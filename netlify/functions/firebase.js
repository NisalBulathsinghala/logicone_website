// netlify/functions/firebase.js
// Shared Firebase Admin initializer — imported by all Netlify functions.
// Credentials come from Netlify environment variables set in the dashboard.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  // FIREBASE_PRIVATE_KEY is stored with literal \n in Netlify env vars
  // Replace them with real newlines so the key parses correctly
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = admin.firestore();

module.exports = { admin, db };
