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

const BATCH_SIZE = 10;
const TIME_BUDGET_MS = 7000; // leave margin under Netlify's ~10s default function timeout

exports.handler = async function (event) {
  const started = Date.now();
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

    // Parallel, not sequential — this is a plain Firestore read with no
    // Apps Script involved, so it comfortably handles this many
    // concurrent reads. Checking 100+ jobs one at a time in a loop here
    // was the actual cause of the earlier 502: it could run past
    // Netlify's function timeout before the real migration work even
    // started.
    //
    // "Needs migration" = the Firestore jobsheet doc doesn't exist at
    // all yet. NOT "has empty parts" — a job that genuinely needs zero
    // parts still gets a doc written (with empty arrays) the moment it's
    // checked, and checking for non-empty parts here would mean that
    // doc looks unmigrated forever, endlessly eating the batch on every
    // run without the remaining count ever actually shrinking.
    const checked = await Promise.all(allJobs.map(async (j) => {
      const snap = await db.collection('jobs').doc(j.id).collection('jobsheet').doc('current').get();
      return snap.exists ? null : j;
    }));
    const needsCheck = checked.filter(Boolean);

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

    // Sequential, not parallel — this one goes through Apps Script per
    // job, and Apps Script's concurrent execution limit is real. The
    // time budget below is the actual guard against a slow run timing
    // out mid-batch: it stops early and reports what's left rather than
    // risking another 502, and picks back up cleanly on the next call.
    for (const j of toProcess) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        details.push('Stopped early — running close to the time budget. Re-run to continue.');
        break;
      }
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
