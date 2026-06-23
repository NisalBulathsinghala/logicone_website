// netlify/functions/firestore-sms.js
// Handles all Firestore SMS operations.
//
// Actions (POST):
//   log-inbound    — save inbound message + update index
//   log-outbound   — save outbound message + update index
//   load-inbox     — load conversation index (sorted, paginated)
//   load-thread    — load full message thread for a job
//   mark-read      — set unread count to 0 for a job

const { db } = require('./firebase');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }; }

  const { action } = body;

  try {

    // ── Log inbound message ───────────────────────────────────
    if (action === 'log-inbound') {
      const { jobId, customerName, phone, from, msgBody, msgSid, timestamp } = body;

      const msg = {
        direction:  'in',
        from:       from || phone,
        body:       msgBody,
        msgSid:     msgSid || '',
        timestamp:  timestamp || new Date().toISOString(),
        jobId:      jobId || null,
      };

      // Write message to thread (if job matched)
      if (jobId) {
        await db.collection('sms').doc(jobId)
          .collection('messages').add(msg);

        // Update index entry
        const indexRef = db.collection('sms').doc('_index')
          .collection('conversations').doc(jobId);
        const snap = await indexRef.get();
        const existing = snap.exists ? snap.data() : {};
        await indexRef.set({
          jobId,
          customerName: customerName || existing.customerName || '',
          phone:        phone        || existing.phone        || '',
          unread:       (existing.unread || 0) + 1,
          lastMessageAt:        msg.timestamp,
          lastMessageBody:      (msgBody || '').slice(0, 100),
          lastMessageDirection: 'in',
        });
      } else {
        // No job match — log to unmatched collection
        await db.collection('sms').doc('_unmatched')
          .collection('messages').add(msg);
      }

      return { statusCode: 200, body: JSON.stringify({ ok: true, jobId: jobId || null }) };
    }

    // ── Log outbound message ──────────────────────────────────
    if (action === 'log-outbound') {
      const { jobId, customerName, phone, to, msgBody, msgSid, timestamp } = body;
      if (!jobId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing jobId' }) };

      const msg = {
        direction: 'out',
        to:        to || phone,
        body:      msgBody,
        msgSid:    msgSid || '',
        timestamp: timestamp || new Date().toISOString(),
        jobId,
        read: true,
      };

      await db.collection('sms').doc(jobId)
        .collection('messages').add(msg);

      // Update index entry (outbound — don't increment unread)
      const indexRef = db.collection('sms').doc('_index')
        .collection('conversations').doc(jobId);
      const snap = await indexRef.get();
      const existing = snap.exists ? snap.data() : {};
      await indexRef.set({
        jobId,
        customerName: customerName || existing.customerName || '',
        phone:        phone || to  || existing.phone        || '',
        unread:       existing.unread || 0,
        lastMessageAt:        msg.timestamp,
        lastMessageBody:      (msgBody || '').slice(0, 100),
        lastMessageDirection: 'out',
      });

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // ── Load inbox (conversation index) ──────────────────────
    if (action === 'load-inbox') {
      const snap = await db.collection('sms').doc('_index')
        .collection('conversations').get();

      const convs = snap.docs.map(d => d.data())
        .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

      return { statusCode: 200, body: JSON.stringify({ ok: true, data: { conversations: convs, total: convs.length } }) };
    }

    // ── Load thread for a job ─────────────────────────────────
    if (action === 'load-thread') {
      const { jobId } = body;
      if (!jobId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing jobId' }) };

      const snap = await db.collection('sms').doc(jobId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .get();

      const messages = snap.docs.map(d => d.data());
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: messages }) };
    }

    // ── Mark conversation as read ─────────────────────────────
    if (action === 'mark-read') {
      const { jobId } = body;
      if (!jobId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing jobId' }) };

      await db.collection('sms').doc('_index')
        .collection('conversations').doc(jobId)
        .set({ unread: 0 }, { merge: true });

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown action: ' + action }) };

  } catch (err) {
    console.error('firestore-sms error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
