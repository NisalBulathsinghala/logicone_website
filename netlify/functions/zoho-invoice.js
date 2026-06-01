// netlify/functions/zoho-invoice.js

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
  if (!data.access_token) throw new Error('Token error: ' + JSON.stringify(data));
  return data.access_token;
}

async function findContact(token, email) {
  const url = `${ZOHO_API_BASE}/contacts?organization_id=${ORG_ID}&contact_type=customer&email=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  const data = await res.json();
  console.log('findContact:', res.status, JSON.stringify(data).substring(0, 400));
  if (!data.contacts || !data.contacts.length) return null;
  // Strict email match
  const match = data.contacts.find(c =>
    c.email === email ||
    (c.contact_persons && c.contact_persons.some(p => p.email === email))
  );
  return match ? match.contact_id : null;
}

async function createContact(token, { name, email, phone }) {
  const nameParts = name.trim().split(' ');
  const body = {
    contact_name: name,
    contact_type: 'customer',
    customer_sub_type: 'individual',
    email,
    contact_persons: [{
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(' ') || '',
      email, phone: phone || '',
      is_primary_contact: true,
    }],
  };
  const res = await fetch(`${ZOHO_API_BASE}/contacts?organization_id=${ORG_ID}`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log('createContact:', res.status, JSON.stringify(data).substring(0, 400));
  if (!data.contact || !data.contact.contact_id) throw new Error('Create contact failed: ' + JSON.stringify(data));
  return data.contact.contact_id;
}

async function resolveContact(token, job) {
  let contactId = await findContact(token, job.email);
  const isNew = !contactId;
  if (isNew) contactId = await createContact(token, { name: job.name, email: job.email, phone: job.phone });
  return { contactId, isNew };
}

async function createInvoice(token, contactId, job) {
  const subject = `Out-of-warranty repair — ${job.brand} ${job.model}${job.serial ? ' (S/N: ' + job.serial + ')' : ''}`;
  const body = {
    customer_id: contactId,
    reference_number: job.jobId,
    status: 'draft',
    subject,
    notes: `${subject}\n\nFault: ${job.issue || ''}`,
    line_items: [{
      name: 'Inspection Fee',
      description: `Out-of-warranty inspection — ${job.brand} ${job.model}`,
      rate: INSPECTION_FEE,
      quantity: 1,
    }],
  };
  const res = await fetch(`${ZOHO_API_BASE}/invoices?organization_id=${ORG_ID}`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log('createInvoice:', res.status, JSON.stringify(data).substring(0, 400));
  if (!data.invoice || !data.invoice.invoice_id) throw new Error('Create invoice failed: ' + JSON.stringify(data));
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

  if (!lineItems.length) throw new Error('No valid line items — add parts with names and quantities first.');

  if (parseFloat(job.postage) > 0) {
    lineItems.push({ name: 'Postage & Handling', rate: parseFloat(job.postage), quantity: 1 });
  }

  lineItems.push({ name: 'Less: Inspection Fee Paid', rate: -INSPECTION_FEE, quantity: 1 });

  const subject = `Repair Quote — ${job.brand} ${job.model}${job.serial ? ' (S/N: ' + job.serial + ')' : ''}`;

  const body = {
    customer_id: contactId,
    reference_number: job.jobId,
    status: 'draft',
    custom_subject: subject,
    notes: `${subject}\n\nFault: ${job.issue || ''}`,
    line_items: lineItems,
  };

  if (parseFloat(job.discount) > 0) {
    body.discount = parseFloat(job.discount);
    body.is_discount_before_tax = true;
  }

  const res = await fetch(`${ZOHO_API_BASE}/estimates?organization_id=${ORG_ID}`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log('createEstimate:', res.status, JSON.stringify(data).substring(0, 400));
  if (!data.estimate || !data.estimate.estimate_id) throw new Error('Create estimate failed: ' + JSON.stringify(data));
  return { estimateId: data.estimate.estimate_id, estimateNumber: data.estimate.estimate_number };
}

async function createTechnocityInvoice(token, { brand, period, lineItems }) {
  // Look up Technocity contact by name (they may not have a consistent email)
  const searchUrl = `${ZOHO_API_BASE}/contacts?organization_id=${ORG_ID}&contact_type=customer&search_text=Technocity`;
  const searchRes = await fetch(searchUrl, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  const searchData = await searchRes.json();
  console.log('Technocity lookup:', searchRes.status, JSON.stringify(searchData).substring(0, 200));

  let contactId;
  if (searchData.contacts && searchData.contacts.length > 0) {
    contactId = searchData.contacts[0].contact_id;
  } else {
    // Create Technocity contact
    const createRes = await fetch(`${ZOHO_API_BASE}/contacts?organization_id=${ORG_ID}`, {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_name: 'Technocity',
        contact_type: 'customer',
        customer_sub_type: 'business',
      }),
    });
    const createData = await createRes.json();
    console.log('createTechnocity:', createRes.status, JSON.stringify(createData).substring(0, 200));
    if (!createData.contact || !createData.contact.contact_id) {
      throw new Error('Could not find or create Technocity contact: ' + JSON.stringify(createData));
    }
    contactId = createData.contact.contact_id;
  }

  // Build line items — one per job
  const zohoLineItems = lineItems.map(item => ({
    name:        item.description || `${item.caseNo} | ${item.model}`,
    description: [
      brand + ' Warranty Repair',
      item.repairLevel || '',
      item.completionDate ? 'Completed ' + item.completionDate : '',
    ].filter(Boolean).join(' · '),
    rate:     parseFloat(item.cost) || 0,
    quantity: 1,
  }));

  const refNumber  = `LO-${brand.substring(0,3).toUpperCase()}-${(period || 'ALL').replace(/[^a-zA-Z0-9]/g, '-')}`;
  const noteText   = `${brand} Warranty Repairs — ${period || 'All Periods'} (${lineItems.length} job${lineItems.length !== 1 ? 's' : ''})`;

  const body = {
    customer_id:      contactId,
    reference_number: refNumber,
    status:           'draft',
    notes:            noteText,
    line_items:       zohoLineItems,
  };

  const res = await fetch(`${ZOHO_API_BASE}/invoices?organization_id=${ORG_ID}`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log('createTechnocityInvoice:', res.status, JSON.stringify(data).substring(0, 400));
  if (!data.invoice || !data.invoice.invoice_id) {
    throw new Error('Create Technocity invoice failed: ' + JSON.stringify(data));
  }
  return { invoiceId: data.invoice.invoice_id, invoiceNumber: data.invoice.invoice_number };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const body = JSON.parse(event.body);
    console.log('Request:', body.action, body.jobId || body.brand, body.email || '');

    // ── Technocity batch invoice (from invoice export module) ──
    if (body.action === 'technocity_invoice') {
      if (!body.lineItems || !body.lineItems.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'No line items provided' }) };
      }
      const token = await getAccessToken();
      const { invoiceId, invoiceNumber } = await createTechnocityInvoice(token, body);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, invoiceId, invoiceNumber }) };
    }

    // ── Individual job invoice / quote (existing flow) ─────────
    const job = body;
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
    console.error('zoho-invoice error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
