// netlify/functions/sms-receive.js
// Twilio webhook — called by Twilio when a customer replies to your AU number.
//
// Configure in Twilio console:
//   Phone Numbers → your AU number → Messaging
//   "A message comes in" → Webhook → POST
//   URL: https://your-site.netlify.app/.netlify/functions/sms-receive
//
// Required environment variables:
//   TWILIO_AUTH_TOKEN        — used to validate the webhook signature
//   APPS_SCRIPT_URL          — your deployed Apps Script URL (to log the reply)
//   NOTIFY_EMAIL             — optional: email to forward replies to (uses Twilio SendGrid if set)
//
// What this does:
//   1. Validates the request really came from Twilio (signature check)
//   2. Logs the inbound message to Apps Script (which saves to Drive/Sheet)
//   3. Returns a TwiML response (can auto-reply or stay silent)

const crypto = require('crypto');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { TWILIO_AUTH_TOKEN, APPS_SCRIPT_URL } = process.env;

  // Parse form-encoded body that Twilio sends
  const params = Object.fromEntries(new URLSearchParams(event.body));
  const from    = params.From   || '';
  const body    = params.Body   || '';
  const to      = params.To     || '';
  const msgSid  = params.MessageSid || '';

  // Validate Twilio signature (security — prevents spoofed webhooks)
  if (TWILIO_AUTH_TOKEN) {
    const isValid = validateTwilioSignature(event, TWILIO_AUTH_TOKEN);
    if (!isValid) {
      console.warn('sms-receive: invalid Twilio signature — request rejected');
      return { statusCode: 403, body: 'Forbidden' };
    }
  }

  console.log(`Inbound SMS from ${from}: "${body}" (sid: ${msgSid})`);

  // Log to Apps Script so the reply is saved against the matching job in Drive
  if (APPS_SCRIPT_URL) {
    try {
      const payload = JSON.stringify({
        action:    'logInboundSms',
        from:      from,
        to:        to,
        body:      body,
        msgSid:    msgSid,
        timestamp: new Date().toISOString(),
      });
      const url = APPS_SCRIPT_URL + '?payload=' + encodeURIComponent(payload);
      await fetch(url, { redirect: 'follow' });
    } catch (err) {
      console.warn('sms-receive: Apps Script log failed (non-fatal):', err.message);
    }
  }

  // Return TwiML — empty response means no auto-reply.
  // To send an auto-reply, add a <Message> element here.
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
</Response>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: twiml,
  };
};

// Validates that the webhook POST genuinely came from Twilio.
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
function validateTwilioSignature(event, authToken) {
  try {
    const twilioSignature = event.headers['x-twilio-signature'] || '';
    if (!twilioSignature) return false;

    // Reconstruct the full URL Twilio posted to
    const host   = event.headers['x-forwarded-host'] || event.headers.host || '';
    const proto  = event.headers['x-forwarded-proto'] || 'https';
    const url    = `${proto}://${host}${event.path}`;

    // Sort POST params and append to URL
    const params = Object.fromEntries(new URLSearchParams(event.body));
    const sortedKeys = Object.keys(params).sort();
    let toSign = url;
    sortedKeys.forEach(k => { toSign += k + params[k]; });

    const expected = crypto
      .createHmac('sha1', authToken)
      .update(toSign)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(twilioSignature)
    );
  } catch {
    return false;
  }
}
