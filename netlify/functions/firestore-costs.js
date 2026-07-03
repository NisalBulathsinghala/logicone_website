// netlify/functions/firestore-costs.js
// Stores/reads the repair-level cost reference (normally costs.json on
// Drive) in Firestore too, so the dashboard can read it without an Apps
// Script round trip.
//
// Drive stays the file Nisal actually edits — nothing changes about that
// workflow. This just gets kept in sync automatically: every time
// jsLoadCosts() / loadRepairLevelCosts() successfully reads costs.json
// from Drive, it pushes the result here in the background. First job
// opened (or invoice export run) after deploy seeds Firestore on its own —
// no manual migration needed.
//
// Actions:
//   save — write the costs.json content to Firestore (config/costs)
//   load — read it back

const { db } = require('./firebase');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }; }

  const { action } = body;
  const ref = db.collection('config').doc('costs');

  try {
    if (action === 'save') {
      const data = body.data;
      if (!data) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing data' }) };
      await ref.set(Object.assign({}, data, { _syncedAt: new Date().toISOString() }), { merge: true });
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'load') {
      const snap = await ref.get();
      if (!snap.exists) return { statusCode: 200, body: JSON.stringify({ ok: false, notFound: true }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: snap.data() }) };
    }

    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown action: ' + action }) };
  } catch (err) {
    console.error('firestore-costs error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
