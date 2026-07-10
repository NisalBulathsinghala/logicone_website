// netlify/functions/firestore-sms.js
// Handles all Firestore SMS operations.
//
// This is the main SMS dashboard for the business number, so conversations
// are keyed by PHONE NUMBER (E.164, e.g. +61466697696) — NOT job ID. Every
// number that texts in or gets texted shows up as a conversation. jobId /
// customerName are optional metadata attached when a job happens to match,
// never a requirement for the conversation to exist.
//
// Actions (POST):
//   log-inbound    — save inbound message + update index (keyed by phone)
//   log-outbound   — save outbound message + update index (keyed by phone)
//   load-inbox     — load conversation index (sorted, paginated)
//   load-thread    — load full message thread for a phone number
//   mark-read      — set unread count to 0 for a phone number

const { db } = require('./firebase');

function normalisePhone(raw) {
  if (!raw) return null;
  let n = String(raw).replace(/[\s\-().]/g, '');
  if (n.startsWith('+61')) return n;
  if (n.startsWith('0061')) return '+61' + n.slice(4);
  if (n.startsWith('61') && n.length === 11) return '+' + n;
  if (n.startsWith('0') && n.length === 10) return '+61' + n.slice(1);
  if (n.startsWith('+')) return n;
  return n; // last resort — store whatever we got rather than drop the message
}

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
      const { jobId, customerName, phone, from, msgBody, mediaUrl, msgSid, timestamp } = body;
      const key = normalisePhone(phone || from);
      if (!key) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing phone' }) };

      const msg = {
        direction:  'in',
        from:       from || phone,
        body:       msgBody || '',
        mediaUrl:   mediaUrl || null,
        msgSid:     msgSid || '',
        timestamp:  timestamp || new Date().toISOString(),
        jobId:      jobId || null,
      };

      await db.collection('sms').doc(key)
        .collection('messages').add(msg);

      const indexRef = db.collection('sms').doc('_index')
        .collection('conversations').doc(key);
      const snap = await indexRef.get();
      const existing = snap.exists ? snap.data() : {};
      await indexRef.set({
        phone:        key,
        // Only overwrite jobId/customerName if this message actually matched
        // one — a transient lookup miss on one message shouldn't erase a
        // link a previous message already established.
        jobId:        jobId || existing.jobId || null,
        customerName: customerName || existing.customerName || '',
        unread:       (existing.unread || 0) + 1,
        lastMessageAt:        msg.timestamp,
        lastMessageBody:      mediaUrl ? '📷 Image' : (msgBody || '').slice(0, 100),
        lastMessageDirection: 'in',
      }, { merge: true });

      return { statusCode: 200, body: JSON.stringify({ ok: true, phone: key, jobId: jobId || null }) };
    }

    // ── Log outbound message ──────────────────────────────────
    if (action === 'log-outbound') {
      const { jobId, customerName, phone, to, msgBody, mediaUrl, msgSid, timestamp } = body;
      const key = normalisePhone(phone || to);
      if (!key) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing phone' }) };

      const msg = {
        direction: 'out',
        to:        to || phone,
        body:      msgBody || '',
        mediaUrl:  mediaUrl || null,
        msgSid:    msgSid || '',
        timestamp: timestamp || new Date().toISOString(),
        jobId:     jobId || null,
        read:      true,
      };

      await db.collection('sms').doc(key)
        .collection('messages').add(msg);

      const indexRef = db.collection('sms').doc('_index')
        .collection('conversations').doc(key);
      const snap = await indexRef.get();
      const existing = snap.exists ? snap.data() : {};
      await indexRef.set({
        phone:        key,
        jobId:        jobId || existing.jobId || null,
        customerName: customerName || existing.customerName || '',
        unread:       existing.unread || 0,
        lastMessageAt:        msg.timestamp,
        lastMessageBody:      mediaUrl ? '📷 Image' : (msgBody || '').slice(0, 100),
        lastMessageDirection: 'out',
      }, { merge: true });

      return { statusCode: 200, body: JSON.stringify({ ok: true, phone: key }) };
    }

    // ── Load inbox (conversation index) ──────────────────────
    if (action === 'load-inbox') {
      const snap = await db.collection('sms').doc('_index')
        .collection('conversations').get();

      // Conversations are keyed by phone (always starts with '+' once
      // normalised). Old jobId-keyed docs from before the phone-keyed
      // migration (e.g. "LO-260702-006") are left in place on purpose —
      // migration doesn't delete anything — but they're not real
      // conversations anymore, just inert leftovers, so skip them here.
      const convs = snap.docs
        .filter(d => d.id.startsWith('+'))
        .map(d => d.data())
        .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

      return { statusCode: 200, body: JSON.stringify({ ok: true, data: { conversations: convs, total: convs.length } }) };
    }

    // ── Load thread for a phone number ────────────────────────
    if (action === 'load-thread') {
      // Accept jobId too, for any caller that hasn't been updated yet —
      // but phone is the real key from here on.
      const key = normalisePhone(body.phone) || body.phone || body.jobId;
      if (!key) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing phone' }) };

      const snap = await db.collection('sms').doc(key)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .get();

      const messages = snap.docs.map(d => d.data());
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: messages }) };
    }

    // ── Mark conversation as read ─────────────────────────────
    if (action === 'mark-read') {
      const key = normalisePhone(body.phone) || body.phone || body.jobId;
      if (!key) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing phone' }) };

      const ref  = db.collection('sms').doc('_index').collection('conversations').doc(key);
      const snap = await ref.get();
      if (!snap.exists) {
        // Nothing to mark read. This gets called every time a jobsheet's
        // Communications tab opens, for every job, whether or not that
        // phone number has ever actually exchanged an SMS — a blind
        // set(merge:true) here would create an empty conversation entry
        // out of thin air for every job with no SMS history.
        return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };
      }

      await ref.set({ unread: 0 }, { merge: true });

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown action: ' + action }) };

  } catch (err) {
    console.error('firestore-sms error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
