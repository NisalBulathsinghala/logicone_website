// migrate-sms-to-phone-keyed.js
// One-time migration: copies existing SMS conversations from the old
// jobId-keyed structure (sms/_index/conversations/{jobId}) to the new
// phone-keyed structure (sms/_index/conversations/{phone}) that
// firestore-sms.js now reads and writes.
//
// Also recovers messages that were previously invisible: _unmatched
// (inbound, no job matched at the time) and _unlinked (outbound, no jobId
// given) both get merged into the correct phone-keyed thread instead of
// sitting in a bucket nothing ever reads.
//
// SAFE TO RE-RUN: message docs keep their original IDs and every write
// uses merge, so running this twice won't duplicate anything.
// NON-DESTRUCTIVE: nothing is deleted from the old structure. Once you've
// checked the dashboard and you're happy, you can manually delete the old
// sms/{jobId}/... docs and the sms/_unmatched, sms/_unlinked collections.
//
// Run locally with the same three env vars Netlify already has set for
// the live functions (copy them from Netlify's dashboard):
//
//   FIREBASE_PROJECT_ID=xxx FIREBASE_CLIENT_EMAIL=xxx FIREBASE_PRIVATE_KEY=xxx \
//     node migrate-sms-to-phone-keyed.js
//
// Or point it at a service account JSON file instead:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node migrate-sms-to-phone-keyed.js

const admin = require('firebase-admin');

if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } else {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
}
const db = admin.firestore();

function normalisePhone(raw) {
  if (!raw) return null;
  let n = String(raw).replace(/[\s\-().]/g, '');
  if (n.startsWith('+61')) return n;
  if (n.startsWith('0061')) return '+61' + n.slice(4);
  if (n.startsWith('61') && n.length === 11) return '+' + n;
  if (n.startsWith('0') && n.length === 10) return '+61' + n.slice(1);
  if (n.startsWith('+')) return n;
  return n;
}

function laterOf(a, b) {
  if (!a) return b || '';
  if (!b) return a || '';
  return new Date(a) > new Date(b) ? a : b;
}

// ── Step 1: existing job-linked conversations ────────────────────────
async function migrateConversation(oldJobId, convData) {
  const phone = normalisePhone(convData.phone);
  if (!phone) {
    console.warn(`  SKIP ${oldJobId}: no usable phone field on the conversation`);
    return { ok: false, msgCount: 0 };
  }

  const indexRef  = db.collection('sms').doc('_index').collection('conversations').doc(phone);
  const existing  = (await indexRef.get()).data() || {};
  await indexRef.set({
    phone,
    jobId:                convData.jobId || oldJobId || existing.jobId || null,
    customerName:         convData.customerName || existing.customerName || '',
    unread:                Math.max(convData.unread || 0, existing.unread || 0),
    lastMessageAt:         laterOf(convData.lastMessageAt, existing.lastMessageAt),
    lastMessageBody:       convData.lastMessageBody || existing.lastMessageBody || '',
    lastMessageDirection:  convData.lastMessageDirection || existing.lastMessageDirection || '',
  }, { merge: true });

  const msgsSnap = await db.collection('sms').doc(oldJobId).collection('messages').get();
  let n = 0;
  for (const doc of msgsSnap.docs) {
    const data = doc.data();
    if (!data.jobId) data.jobId = convData.jobId || oldJobId; // backfill for old rows
    await db.collection('sms').doc(phone).collection('messages').doc(doc.id).set(data, { merge: true });
    n++;
  }
  return { ok: true, msgCount: n };
}

// ── Steps 2 & 3: recover _unmatched / _unlinked messages ─────────────
async function migrateOrphanBucket(bucketName) {
  const snap = await db.collection('sms').doc(bucketName).collection('messages').get();
  let migrated = 0, skipped = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const rawPhone = data.direction === 'out' ? (data.to || data.phone) : (data.from || data.phone);
    const phone = normalisePhone(rawPhone);
    if (!phone) { skipped++; continue; }

    await db.collection('sms').doc(phone).collection('messages').doc(doc.id).set(data, { merge: true });

    const indexRef = db.collection('sms').doc('_index').collection('conversations').doc(phone);
    const existing = (await indexRef.get()).data() || {};
    await indexRef.set({
      phone,
      jobId:                data.jobId || existing.jobId || null,
      customerName:         existing.customerName || '',
      unread:                existing.unread || (data.direction === 'in' ? 1 : 0),
      lastMessageAt:         laterOf(data.timestamp, existing.lastMessageAt),
      lastMessageBody:       existing.lastMessageBody || (data.body || '').slice(0, 100),
      lastMessageDirection:  existing.lastMessageDirection || data.direction || '',
    }, { merge: true });
    migrated++;
  }
  return { migrated, skipped };
}

async function main() {
  console.log('Migrating SMS conversations from jobId-keyed to phone-keyed...\n');

  console.log('Step 1: existing job-linked conversations');
  const convSnap = await db.collection('sms').doc('_index').collection('conversations').get();
  let convOk = 0, convSkipped = 0, totalMsgs = 0;
  for (const doc of convSnap.docs) {
    const result = await migrateConversation(doc.id, doc.data());
    if (result.ok) {
      convOk++; totalMsgs += result.msgCount;
      console.log(`  \u2713 ${doc.id} \u2192 ${doc.data().phone} (${result.msgCount} messages)`);
    } else {
      convSkipped++;
    }
  }
  console.log(`Done: ${convOk} conversations migrated, ${convSkipped} skipped, ${totalMsgs} messages copied.\n`);

  console.log('Step 2: previously-invisible unmatched inbound messages');
  const um = await migrateOrphanBucket('_unmatched');
  console.log(`Done: ${um.migrated} migrated, ${um.skipped} skipped (no usable phone).\n`);

  console.log('Step 3: previously-invisible unlinked outbound messages');
  const ul = await migrateOrphanBucket('_unlinked');
  console.log(`Done: ${ul.migrated} migrated, ${ul.skipped} skipped (no usable phone).\n`);

  console.log('Migration complete. Old data was NOT deleted \u2014 check the dashboard,');
  console.log('then clean up sms/{oldJobId}, sms/_unmatched, sms/_unlinked manually once you\'re happy.');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
