// Logic One SA — Technocity Order Lookup Module
// Loads Roborock + Segway order exports from Drive on dashboard init.
// Wires an autocomplete search bar into the New Job modal so typing a
// customer name, serial number, or case number pre-fills all intake fields.

(function () {

  // ── State ────────────────────────────────────────────────────────────
  let tcOrders   = [];   // flat array of normalised order objects
  let tcLoaded   = false;
  let tcLoading  = false;
  let tcSelected = null; // the order currently applied to the form

  // ── Warranty map ─────────────────────────────────────────────────────
  // Technocity codes → dashboard values
  const WARRANTY_MAP = {
    'IW':  'In Warranty',
    'OOW': 'Out of Warranty',
    'OW':  'Out of Warranty',
  };

  // ── Brand inference ───────────────────────────────────────────────────
  function inferBrand(order) {
    if (order._brand === 'Segway') return 'Segway';
    return 'Roborock'; // default for Roborock sheet
  }

  function inferDeviceType(brand) {
    if (brand === 'Segway') return 'Scooter';
    return 'Robot Vacuum';
  }

  // ── Init — called once after dashboard loads ─────────────────────────
  function tcInit() {
    if (tcLoaded || tcLoading) return;
    tcLoading = true;
    tcFetchOrders();
  }

  async function tcFetchOrders() {
    // cfg is a const in dashboard.js — not on window — access it directly
    const localCfg = (typeof cfg !== 'undefined') ? cfg : null;
    if (!localCfg || !localCfg.appsScriptUrl) {
      tcLoading = false;
      return;
    }
    try {
      const res = await callScript({ action: 'loadTechnocityOrders' }, { timeoutMs: 30000 });
      if (res.ok && Array.isArray(res.data)) {
        tcOrders = res.data;
        tcLoaded = true;
        // Update badge immediately if modal is already open,
        // and again after a tick in case it opens mid-fetch.
        updateStatusBadge();
        setTimeout(updateStatusBadge, 100);
      } else {
        console.warn('Technocity orders not available:', res.error || res);
      }
    } catch (e) {
      console.warn('Technocity fetch error:', e);
    }
    tcLoading = false;
  }

  function updateStatusBadge() {
    const badge = document.getElementById('tcStatusBadge');
    if (!badge) return;
    if (tcLoaded && tcOrders.length > 0) {
      badge.textContent = tcOrders.length + ' orders loaded';
      badge.className = 'tc-badge tc-badge-ok';
    } else if (tcLoading) {
      badge.textContent = 'Loading orders…';
      badge.className = 'tc-badge tc-badge-loading';
    } else {
      badge.textContent = 'Orders unavailable';
      badge.className = 'tc-badge tc-badge-err';
    }
  }

  // ── Search ─────────────────────────────────────────────────────────
  function tcSearch(term) {
    if (!term || term.length < 2) return [];
    const q = term.toLowerCase().trim();
    return tcOrders.filter(o =>
      (o.caseNo   || '').toLowerCase().includes(q) ||
      (o.solvupNo || '').toLowerCase().includes(q) ||
      (o.serial   || '').toLowerCase().includes(q) ||
      (o.name     || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }

  // ── Fill form from selected order ─────────────────────────────────
  function tcApplyOrder(order) {
    tcSelected = order;

    const brand      = inferBrand(order);
    const deviceType = inferDeviceType(brand);
    const warranty   = WARRANTY_MAP[order.warrantyCode] || 'In Warranty';

    // Device + brand + model
    const typeEl = document.getElementById('nType');
    if (typeEl) { typeEl.value = deviceType; }

    const brandEl = document.getElementById('nBrand');
    if (brandEl) { brandEl.value = brand; }

    const modelEl = document.getElementById('nModel');
    if (modelEl) { modelEl.value = order.model || ''; }

    // Serial + case
    const serialEl = document.getElementById('nSerial');
    if (serialEl) { serialEl.value = order.serial || ''; }

    const caseEl = document.getElementById('nCase');
    if (caseEl) {
      // Prefer Solvup case number; fall back to Technocity case number
      caseEl.value = order.solvupNo || order.caseNo || '';
    }

    // Customer
    const nameEl = document.getElementById('nName');
    if (nameEl) { nameEl.value = order.name || ''; }

    const phoneEl = document.getElementById('nPhone');
    if (phoneEl) { phoneEl.value = order.phone || ''; }

    const emailEl = document.getElementById('nEmail');
    if (emailEl) { emailEl.value = order.email || ''; }

    // Issue / fault description
    const issueEl = document.getElementById('nIssue');
    if (issueEl) { issueEl.value = order.issue || ''; }

    // Warranty
    const warrantyEl = document.getElementById('nWarranty');
    if (warrantyEl) { warrantyEl.value = warranty; }

    // Accessories — rebuild checklist for device type, then tick matching ones
    if (typeof updateNewJobAccessories === 'function') updateNewJobAccessories();
    if (order.accessories) {
      const receivedItems = order.accessories.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      document.querySelectorAll('#newJobModal .cb-group input').forEach(cb => {
        const match = receivedItems.some(r =>
          r.includes(cb.value.toLowerCase()) || cb.value.toLowerCase().includes(r)
        );
        cb.checked = match;
      });
    }

    // Remove field-err highlights that might have been set by a prior validation attempt
    ['nBrand','nModel','nIssue','nName','nPhone','nEmail'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('field-err');
    });

    // Show the applied banner
    const banner = document.getElementById('tcAppliedBanner');
    if (banner) {
      banner.textContent = '✓ Pre-filled from: ' + (order.caseNo || order.solvupNo || order.name);
      banner.style.display = 'block';
    }

    // Hide dropdown and clear search
    tcHideDropdown();
    const inp = document.getElementById('tcSearchInput');
    if (inp) inp.value = '';
  }

  // ── Dropdown rendering ────────────────────────────────────────────
  function tcShowDropdown(results) {
    const dd = document.getElementById('tcDropdown');
    if (!dd) return;
    if (!results.length) { tcHideDropdown(); return; }

    dd.innerHTML = results.map((o, i) =>
      `<div class="tc-dd-item" data-idx="${i}">
        <div class="tc-dd-main">
          <span class="tc-dd-name">${escHtml(o.name || '—')}</span>
          <span class="tc-dd-model">${escHtml(o.model || '')}</span>
        </div>
        <div class="tc-dd-sub">
          <span class="tc-dd-case">${escHtml(o.solvupNo || o.caseNo || '')}</span>
          <span class="tc-dd-serial">${escHtml(o.serial || '')}</span>
          <span class="tc-dd-wty ${(o.warrantyCode === 'IW') ? 'wty-iw' : 'wty-oow'}">${escHtml(WARRANTY_MAP[o.warrantyCode] || o.warrantyCode || '')}</span>
        </div>
      </div>`
    ).join('');

    dd.querySelectorAll('.tc-dd-item').forEach((el, i) => {
      el.addEventListener('mousedown', e => {
        e.preventDefault(); // prevent blur firing before click
        tcApplyOrder(results[i]);
      });
    });

    dd.style.display = 'block';
    // Store results for keyboard nav
    dd._results = results;
    dd._cursor  = -1;
  }

  function tcHideDropdown() {
    const dd = document.getElementById('tcDropdown');
    if (dd) { dd.style.display = 'none'; dd._cursor = -1; }
  }

  // ── Keyboard navigation ───────────────────────────────────────────
  function tcKeyNav(e) {
    const dd = document.getElementById('tcDropdown');
    if (!dd || dd.style.display === 'none') return;
    const items = dd.querySelectorAll('.tc-dd-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      dd._cursor = Math.min((dd._cursor || -1) + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      dd._cursor = Math.max((dd._cursor || 0) - 1, 0);
    } else if (e.key === 'Enter' && dd._cursor >= 0) {
      e.preventDefault();
      tcApplyOrder(dd._results[dd._cursor]);
      return;
    } else if (e.key === 'Escape') {
      tcHideDropdown(); return;
    } else {
      return;
    }

    items.forEach((el, i) => el.classList.toggle('tc-dd-item-active', i === dd._cursor));
    items[dd._cursor]?.scrollIntoView({ block: 'nearest' });
  }

  // ── Inject UI into modal ──────────────────────────────────────────
  function tcInjectUI() {
    if (document.getElementById('tcSearchWrap')) {
      // Already injected — just refresh the badge with current load state
      updateStatusBadge();
      return;
    }

    const modalBody = document.querySelector('#newJobModal .modal-body');
    if (!modalBody) return;

    const wrap = document.createElement('div');
    wrap.id = 'tcSearchWrap';
    wrap.innerHTML = `
      <div class="tc-search-label">
        <span>Auto-fill from Technocity</span>
        <span id="tcStatusBadge" class="tc-badge tc-badge-loading">Loading orders…</span>
      </div>
      <div class="tc-search-row">
        <div class="tc-input-wrap">
          <svg class="tc-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="tcSearchInput" class="tc-search-input" placeholder="Type name, serial or case number…" autocomplete="off">
          <button class="tc-clear-btn" id="tcClearBtn" title="Clear" style="display:none">×</button>
        </div>
        <div id="tcDropdown" class="tc-dropdown" style="display:none"></div>
      </div>
      <div id="tcAppliedBanner" class="tc-applied-banner" style="display:none"></div>
      <div class="tc-divider"><span>or fill in manually</span></div>
    `;

    // Insert at the very top of modal-body
    modalBody.insertBefore(wrap, modalBody.firstChild);

    // Wire events
    const inp = document.getElementById('tcSearchInput');
    const clearBtn = document.getElementById('tcClearBtn');

    inp.addEventListener('input', () => {
      const term = inp.value.trim();
      clearBtn.style.display = term ? 'flex' : 'none';
      if (term.length >= 2) {
        tcShowDropdown(tcSearch(term));
      } else {
        tcHideDropdown();
      }
    });

    inp.addEventListener('keydown', tcKeyNav);
    inp.addEventListener('blur', () => setTimeout(tcHideDropdown, 150));

    clearBtn.addEventListener('click', () => {
      inp.value = '';
      clearBtn.style.display = 'none';
      tcHideDropdown();
      const banner = document.getElementById('tcAppliedBanner');
      if (banner) banner.style.display = 'none';
    });

    // Update badge state in case orders already loaded
    updateStatusBadge();
  }

  // ── Reset — called when modal is closed/reset ─────────────────────
  function tcReset() {
    tcSelected = null;
    // Remove the entire injected wrap so injectUI() rebuilds it fresh
    // on next open — guarantees no stale input, banner, or dropdown state.
    const wrap = document.getElementById('tcSearchWrap');
    if (wrap) wrap.remove();
  }

  // ── Styles ────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
#tcSearchWrap {
  margin-bottom: 18px;
}
.tc-search-label {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.6px; color: var(--text-secondary);
  margin-bottom: 8px;
}
.tc-badge {
  font-size: 10px; font-weight: 600; text-transform: none; letter-spacing: 0;
  padding: 2px 8px; border-radius: 20px;
}
.tc-badge-ok      { background: rgba(5,150,105,0.08); color: #059669; border: 1px solid rgba(5,150,105,0.2); }
.tc-badge-loading { background: rgba(245,158,11,0.08); color: #d97706; border: 1px solid rgba(245,158,11,0.2); }
.tc-badge-err     { background: rgba(239,68,68,0.08); color: #dc2626; border: 1px solid rgba(239,68,68,0.2); }

.tc-search-row { position: relative; }
.tc-input-wrap {
  display: flex; align-items: center; gap: 8px;
  border: 1.5px solid var(--accent); border-radius: var(--radius-sm);
  background: var(--bg-surface); padding: 0 10px;
  transition: box-shadow 0.15s;
}
.tc-input-wrap:focus-within {
  box-shadow: 0 0 0 3px rgba(0,180,216,0.12);
}
.tc-search-icon { color: var(--accent); flex-shrink: 0; }
.tc-search-input {
  flex: 1; padding: 9px 0; font-family: 'Inter', sans-serif; font-size: 13px;
  border: none; outline: none; background: transparent; color: var(--text-primary);
}
.tc-search-input::placeholder { color: var(--text-secondary); }
.tc-clear-btn {
  background: none; border: none; cursor: pointer;
  color: var(--text-secondary); font-size: 18px; line-height: 1;
  padding: 2px 0; display: flex; align-items: center; flex-shrink: 0;
}
.tc-clear-btn:hover { color: var(--text-primary); }

.tc-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-md); box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  z-index: 200; max-height: 280px; overflow-y: auto;
}
.tc-dd-item {
  padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-light);
  transition: background 0.1s;
}
.tc-dd-item:last-child { border-bottom: none; }
.tc-dd-item:hover, .tc-dd-item-active { background: rgba(0,180,216,0.06); }
.tc-dd-main {
  display: flex; align-items: baseline; gap: 10px; margin-bottom: 3px;
}
.tc-dd-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.tc-dd-model { font-size: 12px; color: var(--text-secondary); }
.tc-dd-sub {
  display: flex; align-items: center; gap: 10px;
}
.tc-dd-case   { font-size: 11px; color: var(--text-secondary); font-family: 'Orbitron', monospace; letter-spacing: 0.3px; }
.tc-dd-serial { font-size: 11px; color: var(--text-secondary); }
.tc-dd-wty {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; padding: 1px 6px; border-radius: 10px;
}
.wty-iw  { background: rgba(5,150,105,0.1); color: #059669; }
.wty-oow { background: rgba(239,68,68,0.1); color: #dc2626; }

.tc-applied-banner {
  margin-top: 8px; padding: 7px 12px;
  background: rgba(5,150,105,0.08); border: 1px solid rgba(5,150,105,0.2);
  border-radius: var(--radius-sm); font-size: 12px; color: #059669; font-weight: 500;
}

.tc-divider {
  display: flex; align-items: center; gap: 10px;
  margin: 16px 0 0; font-size: 11px; color: var(--text-secondary);
}
.tc-divider::before, .tc-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--border-light);
}
`;
  document.head.appendChild(style);

  // ── Helpers ───────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Public API ────────────────────────────────────────────────────
  window.tcLookup = { init: tcInit, injectUI: tcInjectUI, reset: tcReset };

  // Self-start — fetch orders immediately after the module loads.
  // dashboard.js may have already run DOMContentLoaded by this point,
  // so we cannot rely on loadData() calling us — we call ourselves.
  tcInit();

})();
