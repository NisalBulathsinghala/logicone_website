// netlify/functions/zoho-invoice.js
// Handles Zoho Books contact creation, draft invoices, and draft estimates (quotes)

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com.au/oauth/v2/token';
const ZOHO_API_BASE     = 'https://www.zohoapis.com.au/books/v3';
const ORG_ID            = process.env.ZOHO_ORG_ID;
const CLIENT_ID         = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET     = process.env.ZOHO_CLIENT_SECRET;
const REFRESH_TOKEN     = process.env.ZOHO_REFRESH_TOKEN;
const INSPECTION_FEE    = 85.00;

async function getAccessToken() {
  const params = new URLSearchParams({
    grant_type: 'refresh_token', client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN,
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

async function findContact(token, email) {
  const res = await fetch(`${ZOHO_API_BASE}/contacts?organization_id=${ORG_ID}&email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  const data = await res.json();
  return (data.contacts && data.contacts.length > 0) ? data.contacts[0].contact_id : null;
}

async function createContact(token, { name, email, phone }) {
  const nameParts = name.trim().split(' ');
  const body = {
    contact_name: name, contact_type: 'customer', email,
    contact_persons: [{
      first_name: nameParts[0], last_name: nameParts.slice(1).join(' '),
      email, phone: phone || '', is_primary_contact: true,
    }],
  };
  const res = await fetch(`${ZOHO_API_BASE}/contacts?organization_id=${ORG_ID}`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.contact || !data.contact.contact_id) throw new Error('Failed to create contact: ' + JSON.stringify(data));
  return data.contact.contact_id;
}

async function resolveContact(token, job) {
  let contactId = await findContact(token, job.email);
  const isNew = !contactId;
  if (isNew) contactId = await createContact(token, { name: job.name, email: job.email, phone: job.phone });
  return { contactId, isNew };
}

function jobNote(job) {
  return `Out-of-warranty repair — ${job.brand} ${job.model}${job.serial ? ' (S/N: ' + job.serial + ')' : ''}.\nFault: ${job.issue}`;
}

async function createInvoice(token, contactId, job) {
  const body = {
    customer_id: contactId, reference_number: job.jobId, status: 'draft', notes: jobNote(job),
    line_items: [{ name: 'Inspection Fee', description: `Out-of-warranty inspection — ${job.brand} ${job.model}`, rate: INSPECTION_FEE, quantity: 1 }],
  };
  const res = await fetch(`${ZOHO_API_BASE}/invoices?organization_id=${ORG_ID}`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.invoice || !data.invoice.invoice_id) throw new Error('Failed to create invoice: ' + JSON.stringify(data));
  return { invoiceId: data.invoice.invoice_id, invoiceNumber: data.invoice.invoice_number };
}

async function createEstimate(token, contactId, job) {
  const lineItems = (job.parts || [])
    .filter(p => p.name && parseFloat(p.qty) > 0)
    .map(p => ({
      name: p.name,
      rate: parseFloat(p.price) || 0,
      quantity: parseFloat(p.qty) || 1,
    }));

  if (parseFloat(job.postage) > 0) {
    lineItems.push({ name: 'Postage & Handling', rate: parseFloat(job.postage), quantity: 1 });
  }

  // Deduct inspection fee already paid
  lineItems.push({ name: 'Less: Inspection Fee Paid', rate: -INSPECTION_FEE, quantity: 1 });

  if (!lineItems.length) throw new Error('No valid line items — add parts with names and quantities first.');

  const body = {
    customer_id: contactId, reference_number: job.jobId, status: 'draft', notes: jobNote(job),
    discount: parseFloat(job.discount) > 0 ? parseFloat(job.discount) : undefined,
    is_discount_before_tax: true,
    line_items: lineItems,
  };

  const res = await fetch(`${ZOHO_API_BASE}/estimates?organization_id=${ORG_ID}`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.estimate || !data.estimate.estimate_id) throw new Error('Failed to create estimate: ' + JSON.stringify(data));
  return { estimateId: data.estimate.estimate_id, estimateNumber: data.estimate.estimate_number };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const job = JSON.parse(event.body);
    if (!job.name || !job.email || !job.jobId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields: name, email, jobId' }) };
    }

    const token = await getAccessToken();
    const { contactId, isNew } = await resolveContact(token, job);

    if (job.action === 'quote') {
      const { estimateId, estimateNumber } = await createEstimate(token, contactId, job);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, estimateId, estimateNumber, contactId, isNewContact: isNew }) };
    } else {
      const { invoiceId, invoiceNumber } = await createInvoice(token, contactId, job);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, invoiceId, invoiceNumber, contactId, isNewContact: isNew }) };
    }
  } catch (err) {
    console.error('zoho-invoice error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
