// improve-notes.js
// Netlify function: cleans up shorthand technician job-stage notes into
// clear, professional English using Google's Gemini API (free tier).
//
// Env var required: GEMINI_API_KEY (inject via build.js, same pattern as
// your other secrets). Get a key at aistudio.google.com — no card needed.
//
// NOTE ON THE FREE TIER: Google may use free-tier request content to
// improve its products (this is not the case on the paid tier). If job
// notes ever carry anything customer-sensitive you'd rather not have
// used that way, that's the real tradeoff of "free" here — worth a
// second thought before this goes live, not a blocker either way.
//
// Request body (JSON): { note: string, deviceType?: string, brand?: string }
// Response (200):       { ok: true, improved: string }
// Response (4xx/5xx):   { ok: false, error: string, detail?: string }

const MODEL = 'gemini-3.5-flash';
const MAX_NOTE_LENGTH = 4000;

const INSTRUCTIONS = `You are cleaning up shorthand job notes for an electronics repair shop's internal job log. Rewrite the technician's note into clear, professional English.

Rules:
- Preserve every technical fact exactly as given: part numbers, model numbers, error codes, measurements, dates, prices. Never invent, infer, or add anything not stated in the original note.
- Expand abbreviations and shorthand into full sentences.
- Fix grammar and spelling only where it doesn't change meaning.
- Keep it factual and concise — this is an internal record, not a customer-facing message.
- If the note is already clear, make only light edits.
- Return ONLY the improved note text. No preamble, no quotation marks, no markdown.`;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  if (!process.env.GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'GEMINI_API_KEY not configured' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON body' }) };
  }

  const { note, deviceType, brand } = payload;

  if (!note || typeof note !== 'string' || !note.trim()) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'note (non-empty string) is required' }) };
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: `note too long (max ${MAX_NOTE_LENGTH} chars)` }) };
  }

  const contextLine = [brand, deviceType].filter(Boolean).join(' ');
  const input = contextLine ? `Device: ${contextLine}\n\nNote: ${note}` : note;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: input }] }],
          systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
          generationConfig: {
            maxOutputTokens: 500,
            // Deliberately not setting thinkingConfig/thinkingLevel here —
            // that corner of the API is newer and less consistently
            // documented, and was the most likely reason a request would
            // fail outright. This costs a bit more per call (model uses its
            // own default thinking level) but is the safer starting point.
            // Once this is confirmed working, thinkingConfig: { thinkingLevel: 'low' }
            // can be reintroduced as a cost tweak.
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini error:', response.status, errText);
      // Gemini error bodies are normally JSON: { error: { code, message, status } }.
      // Surface that real message so failures are readable straight from the
      // toast in the browser, without needing to open Netlify function logs.
      let reason = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) reason = `${parsed.error.status || response.status}: ${parsed.error.message}`;
      } catch (parseErr) {
        // errText wasn't JSON — fall back to the raw text as-is
      }
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: reason }) };
    }

    const data = await response.json();
    const improved = extractText(data);

    if (!improved) {
      console.error('No text in Gemini response:', JSON.stringify(data));
      const blockReason = data.promptFeedback?.blockReason;
      return {
        statusCode: 502,
        body: JSON.stringify({
          ok: false,
          error: blockReason ? `Blocked by Gemini: ${blockReason}` : 'Empty response from Gemini',
        }),
      };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, improved }) };
  } catch (err) {
    console.error('improve-notes error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error', detail: err.message }) };
  }
};

// Raw REST responses don't come with the SDK's `response.text` convenience
// getter (same story as OpenAI's output_text) — walk the candidates/parts
// structure manually and concatenate any text parts.
function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => p.text || '').join('').trim();
}
