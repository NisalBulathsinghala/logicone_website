// netlify/functions/call-initiate.js
// Handles TWO scenarios:
//
// A) Groundwire outbound call (SIP → Twilio webhook, GET/POST with form params)
//    Twilio calls this URL when Groundwire dials out via the SIP domain.
//    Params: To (SIP URI like sip:0432499996@logiconesa.sip.twilio.com:5060)
//    Response: TwiML to dial the real destination with business caller ID
//
// B) Dashboard call button (POST JSON { to, jobId, customerName })
//    Creates a new call via Twilio API — rings your mobile first, then bridges to customer.
//
// Required environment variables:
//   TWILIO_ACCOUNT_SID   — from console.twilio.com
//   TWILIO_AUTH_TOKEN    — from console.twilio.com
//   TWILIO_FROM_NUMBER   — your Twilio AU number e.g. +61485061001
//   MY_MOBILE_NUMBER     — your real mobile e.g. +61466697696

exports.handler = async function (event) {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
    MY_MOBILE_NUMBER,
  } = process.env;

  // ── Scenario A: Groundwire SIP outbound ──────────────────────
  // Twilio calls this as a webhook — form-encoded body or query params
  // Content-Type: application/x-www-form-urlencoded
  const contentType = event.headers['content-type'] || '';
  const isFormEncoded = contentType.includes('application/x-www-form-urlencoded');
  const isGet = event.httpMethod === 'GET';

  if (isGet || isFormEncoded) {
    // Parse To from form params or query string
    const params = isGet
      ? Object.fromEntries(new URLSearchParams(event.rawQuery || ''))
      : Object.fromEntries(new URLSearchParams(event.body || ''));

    const rawTo = params.To || params.to || '';
    const destination = parseSipOrPhone(rawTo);

    console.log(`Groundwire outbound: raw="${rawTo}" → parsed="${destination}"`);

    if (!destination) {
      // Return TwiML error message
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/xml' },
        body: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, the number could not be recognised. Please try again.</Say>
</Response>`,
      };
    }

    // Return TwiML to dial the destination with business caller ID
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${TWILIO_FROM_NUMBER}" timeout="30">
    <Number>${destination}</Number>
  </Dial>
</Response>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: twiml,
    };
  }

  // ── Scenario B: Dashboard call button (POST JSON) ─────────────
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || !MY_MOBILE_NUMBER) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Missing env vars' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }; }

  const { to, jobId, customerName } = body;
  if (!to) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing phone number' }) };
  }

  const toNorm = normalisePhone(to);
  if (!toNorm) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid phone number: ' + to }) };
  }

  try {
    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const twilioUrl   = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew-Neural">Connecting you to ${customerName || 'your customer'}${jobId ? ' for job ' + jobId : ''}.</Say>
  <Dial callerId="${TWILIO_FROM_NUMBER}" timeout="30">
    <Number>${toNorm}</Number>
  </Dial>
</Response>`;

    const params = new URLSearchParams();
    params.append('To',      MY_MOBILE_NUMBER);
    params.append('From',    TWILIO_FROM_NUMBER);
    params.append('Twiml',   twiml);
    params.append('Timeout', '30');

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Twilio call error:', data);
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: data.message || 'Twilio API error' }) };
    }

    console.log(`Dashboard call: job=${jobId} → ${toNorm}, sid=${data.sid}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, sid: data.sid, status: data.status }) };

  } catch (err) {
    console.error('call-initiate error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};

// Parse SIP URI or plain phone number → E.164
// Handles: sip:0432499996@logiconesa.sip.twilio.com:5060
//          sip:+61432499996@...
//          0432499996
//          +61432499996
function parseSipOrPhone(raw) {
  if (!raw) return null;
  let n = String(raw).trim();

  // Extract number from SIP URI: sip:NUMBER@host
  const sipMatch = n.match(/^sip:([^@]+)@/i);
  if (sipMatch) n = sipMatch[1];

  return normalisePhone(n);
}

function normalisePhone(raw) {
  if (!raw) return null;
  let n = String(raw).replace(/[\s\-().]/g, '');
  if (n.startsWith('+61')) return n;
  if (n.startsWith('0061')) return '+61' + n.slice(4);
  if (n.startsWith('61') && n.length === 11) return '+' + n;
  if (n.startsWith('0') && n.length === 10) return '+61' + n.slice(1);
  if (n.startsWith('+')) return n;
  return null;
}
