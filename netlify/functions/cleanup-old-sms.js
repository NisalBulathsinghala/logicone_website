// netlify/functions/cleanup-old-sms.js
//
// OPTIONAL. Run this only after you've deployed the load-inbox fix in
// firestore-sms.js and confirmed the SMS tab looks right — no more
// duplicate rows, every conversation still there.
//
// This DELETES the old jobId-keyed SMS docs (the ones migrate-sms.js left
// behind on purpose): the index entry at sms/_index/conversations/{jobId}
// and the whole sms/{jobId} message tree. Nothing here is needed for the
// dashboard to work correctly — load-inbox already ignores these — this
// is purely tidying up data that's now duplicated in the phone-keyed
// structure. Every message being deleted here has already been copied;
// nothing new is being lost.
//
// Visit (or curl):
//   https://YOUR-SITE.netlify.app/.netlify/functions/cleanup-old-sms?confirm=yes
//
// Without ?confirm=yes it lists what WOULD be deleted and does nothing.
// DELETE THIS FILE after running it once.

const { db } = require('./firebase');

function isPhoneKeyed(id) {
  return id.startsWith('+');
}

exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  const dryRun = params.confirm !== 'yes';

  try {
    const snap = await db.collection('sms').doc('_index').collection('conversations').get();
    const oldDocs = snap.docs.filter(d => !isPhoneKeyed(d.id));

    if (dryRun) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          message: 'Dry run — add ?confirm=yes to actually delete these. Every message in them has already been copied to the phone-keyed structure by migrate-sms.js.',
          wouldDelete: oldDocs.map(d => ({ id: d.id, phone: d.data().phone, customerName: d.data().customerName })),
          count: oldDocs.length,
        }, null, 2),
      };
    }

    let deleted = 0;
    const details = [];
    for (const doc of oldDocs) {
      const oldJobId = doc.id;
      // Delete the whole sms/{oldJobId} tree (doc + messages subcollection)
      await db.recursiveDelete(db.collection('sms').doc(oldJobId));
      // Delete the old index entry
      await doc.ref.delete();
      details.push(oldJobId);
      deleted++;
    }

    console.log('cleanup-old-sms deleted:\n' + details.join('\n'));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        deleted,
        deletedIds: details,
        note: 'Old jobId-keyed SMS docs removed. Phone-keyed conversations and their messages are untouched.',
      }, null, 2),
    };
  } catch (err) {
    console.error('cleanup-old-sms error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
