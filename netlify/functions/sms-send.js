// netlify/functions/sms-send.js
// Sends an outbound SMS to a customer via Twilio AND logs it to the job's
// Drive folder so the message persists in the conversation thread.
//
// Required environment variables (set in Netlify dashboard):
//   TWILIO_ACCOUNT_SID   — from console.twilio.com
//   TWILIO_AUTH_TOKEN    — from console.twilio.com
//   TWILIO_FROM_NUMBER   — your Twilio AU number e.g. +61485061001
//   APPS_SCRIPT_URL      — your deployed Apps Script URL (to log the sent message)
//
// POST body JSON:
//   { to, body, jobId }

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, APPS_SCRIPT_URL } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Twilio env vars not set' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }; }

  const { to, body: messageBody, jobId } = body;
  if (!to || !messageBody) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing to or body' }) };
  }

  const toNorm = normalisePhone(to);
  if (!toNorm) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid phone number: ' + to }) };
  }

  try {
    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const params = new URLSearchParams();
    params.append('To', toNorm);
    params.append('From', TWILIO_FROM_NUMBER);
    params.append('Body', messageBody);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', data);
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, error: data.message || 'Twilio API error', code: data.code }),
      };
    }

    console.log(`SMS sent for job ${jobId || '?'} -> ${toNorm} sid:${data.sid}`);

    // Log the outbound message to the job's Drive folder via Apps Script.
    // This makes the sent message persist in the conversation thread.
    if (APPS_SCRIPT_URL && jobId) {
      try {
        const payload = JSON.stringify({
          action:    'logOutboundSms',
          jobId:     jobId,
          to:        toNorm,
          body:      messageBody,
          msgSid:    data.sid,
          timestamp: new Date().toISOString(),
        });
        const url = APPS_SCRIPT_URL + '?payload=' + encodeURIComponent(payload);
        await fetch(url, { redirect: 'follow' });
      } catch (logErr) {
        console.warn('sms-send: Drive log failed (non-fatal):', logErr.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, sid: data.sid, to: toNorm }),
    };

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
