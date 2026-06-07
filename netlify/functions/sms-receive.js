// netlify/functions/sms-receive.js
// Twilio webhook for inbound SMS. Fires when a customer replies to your AU number.
//
// Configure in Twilio console:
//   Phone Numbers → +61 485 061 001 → Messaging
//   "A message comes in" → Webhook → POST
//   URL: https://logicone.com.au/.netlify/functions/sms-receive
//
// Required env vars:
//   TWILIO_AUTH_TOKEN     — validates webhook is genuinely from Twilio
//   APPS_SCRIPT_URL       — logs reply to Drive/Sheet
//   TELEGRAM_BOT_TOKEN    — your Telegram bot token (from @BotFather)
//   TELEGRAM_CHAT_ID      — your personal Telegram chat ID

const crypto = require('crypto');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { TWILIO_AUTH_TOKEN, APPS_SCRIPT_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

  // Parse Twilio's form-encoded body
  const params = Object.fromEntries(new URLSearchParams(event.body));
  const from   = params.From        || '';
  const body   = params.Body        || '';
  const to     = params.To          || '';
  const msgSid = params.MessageSid  || '';

  // Validate Twilio signature — reject spoofed webhooks
  if (TWILIO_AUTH_TOKEN) {
    const isValid = validateTwilioSignature(event, TWILIO_AUTH_TOKEN);
    if (!isValid) {
      console.warn('sms-receive: invalid Twilio signature — rejected');
      return { statusCode: 403, body: 'Forbidden' };
    }
  }

  console.log(`Inbound SMS from ${from}: "${body}" (sid: ${msgSid})`);

  const timestamp = new Date().toISOString();
  let matchedJobId = null;
  let matchedName  = null;

  // 1. Log to Apps Script (fire-and-forget — don't block Twilio response)
  if (APPS_SCRIPT_URL) {
    const payload = JSON.stringify({ action: 'logInboundSms', from, to, body, msgSid, timestamp });
    const url = APPS_SCRIPT_URL + '?payload=' + encodeURIComponent(payload);
    fetch(url, { redirect: 'follow' })
      .then(r => r.json())
      .then(d => {
        matchedJobId = d.jobId || null;
        matchedName  = d.customerName || null;
      })
      .catch(e => console.warn('sms-receive: Apps Script log failed:', e.message));
  }

  // 2. Send Telegram notification (fire-and-forget)
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    const fromDisplay = from.replace('+61', '0');
    // Build message — jobId/name added if Apps Script returns them (best effort)
    const tgText = [
      '📩 *New SMS Reply*',
      `From: \`${fromDisplay}\``,
      matchedJobId ? `Job: \`${matchedJobId}\`${matchedName ? ' — ' + matchedName : ''}` : '',
      '',
      body,
    ].filter(Boolean).join('\n');

    const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    TELEGRAM_CHAT_ID,
        text:       tgText,
        parse_mode: 'Markdown',
      }),
    }).catch(e => console.warn('sms-receive: Telegram notify failed:', e.message));
  }

  // 3. Return TwiML immediately — Twilio doesn't wait for our logging
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
