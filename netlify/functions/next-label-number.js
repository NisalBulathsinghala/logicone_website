/* ============================================================
   Logic One SA — next-label-number
   ------------------------------------------------------------
   Hands out the short number that goes on parts labels (see
   label-module.js) — just enough to tell "these labels belong
   together" apart from every other job's, nothing else. No job
   ID, no customer info; the receipt tag is the record for that.

   Two Firestore docs do the work:
     counters/labelSequence   { quarterKey, value }
       — the running count for the CURRENT calendar quarter only.
         Rolls back to 1 the first time this runs in a new quarter,
         so numbers cycle every 3 months instead of growing forever.
     labelNumbers/{jobId}     { number, quarterKey, assignedAt }
       — one per job, written once. If a job already has a number,
         that same number is returned again — so re-printing labels
         (a misprint, a second part found later, etc.) never hands
         out a second number for a job already on the shelf.

   Number format: "26Q3-001" (2-digit year, calendar quarter, then
   a 3+ digit sequence that resets to 001 each quarter — padStart
   doesn't truncate, so it just grows past 3 digits if a quarter
   ever sees 1000+ jobs).

   Quarter boundaries used here are plain calendar quarters
   (Jan-Mar / Apr-Jun / Jul-Sep / Oct-Dec), not your BAS/FY quarters
   (Jul-Jun) — say the word if you'd rather it follow the same
   Jul-start quarters as your BAS reporting, it's a one-line change.

   ── IMPORTANT ─────────────────────────────────────────────────
   This function initialises firebase-admin itself, with the env
   var names Logic One's other Firestore-backed functions are
   assumed to use (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
   FIREBASE_PRIVATE_KEY). If your existing functions (e.g. whatever
   writes jobs/{jobId}/jobsheet/partsOrders) initialise firebase-admin
   a different way — a shared helper file, different env var names,
   applicationDefault(), etc. — paste one of those in and this
   should be changed to match it exactly rather than run its own
   separate init.
   ============================================================ */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:  process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
db.settings({ databaseId: '(default)' }); // change if using a named DB — see australia-southeast1 setup

function currentQuarterKey(d) {
  d = d || new Date();
  const q = Math.floor(d.getMonth() / 3) + 1; // 1-4, calendar quarters
  return `${d.getFullYear()}Q${q}`;
}

function formatNumber(quarterKey, value) {
  const m = quarterKey.match(/^(\d{4})Q(\d)$/);
  const yy = m ? m[1].slice(2) : '00';
  const q  = m ? m[2] : '0';
  return `${yy}Q${q}-${String(value).padStart(3, '0')}`;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  let jobId;
  try {
    jobId = (JSON.parse(event.body || '{}').jobId || '').trim();
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON body' }) };
  }
  if (!jobId) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'jobId is required' }) };
  }

  try {
    const jobRef     = db.collection('labelNumbers').doc(jobId);
    const counterRef = db.collection('counters').doc('labelSequence');

    const number = await db.runTransaction(async (tx) => {
      // Reprint case: this job already has a number — hand back the same
      // one, don't touch the counter.
      const jobSnap = await tx.get(jobRef);
      if (jobSnap.exists && jobSnap.data().number) {
        return jobSnap.data().number;
      }

      // First print for this job — advance the quarter counter.
      const qKey = currentQuarterKey();
      const counterSnap = await tx.get(counterRef);
      let value = 1;
      if (counterSnap.exists && counterSnap.data().quarterKey === qKey) {
        value = (counterSnap.data().value || 0) + 1;
      }
      // else: no doc yet, or it's a stale quarter — value stays 1 (reset)

      const formatted = formatNumber(qKey, value);

      tx.set(counterRef, {
        quarterKey: qKey,
        value,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(jobRef, {
        number: formatted,
        quarterKey: qKey,
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return formatted;
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, data: { number } }),
    };
  } catch (err) {
    console.error('next-label-number error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
