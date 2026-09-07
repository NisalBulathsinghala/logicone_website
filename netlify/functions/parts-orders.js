// netlify/functions/parts-orders.js
//
// Stores Cin7/Technocity parts-order data auto-parsed from Gmail by
// the Apps Script Cin7 processor (see processCin7Orders_ /
// handleCin7InvoiceEmail_ in the Apps Script project).
//
// Lives at its own Firestore path — jobs/{jobId}/jobsheet/partsOrders —
// deliberately SEPARATE from jobs/{jobId}/jobsheet/current. That doc is
// overwritten wholesale (no merge) every time the Job Sheet UI saves, so
// anything written here would get silently wiped the next time Nisal
// hits Save on that form. This mirrors the existing jobsheet/timestamps
// pattern, which has the same isolation for the same reason.
//
// Actions:
//   add           — append one auto-parsed order (called by Apps Script).
//                   De-duped by orderRef — reprocessing the same email
//                   (e.g. after a Gmail label got reset) updates the
//                   existing entry instead of duplicating it.
//   mark-received — toggle received/receivedAt on one order (dashboard UI)
//   load          — return all parts orders for one job
//   load-batch    — same, for many jobs at once (kanban tile use)

const { db } = require('./firebase');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }; }

  const { action } = body;

  try {
    // ── Batch load for many jobs at once ─────────────────────────
    if (action === 'load-batch') {
      const jobIds = Array.isArray(body.jobIds) ? body.jobIds.filter(Boolean) : [];
      if (!jobIds.length) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing jobIds' }) };

      const result = {};
      await Promise.all(jobIds.map(async (id) => {
        try {
          const snap = await db.collection('jobs').doc(id).collection('jobsheet').doc('partsOrders').get();
          if (snap.exists) result[id] = snap.data().orders || [];
        } catch (e) {
          console.warn(`parts-orders load-batch: skipped ${id}:`, e.message);
        }
      }));
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: result }) };
    }

    // Every other action operates on one job
    const { jobId } = body;
    if (!jobId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing jobId' }) };
    const ref = db.collection('jobs').doc(jobId).collection('jobsheet').doc('partsOrders');

    // ── Add (or update, if this orderRef was already recorded) ───
    if (action === 'add') {
      const snap = await ref.get();
      const existing = snap.exists ? (snap.data().orders || []) : [];

      const entry = {
        orderRef:     body.orderRef || '',
        caseNo:       body.caseNo || '',
        invoiceNo:    body.invoiceNo || '',
        item:         body.item || '',
        itemRaw:      body.itemRaw || '',
        cost:         body.cost ?? null,
        trackingCode: body.trackingCode || '',
        invoiceDate:  body.invoiceDate || '',
        driveFileUrl: body.driveFileUrl || '',
        needsReview:  !!body.needsReview,
        received:     false,
        receivedAt:   null,
        addedAt:      new Date().toISOString(),
      };

      const idx = entry.orderRef
        ? existing.findIndex(o => o.orderRef === entry.orderRef)
        : -1;

      let orders;
      if (idx >= 0) {
        // Same order, second document (Tax Invoice + Delivery Order slip
        // both reference the same orderRef, with different fields
        // populated — a Delivery Order has no pricing, a Tax Invoice
        // sometimes has no tracking yet). Merge field-by-field, only
        // overwriting with a new value when the incoming one is actually
        // non-empty, so a leaner document processing second doesn't
        // blank out what a richer one already captured. Always keep
        // received status and re-stamp addedAt to the latest process time.
        const prev = existing[idx];
        const merged = { ...prev };
        Object.keys(entry).forEach(k => {
          if (k === 'received' || k === 'receivedAt') return;
          const v = entry[k];
          const isEmpty = v === '' || v === null || v === undefined;
          if (!isEmpty) merged[k] = v;
        });
        merged.addedAt = entry.addedAt;
        orders = [...existing];
        orders[idx] = merged;
      } else {
        orders = [...existing, entry];
      }

      await ref.set({ orders, _updatedAt: new Date().toISOString() }, { merge: true });
      console.log(`parts-orders: added/updated order ${entry.orderRef} for ${jobId}`);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // ── Toggle received status on one order ───────────────────────
    if (action === 'mark-received') {
      const { orderRef, received } = body;
      if (!orderRef) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing orderRef' }) };

      const snap = await ref.get();
      if (!snap.exists) return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'No parts orders recorded for this job' }) };

      const orders = snap.data().orders || [];
      const idx = orders.findIndex(o => o.orderRef === orderRef);
      if (idx < 0) return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Order not found' }) };

      orders[idx] = {
        ...orders[idx],
        received: !!received,
        receivedAt: received ? new Date().toISOString() : null,
      };

      await ref.set({ orders, _updatedAt: new Date().toISOString() }, { merge: true });
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // ── Load all orders for one job ───────────────────────────────
    if (action === 'load') {
      const snap = await ref.get();
      if (!snap.exists) return { statusCode: 200, body: JSON.stringify({ ok: true, data: [] }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: snap.data().orders || [] }) };
    }

    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown action: ' + action }) };

  } catch (err) {
    console.error('parts-orders error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
