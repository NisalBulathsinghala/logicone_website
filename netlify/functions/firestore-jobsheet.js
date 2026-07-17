// netlify/functions/firestore-jobsheet.js
// Handles Firestore read/write for jobsheets AND core job records.
// Called directly from the dashboard — bypasses Apps Script entirely.
//
// Actions:
//   save-records-batch    — write/merge many job records at once (jobs/{jobId})
//   load-sms-status-batch — read smsSentTemplates for every job at once
//   save   — write jobsheet data to Firestore (jobs/{jobId}/jobsheet/current)
//   load   — read jobsheet data from Firestore
//   timestamps-save — write status timestamps
//   timestamps-load — read status timestamps
//   mark-sms-sent   — record that a named SMS template was sent for a job

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
    // ── Batch-sync job records (core fields from the Sheet, not jobsheet) ──
    // Used by the dashboard's fetchSheet() to push every job into Firestore
    // on every load — this is what backfills existing jobs and keeps new
    // ones in sync, without needing an Apps Script change.
    if (action === 'save-records-batch') {
      const records = Array.isArray(body.records) ? body.records.filter(r => r && r.jobId) : [];
      if (!records.length) {
        return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing records' }) };
      }
      const syncedAt = new Date().toISOString();
      // Firestore batches cap at 500 writes — chunk just in case job count grows
      const CHUNK = 450;
      let written = 0;
      for (let i = 0; i < records.length; i += CHUNK) {
        const batch = db.batch();
        records.slice(i, i + CHUNK).forEach(rec => {
          const ref = db.collection('jobs').doc(rec.jobId);
          batch.set(ref, Object.assign({}, rec, { _syncedAt: syncedAt }), { merge: true });
        });
        await batch.commit();
        written += Math.min(CHUNK, records.length - i);
      }
      console.log(`Firestore: batch-synced ${written} job records`);
      return { statusCode: 200, body: JSON.stringify({ ok: true, count: written }) };
    }

    // ── Batch-read SMS-sent status for every job ──────────────────
    // Returns { [jobId]: { "Received": "2026-07-01T...", "Parts Ordered": "..." } }
    // for every job that has sent at least one template. Called once per
    // dashboard load so kanban cards can show sent/not-sent without a
    // per-job round trip.
    if (action === 'load-sms-status-batch') {
      const snap = await db.collection('jobs').get();
      const result = {};
      snap.forEach(doc => {
        const data = doc.data();
        if (data.smsSentTemplates) result[doc.id] = data.smsSentTemplates;
      });
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: result }) };
    }

    // ── Batch-read parts + order numbers for a set of jobs ─────────
    // Powers the kanban "Awaiting Parts" tile table — one call for every
    // job in that status instead of one request per job. Missing/unread
    // jobsheets are just skipped rather than failing the whole batch.
    if (action === 'load-parts-batch') {
      const jobIds = Array.isArray(body.jobIds) ? body.jobIds.filter(Boolean) : [];
      if (!jobIds.length) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing jobIds' }) };

      const result = {};
      await Promise.all(jobIds.map(async (id) => {
        try {
          const snap = await db.collection('jobs').doc(id).collection('jobsheet').doc('current').get();
          if (snap.exists) {
            const d = snap.data();
            result[id] = { parts: d.parts || [], orderNums: d.orderNums || [] };
          }
        } catch (e) {
          console.warn(`load-parts-batch: skipped ${id}:`, e.message);
        }
      }));
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: result }) };
    }

    // Every action below operates on one job and needs a jobId
    const { jobId } = body;
    if (!jobId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing jobId' }) };
    const jobRef = db.collection('jobs').doc(jobId);

    // ── Mark an SMS template as sent for this job ─────────────────
    if (action === 'mark-sms-sent') {
      const template = body.template;
      if (!template) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing template' }) };
      const sentAt = body.sentAt || new Date().toISOString();
      // merge:true recurses into nested maps, so this only touches this
      // one key inside smsSentTemplates — every other template's sent
      // status (and every other job field) is left alone.
      await jobRef.set({ smsSentTemplates: { [template]: sentAt } }, { merge: true });
      console.log(`Firestore: marked "${template}" sent for ${jobId}`);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

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
