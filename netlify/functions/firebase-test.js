// netlify/functions/firebase-test.js
// Temporary test endpoint — DELETE after confirming Firebase works.
// Visit: https://logicone.com.au/.netlify/functions/firebase-test

const { db } = require('./firebase');

exports.handler = async function () {
  try {
    // Write a test document
    const ref  = db.collection('_test').doc('connection');
    await ref.set({ ok: true, ts: new Date().toISOString() });

    // Read it back
    const snap = await ref.get();
    const data = snap.data();

    // Clean up
    await ref.delete();

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: 'Firebase connected successfully', data }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
