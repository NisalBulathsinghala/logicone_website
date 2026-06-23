// netlify/functions/sms-send.js
// Sends outbound SMS via Twilio and logs to Firestore.
// No Apps Script — no cold starts, instant logging.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Twilio env vars not set' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }; }

  const { to, body: messageBody, jobId, customerName, phone } = body;
  if (!to || !messageBody) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing to or body' }) };
  }

  const toNorm = normalisePhone(to);
  if (!toNorm) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid phone number: ' + to }) };
  }

  try {
    // 1. Send via Twilio
    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const params = new URLSearchParams();
    params.append('To',   toNorm);
    params.append('From', TWILIO_FROM_NUMBER);
    params.append('Body', messageBody);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('Twilio error:', data);
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: data.message || 'Twilio error', code: data.code }) };
    }

    console.log(`SMS sent job=${jobId || '?'} to=${toNorm} sid=${data.sid}`);

    // 2. Log to Firestore — awaited so it completes before handler returns
    if (jobId) {
      try {
        const host = (event.headers['x-forwarded-proto'] || 'https') + '://' + (event.headers['x-forwarded-host'] || event.headers.host || '');
        await fetch(host + '/.netlify/functions/firestore-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action:       'log-outbound',
            jobId,
            customerName: customerName || '',
            phone:        phone || toNorm,
            to:           toNorm,
            msgBody:      messageBody,
            msgSid:       data.sid,
            timestamp:    new Date().toISOString(),
          }),
        });
        console.log(`Firestore outbound SMS logged for job=${jobId}`);
      } catch (fe) {
        console.warn('Firestore log failed (non-fatal):', fe.message);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, sid: data.sid, to: toNorm }) };

  } catch (err) {
    console.error('sms-send error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};

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
