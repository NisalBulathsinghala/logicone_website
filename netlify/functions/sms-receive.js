// netlify/functions/sms-receive.js
// Twilio webhook for inbound SMS.
// Now writes directly to Firestore — no Apps Script, no Drive, no cold starts.
//
// Required env vars:
//   TWILIO_AUTH_TOKEN   — validates webhook is from Twilio
//   SHEETS_ID           — Google Sheet ID for job lookup
//   SHEETS_API_KEY      — Google Sheets API key (read-only)
//   TELEGRAM_BOT_TOKEN  — Telegram bot token
//   TELEGRAM_CHAT_ID    — Telegram chat ID

const crypto = require('crypto');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const {
    TWILIO_AUTH_TOKEN,
    SHEETS_ID,
    SHEETS_API_KEY,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
  } = process.env;

  // Parse Twilio body
  const params = Object.fromEntries(new URLSearchParams(event.body));
  const from   = params.From       || '';
  const body   = params.Body       || '';
  const msgSid = params.MessageSid || '';

  // Validate Twilio signature
  if (TWILIO_AUTH_TOKEN && !validateTwilioSignature(event, TWILIO_AUTH_TOKEN)) {
    console.warn('sms-receive: invalid Twilio signature — rejected');
    return { statusCode: 403, body: 'Forbidden' };
  }

  console.log(`Inbound SMS from ${from}: "${body}" (sid: ${msgSid})`);

  const timestamp  = new Date().toISOString();
  const normPhone  = normalisePhone(from);
  let matchedJobId = null;
  let matchedName  = null;

  // 1. Look up job by phone number directly from Google Sheets API
  // This replaces the Apps Script phone lookup — instant, no cold start
  if (SHEETS_ID && SHEETS_API_KEY) {
    try {
      const tab = encodeURIComponent('Form Responses 1');
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${tab}?key=${SHEETS_API_KEY}`;
      const r   = await fetch(url);
      const d   = await r.json();
      const rows = d.values || [];
      if (rows.length > 1) {
        const headers = rows[0].map(h => h.toLowerCase().trim());
        const phoneCol  = headers.indexOf('phone number') !== -1 ? headers.indexOf('phone number') : headers.indexOf('phone');
        const jobIdCol  = headers.indexOf('job id');
        const nameCol   = headers.indexOf('full name');
        if (phoneCol !== -1 && jobIdCol !== -1) {
          for (let i = 1; i < rows.length; i++) {
            const rowPhone = normalisePhone(rows[i][phoneCol] || '');
            if (rowPhone && rowPhone === normPhone) {
              matchedJobId = rows[i][jobIdCol] || null;
              matchedName  = nameCol !== -1 ? (rows[i][nameCol] || '') : '';
            }
          }
        }
      }
      console.log(`sms-receive: phone lookup complete, jobId=${matchedJobId}`);
    } catch (e) {
      console.warn('sms-receive: Sheets lookup failed:', e.message);
    }
  }

  // 2. Write to Firestore
  try {
    const host = (event.headers['x-forwarded-proto'] || 'https') + '://' + (event.headers['x-forwarded-host'] || event.headers.host || '');
    await fetch(host + '/.netlify/functions/firestore-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:       'log-inbound',
        jobId:        matchedJobId,
        customerName: matchedName,
        phone:        normPhone,
        from,
        msgBody:      body,
        msgSid,
        timestamp,
      }),
    });
    console.log('sms-receive: Firestore write OK');
  } catch (fe) {
    console.warn('sms-receive: Firestore write failed:', fe.message);
  }

  // 3. Telegram notification
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    const fromDisplay = from.startsWith('+61') ? '0' + from.slice(3) : from;
    const jobLine = matchedJobId
      ? `Job: ${matchedJobId}${matchedName ? ' — ' + matchedName : ''}`
      : 'No matching job found';
    const text = `📩 New SMS Reply\nFrom: ${fromDisplay}\n${jobLine}\n\n${body}`;
    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    }).catch(e => console.warn('Telegram failed:', e.message));
  }

  // Return TwiML immediately
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
  };
};

function normalisePhone(raw) {
  if (!raw) return '';
  let n = String(raw).replace(/[\s\-().]/g, '');
  if (n.startsWith('+61')) return n;
  if (n.startsWith('0061')) return '+61' + n.slice(4);
  if (n.startsWith('61') && n.length === 11) return '+' + n;
  if (n.startsWith('0') && n.length === 10) return '+61' + n.slice(1);
  return n;
}

function validateTwilioSignature(event, authToken) {
  try {
    const sig   = event.headers['x-twilio-signature'] || '';
    if (!sig) return false;
    const host  = event.headers['x-forwarded-host'] || event.headers.host || '';
    const proto = event.headers['x-forwarded-proto'] || 'https';
    const url   = `${proto}://${host}${event.path}`;
    const prms  = Object.fromEntries(new URLSearchParams(event.body));
    let toSign  = url;
    Object.keys(prms).sort().forEach(k => { toSign += k + prms[k]; });
    const expected = crypto.createHmac('sha1', authToken).update(toSign).digest('base64');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch { return false; }
}
