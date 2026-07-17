// netlify/functions/migrate-jobsheets-to-firestore.js
//
// ONE-TIME backfill. Jobsheets saved before Firestore dual-write existed
// for this feature only ever landed in the legacy jobsheet-{jobId}.json
// file in each job's Drive folder — Firestore never got a copy. The
// jobsheet UI itself doesn't notice, because it loads Firestore-first
// with a Drive fallback, so it quietly finds the data in Drive and looks
// fine. Anything that reads straight from Firestore with no fallback —
// like the kanban "Awaiting Parts" table — sees nothing for those jobs.
//
// This checks every job with a Drive folder; for any whose Firestore
// jobsheet doc has no parts/order numbers, it pulls the real jobsheet
// JSON from Drive (via Apps Script's existing loadJobSheet action) and
// copies it into Firestore. Jobs that already have Firestore data are
// skipped, so this is safe to re-run — if it times out partway through,
// or there are more jobs left than fit in one run, just hit the URL
// again to keep going.
//
// Visit (or curl):
//   https://YOUR-SITE.netlify.app/.netlify/functions/migrate-jobsheets-to-firestore?confirm=yes
//
// Without ?confirm=yes it lists what it WOULD do and does nothing.
// Processes at most 15 jobs per call — sequential, not parallel, since
// this goes through Apps Script per job and its concurrent execution
// limit is real. DELETE THIS FILE once a run reports 0 remaining.

const { db } = require('./firebase');

const BATCH_SIZE = 15;

exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  const dryRun = params.confirm !== 'yes';
  const { APPS_SCRIPT_URL } = process.env;

  if (!APPS_SCRIPT_URL) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'APPS_SCRIPT_URL not configured' }) };
  }

  try {
    const jobsSnap = await db.collection('jobs').get();
    const allJobs = jobsSnap.docs
      .map(d => ({ id: d.id, driveFolder: d.data().driveFolder }))
      .filter(j => j.driveFolder);

    // Skip anything Firestore already has real parts/order data for —
    // either already migrated, or genuinely never had any parts needed.
    const needsCheck = [];
    for (const j of allJobs) {
      const snap = await db.collection('jobs').doc(j.id).collection('jobsheet').doc('current').get();
      const d = snap.exists ? snap.data() : {};
      const hasPartsData = (d.parts && d.parts.length) || (d.orderNums && d.orderNums.length);
      if (!hasPartsData) needsCheck.push(j);
    }

    const toProcess = needsCheck.slice(0, BATCH_SIZE);

    if (dryRun) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          message: 'Dry run — add ?confirm=yes to actually migrate. Pulls each job\'s Drive jobsheet JSON and copies it into Firestore, but only for jobs where Firestore has no parts/order number data yet.',
          remainingToCheck: needsCheck.length,
          wouldProcessThisRun: toProcess.map(j => j.id),
        }, null, 2),
      };
    }

    let migrated = 0, noFile = 0, failed = 0;
    const details = [];

    for (const j of toProcess) {
      try {
        const r = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'loadJobSheet', jobId: j.id, driveFolder: j.driveFolder }),
        });
        const json = JSON.parse(await r.text());
        if (json.result === 'ok' && json.data) {
          await db.collection('jobs').doc(j.id).collection('jobsheet').doc('current').set({
            ...json.data,
            _migratedFromDrive: new Date().toISOString(),
          }, { merge: true });
          migrated++;
          details.push(`${j.id}: migrated (${(json.data.parts || []).length} parts, ${(json.data.orderNums || []).length} order numbers)`);
        } else {
          noFile++;
          details.push(`${j.id}: no Drive jobsheet file found — nothing to migrate`);
        }
      } catch (e) {
        failed++;
        details.push(`${j.id}: ERROR ${e.message}`);
      }
    }

    console.log('migrate-jobsheets-to-firestore:\n' + details.join('\n'));

    const remaining = needsCheck.length - toProcess.length;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        migrated, noFile, failed,
        remainingAfterThisRun: remaining,
        note: remaining > 0 ? 'More jobs still to check — hit this URL again to continue.' : 'All caught up.',
        details,
      }, null, 2),
    };
  } catch (err) {
    console.error('migrate-jobsheets-to-firestore error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
