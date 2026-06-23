// netlify/functions/firestore-jobsheet.js
// Handles Firestore read/write for jobsheets.
// Called directly from the dashboard — bypasses Apps Script entirely.
//
// Actions:
//   save   — write jobsheet data to Firestore
//   load   — read jobsheet data from Firestore
//   timestamps-save — write status timestamps
//   timestamps-load — read status timestamps

const { db } = require('./firebase');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }; }

  const { action, jobId } = body;
  if (!jobId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing jobId' }) };

  const jobRef = db.collection('jobs').doc(jobId);

  try {
    // ── Save jobsheet ─────────────────────────────────────────
    if (action === 'save') {
      const data = body.data;
      if (!data) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing data' }) };
      await jobRef.collection('jobsheet').doc('current').set({
        ...data,
        _savedAt:  new Date().toISOString(),
        _source:   'dashboard',
      });
      console.log(`Firestore: saved jobsheet for ${jobId}`);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // ── Load jobsheet ─────────────────────────────────────────
    if (action === 'load') {
      const snap = await jobRef.collection('jobsheet').doc('current').get();
      if (!snap.exists) {
        return { statusCode: 200, body: JSON.stringify({ ok: false, notFound: true }) };
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: snap.data() }) };
    }

    // ── Save timestamps ───────────────────────────────────────
    if (action === 'timestamps-save') {
      const timestamps = body.timestamps;
      if (!timestamps) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing timestamps' }) };
      // Merge with existing so we never lose a timestamp
      await jobRef.collection('jobsheet').doc('timestamps').set(timestamps, { merge: true });
      console.log(`Firestore: saved timestamps for ${jobId}`);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // ── Load timestamps ───────────────────────────────────────
    if (action === 'timestamps-load') {
      const snap = await jobRef.collection('jobsheet').doc('timestamps').get();
      if (!snap.exists) {
        return { statusCode: 200, body: JSON.stringify({ ok: false, notFound: true }) };
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: snap.data() }) };
    }

    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown action: ' + action }) };

  } catch (err) {
    console.error('firestore-jobsheet error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
