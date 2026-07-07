// netlify/functions/cleanup-phantom-sms.js
//
// OPTIONAL, one-time cleanup for phantom conversations created by a bug in
// mark-read: opening a jobsheet's Communications tab called mark-read for
// that job's phone number even when no SMS had ever been exchanged, and
// mark-read used to blindly set(merge:true), which creates a document if
// one doesn't exist. That left behind empty conversation entries — no
// phone, no name, no last message — showing up as "Unknown" in the inbox.
// mark-read itself is now fixed to check existence first; this just clears
// out the ones it already created.
//
// A conversation is treated as phantom if it has zero messages in its
// subcollection — a real conversation always has at least one, since
// log-inbound/log-outbound always add a message at the same time they
// touch the index entry.
//
// Visit (or curl):
//   https://YOUR-SITE.netlify.app/.netlify/functions/cleanup-phantom-sms?confirm=yes
//
// Without ?confirm=yes it lists what would be deleted and does nothing.
// DELETE THIS FILE after running it once.

const { db } = require('./firebase');

exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  const dryRun = params.confirm !== 'yes';

  try {
    const snap = await db.collection('sms').doc('_index').collection('conversations').get();
    const candidates = [];

    for (const doc of snap.docs) {
      const data = doc.data() || {};
      // Has a real trace of an actual message — not phantom
      if (data.lastMessageBody || data.customerName || data.jobId || data.lastMessageAt) continue;

      const msgs = await db.collection('sms').doc(doc.id).collection('messages').limit(1).get();
      if (msgs.empty) candidates.push(doc.id);
    }

    if (dryRun) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          message: 'Dry run — add ?confirm=yes to actually delete these. Each has zero messages and no name/phone/job data.',
          wouldDelete: candidates,
          count: candidates.length,
        }, null, 2),
      };
    }

    for (const id of candidates) {
      await db.collection('sms').doc('_index').collection('conversations').doc(id).delete();
    }

    console.log('cleanup-phantom-sms deleted:\n' + candidates.join('\n'));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, deleted: candidates.length, deletedIds: candidates }, null, 2),
    };
  } catch (err) {
    console.error('cleanup-phantom-sms error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
