// netlify/functions/migrate-sms.js
//
// ONE-TIME migration, run through Netlify instead of locally — uses the
// same Firebase credentials every other function already has via ./firebase,
// so there's no local setup, no service account file, no env var copying.
//
// After deploying, visit (or curl):
//   https://YOUR-SITE.netlify.app/.netlify/functions/migrate-sms?confirm=yes
//
// Without ?confirm=yes it just explains itself and does nothing, so an
// accidental visit (or a crawler hitting it) can't trigger a write.
//
// Copies existing SMS conversations from the old jobId-keyed structure to
// the new phone-keyed one, and recovers messages that were previously
// stuck in the _unmatched / _unlinked buckets with no way to see them.
//
// Safe to re-run: every write is a merge, message docs keep their original
// IDs, nothing is ever deleted. If it times out partway through (Netlify
// caps function duration), just hit the URL again — already-migrated
// conversations get harmlessly re-merged, and it'll pick up any that
// didn't finish.
//
// DELETE THIS FILE once you've checked the SMS tab and you're happy with
// the result — same as you'd do with firebase-test.js.

const { db } = require('./firebase');

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

async function migrateConversation(oldJobId, convData, log) {
  const phone = normalisePhone(convData.phone);
  if (!phone) {
    log.push(`SKIP ${oldJobId}: no usable phone field on the conversation`);
    return { ok: false, msgCount: 0 };
  }

  const indexRef = db.collection('sms').doc('_index').collection('conversations').doc(phone);
  const existing = (await indexRef.get()).data() || {};
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
    if (!data.jobId) data.jobId = convData.jobId || oldJobId;
    await db.collection('sms').doc(phone).collection('messages').doc(doc.id).set(data, { merge: true });
    n++;
  }
  log.push(`${oldJobId} -> ${phone} (${n} messages)`);
  return { ok: true, msgCount: n };
}

async function migrateOrphanBucket(bucketName, log) {
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
  log.push(`${bucketName}: ${migrated} migrated, ${skipped} skipped (no usable phone)`);
  return { migrated, skipped };
}

exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  if (params.confirm !== 'yes') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        message: 'Add ?confirm=yes to the URL to actually run the migration. Writes are merge-only and non-destructive — safe, but this does touch real Firestore data, hence the confirm step.',
      }, null, 2),
    };
  }

  const log = [];
  try {
    const convSnap = await db.collection('sms').doc('_index').collection('conversations').get();
    let convOk = 0, convSkipped = 0, totalMsgs = 0;
    for (const doc of convSnap.docs) {
      const result = await migrateConversation(doc.id, doc.data(), log);
      if (result.ok) { convOk++; totalMsgs += result.msgCount; } else { convSkipped++; }
    }

    const unmatched = await migrateOrphanBucket('_unmatched', log);
    const unlinked  = await migrateOrphanBucket('_unlinked', log);

    console.log('migrate-sms full log:\n' + log.join('\n'));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        conversationsMigrated: convOk,
        conversationsSkipped:  convSkipped,
        messagesCopied:        totalMsgs,
        unmatchedRecovered:    unmatched.migrated,
        unmatchedSkipped:      unmatched.skipped,
        unlinkedRecovered:     unlinked.migrated,
        unlinkedSkipped:       unlinked.skipped,
        note: 'Old data was not deleted. Check the SMS tab, then delete this function once you are happy — full per-conversation detail is in the function logs if you want it.',
      }, null, 2),
    };
  } catch (err) {
    console.error('migrate-sms error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message, partialLog: log }),
    };
  }
};
