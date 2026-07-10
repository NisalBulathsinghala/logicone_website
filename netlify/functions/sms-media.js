// netlify/functions/sms-media.js
//
// Stores images for MMS in Firestore and serves them back over a plain,
// public URL. This exists because of two separate constraints:
//   - Sending an MMS: Twilio needs a URL it can fetch the image FROM —
//     it doesn't accept raw bytes in the send request.
//   - Receiving an MMS: Twilio's own media URLs require Basic Auth
//     (Account SID + Auth Token) to fetch, so a plain <img src="..."> in
//     the browser can't load them directly.
// This function solves both the same way: images always end up stored
// here, and always get served back through this same public GET endpoint.
// For inbound MMS, sms-receive.js downloads the image from Twilio
// server-side (where it has the auth token) and re-uploads it here.
//
// Actions:
//   POST { action: 'store', dataUrl } — store an image, returns { id, url }
//   GET  ?id=XXX                       — serve the image bytes directly
//
// Firestore has a 1MiB per-document limit, so images should be resized
// client-side before upload — see jsResizeImageForMms() in dashboard.js.

const { db } = require('./firebase');

exports.handler = async function (event) {
  // ── Serve an image ──────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const id = (event.queryStringParameters || {}).id;
    if (!id) return { statusCode: 400, body: 'Missing id' };

    try {
      const snap = await db.collection('smsMedia').doc(id).get();
      if (!snap.exists) return { statusCode: 404, body: 'Not found' };

      const data = snap.data();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': data.contentType || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
        body: data.base64,
        isBase64Encoded: true,
      };
    } catch (err) {
      console.error('sms-media serve error:', err);
      return { statusCode: 500, body: 'Error serving image' };
    }
  }

  // ── Store an image ──────────────────────────────────────────
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }; }

  if (body.action !== 'store' || !body.dataUrl) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing dataUrl' }) };
  }

  try {
    const match = /^data:([^;]+);base64,(.+)$/.exec(body.dataUrl);
    if (!match) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'dataUrl must be a base64 data URL' }) };
    }
    const contentType = match[1];
    const base64 = match[2];

    // Roughly 1MiB Firestore limit, leave headroom for the rest of the doc
    const approxBytes = base64.length * 0.75;
    if (approxBytes > 900000) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Image too large after resize — try a smaller photo' }) };
    }

    const id = db.collection('smsMedia').doc().id;
    await db.collection('smsMedia').doc(id).set({
      base64,
      contentType,
      createdAt: new Date().toISOString(),
    });

    const host = (event.headers['x-forwarded-proto'] || 'https') + '://' + (event.headers['x-forwarded-host'] || event.headers.host || '');
    const url = `${host}/.netlify/functions/sms-media?id=${id}`;

    return { statusCode: 200, body: JSON.stringify({ ok: true, id, url }) };
  } catch (err) {
    console.error('sms-media store error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
