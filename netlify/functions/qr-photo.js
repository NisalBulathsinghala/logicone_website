// netlify/functions/qr-photo.js
//
// Backs the "scan to upload from phone" QR code in the job sheet.
//
// The QR code encodes a link like /photo-upload.html?job=LO-260710-001&t=xxxx
// — that page is deliberately NOT behind the lo_authed cookie wall, so it
// opens straight into the camera on a phone that's never logged into the
// dashboard. Everything sensitive stays server-side:
//   - the Apps Script URL (cfg.appsScriptUrl) is never sent to that page
//   - the token is a random value stored in Firestore, not something a
//     phone (or anyone else) could derive from the job ID alone
//
// Actions:
//   mint   — dashboard (authenticated) asks for this job's token. Reuses
//            the existing one if already minted, so the QR code stays
//            stable for the life of the job (fine to screenshot or leave
//            pinned on a phone across multiple visits to the workbench).
//   verify — the public upload page presents {jobId, token}. On a match,
//            this fetches a real (short-lived) Drive upload token from
//            Apps Script server-side and returns it, along with basic
//            job info for the page header.
//
// Worst case if a token ever leaked: someone could upload extra photos
// to that one job's Inspection/Testing/Shipping folders — no read access,
// no access to any other job, no access to the rest of the dashboard.

const crypto = require('crypto');
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
    // ── Mint (or reuse) a token for this job ─────────────────
    if (action === 'mint') {
      const snap = await jobRef.get();
      const existing = snap.exists ? snap.data().qrToken : null;
      if (existing) {
        return { statusCode: 200, body: JSON.stringify({ ok: true, token: existing }) };
      }
      const token = crypto.randomBytes(16).toString('hex');
      await jobRef.set({ qrToken: token }, { merge: true });
      console.log(`qr-photo: minted token for ${jobId}`);
      return { statusCode: 200, body: JSON.stringify({ ok: true, token }) };
    }

    // ── Clear a job's token (e.g. once the job is Collected) ──
    if (action === 'clear') {
      await jobRef.set({ qrToken: null }, { merge: true });
      console.log(`qr-photo: cleared token for ${jobId}`);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // ── Verify a token, then issue a real Drive upload token ──
    if (action === 'verify') {
      const { token } = body;
      if (!token) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing token' }) };

      const snap = await jobRef.get();
      if (!snap.exists) {
        return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Invalid or expired link' }) };
      }
      const data = snap.data();
      const stored = data.qrToken;
      const driveFolder = data.driveFolder;

      if (!stored || !driveFolder) {
        return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Invalid or expired link' }) };
      }

      const given = Buffer.from(String(token));
      const want  = Buffer.from(String(stored));
      if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
        return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Invalid or expired link' }) };
      }

      // Verified — fetch a real, short-lived Drive upload token server-side.
      // The upload page never sees the Apps Script URL, only this response.
      const { APPS_SCRIPT_URL } = process.env;
      if (!APPS_SCRIPT_URL) {
        return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server not configured (APPS_SCRIPT_URL)' }) };
      }
      const r = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getUploadToken', driveFolder }),
      });
      const rawText = await r.text();
      let asJson;
      try {
        asJson = JSON.parse(rawText);
      } catch {
        console.error('qr-photo: Apps Script returned non-JSON:', rawText.slice(0, 200));
        return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Apps Script returned an unexpected response' }) };
      }
      if (asJson.result !== 'ok') {
        return { statusCode: 200, body: JSON.stringify({ ok: false, error: asJson.msg || 'Apps Script error' }) };
      }

      console.log(`qr-photo: verified + issued upload token for ${jobId}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          data: asJson.data, // { token, stageFolderIds }
          job: { jobId, name: data.name || '', brand: data.brand || '', model: data.model || '' },
        }),
      };
    }

    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown action: ' + action }) };

  } catch (err) {
    console.error('qr-photo error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
