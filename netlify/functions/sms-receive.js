// netlify/functions/sms-receive.js
// Twilio webhook for inbound SMS.
//
// Configure in Twilio console:
//   Phone Numbers → +61 485 061 001 → Messaging
//   "A message comes in" → Webhook → POST
//   URL: https://logicone.com.au/.netlify/functions/sms-receive
//
// Required env vars:
//   TWILIO_AUTH_TOKEN     — validates webhook is from Twilio
//   APPS_SCRIPT_URL       — logs reply to Drive/Sheet
//   TELEGRAM_BOT_TOKEN    — your Telegram bot token
//   TELEGRAM_CHAT_ID      — your Telegram chat ID (6572159460)

const crypto = require('crypto');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const {
    TWILIO_AUTH_TOKEN,
    APPS_SCRIPT_URL,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
  } = process.env;

  // Parse Twilio's form-encoded body
  const params = Object.fromEntries(new URLSearchParams(event.body));
  const from   = params.From       || '';
  const body   = params.Body       || '';
  const to     = params.To         || '';
  const msgSid = params.MessageSid || '';

  // Validate Twilio signature
  if (TWILIO_AUTH_TOKEN) {
    if (!validateTwilioSignature(event, TWILIO_AUTH_TOKEN)) {
      console.warn('sms-receive: invalid Twilio signature — rejected');
      return { statusCode: 403, body: 'Forbidden' };
    }
  }

  console.log(`Inbound SMS from ${from}: "${body}" (sid: ${msgSid})`);

  const timestamp = new Date().toISOString();
  let matchedJobId  = null;
  let matchedName   = null;

  // Log to Apps Script — with retry on failure
  if (APPS_SCRIPT_URL) {
    const payload = JSON.stringify({
      action: 'logInboundSms',
      from, to, body, msgSid, timestamp,
    });

    // Build URL — handle if APPS_SCRIPT_URL already has query params
    const separator = APPS_SCRIPT_URL.includes('?') ? '&' : '?';
    const url = APPS_SCRIPT_URL + separator + 'payload=' + encodeURIComponent(payload);

    const tryLog = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const r = await fetch(url, { redirect: 'follow', signal: controller.signal });
        clearTimeout(timer);
        const text = await r.text();
        try {
          const d = JSON.parse(text);
          matchedJobId = d.jobId        || null;
          matchedName  = d.customerName || null;
          return d;
        } catch {
          return { result: 'ok' };
        }
      } catch (e) {
        clearTimeout(timer);
        throw e;
      }
    };

    try {
      await tryLog();
      console.log(`sms-receive: logged to Apps Script, jobId=${matchedJobId}`);
    } catch (e) {
      console.warn(`sms-receive: first attempt failed (${e.message}), retrying in 3s`);
      await new Promise(r => setTimeout(r, 3000));
      try {
        await tryLog();
        console.log(`sms-receive: retry succeeded, jobId=${matchedJobId}`);
      } catch (e2) {
        console.warn(`sms-receive: retry also failed (${e2.message}) — SMS logged to Twilio only`);
      }
    }
  }

  // Telegram notification — fires after Apps Script so we have job details
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    const fromDisplay = from.startsWith('+61') ? '0' + from.slice(3) : from;
    const jobLine = matchedJobId
      ? `Job: \`${matchedJobId}\`${matchedName ? ' — ' + matchedName : ''}`
      : '_No matching job found_';
    const tgText = `📩 *New SMS Reply*\nFrom: \`${fromDisplay}\`\n${jobLine}\n\n${body}`;

    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    TELEGRAM_CHAT_ID,
        text:       tgText,
        parse_mode: 'Markdown',
      }),
    }).catch(e => console.warn('Telegram notify failed:', e.message));
  }

  // Return TwiML immediately
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
  };
};

function validateTwilioSignature(event, authToken) {
  try {
    const sig  = event.headers['x-twilio-signature'] || '';
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
