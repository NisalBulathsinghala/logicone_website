// netlify/functions/inventory.js
//
// General parts/stock inventory — items Nisal buys and keeps on hand
// (batteries, wheels, consumables, etc.), independent of any single job.
// Deliberately separate from the Cin7 warranty parts orders pipeline
// (jobs/{jobId}/jobsheet/partsOrders), which is job-specific — a Cin7
// order is a replacement part earmarked for one repair, not general stock.
//
// Firestore layout:
//   inventory/{itemId}                    — item doc
//   inventory/{itemId}/movements/{autoId} — audit log of every qty change
//
// Actions:
//   list      — return all items, sorted by name
//   add       — create a new item (optional starting qty, logged as an
//               'in' movement so the audit trail has a clean beginning)
//   update    — edit item details (sku/name/category/minStock/cost/
//               location/notes). Does NOT touch qty — always use
//               'adjust' for qty so every change is logged with a reason.
//   adjust    — change qty by a signed delta (+in / -out), logs a
//               movement. Runs in a transaction and clamps at 0 so
//               concurrent adjusts (e.g. dashboard + job save both
//               firing) can't push stock negative or race each other.
//   delete    — remove an item (movements subcollection is left in
//               place — cheap, and useful if the item gets re-added)
//   movements — most recent movements for one item (audit history)

const { db } = require('./firebase');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }; }

  const { action } = body;
  const col = db.collection('inventory');

  try {
    // ── List all items ────────────────────────────────────────────
    if (action === 'list') {
      const snap = await col.get();
      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: items }) };
    }

    // ── Add a new item ───────────────────────────────────────────
    if (action === 'add') {
      const now = new Date().toISOString();
      const qty = Math.max(0, parseFloat(body.qty) || 0);
      const item = {
        sku:      body.sku || '',
        name:     body.name || '',
        category: body.category || '',
        qty,
        minStock: Math.max(0, parseFloat(body.minStock) || 0),
        cost:     (body.cost !== undefined && body.cost !== '') ? parseFloat(body.cost) : null,
        location: body.location || '',
        notes:    body.notes || '',
        createdAt: now,
        updatedAt: now,
      };
      if (!item.name) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing name' }) };

      const ref = await col.add(item);
      if (qty > 0) {
        await ref.collection('movements').add({
          type: 'in', qtyChange: qty, qtyAfter: qty,
          reason: 'Initial stock', jobId: null, at: now,
        });
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true, id: ref.id }) };
    }

    // Every other action operates on one item
    const { itemId } = body;
    if (!itemId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing itemId' }) };
    const ref = col.doc(itemId);

    // ── Update item details (never qty — see 'adjust') ────────────
    if (action === 'update') {
      const fields = ['sku', 'name', 'category', 'minStock', 'cost', 'location', 'notes'];
      const patch = { updatedAt: new Date().toISOString() };
      fields.forEach(f => {
        if (body[f] === undefined) return;
        if (f === 'minStock') patch[f] = Math.max(0, parseFloat(body[f]) || 0);
        else if (f === 'cost') patch[f] = (body[f] === '' || body[f] === null) ? null : parseFloat(body[f]);
        else patch[f] = body[f];
      });
      await ref.set(patch, { merge: true });
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // ── Adjust qty (in / out / correction) ────────────────────────
    if (action === 'adjust') {
      const delta = parseFloat(body.delta);
      if (!delta) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing/zero delta' }) };

      const qtyAfter = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error('Item not found');
        const cur = snap.data();
        const after = Math.max(0, (parseFloat(cur.qty) || 0) + delta);
        const now = new Date().toISOString();
        tx.set(ref, { qty: after, updatedAt: now }, { merge: true });
        const moveRef = ref.collection('movements').doc();
        tx.set(moveRef, {
          type: delta > 0 ? 'in' : 'out',
          qtyChange: delta,
          qtyAfter: after,
          reason: body.reason || '',
          jobId: body.jobId || null,
          at: now,
        });
        return after;
      });

      return { statusCode: 200, body: JSON.stringify({ ok: true, qty: qtyAfter }) };
    }

    // ── Delete item ─────────────────────────────────────────────
    if (action === 'delete') {
      await ref.delete();
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // ── Recent movement history for one item ──────────────────────
    if (action === 'movements') {
      const snap = await ref.collection('movements').orderBy('at', 'desc').limit(50).get();
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return { statusCode: 200, body: JSON.stringify({ ok: true, data }) };
    }

    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown action: ' + action }) };

  } catch (err) {
    console.error('inventory error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
