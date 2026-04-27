// netlify/functions/zoho-invoice.js
// Creates a Zoho Books contact + draft inspection fee invoice for out-of-warranty jobs

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com.au/oauth/v2/token';
const ZOHO_API_BASE     = 'https://www.zohoapis.com.au/books/v3';
const ORG_ID            = process.env.ZOHO_ORG_ID;
const CLIENT_ID         = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET     = process.env.ZOHO_CLIENT_SECRET;
const REFRESH_TOKEN     = process.env.ZOHO_REFRESH_TOKEN;
const INSPECTION_FEE    = 85.00;

// ── Get a fresh access token using the refresh token ──────────
async function getAccessToken() {
  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
  });

  const res = await fetch(ZOHO_ACCOUNTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data));
  return data.access_token;
}

// ── Find existing contact by email ────────────────────────────
async function findContact(token, email) {
  const url = `${ZOHO_API_BASE}/contacts?organization_id=${ORG_ID}&email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  const data = await res.json();
  if (data.contacts && data.contacts.length > 0) return data.contacts[0].contact_id;
  return null;
}

// ── Create a new contact ──────────────────────────────────────
async function createContact(token, { name, email, phone }) {
  const body = {
    contact_name: name,
    contact_type: 'customer',
    email,
    contact_persons: [{ first_name: name.split(' ')[0], last_name: name.split(' ').slice(1).join(' '), email, phone, is_primary_contact: true }],
  };

  const res = await fetch(`${ZOHO_API_BASE}/contacts?organization_id=${ORG_ID}`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.contact || !data.contact.contact_id) throw new Error('Failed to create contact: ' + JSON.stringify(data));
  return data.contact.contact_id;
}

// ── Create a draft invoice ────────────────────────────────────
async function createInvoice(token, contactId, job) {
  const body = {
    customer_id:    contactId,
    reference_number: job.jobId,
    status:         'draft',
    notes:          `Out-of-warranty repair — ${job.brand} ${job.model}${job.serial ? ' (S/N: ' + job.serial + ')' : ''}.\nFault: ${job.issue}`,
    line_items: [
      {
        name:        'Inspection Fee',
        description: `Out-of-warranty inspection — ${job.brand} ${job.model}`,
        rate:        INSPECTION_FEE,
        quantity:    1,
      },
    ],
  };

  const res = await fetch(`${ZOHO_API_BASE}/invoices?organization_id=${ORG_ID}`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.invoice || !data.invoice.invoice_id) throw new Error('Failed to create invoice: ' + JSON.stringify(data));
  return {
    invoiceId:     data.invoice.invoice_id,
    invoiceNumber: data.invoice.invoice_number,
  };
}

// ── Main handler ──────────────────────────────────────────────
exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const job = JSON.parse(event.body);

    // Validate required fields
    if (!job.name || !job.email || !job.jobId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields: name, email, jobId' }) };
    }

    // 1. Get access token
    const token = await getAccessToken();

    // 2. Find or create contact
    let contactId = await findContact(token, job.email);
    let isNew = false;
    if (!contactId) {
      contactId = await createContact(token, { name: job.name, email: job.email, phone: job.phone || '' });
      isNew = true;
    }

    // 3. Create draft invoice
    const { invoiceId, invoiceNumber } = await createInvoice(token, contactId, job);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        invoiceId,
        invoiceNumber,
        contactId,
        isNewContact: isNew,
      }),
    };

  } catch (err) {
    console.error('zoho-invoice error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
