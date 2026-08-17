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
    TWILIO_ACCOUNT_SID,
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
  const numMedia   = parseInt(params.NumMedia || '0', 10);

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

  // 2. If this is an MMS, pull every attached photo down from Twilio (needs
  // Basic Auth, which only this server-side function has) and re-host each
  // one through sms-media.js so it has a plain public URL the browser can
  // just <img src> — Twilio's own media URLs can't be loaded directly
  // client-side.
  //
  // A single text can carry more than one photo — Twilio reports that as
  // NumMedia > 1 with MediaUrl0, MediaUrl1, MediaUrl2 etc. This used to only
  // ever look at MediaUrl0, so every photo after the first in a multi-photo
  // text was silently dropped. Downloads run in parallel; each successful
  // one becomes its own Firestore message doc in step 3 below — same as if
  // the customer had sent them as separate texts.
  let ourMediaUrls = [];
  if (numMedia > 0 && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const host = (event.headers['x-forwarded-proto'] || 'https') + '://' + (event.headers['x-forwarded-host'] || event.headers.host || '');

    const downloaded = await Promise.all(
      Array.from({ length: numMedia }, (_, n) => n).map(async (n) => {
        const twilioMediaUrl = params[`MediaUrl${n}`];
        if (!twilioMediaUrl) return null;
        try {
          const mediaRes = await fetch(twilioMediaUrl, { headers: { Authorization: `Basic ${credentials}` } });
          if (!mediaRes.ok) {
            console.warn(`sms-receive: could not download media ${n} from Twilio, status`, mediaRes.status);
            return null;
          }
          const contentType = mediaRes.headers.get('content-type') || 'image/jpeg';
          const buf = Buffer.from(await mediaRes.arrayBuffer());
          const dataUrl = `data:${contentType};base64,${buf.toString('base64')}`;
          const storeRes = await fetch(host + '/.netlify/functions/sms-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'store', dataUrl }),
          }).then(r => r.json());
          if (storeRes.ok) return storeRes.url;
          console.warn(`sms-receive: media ${n} store failed:`, storeRes.error);
          return null;
        } catch (e) {
          console.warn(`sms-receive: media ${n} handling failed:`, e.message);
          return null;
        }
      })
    );

    ourMediaUrls = downloaded.filter(Boolean);
  }

  // 3. Write to Firestore — one message doc per photo, so a multi-photo
  // text renders as separate image bubbles (dashboard.js's smsRenderThread
  // already handles that fine — it just draws whatever's in the array).
  // The caption goes on the first photo's doc only, so it doesn't repeat
  // once per image. Timestamps are staggered 1ms apart per photo purely so
  // load-thread's orderBy('timestamp') keeps them in the order Twilio sent
  // them rather than leaving same-timestamp ordering undefined.
  try {
    const host = (event.headers['x-forwarded-proto'] || 'https') + '://' + (event.headers['x-forwarded-host'] || event.headers.host || '');
    const baseTime = new Date(timestamp).getTime();

    const docsToWrite = ourMediaUrls.length
      ? ourMediaUrls.map((url, n) => ({
          mediaUrl:  url,
          msgBody:   n === 0 ? body : '',
          timestamp: new Date(baseTime + n).toISOString(),
        }))
      : [{ mediaUrl: null, msgBody: body, timestamp }];

    for (const doc of docsToWrite) {
      await fetch(host + '/.netlify/functions/firestore-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:       'log-inbound',
          jobId:        matchedJobId,
          customerName: matchedName,
          phone:        normPhone,
          from,
          msgBody:      doc.msgBody,
          mediaUrl:     doc.mediaUrl,
          msgSid,
          timestamp:    doc.timestamp,
        }),
      });
    }
    console.log(`sms-receive: Firestore write OK (${docsToWrite.length} message${docsToWrite.length !== 1 ? 's' : ''})`);
  } catch (fe) {
    console.warn('sms-receive: Firestore write failed:', fe.message);
  }

  // 4. Telegram notification — AWAITED. This was the actual bug: firing it
  // without awaiting meant it raced the TwiML return below. Lambda can freeze
  // the execution environment the instant a response is sent, which can kill
  // an in-flight fetch before it ever resolves OR rejects — explaining why
  // no success log, no error log, nothing showed up for real inbound SMS.
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('sms-receive: Telegram not configured (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing)');
  } else {
    const fromDisplay = from.startsWith('+61') ? '0' + from.slice(3) : from;
    const jobLine = matchedJobId
      ? `Job: ${matchedJobId}${matchedName ? ' — ' + matchedName : ''}`
      : 'No matching job found';
    const photoLine = ourMediaUrls.length
      ? `\n📷 ${ourMediaUrls.length > 1 ? ourMediaUrls.length + ' images' : 'Image'} attached`
      : '';
    const text = `📩 New SMS Reply\nFrom: ${fromDisplay}\n${jobLine}${photoLine}\n\n${body}`;
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
      });
      const resData = await tgRes.json().catch(() => ({}));
      if (!tgRes.ok || !resData.ok) {
        // fetch() does NOT reject on 4xx/5xx, so this is the only place
        // a bad token / wrong chat_id / blocked bot would ever show up
        console.error('sms-receive: Telegram API rejected the message —', tgRes.status, JSON.stringify(resData));
      } else {
        console.log('sms-receive: Telegram notification sent OK, message_id', resData.result && resData.result.message_id);
      }
    } catch (e) {
      console.error('sms-receive: Telegram fetch failed:', e.message);
    }
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
