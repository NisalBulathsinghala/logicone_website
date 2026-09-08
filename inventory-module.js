/* ============================================================
   Logic One SA — Inventory Module
   ------------------------------------------------------------
   Two tabs under one "Inventory" nav item:

   1. STOCK — general parts inventory (batteries, wheels, cables,
      consumables etc.) that Nisal buys and keeps on hand, independent
      of any single job. Backed by the `inventory` Firestore collection
      via netlify/functions/inventory.js.

   2. RECEIVING — a cross-job checklist of Cin7/Technocity warranty
      parts orders that haven't been manually confirmed received yet.
      Pulls from the existing per-job partsOrders pipeline (parts-orders.js
      load-batch action) so nothing new is written for Cin7 orders
      themselves — this is just a central place to process them instead
      of hunting through each job sheet. AusPost/Cin7 "delivered" status
      is shown for reference only and never auto-marks anything received;
      only a manual tick here (or on the job sheet) does that.

   Public API:
     window.invModuleInit()          — call from switchView('inventory')
     window.invRefreshNavBadge()     — recompute the nav badge count
     window.fsInventory(action, payload)
     window.invLookupMap             — { "name" / "name (sku)" -> item }
     window.invItems                 — cached item list

   Depends on: showToast(), jobs[] (dashboard.js), fsPartsOrders(),
   switchView(), jsOpenJob() (jobsheet-module.js)
   ============================================================ */

(function () {
  'use strict';

  // ── Styles ────────────────────────────────────────────────────
  if (document.getElementById('lo-inventory-styles')) return;
  const style = document.createElement('style');
  style.id = 'lo-inventory-styles';
  style.textContent = `
.inv-wrap { padding: 20px 28px; }
.inv-tabs { display: flex; gap: 8px; margin-bottom: 18px; }
.inv-tab-btn {
  padding: 8px 18px; font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
  border: 1px solid var(--border); border-radius: 30px; cursor: pointer;
  background: var(--bg-surface); color: var(--text-secondary); transition: all 0.15s;
}
.inv-tab-btn:hover { border-color: var(--accent); }
.inv-tab-btn.active { background: rgba(0,180,216,0.1); border-color: var(--accent); color: #0369a1; }
.inv-tab-badge {
  display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 10px;
  font-size: 10.5px; font-weight: 700; background: rgba(220,38,38,0.12); color: #dc2626;
}
.inv-panel { display: none; }
.inv-panel.active { display: block; }
.inv-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.inv-search {
  flex: 1; min-width: 200px; max-width: 380px; padding: 8px 14px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  font-family: 'Inter', sans-serif; font-size: 13px; background: var(--bg-surface); color: var(--text-primary);
}
.inv-search:focus { outline: none; border-color: var(--accent); }
.inv-table-wrap { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
.inv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.inv-table th {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--text-secondary); padding: 9px 12px; border-bottom: 1px solid var(--border);
  background: var(--bg-primary); text-align: left;
}
.inv-table td { padding: 9px 12px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
.inv-table tr:hover td { background: var(--bg-surface-hover); }
.inv-table tr.inv-low td { background: rgba(217,119,6,0.06); }
.inv-qty { font-weight: 700; font-family: 'Orbitron', sans-serif; }
.inv-low .inv-qty { color: #d97706; }
.inv-low-tag {
  font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
  color: #d97706; background: rgba(217,119,6,0.12); padding: 2px 7px; border-radius: 10px; margin-left: 6px;
}
.inv-row-actions { display: flex; gap: 6px; }
.inv-mini-btn {
  padding: 5px 10px; font-size: 11.5px; font-weight: 600; font-family: 'Inter', sans-serif;
  border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;
  background: var(--bg-surface); color: var(--text-secondary); transition: all 0.15s; white-space: nowrap;
}
.inv-mini-btn:hover { border-color: var(--accent); color: var(--accent); }
.inv-mini-btn.danger:hover { border-color: #dc2626; color: #dc2626; background: #fef2f2; }
.inv-empty { text-align: center; padding: 34px; color: var(--text-secondary); font-size: 13px; }
.inv-sub { font-size: 11.5px; color: var(--text-secondary); }

/* Receiving */
.inv-recv-card {
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 14px 16px; margin-bottom: 12px;
}
.inv-recv-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.inv-recv-item { font-weight: 600; font-size: 13.5px; }
.inv-recv-job { font-size: 11.5px; color: var(--accent); font-weight: 600; cursor: pointer; }
.inv-recv-job:hover { text-decoration: underline; }
.inv-recv-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11.5px; color: var(--text-secondary); margin-top: 6px; }
.inv-recv-meta a { color: var(--accent); }
.inv-recv-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.inv-recv-flag {
  margin-top: 8px; padding: 8px 10px; border-radius: var(--radius-sm);
  background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.2);
  font-size: 12px; color: #b91c1c;
}
.inv-btn-ok { border-color: rgba(16,185,129,0.4); color: #059669; }
.inv-btn-ok:hover { background: rgba(16,185,129,0.1); border-color: #059669; color: #065f46; }
.inv-btn-flag { border-color: rgba(217,119,6,0.4); color: #b45309; }
.inv-btn-flag:hover { background: rgba(217,119,6,0.1); border-color: #d97706; color: #92400e; }

/* Modals reuse .modal-overlay / .modal / .modal-header / .modal-body / .modal-footer / .ff / .fr2 */
.inv-sign-toggle { display: flex; gap: 8px; margin-bottom: 4px; }
.inv-sign-btn {
  flex: 1; padding: 8px; text-align: center; font-size: 13px; font-weight: 600;
  border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;
  background: var(--bg-surface); color: var(--text-secondary);
}
.inv-sign-btn.active.in  { background: rgba(16,185,129,0.1); border-color: #10b981; color: #065f46; }
.inv-sign-btn.active.out { background: rgba(220,38,38,0.08); border-color: #dc2626; color: #b91c1c; }
.inv-adjust-current { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
`;
  document.head.appendChild(style);
})();

// ============================================================
// STATE
// ============================================================
let invItems = [];
let invLookupMap = {};
let invLoaded = false;
let invUIBuilt = false;
let invActiveTab = 'stock';
let invSearchTerm = '';

let invReceiving = [];
let invReceivingLoaded = false;

let invEditItemId = null;   // set when the item modal is in edit mode
let invAdjustItemId = null;
let invAdjustSign = 1;      // 1 = in, -1 = out

// ============================================================
// API
// ============================================================
async function fsInventory(action, payload) {
  try {
    const res = await fetch('/.netlify/functions/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action }, payload)),
    });
    return await res.json();
  } catch (e) {
    console.warn('inventory ' + action + ' error:', e);
    return { ok: false, error: e.message };
  }
}
window.fsInventory = fsInventory;

// ============================================================
// INIT / UI SHELL
// ============================================================
function invModuleInit() {
  invBuildUI();
  if (!invLoaded) invLoadItems();
  else invRenderStock();
  if (invActiveTab === 'receiving' && !invReceivingLoaded) invLoadReceiving();
}
window.invModuleInit = invModuleInit;

function invBuildUI() {
  const root = document.getElementById('invRoot');
  if (!root || invUIBuilt) return;
  invUIBuilt = true;

  root.innerHTML = `
    <div class="inv-wrap">
      <div class="inv-tabs">
        <button type="button" class="inv-tab-btn active" id="invTabBtnStock" onclick="invSwitchTab('stock')">Stock</button>
        <button type="button" class="inv-tab-btn" id="invTabBtnReceiving" onclick="invSwitchTab('receiving')">
          Receiving <span class="inv-tab-badge" id="invRecvTabBadge" style="display:none;">0</span>
        </button>
      </div>

      <!-- STOCK PANEL -->
      <div class="inv-panel active" id="invPanelStock">
        <div class="inv-toolbar">
          <input type="text" class="inv-search" id="invSearchInput" placeholder="Search name, SKU, category, location…" oninput="invFilterStock()">
          <button class="btn btn-primary" onclick="invOpenAddModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Item
          </button>
        </div>
        <div class="inv-table-wrap">
          <table class="inv-table">
            <thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Qty</th><th>Min</th><th>Cost</th><th>Location</th><th></th></tr></thead>
            <tbody id="invStockBody"><tr><td colspan="8" class="inv-empty">Loading…</td></tr></tbody>
          </table>
        </div>
      </div>

      <!-- RECEIVING PANEL -->
      <div class="inv-panel" id="invPanelReceiving">
        <div class="inv-toolbar">
          <div class="inv-sub">Cin7/Technocity orders not yet confirmed received. Tracking status shown for reference only — nothing here counts as received until you tick it.</div>
          <button class="btn btn-secondary" onclick="invReceivingLoaded=false;invLoadReceiving();">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
        </div>
        <div id="invReceivingBody"><div class="inv-empty">Loading…</div></div>
      </div>
    </div>

    <!-- ADD/EDIT ITEM MODAL -->
    <div class="modal-overlay" id="invItemModal">
      <div class="modal">
        <div class="modal-header"><h2 id="invItemModalTitle">Add Stock Item</h2><button class="modal-close" onclick="invCloseItemModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
        <div class="modal-body">
          <div class="fr2">
            <div class="ff"><label>Name <span class="req">*</span></label><input type="text" id="invFName" placeholder="e.g. S8 MaxV side wheel"></div>
            <div class="ff"><label>SKU / Part #</label><input type="text" id="invFSku" placeholder="Optional"></div>
          </div>
          <div class="fr2">
            <div class="ff"><label>Category</label><input type="text" id="invFCategory" list="invCategoryList" placeholder="e.g. Wheel, Battery, Cable">
              <datalist id="invCategoryList">
                <option value="Battery"><option value="Wheel"><option value="Brush"><option value="Filter">
                <option value="Dock / Charging"><option value="Cable"><option value="Sensor"><option value="Motor">
                <option value="PCB"><option value="Screw / Fastener"><option value="Other">
              </datalist>
            </div>
            <div class="ff"><label>Location</label><input type="text" id="invFLocation" placeholder="e.g. Shelf A2"></div>
          </div>
          <div class="fr2">
            <div class="ff" id="invFQtyWrap"><label>Starting Qty</label><input type="text" inputmode="decimal" id="invFQty" placeholder="0"></div>
            <div class="ff"><label>Min Stock (low-stock alert)</label><input type="text" inputmode="decimal" id="invFMinStock" placeholder="0"></div>
          </div>
          <div class="fr2">
            <div class="ff"><label>Unit Cost ($)</label><input type="text" inputmode="decimal" id="invFCost" placeholder="0.00"></div>
          </div>
          <div class="ff"><label>Notes</label><textarea id="invFNotes" placeholder="Optional"></textarea></div>
          <div id="invItemError" style="display:none;padding:10px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;font-size:13px;color:#dc2626;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="invCloseItemModal()">Cancel</button>
          <button class="btn btn-primary" id="invSaveItemBtn" onclick="invSaveItem()">Save</button>
        </div>
      </div>
    </div>

    <!-- ADJUST STOCK MODAL -->
    <div class="modal-overlay" id="invAdjustModal">
      <div class="modal" style="width:420px;">
        <div class="modal-header"><h2>Adjust Stock</h2><button class="modal-close" onclick="invCloseAdjustModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
        <div class="modal-body">
          <div class="inv-adjust-current" id="invAdjustCurrent"></div>
          <div class="inv-sign-toggle">
            <button type="button" class="inv-sign-btn active in" id="invSignInBtn" onclick="invSetAdjustSign(1)">+ Stock In</button>
            <button type="button" class="inv-sign-btn" id="invSignOutBtn" onclick="invSetAdjustSign(-1)">− Stock Out</button>
          </div>
          <div class="ff"><label>Quantity</label><input type="text" inputmode="decimal" id="invAdjustQty" placeholder="0"></div>
          <div class="ff"><label>Reason</label>
            <select id="invAdjustReason">
              <option value="Received new stock">Received new stock</option>
              <option value="Stocktake / correction">Stocktake / correction</option>
              <option value="Used on job (manual)">Used on job (manual)</option>
              <option value="Damaged / lost">Damaged / lost</option>
              <option value="Returned to supplier">Returned to supplier</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div id="invAdjustError" style="display:none;padding:10px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;font-size:13px;color:#dc2626;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="invCloseAdjustModal()">Cancel</button>
          <button class="btn btn-primary" id="invSubmitAdjustBtn" onclick="invSubmitAdjust()">Apply</button>
        </div>
      </div>
    </div>
  `;
}

// Loads just enough to populate the nav badge (low stock + pending
// receiving counts) at page startup, without needing the Inventory tab
// to have been opened yet. Safe to call before invBuildUI() — every
// render function below no-ops if its target element isn't in the DOM.
function invPreloadBadge() {
  invLoadItems();
  let tries = 0;
  const poll = setInterval(() => {
    tries++;
    const gotJobs = typeof jobs !== 'undefined' && jobs.length;
    if (gotJobs || tries > 20) {
      clearInterval(poll);
      if (gotJobs) invLoadReceiving();
    }
  }, 500);
}
window.invPreloadBadge = invPreloadBadge;

function invSwitchTab(tab) {
  invActiveTab = tab;
  document.getElementById('invTabBtnStock').classList.toggle('active', tab === 'stock');
  document.getElementById('invTabBtnReceiving').classList.toggle('active', tab === 'receiving');
  document.getElementById('invPanelStock').classList.toggle('active', tab === 'stock');
  document.getElementById('invPanelReceiving').classList.toggle('active', tab === 'receiving');
  if (tab === 'receiving' && !invReceivingLoaded) invLoadReceiving();
}
window.invSwitchTab = invSwitchTab;

// ============================================================
// STOCK — load / render
// ============================================================
async function invLoadItems() {
  const res = await fsInventory('list', {});
  invItems = (res.ok && Array.isArray(res.data)) ? res.data : [];
  invLoaded = true;

  invLookupMap = {};
  invItems.forEach(item => {
    const nameKey = (item.name || '').trim().toLowerCase();
    if (nameKey) invLookupMap[nameKey] = item;
    if (item.sku) invLookupMap[`${item.name} (${item.sku})`.trim().toLowerCase()] = item;
  });
  window.invItems = invItems;
  window.invLookupMap = invLookupMap;

  invRenderStock();
  invRefreshNavBadge();
  if (typeof jsEnsureInvDatalist === 'function') jsEnsureInvDatalist();
  if (typeof jsRefreshPartsStockBadges === 'function') jsRefreshPartsStockBadges();
}

function invFilterStock() {
  invSearchTerm = (document.getElementById('invSearchInput')?.value || '').trim().toLowerCase();
  invRenderStock();
}
window.invFilterStock = invFilterStock;

function invRenderStock() {
  const body = document.getElementById('invStockBody');
  if (!body) return;

  const term = invSearchTerm;
  const list = term
    ? invItems.filter(i => [i.name, i.sku, i.category, i.location].some(v => (v || '').toLowerCase().includes(term)))
    : invItems;

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="8" class="inv-empty">${invItems.length ? 'No matching items.' : 'No stock items yet — click Add Item to start your inventory.'}</td></tr>`;
    return;
  }

  const esc = s => String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  body.innerHTML = list.map(i => {
    const qty = parseFloat(i.qty) || 0;
    const min = parseFloat(i.minStock) || 0;
    const low = min > 0 && qty <= min;
    return `
      <tr class="${low ? 'inv-low' : ''}">
        <td>${esc(i.name) || '—'}${low ? '<span class="inv-low-tag">Low</span>' : ''}</td>
        <td class="inv-sub">${esc(i.sku) || '—'}</td>
        <td class="inv-sub">${esc(i.category) || '—'}</td>
        <td class="inv-qty">${qty}</td>
        <td class="inv-sub">${min || '—'}</td>
        <td class="inv-sub">${i.cost != null ? '$' + Number(i.cost).toFixed(2) : '—'}</td>
        <td class="inv-sub">${esc(i.location) || '—'}</td>
        <td>
          <div class="inv-row-actions">
            <button class="inv-mini-btn" onclick="invOpenAdjustModal('${i.id}')">Adjust</button>
            <button class="inv-mini-btn" onclick="invOpenEditModal('${i.id}')">Edit</button>
            <button class="inv-mini-btn danger" onclick="invDeleteItem('${i.id}')">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function invRefreshNavBadge() {
  const lowCount = invItems.filter(i => {
    const qty = parseFloat(i.qty) || 0, min = parseFloat(i.minStock) || 0;
    return min > 0 && qty <= min;
  }).length;
  const recvCount = invReceiving.length;
  const total = lowCount + recvCount;
  const badge = document.getElementById('invNavBadge');
  if (!badge) return;
  if (total > 0) {
    badge.textContent = total;
    badge.style.display = '';
    badge.title = [
      lowCount ? `${lowCount} low stock` : '',
      recvCount ? `${recvCount} pending receipt` : '',
    ].filter(Boolean).join(' · ');
  } else {
    badge.style.display = 'none';
  }
}
window.invRefreshNavBadge = invRefreshNavBadge;

// ============================================================
// ADD / EDIT ITEM MODAL
// ============================================================
function invOpenAddModal(prefillName, prefillCost) {
  invEditItemId = null;
  document.getElementById('invItemModalTitle').textContent = 'Add Stock Item';
  document.getElementById('invFName').value = prefillName || '';
  document.getElementById('invFSku').value = '';
  document.getElementById('invFCategory').value = '';
  document.getElementById('invFLocation').value = '';
  document.getElementById('invFQty').value = '1';
  document.getElementById('invFMinStock').value = '';
  document.getElementById('invFCost').value = prefillCost != null ? prefillCost : '';
  document.getElementById('invFNotes').value = '';
  document.getElementById('invFQtyWrap').style.display = '';
  document.getElementById('invItemError').style.display = 'none';
  document.getElementById('invItemModal').classList.add('show');
}
window.invOpenAddModal = invOpenAddModal;

function invOpenEditModal(itemId) {
  const item = invItems.find(i => i.id === itemId);
  if (!item) return;
  invEditItemId = itemId;
  document.getElementById('invItemModalTitle').textContent = 'Edit Stock Item';
  document.getElementById('invFName').value = item.name || '';
  document.getElementById('invFSku').value = item.sku || '';
  document.getElementById('invFCategory').value = item.category || '';
  document.getElementById('invFLocation').value = item.location || '';
  document.getElementById('invFMinStock').value = item.minStock || '';
  document.getElementById('invFCost').value = item.cost != null ? item.cost : '';
  document.getElementById('invFNotes').value = item.notes || '';
  // Qty is edited via Adjust (for the audit trail) — hide the field here
  document.getElementById('invFQtyWrap').style.display = 'none';
  document.getElementById('invItemError').style.display = 'none';
  document.getElementById('invItemModal').classList.add('show');
}
window.invOpenEditModal = invOpenEditModal;

function invCloseItemModal() {
  document.getElementById('invItemModal').classList.remove('show');
}
window.invCloseItemModal = invCloseItemModal;

async function invSaveItem() {
  const name = document.getElementById('invFName').value.trim();
  const errEl = document.getElementById('invItemError');
  if (!name) {
    errEl.textContent = 'Name is required.';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  const payload = {
    name,
    sku: document.getElementById('invFSku').value.trim(),
    category: document.getElementById('invFCategory').value.trim(),
    location: document.getElementById('invFLocation').value.trim(),
    minStock: document.getElementById('invFMinStock').value,
    cost: document.getElementById('invFCost').value,
    notes: document.getElementById('invFNotes').value.trim(),
  };

  const btn = document.getElementById('invSaveItemBtn');
  btn.disabled = true;

  let res;
  if (invEditItemId) {
    res = await fsInventory('update', Object.assign({ itemId: invEditItemId }, payload));
  } else {
    payload.qty = document.getElementById('invFQty').value;
    res = await fsInventory('add', payload);
  }

  btn.disabled = false;

  if (!res.ok) {
    errEl.textContent = 'Save failed: ' + (res.error || 'Unknown error');
    errEl.style.display = 'block';
    return;
  }

  invCloseItemModal();
  if (typeof showToast === 'function') showToast('success', invEditItemId ? 'Item updated' : 'Item added');
  await invLoadItems();
}
window.invSaveItem = invSaveItem;

async function invDeleteItem(itemId) {
  const item = invItems.find(i => i.id === itemId);
  if (!confirm(`Delete "${item ? item.name : 'this item'}" from inventory? This can't be undone.`)) return;
  const res = await fsInventory('delete', { itemId });
  if (!res.ok) {
    if (typeof showToast === 'function') showToast('error', 'Delete failed: ' + res.error);
    return;
  }
  if (typeof showToast === 'function') showToast('success', 'Item deleted');
  await invLoadItems();
}
window.invDeleteItem = invDeleteItem;

// ============================================================
// ADJUST STOCK MODAL
// ============================================================
function invSetAdjustSign(sign) {
  invAdjustSign = sign;
  document.getElementById('invSignInBtn').classList.toggle('active', sign === 1);
  document.getElementById('invSignOutBtn').classList.toggle('active', sign === -1);
}
window.invSetAdjustSign = invSetAdjustSign;

function invOpenAdjustModal(itemId) {
  const item = invItems.find(i => i.id === itemId);
  if (!item) return;
  invAdjustItemId = itemId;
  invSetAdjustSign(1);
  document.getElementById('invAdjustCurrent').textContent = `${item.name} — currently ${parseFloat(item.qty) || 0} in stock`;
  document.getElementById('invAdjustQty').value = '';
  document.getElementById('invAdjustReason').value = 'Received new stock';
  document.getElementById('invAdjustError').style.display = 'none';
  document.getElementById('invAdjustModal').classList.add('show');
}
window.invOpenAdjustModal = invOpenAdjustModal;

function invCloseAdjustModal() {
  document.getElementById('invAdjustModal').classList.remove('show');
}
window.invCloseAdjustModal = invCloseAdjustModal;

async function invSubmitAdjust() {
  const errEl = document.getElementById('invAdjustError');
  const qty = parseFloat(document.getElementById('invAdjustQty').value);
  if (!qty || qty <= 0) {
    errEl.textContent = 'Enter a quantity greater than 0.';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  const btn = document.getElementById('invSubmitAdjustBtn');
  btn.disabled = true;
  const res = await fsInventory('adjust', {
    itemId: invAdjustItemId,
    delta: qty * invAdjustSign,
    reason: document.getElementById('invAdjustReason').value,
  });
  btn.disabled = false;

  if (!res.ok) {
    errEl.textContent = 'Adjust failed: ' + (res.error || 'Unknown error');
    errEl.style.display = 'block';
    return;
  }

  invCloseAdjustModal();
  if (typeof showToast === 'function') showToast('success', 'Stock updated');
  await invLoadItems();
}
window.invSubmitAdjust = invSubmitAdjust;

// ============================================================
// RECEIVING — cross-job Cin7 checklist
// ============================================================
async function invLoadReceiving() {
  const bodyEl = document.getElementById('invReceivingBody');
  if (bodyEl) bodyEl.innerHTML = '<div class="inv-empty">Loading…</div>';

  const jobList = (typeof jobs !== 'undefined') ? jobs : [];
  if (!jobList.length) {
    if (bodyEl) bodyEl.innerHTML = '<div class="inv-empty">No jobs loaded yet — hit Sync in the top bar, then Refresh here.</div>';
    return;
  }

  const jobIds = jobList.filter(j => j.status !== 'Collected').map(j => j.jobId).filter(Boolean);
  const res = await fsPartsOrders('load-batch', { jobIds });
  invReceivingLoaded = true;

  invReceiving = [];
  if (res.ok && res.data) {
    Object.keys(res.data).forEach(jobId => {
      const job = jobList.find(j => j.jobId === jobId);
      (res.data[jobId] || []).forEach(order => {
        if (order.received) return; // already confirmed — not our concern here
        invReceiving.push(Object.assign({ jobId, job }, order));
      });
    });
  }
  // Flagged items first, then by order date
  invReceiving.sort((a, b) => {
    if (!!b.flagged !== !!a.flagged) return b.flagged ? 1 : -1;
    return (b.addedAt || '').localeCompare(a.addedAt || '');
  });

  const badge = document.getElementById('invRecvTabBadge');
  if (badge) {
    badge.textContent = invReceiving.length;
    badge.style.display = invReceiving.length ? '' : 'none';
  }

  invRenderReceiving();
  invRefreshNavBadge();
}

function invRenderReceiving() {
  const body = document.getElementById('invReceivingBody');
  if (!body) return;

  if (!invReceiving.length) {
    body.innerHTML = '<div class="inv-empty">Nothing pending — every recorded order has been checked off.</div>';
    return;
  }

  const esc = s => String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  body.innerHTML = invReceiving.map(o => {
    const trackUrl = o.trackingCode
      ? `https://auspost.com.au/mypost/track/#/details/${encodeURIComponent(o.trackingCode)}`
      : '';
    const jobLabel = o.job ? `${o.jobId} — ${esc(o.job.name || '')}` : o.jobId;
    return `
      <div class="inv-recv-card">
        <div class="inv-recv-top">
          <div>
            <div class="inv-recv-item">${esc(o.item) || esc(o.itemRaw) || 'Item not parsed'}</div>
            <div class="inv-recv-job" onclick="invOpenJobFromReceiving('${esc(o.jobId)}')">${jobLabel} →</div>
          </div>
          ${o.cost ? `<div style="font-size:13px;color:var(--text-secondary);">$${Number(o.cost).toFixed(2)}</div>` : ''}
        </div>
        <div class="inv-recv-meta">
          <span>Order ${esc(o.orderRef) || '—'}</span>
          ${o.invoiceNo ? `<span>Inv ${esc(o.invoiceNo)}</span>` : ''}
          ${o.invoiceDate ? `<span>${esc(o.invoiceDate)}</span>` : ''}
          ${o.driveFileUrl ? `<a href="${esc(o.driveFileUrl)}" target="_blank">Invoice PDF</a>` : ''}
          ${trackUrl ? `<a href="${trackUrl}" target="_blank">Tracking: ${esc(o.trackingCode)} (carrier status — not confirmed)</a>` : ''}
        </div>
        ${o.needsReview ? `<div style="font-size:11px;color:#d97706;margin-top:6px;">⚠️ Some fields may not have parsed cleanly — check against the invoice PDF</div>` : ''}
        ${o.flagged ? `<div class="inv-recv-flag">⚠ Flagged: ${esc(o.flagNote) || 'Marked as an issue'} — <span style="cursor:pointer;text-decoration:underline;" onclick="invClearFlag('${esc(o.jobId)}','${esc(o.orderRef)}')">clear flag</span></div>` : ''}
        <div class="inv-recv-actions">
          <button class="inv-mini-btn inv-btn-ok" onclick="invMarkReceived('${esc(o.jobId)}','${esc(o.orderRef)}')">✓ Confirmed received</button>
          <button class="inv-mini-btn inv-btn-flag" onclick="invFlagOrder('${esc(o.jobId)}','${esc(o.orderRef)}')">⚠ Flag an issue</button>
          <button class="inv-mini-btn" onclick="invQuickAddToStock('${esc(o.item || o.itemRaw)}', ${o.cost || 'null'})">+ Also add to general stock</button>
        </div>
      </div>`;
  }).join('');
}

function invOpenJobFromReceiving(jobId) {
  switchView('jobsheet');
  if (typeof jsOpenJob === 'function') jsOpenJob(jobId);
}
window.invOpenJobFromReceiving = invOpenJobFromReceiving;

async function invMarkReceived(jobId, orderRef) {
  const res = await fsPartsOrders('mark-received', { jobId, orderRef, received: true, flagged: false, flagNote: '' });
  if (!res.ok) {
    if (typeof showToast === 'function') showToast('error', 'Could not update: ' + res.error);
    return;
  }
  invReceiving = invReceiving.filter(o => !(o.jobId === jobId && o.orderRef === orderRef));
  invRenderReceiving();
  invRefreshNavBadge();
  const badge = document.getElementById('invRecvTabBadge');
  if (badge) { badge.textContent = invReceiving.length; badge.style.display = invReceiving.length ? '' : 'none'; }
  if (typeof showToast === 'function') showToast('success', 'Marked received');
  // Keep the job sheet's own Cin7 list in sync if that job happens to be open
  if (typeof jsCurrentJob !== 'undefined' && jsCurrentJob && jsCurrentJob.jobId === jobId && typeof jsLoadCin7Orders === 'function') {
    jsLoadCin7Orders(jobId);
  }
}
window.invMarkReceived = invMarkReceived;

async function invFlagOrder(jobId, orderRef) {
  const note = prompt('What\'s wrong with this order? (e.g. "tracking says delivered but box was empty", "wrong part received")');
  if (note === null) return; // cancelled
  const res = await fsPartsOrders('mark-received', { jobId, orderRef, received: false, flagged: true, flagNote: note.trim() || 'Marked as an issue' });
  if (!res.ok) {
    if (typeof showToast === 'function') showToast('error', 'Could not flag: ' + res.error);
    return;
  }
  const o = invReceiving.find(x => x.jobId === jobId && x.orderRef === orderRef);
  if (o) { o.flagged = true; o.flagNote = note.trim() || 'Marked as an issue'; }
  invRenderReceiving();
  if (typeof showToast === 'function') showToast('success', 'Flagged for follow-up');
  if (typeof jsCurrentJob !== 'undefined' && jsCurrentJob && jsCurrentJob.jobId === jobId && typeof jsLoadCin7Orders === 'function') {
    jsLoadCin7Orders(jobId);
  }
}
window.invFlagOrder = invFlagOrder;

async function invClearFlag(jobId, orderRef) {
  const res = await fsPartsOrders('mark-received', { jobId, orderRef, received: false, flagged: false, flagNote: '' });
  if (!res.ok) {
    if (typeof showToast === 'function') showToast('error', 'Could not clear flag: ' + res.error);
    return;
  }
  const o = invReceiving.find(x => x.jobId === jobId && x.orderRef === orderRef);
  if (o) { o.flagged = false; o.flagNote = ''; }
  invRenderReceiving();
  if (typeof jsCurrentJob !== 'undefined' && jsCurrentJob && jsCurrentJob.jobId === jobId && typeof jsLoadCin7Orders === 'function') {
    jsLoadCin7Orders(jobId);
  }
}
window.invClearFlag = invClearFlag;

function invQuickAddToStock(name, cost) {
  invSwitchTab('stock');
  document.getElementById('invTabBtnStock').classList.add('active');
  document.getElementById('invTabBtnReceiving').classList.remove('active');
  document.getElementById('invPanelStock').classList.add('active');
  document.getElementById('invPanelReceiving').classList.remove('active');
  invOpenAddModal(name, cost);
}
window.invQuickAddToStock = invQuickAddToStock;
