/* ============================================================
   Logic One SA — Report Module
   ------------------------------------------------------------
   Self-contained module that hooks into the existing dashboard
   to generate a Customer Report PDF and save it to the job's
   Drive folder via Apps Script.

   Dependencies:
   - jsPDF (loaded on-demand from CDN — vector PDF only, no rasterisation)
   - Existing globals from dashboard.js / jobsheet-module.js:
       cfg, callScript, showToast, jsCurrentJob,
       jsCollectData, jobs (or filtered())
   - Apps Script handler 'saveReport' (see saveReport-snippet.gs)

   Public functions exposed on window:
   - reportOpenForCurrentJob()    -> Job Sheet topbar button
   - reportOpenForJobId(jobId)    -> All Jobs row button
   ============================================================ */

(function () {
  'use strict';

  // ── Style injection ─────────────────────────────────────────
  const STYLE = `
.lo-report-overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  display: none; align-items: center; justify-content: center;
  z-index: 9000;
  padding: 24px;
}
.lo-report-overlay.show { display: flex; }
/* Ensure toasts always sit above the report modal */
.toast { z-index: 10000 !important; }
.lo-report-modal {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.25);
  width: 100%; max-width: 880px;
  max-height: 92vh;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.lo-report-header {
  padding: 18px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}
.lo-report-header h2 {
  margin: 0; font-size: 17px; font-weight: 700;
  font-family: 'Orbitron', sans-serif; letter-spacing: 0.04em;
  color: #0f172a;
}
.lo-report-header-sub {
  font-size: 12px; color: #64748b; margin-top: 2px;
  font-family: 'Inter', sans-serif;
}
.lo-report-close {
  background: none; border: 0; cursor: pointer;
  width: 36px; height: 36px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: #64748b; transition: background 0.15s;
}
.lo-report-close:hover { background: #f1f5f9; color: #0f172a; }

.lo-report-body {
  flex: 1; overflow-y: auto;
  background: #f5f7fa;
  padding: 24px;
}
.lo-report-preview {
  background: #fff;
  width: 794px;       /* A4 width @ 96dpi */
  max-width: 100%;
  min-height: 1123px; /* A4 height @ 96dpi */
  margin: 0 auto;
  padding: 56px 56px 64px;  /* ~15mm visual margin */
  box-shadow: 0 4px 20px rgba(15,23,42,0.08);
  border-radius: 4px;
  font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px; line-height: 1.5;
  color: #0f172a;
  box-sizing: border-box;
}

/* Report content styles (scoped to .lo-report-preview) */
.lo-report-preview * { box-sizing: border-box; }

.lor-header {
  display: flex; justify-content: space-between; align-items: center;
  gap: 24px; padding-bottom: 14px;
  border-bottom: 2px solid #0f172a; margin-bottom: 20px;
}
.lor-header-left { display: flex; align-items: center; gap: 12px; }
.lor-logo { height: 42px; width: auto; }
.lor-logo-text { height: 26px; width: auto; max-width: 160px; display: block; margin-bottom: 3px; }
.lor-brand-block { display: flex; flex-direction: column; justify-content: center; }
.lor-brand-name {
  font-family: 'Orbitron', sans-serif;
  font-weight: 900; font-size: 14px;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: #0f172a; line-height: 1; margin-bottom: 3px;
}
.lor-brand-tag { font-size: 10.5px; color: #475569; letter-spacing: 0.04em; }
.lor-header-right { text-align: right; flex-shrink: 0; }
.lor-doc-type {
  font-family: 'Orbitron', sans-serif;
  font-weight: 700; font-size: 13px;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: #0066cc;
}
.lor-doc-id {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 13px; font-weight: 500; color: #0f172a; margin-top: 4px;
}
.lor-doc-date { font-size: 12px; color: #475569; margin-top: 2px; }

.lor-section { margin-bottom: 22px; }
.lor-section-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: #475569;
  padding-bottom: 6px; border-bottom: 1px solid #e2e8f0;
  margin-bottom: 12px;
}
.lor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
.lor-field { display: flex; flex-direction: column; gap: 2px; }
.lor-field-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
  color: #94a3b8; font-weight: 600;
}
.lor-field-value {
  font-size: 13px; color: #0f172a; font-weight: 500; word-break: break-word;
}
.lor-field-value.mono {
  font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 12px;
}
.lor-pill {
  display: inline-block; padding: 2px 10px; font-size: 11px; font-weight: 600;
  border-radius: 999px; letter-spacing: 0.04em; text-transform: uppercase;
}
.lor-pill.warranty { background: #d1fae5; color: #047857; }
.lor-pill.oow { background: #fef3c7; color: #b45309; }

.lor-stage-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.8px; color: #64748b;
  margin: 14px 0 3px; padding-left: 2px;
}
.lor-stage-label:first-child { margin-top: 0; }
.lor-prose {
  background: #f5f7fa; border-left: 3px solid #0066cc;
  padding: 12px 16px; font-size: 13px; line-height: 1.6; color: #0f172a;
  border-radius: 0 4px 4px 0; white-space: pre-wrap;
}
.lor-prose ul { margin: 6px 0; padding-left: 18px; }
.lor-prose li { margin-bottom: 4px; }
.lor-prose-stage { margin-bottom: 0; }
.lor-empty { font-size: 12px; color: #94a3b8; font-style: italic; padding: 8px 0; }

.lor-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.lor-table th {
  text-align: left; font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.08em; color: #94a3b8; font-weight: 600;
  padding: 8px 10px; border-bottom: 1px solid #cbd5e1;
}
.lor-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
.lor-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.lor-table tfoot td { border-bottom: 0; font-weight: 600; }
.lor-table tfoot tr.total td {
  border-top: 2px solid #0f172a; font-size: 15px; padding-top: 12px; color: #003d80;
}
.lor-signatures {
  display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 28px;
}
.lor-sig { border-top: 1px solid #0f172a; padding-top: 6px; }
.lor-sig-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
  color: #94a3b8; font-weight: 600;
}
.lor-sig-name { font-size: 12px; color: #475569; margin-top: 2px; }
.lor-footer {
  margin-top: 32px; padding-top: 14px; border-top: 1px solid #e2e8f0;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 11px; color: #94a3b8;
}
.lor-footer .lor-stamp {
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 0.12em; text-transform: uppercase;
}

.lo-report-footer {
  padding: 14px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-shrink: 0;
  background: #fff;
}
.lo-report-footer-info {
  font-size: 12px; color: #64748b;
}
.lo-report-actions { display: flex; gap: 10px; }
.lo-report-btn {
  padding: 9px 18px;
  border-radius: 7px;
  font-size: 13px; font-weight: 600;
  font-family: 'Inter', sans-serif;
  cursor: pointer; transition: all 0.15s;
  border: 1px solid transparent;
  display: inline-flex; align-items: center; gap: 7px;
}
.lo-report-btn-secondary {
  background: #fff; border-color: #cbd5e1; color: #0f172a;
}
.lo-report-btn-secondary:hover { background: #f1f5f9; border-color: #94a3b8; }
.lo-report-btn-primary {
  background: #0066cc; color: #fff;
}
.lo-report-btn-primary:hover:not(:disabled) { background: #003d80; }
.lo-report-btn-primary:disabled { opacity: 0.6; cursor: wait; }
.lo-report-btn svg { width: 15px; height: 15px; }

.lo-report-loading {
  position: absolute; inset: 0;
  background: rgba(255,255,255,0.92);
  display: none; align-items: center; justify-content: center;
  flex-direction: column; gap: 12px;
  z-index: 5;
}
.lo-report-loading.show { display: flex; }
.lo-report-spinner {
  width: 36px; height: 36px;
  border: 3px solid #e2e8f0; border-top-color: #0066cc;
  border-radius: 50%; animation: lor-spin 0.8s linear infinite;
}
@keyframes lor-spin { to { transform: rotate(360deg); } }
.lo-report-loading-msg { font-size: 13px; color: #475569; font-weight: 500; }

/* Row icon button for All Jobs table */
.lo-row-report-btn {
  background: none; border: 0; cursor: pointer;
  padding: 4px 6px; border-radius: 4px;
  color: #64748b; display: inline-flex; align-items: center;
  transition: background 0.15s, color 0.15s;
}
.lo-row-report-btn:hover { background: #e6f0fb; color: #0066cc; }
.lo-row-report-btn svg { width: 16px; height: 16px; }

/* ── Photo picker ──────────────────────────────────────────── */
.lo-photo-panel {
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 16px 24px;
  flex-shrink: 0;
  max-height: 300px;
  overflow-y: auto;
}
.lo-photo-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.lo-photo-panel-title {
  font-size: 12px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: #475569;
}
.lo-photo-panel-hint { font-size: 11px; color: #94a3b8; }
.lo-photo-loading { font-size: 12px; color: #94a3b8; font-style: italic; padding: 8px 0; }
.lo-photo-group { margin-bottom: 14px; }
.lo-photo-group-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: #94a3b8;
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.lo-photo-group-toggle {
  font-size: 11px; font-weight: 500; color: #0066cc;
  background: none; border: 0; cursor: pointer; padding: 0;
  font-family: inherit;
}
.lo-photo-group-toggle:hover { text-decoration: underline; }
.lo-photo-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
}
.lo-photo-item {
  position: relative; cursor: pointer;
  border-radius: 6px; overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.15s;
  aspect-ratio: 4/3;
  background: #e2e8f0;
}
.lo-photo-item.selected { border-color: #0066cc; }
.lo-photo-item img {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}
.lo-photo-item-check {
  position: absolute; top: 4px; right: 4px;
  width: 18px; height: 18px;
  background: #0066cc; border-radius: 50%;
  display: none; align-items: center; justify-content: center;
}
.lo-photo-item.selected .lo-photo-item-check { display: flex; }
.lo-photo-item-check svg { width: 10px; height: 10px; color: white; }
.lo-photo-item-name {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: rgba(15,23,42,0.55);
  color: #fff; font-size: 9px; padding: 2px 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: none;
}
.lo-photo-item:hover .lo-photo-item-name { display: block; }
.lo-photo-count {
  font-size: 12px; color: #0066cc; font-weight: 600;
}
.lo-photo-empty { font-size: 12px; color: #94a3b8; font-style: italic; }
`;

  // ── State ───────────────────────────────────────────────────
  let jsPDFLoaded = false;
  let currentReportData = null;
  let logoDataUrl = null;
  let logoNaturalW = 0;
  let logoNaturalH = 0;
  let companyNameDataUrl = null;
  let companyNameW = 0;
  let companyNameH = 0;
  let photoList = [];        // [{ id, name, subfolder, thumbUrl }]
  let selectedPhotoIds = new Set();
  let photoBase64Cache = {}; // id → base64 string

  // ── Utility ─────────────────────────────────────────────────
  const esc = (s) => {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  const orDash = (v) => (v === null || v === undefined || v === '' ? '—' : esc(v));
  const fmtMoney = (n) => '$' + (Number(n) || 0).toFixed(2);
  const fmtDate = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d)) return esc(s);
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const isWarranty = (w) => /in[-\s]?warranty/i.test(w || '');

  const renderProse = (text) => {
    if (!text) return `<div class="lor-empty">No notes recorded.</div>`;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const isList = lines.length > 1 && lines.every(l => l.startsWith('-') || l.startsWith('•'));
    if (isList) {
      return `<ul>${lines.map(l => `<li>${esc(l.replace(/^[-•]\s*/, ''))}</li>`).join('')}</ul>`;
    }
    return esc(text);
  };

  const renderPartsTable = (parts) => {
    if (!parts || !parts.length) {
      return `<div class="lor-empty">No parts used or replaced.</div>`;
    }
    const rows = parts.map(p => {
      const qty = Number(p.qty ?? p.quantity ?? 1);
      const price = Number(p.price ?? p.unitPrice ?? 0);
      return `
        <tr>
          <td>${esc(p.name || p.partName || p.part || '—')}</td>
          <td>${esc(p.partNo || p.partNumber || p.sku || '')}</td>
          <td class="num">${qty}</td>
          <td class="num">${fmtMoney(price)}</td>
          <td class="num">${fmtMoney(qty * price)}</td>
        </tr>`;
    }).join('');
    return `
      <table class="lor-table">
        <thead><tr>
          <th>Part / Description</th><th>Part No.</th>
          <th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  };

  const renderTotals = (d) => {
    const hasMoney = Number(d.total) || Number(d.subtotal) || Number(d.partsTotal) || Number(d.postage);
    if (!hasMoney) return '';
    return `
      <table class="lor-table" style="margin-top:12px;">
        <tbody>
          <tr><td>Parts subtotal</td><td class="num">${fmtMoney(d.partsTotal)}</td></tr>
          <tr><td>Postage</td><td class="num">${fmtMoney(d.postage)}</td></tr>
          <tr><td>Discount</td><td class="num">${(Number(d.discount)||0) > 0 ? '−' : ''}${fmtMoney(d.discount)}</td></tr>
          <tr><td>Subtotal</td><td class="num">${fmtMoney(d.subtotal)}</td></tr>
        </tbody>
        <tfoot><tr class="total"><td>Total (AUD)</td><td class="num">${fmtMoney(d.total)}</td></tr></tfoot>
      </table>`;
  };

  const warrantyPill = (w) => {
    if (!w) return '';
    return isWarranty(w)
      ? `<span class="lor-pill warranty">${esc(w)}</span>`
      : `<span class="lor-pill oow">${esc(w)}</span>`;
  };

  // ── Render the customer report ──────────────────────────────
  function renderCustomerReport(d) {
    const logoSrc = logoDataUrl || 'images/logo.png';
    return `
      <header class="lor-header">
        <div class="lor-header-left">
          <img src="${logoSrc}" alt="Logic One SA" class="lor-logo" crossorigin="anonymous">
          <div class="lor-brand-block">
            ${logoDataUrl ? '' : '<div class="lor-brand-name">Logic One SA</div>'}
            <img src="images/logo_text.png" alt="Logic One SA" class="lor-logo-text" crossorigin="anonymous"
              onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
            <div class="lor-brand-name" style="display:none">Logic One SA</div>
            <div class="lor-brand-tag">Electronics Engineering · Authorised Repairs</div>
          </div>
        </div>
        <div class="lor-header-right">
          <div class="lor-doc-type">Repair Report</div>
          <div class="lor-doc-id">${esc(d.jobId || '—')}</div>
          <div class="lor-doc-date">${fmtDate(new Date().toISOString())}</div>
        </div>
      </header>

      <section class="lor-section">
        <div class="lor-section-title">Customer</div>
        <div class="lor-grid">
          <div class="lor-field"><span class="lor-field-label">Name</span><span class="lor-field-value">${orDash(d.name)}</span></div>
          <div class="lor-field"><span class="lor-field-label">Contact</span><span class="lor-field-value">${orDash(d.phone)}${d.email ? ' · ' + esc(d.email) : ''}</span></div>
        </div>
      </section>

      <section class="lor-section">
        <div class="lor-section-title">Device</div>
        <div class="lor-grid">
          <div class="lor-field"><span class="lor-field-label">Type</span><span class="lor-field-value">${orDash(d.deviceType)}</span></div>
          <div class="lor-field"><span class="lor-field-label">Brand &amp; Model</span><span class="lor-field-value">${orDash([d.brand, d.model].filter(Boolean).join(' '))}</span></div>
          <div class="lor-field"><span class="lor-field-label">Serial Number</span><span class="lor-field-value mono">${orDash(d.serial)}</span></div>
          <div class="lor-field"><span class="lor-field-label">Warranty</span><span class="lor-field-value">${warrantyPill(d.warranty) || '—'}</span></div>
          <div class="lor-field"><span class="lor-field-label">Service Type</span><span class="lor-field-value">${orDash(d.svcType)}</span></div>
          <div class="lor-field"><span class="lor-field-label">Items Received</span><span class="lor-field-value">${(d.checklist && d.checklist.length) ? esc(d.checklist.join(', ')) : '—'}</span></div>
        </div>
      </section>

      <section class="lor-section">
        <div class="lor-section-title">Reported Issue</div>
        <div class="lor-prose">${renderProse(d.custRemark || d.issue)}</div>
      </section>

      ${(d.inspectionNote || d.repairingNote || d.testingNote || d.qcNote) ? `
      <section class="lor-section">
        <div class="lor-section-title">Work Performed</div>
        ${d.inspectionNote ? `<div class="lor-stage-label">Inspection</div><div class="lor-prose lor-prose-stage">${renderProse(d.inspectionNote)}</div>` : ''}
        ${d.repairingNote  ? `<div class="lor-stage-label">Repairing</div><div class="lor-prose lor-prose-stage">${renderProse(d.repairingNote)}</div>`  : ''}
        ${d.testingNote    ? `<div class="lor-stage-label">Testing</div><div class="lor-prose lor-prose-stage">${renderProse(d.testingNote)}</div>`    : ''}
        ${d.qcNote         ? `<div class="lor-stage-label">QC</div><div class="lor-prose lor-prose-stage">${renderProse(d.qcNote)}</div>`         : ''}
      </section>` : ''}

      ${d.finalRemark ? `
      <section class="lor-section">
        <div class="lor-section-title">Outcome</div>
        <div class="lor-prose">${renderProse(d.finalRemark)}</div>
      </section>` : ''}

      <section class="lor-section">
        <div class="lor-section-title">Parts &amp; Charges</div>
        ${renderPartsTable(d.parts)}
        ${renderTotals(d)}
      </section>

      <div class="lor-signatures">
        <div class="lor-sig"><div class="lor-sig-label">Technician</div><div class="lor-sig-name">${orDash(d.tech)}</div></div>
        <div class="lor-sig"><div class="lor-sig-label">Customer Signature</div><div class="lor-sig-name">&nbsp;</div></div>
      </div>

      <footer class="lor-footer">
        <div><span class="lor-stamp">Repair Report</span> · Job ${esc(d.jobId || '—')}</div>
        <div>${fmtDate(new Date().toISOString())}</div>
      </footer>
    `;
  }

  // ── Inject styles & build modal ─────────────────────────────
  function injectStyles() {
    if (document.getElementById('lo-report-styles')) return;
    const style = document.createElement('style');
    style.id = 'lo-report-styles';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function buildModal() {
    if (document.getElementById('loReportOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'lo-report-overlay';
    overlay.id = 'loReportOverlay';
    overlay.innerHTML = `
      <div class="lo-report-modal">
        <div class="lo-report-header">
          <div>
            <h2>Generate Repair Report</h2>
            <div class="lo-report-header-sub" id="loReportSubtitle">Preview before saving to Drive</div>
          </div>
          <button class="lo-report-close" onclick="window.reportClose()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="lo-report-body" style="position:relative;">
          <div class="lo-report-loading" id="loReportLoading">
            <div class="lo-report-spinner"></div>
            <div class="lo-report-loading-msg" id="loReportLoadingMsg">Generating PDF…</div>
          </div>
          <div class="lo-report-preview" id="loReportPreview"></div>
        </div>
        <div class="lo-photo-panel" id="loPhotoPanel" style="display:none;">
          <div class="lo-photo-panel-header">
            <div class="lo-photo-panel-title">
              📷 Add Photos
              <span class="lo-photo-count" id="loPhotoCount" style="margin-left:8px;"></span>
            </div>
            <div class="lo-photo-panel-hint" id="loPhotoPanelHint">Select photos to include in the report</div>
          </div>
          <div id="loPhotoPickerBody">
            <div class="lo-photo-loading">Loading photos from Drive…</div>
          </div>
        </div>
        <div class="lo-report-footer">
          <div class="lo-report-footer-info" id="loReportFooterInfo">Will save as: <strong id="loReportFilename">—</strong></div>
          <div class="lo-report-actions">
            <button class="lo-report-btn lo-report-btn-secondary" onclick="window.reportDownload()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
            <button class="lo-report-btn lo-report-btn-secondary" onclick="window.reportClose()">Cancel</button>
            <button class="lo-report-btn lo-report-btn-primary" id="loReportConfirmBtn" onclick="window.reportConfirm()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Save to Drive
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) window.reportClose();
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('show')) {
        window.reportClose();
      }
    });
  }

  // ── Load logo as data URL and measure natural dimensions ────
  async function preloadLogo() {
    if (logoDataUrl) return logoDataUrl;
    try {
      // Load logo icon
      const r = await fetch('images/logo.png');
      const blob = await r.blob();
      logoDataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
      const dims = await new Promise((res) => {
        const img = new Image();
        img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => res({ w: 0, h: 0 });
        img.src = logoDataUrl;
      });
      logoNaturalW = dims.w;
      logoNaturalH = dims.h;

      // Load company name image (optional — falls back to text if missing)
      try {
        const r2 = await fetch('images/logo_text.png');
        const blob2 = await r2.blob();
        companyNameDataUrl = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = rej;
          fr.readAsDataURL(blob2);
        });
        const dims2 = await new Promise((res) => {
          const img = new Image();
          img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => res({ w: 0, h: 0 });
          img.src = companyNameDataUrl;
        });
        companyNameW = dims2.w;
        companyNameH = dims2.h;
      } catch (e) {
        // logo_text.png not found — will fall back to helvetica text
      }

      return logoDataUrl;
    } catch (e) {
      console.warn('Logo preload failed:', e);
      return null;
    }
  }

  // ── Lazy-load jsPDF from CDN ────────────────────────────────
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureLibs() {
    if (!jsPDFLoaded) {
      if (typeof window.jspdf === 'undefined') {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
      jsPDFLoaded = true;
    }
  }

  // ── Build PDF blob using native jsPDF drawing primitives ────
  // Vector PDF — text is selectable/copyable, file is small,
  // logo embeds as a small JPEG (only raster element).
  // This renders the same content as renderCustomerReport(),
  // laid out for A4 with 15mm margins.
  async function buildPdfBlob() {
    await ensureLibs();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      unit: 'mm', format: 'a4', orientation: 'portrait', compress: true,
    });

    // ── Layout constants (mm) ─────────────────────────────────
    const PAGE_W = 210, PAGE_H = 297;
    const MARGIN = 15;
    const CONTENT_W = PAGE_W - MARGIN * 2;          // 180mm
    const COL_GAP = 8;
    const COL_W = (CONTENT_W - COL_GAP) / 2;        // 86mm

    // ── Colours ───────────────────────────────────────────────
    const C = {
      ink:        [15, 23, 42],
      inkSoft:    [71, 85, 105],
      inkMute:    [148, 163, 184],
      rule:       [226, 232, 240],
      ruleStrong: [203, 213, 225],
      accent:     [0, 102, 204],
      accentDeep: [0, 61, 128],
      bg:         [245, 247, 250],
      ok:         [4, 120, 87],
      okSoft:     [209, 250, 229],
      warn:       [180, 83, 9],
      warnSoft:   [254, 243, 199],
    };

    const data = currentReportData;
    let y = MARGIN;  // running cursor

    // ── Helpers ───────────────────────────────────────────────
    const setText = (rgb, size, weight) => {
      pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
      pdf.setFontSize(size);
      pdf.setFont('helvetica', weight || 'normal');
    };
    const setDraw = (rgb, w) => {
      pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
      pdf.setLineWidth(w || 0.2);
    };
    const setFill = (rgb) => pdf.setFillColor(rgb[0], rgb[1], rgb[2]);

    // Estimate height a wrapped string will take at given font size & weight.
    // Returns { lines: [...], height: mm }
    const wrap = (text, maxW, size) => {
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(String(text || ''), maxW);
      const lineH = size * 0.352778 * 1.25; // pt -> mm with 1.25 line-height
      return { lines, height: lines.length * lineH, lineH };
    };

    // Draw a section title — small uppercase, tinted, with a thin rule
    const drawSectionTitle = (label) => {
      // Add breathing room before each new section
      y += 4;
      setText(C.inkSoft, 8, 'bold');
      pdf.text(label.toUpperCase(), MARGIN, y, { charSpace: 0.5 });
      // rule under
      setDraw(C.rule, 0.2);
      pdf.line(MARGIN, y + 1.5, MARGIN + CONTENT_W, y + 1.5);
      y += 5.5;
    };

    // Draw a small uppercase label + value (used in field grids)
    // Returns the height consumed.
    const drawField = (x, yTop, w, label, value, opts) => {
      const o = opts || {};
      // Label
      setText(C.inkMute, 7, 'bold');
      pdf.text(String(label || '').toUpperCase(), x, yTop + 2.5, { charSpace: 0.4 });

      // Pill (warranty) gets a rounded coloured background
      if (o.pill && value) {
        const pillText = String(value).toUpperCase();
        const isInWarranty = isWarranty(pillText);
        const fillCol = isInWarranty ? C.okSoft : C.warnSoft;
        const txtCol  = isInWarranty ? C.ok      : C.warn;
        // Set font BEFORE measuring so getTextWidth uses the correct size
        setText(txtCol, 8, 'bold');
        const tw = pdf.getTextWidth(pillText);
        const padX = 3, padY = 1.5, pillH = 5.5;
        setFill(fillCol);
        pdf.roundedRect(x, yTop + 4.5, tw + padX * 2, pillH, 1.5, 1.5, 'F');
        // Re-set after setFill (setFill changes fill colour, text colour stays)
        setText(txtCol, 8, 'bold');
        pdf.text(pillText, x + padX, yTop + 4.5 + pillH * 0.68, { charSpace: 0.2 });
        return 4 + pillH + 3;
      }

      // Value — helvetica throughout (no courier)
      const fontSize = o.mono ? 9 : 10;
      setText(C.ink, fontSize, 'normal');
      const v = (value === undefined || value === null || value === '') ? '—' : String(value);
      const w_ = wrap(v, w, fontSize);
      const lineH = 4.4;
      let lineY = yTop + 6.8;
      w_.lines.forEach((ln, i) => {
        pdf.text(ln, x, lineY + i * lineH);
      });
      const valueBlockH = Math.max(lineH, w_.lines.length * lineH);
      return 4 + valueBlockH + 3;
    };

    // Draw a 2-column field grid. fields = [{label, value, mono?, pill?}, ...]
    const drawFieldGrid = (fields) => {
      let leftY = y, rightY = y;
      fields.forEach((f, i) => {
        const isLeft = i % 2 === 0;
        const x = isLeft ? MARGIN : MARGIN + COL_W + COL_GAP;
        const yy = isLeft ? leftY : rightY;
        const consumed = drawField(x, yy, COL_W, f.label, f.value, { mono: f.mono, pill: f.pill });
        if (isLeft) leftY = yy + consumed; else rightY = yy + consumed;
      });
      y = Math.max(leftY, rightY) + 2;
    };

    // Draw a prose block with optional bullet list.
    // Auto-detects bullets ("- " or "• " at start of each line).
    const drawProseBlock = (text) => {
      const empty = !text || !String(text).trim();
      const padding = 4;
      const innerW = CONTENT_W - padding * 2;

      if (empty) {
        // Empty state — italic muted text on bg
        const blockH = 9;
        setFill(C.bg);
        pdf.rect(MARGIN, y, CONTENT_W, blockH, 'F');
        // Left accent bar
        setFill(C.accent);
        pdf.rect(MARGIN, y, 0.8, blockH, 'F');
        setText(C.inkMute, 9, 'italic');
        pdf.text('No notes recorded.', MARGIN + padding, y + 6);
        y += blockH + 3;
        return;
      }

      const raw = String(text);
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const isList = lines.length > 1 && lines.every(l => l.startsWith('-') || l.startsWith('•'));

      // Pre-measure to know block height
      const fontSize = 10;
      let totalLines = [];
      if (isList) {
        const bulletIndent = 5;
        const bulletInnerW = innerW - bulletIndent;
        lines.forEach(rawLine => {
          const cleaned = rawLine.replace(/^[-•]\s*/, '');
          const wrapped = wrap(cleaned, bulletInnerW, fontSize);
          wrapped.lines.forEach((ln, i) => totalLines.push({ text: ln, bullet: i === 0 ? '•' : '' }));
        });
      } else {
        const wrapped = wrap(raw, innerW, fontSize);
        wrapped.lines.forEach(ln => totalLines.push({ text: ln, bullet: '' }));
      }

      const lineH = 4.6;
      const blockH = padding * 2 + totalLines.length * lineH;

      // Page break if needed
      if (y + blockH > PAGE_H - MARGIN) {
        pdf.addPage(); y = MARGIN;
      }

      // Background
      setFill(C.bg);
      pdf.rect(MARGIN, y, CONTENT_W, blockH, 'F');
      // Accent bar
      setFill(C.accent);
      pdf.rect(MARGIN, y, 0.8, blockH, 'F');

      // Text
      setText(C.ink, fontSize, 'normal');
      let ty = y + padding + 3.4;
      totalLines.forEach(item => {
        if (item.bullet) {
          pdf.text('•', MARGIN + padding, ty);
          pdf.text(item.text, MARGIN + padding + 4, ty);
        } else {
          pdf.text(item.text, MARGIN + padding, ty);
        }
        ty += lineH;
      });

      y += blockH + 3;
    };

    // Draw a parts table. Columns: Part / No / Qty / Unit / Total
    const drawPartsTable = (parts) => {
      const cols = [
        { key: 'name',  title: 'Part / Description', w: 78,  align: 'left'  },
        { key: 'partNo',title: 'Part No.',           w: 38,  align: 'left'  },
        { key: 'qty',   title: 'Qty',                w: 14,  align: 'right' },
        { key: 'unit',  title: 'Unit',               w: 22,  align: 'right' },
        { key: 'total', title: 'Total',              w: 28,  align: 'right' },
      ];
      // Verify total = CONTENT_W (180mm)
      const xOf = (idx) => {
        let x = MARGIN;
        for (let i = 0; i < idx; i++) x += cols[i].w;
        return x;
      };

      // Header row
      setText(C.inkMute, 7, 'bold');
      cols.forEach((c, i) => {
        const x = xOf(i);
        const tx = c.align === 'right' ? x + c.w - 1 : x + 1;
        pdf.text(c.title.toUpperCase(), tx, y + 3, {
          align: c.align === 'right' ? 'right' : 'left',
          charSpace: 0.4,
        });
      });
      setDraw(C.ruleStrong, 0.3);
      pdf.line(MARGIN, y + 5, MARGIN + CONTENT_W, y + 5);
      y += 7;

      // Body
      if (!parts || !parts.length) {
        setText(C.inkMute, 9, 'italic');
        pdf.text('No parts used or replaced.', MARGIN, y + 1);
        y += 6;
        return;
      }

      setText(C.ink, 10, 'normal');
      parts.forEach(p => {
        const qty = Number(p.qty ?? p.quantity ?? 1);
        const price = Number(p.price ?? p.unitPrice ?? 0);
        const total = qty * price;
        const name = String(p.name || p.partName || p.part || '—');
        const partNo = String(p.partNo || p.partNumber || p.sku || '');

        // Wrap the name column
        const nameWrap = wrap(name, cols[0].w - 2, 10);
        const rowH = Math.max(6, nameWrap.lines.length * 4.4 + 2);

        // Page break if needed
        if (y + rowH > PAGE_H - MARGIN - 30) {
          pdf.addPage(); y = MARGIN;
        }

        // Cell text
        setText(C.ink, 10, 'normal');
        nameWrap.lines.forEach((ln, i) => {
          pdf.text(ln, xOf(0) + 1, y + 4 + i * 4.4);
        });
        pdf.text(partNo, xOf(1) + 1, y + 4);
        pdf.text(String(qty), xOf(2) + cols[2].w - 1, y + 4, { align: 'right' });
        pdf.text(fmtMoney(price), xOf(3) + cols[3].w - 1, y + 4, { align: 'right' });
        pdf.text(fmtMoney(total), xOf(4) + cols[4].w - 1, y + 4, { align: 'right' });

        // Row separator
        setDraw(C.rule, 0.2);
        pdf.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH);
        y += rowH;
      });
    };

    // Draw the totals block (only if any monetary values present)
    const drawTotals = (d) => {
      const hasMoney = Number(d.total) || Number(d.subtotal) || Number(d.partsTotal) || Number(d.postage);
      if (!hasMoney) return;
      y += 3;
      const labelX = MARGIN + CONTENT_W - 60;
      const valueX = MARGIN + CONTENT_W;
      const rows = [
        ['Parts subtotal', fmtMoney(d.partsTotal)],
        ['Postage',        fmtMoney(d.postage)],
        ['Discount',       (Number(d.discount) || 0) > 0 ? '−' + fmtMoney(d.discount) : fmtMoney(d.discount)],
        ['Subtotal',       fmtMoney(d.subtotal)],
      ];
      setText(C.ink, 10, 'normal');
      rows.forEach(([lab, val]) => {
        pdf.text(lab, labelX, y + 4);
        pdf.text(val, valueX, y + 4, { align: 'right' });
        y += 6;
      });
      // Total — heavy rule above + bigger blue text
      setDraw(C.ink, 0.5);
      pdf.line(labelX, y, valueX, y);
      y += 5;
      setText(C.accentDeep, 12, 'bold');
      pdf.text('Total (AUD)', labelX, y);
      pdf.text(fmtMoney(d.total), valueX, y, { align: 'right' });
      y += 4;
    };

    // ── Render the report ─────────────────────────────────────

    // ── Header layout ─────────────────────────────────────────
    // Left: icon logo + text logo image stacked vertically
    // Right: REPAIR REPORT + job ID + date, vertically centred
    // Horizontal rule spans full width below header

    const HEADER_H = 22; // total header block height in mm

    // Left: icon logo — fixed 14mm height
    const LOGO_H = 14;
    const LOGO_W = (logoNaturalW && logoNaturalH)
      ? LOGO_H * (logoNaturalW / logoNaturalH)
      : LOGO_H;

    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, 'PNG', MARGIN, y, LOGO_W, LOGO_H, undefined, 'FAST');
      } catch (e) { /* skip */ }
    }

    // Text logo image — natural aspect ratio, 7mm tall
    const textLogoX = MARGIN + LOGO_W + 3;
    if (companyNameDataUrl && companyNameW && companyNameH) {
      const cnH = 7;
      const cnW = cnH * (companyNameW / companyNameH); // true natural ratio, no cap
      try {
        pdf.addImage(companyNameDataUrl, 'PNG', textLogoX, y + 2, cnW, cnH, undefined, 'FAST');
      } catch (e) {
        setText(C.ink, 11, 'bold');
        pdf.text('LOGIC ONE SA', textLogoX, y + 7, { charSpace: 0.5 });
      }
      setText(C.inkSoft, 7, 'normal');
      pdf.text('Electronics Engineering · Authorised Repairs', textLogoX, y + 12);
    } else {
      setText(C.ink, 11, 'bold');
      pdf.text('LOGIC ONE SA', textLogoX, y + 7, { charSpace: 0.5 });
      setText(C.inkSoft, 7, 'normal');
      pdf.text('Electronics Engineering · Authorised Repairs', textLogoX, y + 12);
    }

    // Right side: REPAIR REPORT block — right column, above the rule
    // Positioned at 60% across the page so it doesn't hug the far right edge
    const rightX = MARGIN + CONTENT_W - 2;  // 2mm inset from right margin
    setText(C.accent, 11, 'bold');
    pdf.text('REPAIR REPORT', rightX, y + 7, { align: 'right' });
    setText(C.ink, 8.5, 'normal');
    pdf.text(String(data.jobId || '—'), rightX, y + 13, { align: 'right' });
    setText(C.inkSoft, 8.5, 'normal');
    pdf.text(fmtDate(new Date().toISOString()), rightX, y + 19, { align: 'right' });

    y += HEADER_H;

    // Full-width rule — both logo and REPAIR REPORT sit above this line
    setDraw(C.ink, 0.7);
    pdf.line(MARGIN, y, MARGIN + CONTENT_W, y);
    y += 7;

    // Customer
    drawSectionTitle('Customer');
    drawFieldGrid([
      { label: 'Name',    value: data.name },
      { label: 'Contact', value: [data.phone, data.email].filter(Boolean).join(' · ') },
    ]);

    // Device
    drawSectionTitle('Device');
    drawFieldGrid([
      { label: 'Type',           value: data.deviceType },
      { label: 'Brand & Model',  value: [data.brand, data.model].filter(Boolean).join(' ') },
      { label: 'Serial Number',  value: data.serial, mono: true },
      { label: 'Warranty',       value: data.warranty, pill: true },
      { label: 'Service Type',   value: data.svcType },
      { label: 'Items Received', value: (data.checklist && data.checklist.length) ? data.checklist.join(', ') : '' },
    ]);

    // Reported Issue
    drawSectionTitle('Reported Issue');
    drawProseBlock(data.custRemark || data.issue);

    // Work Performed — four stage notes
    const stageNotes = [
      { label: 'Inspection', value: data.inspectionNote },
      { label: 'Repairing',  value: data.repairingNote  },
      { label: 'Testing',    value: data.testingNote    },
      { label: 'QC',         value: data.qcNote         },
    ].filter(s => s.value && s.value.trim());

    if (stageNotes.length) {
      drawSectionTitle('Work Performed');
      stageNotes.forEach(function(stage) {
        // Stage sub-label — inline page break check
        if (y + 8 > PAGE_H - MARGIN) { pdf.addPage(); y = MARGIN; }
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(100, 116, 139);
        pdf.text(stage.label.toUpperCase(), MARGIN, y);
        y += 6;
        pdf.setFont('helvetica', 'normal');
        drawProseBlock(stage.value);
        y += 2;
      });
    }

    // Outcome (only if present)
    if (data.finalRemark) {
      drawSectionTitle('Outcome');
      drawProseBlock(data.finalRemark);
    }

    // Parts & Charges — estimate height needed and page-break if won't fit
    const partsCount = (data.parts && data.parts.length) ? data.parts.length : 0;
    const estPartsH = 10 + partsCount * 8 + 30 + 40; // header + rows + totals + sig
    if (y + estPartsH > PAGE_H - MARGIN) { pdf.addPage(); y = MARGIN; }
    drawSectionTitle('Parts & Charges');
    drawPartsTable(data.parts);
    drawTotals(data);
    y += 12; // space between totals and signature

    // Signature block — new page if not enough room (need ~35mm)
    if (y + 35 > PAGE_H - MARGIN - 10) { pdf.addPage(); y = MARGIN; }
    const sigY = y + 6;
    const sigW = (CONTENT_W - 16) / 2;
    setDraw(C.ink, 0.3);
    pdf.line(MARGIN, sigY, MARGIN + sigW, sigY);
    pdf.line(MARGIN + sigW + 16, sigY, MARGIN + CONTENT_W, sigY);
    setText(C.inkMute, 7, 'bold');
    pdf.text('TECHNICIAN', MARGIN, sigY + 4, { charSpace: 0.4 });
    pdf.text('CUSTOMER SIGNATURE', MARGIN + sigW + 16, sigY + 4, { charSpace: 0.4 });
    setText(C.inkSoft, 9, 'normal');
    pdf.text(String(data.tech || ''), MARGIN, sigY + 9);
    y = sigY + 14;

    // Footer — anchor to bottom of last page
    const footY = PAGE_H - MARGIN;
    setDraw(C.rule, 0.2);
    pdf.line(MARGIN, footY - 5, MARGIN + CONTENT_W, footY - 5);
    setText(C.inkMute, 8, 'bold');
    pdf.text(`REPAIR REPORT  ·  Job ${data.jobId || '—'}`, MARGIN, footY - 1, { charSpace: 0.4 });
    setText(C.inkMute, 8, 'normal');
    pdf.text(fmtDate(new Date().toISOString()), MARGIN + CONTENT_W, footY - 1, { align: 'right' });

    // ── Photos page (if any selected) ─────────────────────────
    if (selectedPhotoIds.size > 0) {
      showLoading(true, 'Fetching photos…');
      const photoData = await fetchPhotoBase64s(
        [...selectedPhotoIds],
        data.driveFolder,
      );
      showLoading(true, 'Embedding photos…');

      console.log('selectedPhotoIds:', [...selectedPhotoIds]);
      console.log('photoData keys:', Object.keys(photoData));
      const orderedIds = photoList
        .map(p => p.id)
        .filter(id => selectedPhotoIds.has(id) && photoData[id]);

      console.log('orderedIds to embed:', orderedIds.length);
      if (orderedIds.length) {
        // Flow photos after content — only add new page if not enough space
        // Need at least ~80mm for a photo row + header
        if (y + 80 > PAGE_H - MARGIN) {
          pdf.addPage();
          y = MARGIN;
        } else {
          y += 8; // small gap between content and photos section
        }
        let py = y;

        // Photos section header
        setText(C.inkSoft, 8, 'bold');
        pdf.text('INSPECTION PHOTOS', MARGIN, py, { charSpace: 0.5 });
        setDraw(C.rule, 0.2);
        pdf.line(MARGIN, py + 1.5, MARGIN + CONTENT_W, py + 1.5);
        py += 7;

        // 2 per row — fixed column width, height derived from each image's
        // actual aspect ratio so nothing ever stretches.
        const COL_COUNT = 2;
        const PHOTO_GAP = 5;
        const PHOTO_W = (CONTENT_W - PHOTO_GAP * (COL_COUNT - 1)) / COL_COUNT; // ~87.5mm

        // Helper: measure natural image dimensions from base64 data URL
        const measureImage = (dataUrl) => new Promise((res) => {
          const img = new Image();
          img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => res({ w: 4, h: 3 }); // fallback 4:3
          img.src = dataUrl;
        });

        // Pre-measure all images so we can compute correct row heights
        const photoMetas = [];
        for (const id of orderedIds) {
          const photoInfo = photoData[id];
          const b64 = photoInfo.base64 || photoInfo; // handle both old and new format
          const fmt = photoInfo.fmt || 'JPEG';
          const mime = fmt === 'PNG' ? 'image/png' : 'image/jpeg';
          const dataUrl = `data:${mime};base64,${b64}`;
          const dims = await measureImage(dataUrl);
          // Compute height to fit PHOTO_W while preserving aspect ratio
          const ratio = dims.h > 0 ? dims.w / dims.h : 4 / 3;
          const imgH = PHOTO_W / ratio;
          // Cap height at a reasonable max (A4 half-page) to avoid portrait shots filling the whole page
          const PHOTO_H = Math.min(imgH, 120);
          // If portrait, centre it within the capped height
          const actualH = Math.min(imgH, PHOTO_H);
          photoMetas.push({ id, dataUrl, fmt, dims, PHOTO_H: actualH });
        }

        // Layout in rows of 2
        for (let i = 0; i < photoMetas.length; i += COL_COUNT) {
          const row = photoMetas.slice(i, i + COL_COUNT);
          // Row height = max height across both columns in this row
          const rowH = Math.max(...row.map(p => p.PHOTO_H));

          // Page break if needed
          if (py + rowH > PAGE_H - MARGIN - 10) {
            pdf.addPage();
            py = MARGIN;
            setText(C.inkSoft, 8, 'bold');
            pdf.text('INSPECTION PHOTOS (continued)', MARGIN, py, { charSpace: 0.5 });
            setDraw(C.rule, 0.2);
            pdf.line(MARGIN, py + 1.5, MARGIN + CONTENT_W, py + 1.5);
            py += 7;
          }

          row.forEach((p, col) => {
            const x = MARGIN + col * (PHOTO_W + PHOTO_GAP);
            try {
              // Centre photo vertically within row height
              const yOffset = (rowH - p.PHOTO_H) / 2;
              pdf.addImage(p.dataUrl, p.fmt, x, py + yOffset, PHOTO_W, p.PHOTO_H, undefined, 'FAST');
            } catch (e) {
              setFill(C.bg);
              pdf.rect(x, py, PHOTO_W, rowH, 'F');
              setText(C.inkMute, 9, 'normal');
              pdf.text('Image unavailable', x + PHOTO_W / 2, py + rowH / 2, { align: 'center' });
            }
          });

          py += rowH + PHOTO_GAP;
        }

        // Footer on photos page
        const fY = PAGE_H - MARGIN;
        setDraw(C.rule, 0.2);
        pdf.line(MARGIN, fY - 5, MARGIN + CONTENT_W, fY - 5);
        setText(C.inkMute, 8, 'bold');
        pdf.text(`REPAIR REPORT  ·  Job ${data.jobId || '—'}`, MARGIN, fY - 1, { charSpace: 0.4 });
        setText(C.inkMute, 8, 'normal');
        pdf.text(fmtDate(new Date().toISOString()), MARGIN + CONTENT_W, fY - 1, { align: 'right' });
      }
    }

    return pdf.output('blob', { compress: true });
  }

  // Convert blob to base64 (without data: prefix)
  function blobToBase64(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        const result = fr.result;
        const idx = result.indexOf(',');
        res(idx >= 0 ? result.substring(idx + 1) : result);
      };
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }

  // ── Upload report PDF via POST ──────────────────────────────
  // The dashboard's callScript() sends data as a URL query
  // parameter, which works fine for small JSON job sheets but
  // fails on PDFs (URL length limit). This sends the payload
  // in the request body instead.
  //
  // Important: Apps Script web apps don't allow CORS preflight
  // requests, so we must use Content-Type: text/plain (a "simple
  // request" that doesn't trigger preflight). The Apps Script
  // side reads the body via e.postData.contents.
  async function uploadReportToDrive(payload) {
    if (typeof cfg === 'undefined' || !cfg || !cfg.appsScriptUrl) {
      return { ok: false, error: 'Apps Script not configured' };
    }
    try {
      const r = await fetch(cfg.appsScriptUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      try {
        const json = JSON.parse(text);
        if (json.result === 'ok') return { ok: true, data: json.data || null };
        return { ok: false, error: json.msg || json.result || 'Unknown error' };
      } catch {
        return { ok: false, error: 'Bad response: ' + text.substring(0, 160) };
      }
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // ── Photo picker ────────────────────────────────────────────

  // Call Apps Script to list photos from all 4 photo subfolders
  async function fetchPhotoList(driveFolder) {
    if (!driveFolder || typeof cfg === 'undefined' || !cfg || !cfg.appsScriptUrl) return [];
    try {
      const url = `${cfg.appsScriptUrl}?payload=${encodeURIComponent(JSON.stringify({
        action: 'listPhotos',
        driveFolder,
      }))}`;
      const r = await fetch(url, { redirect: 'follow' });
      const json = await r.json();
      console.log('listPhotos response:', JSON.stringify(json).substring(0, 300));
      if (json.result === 'ok') {
        console.log('listPhotos: found', (json.data||[]).length, 'photos');
        return json.data || [];
      }
      console.warn('listPhotos failed:', json.msg);
      return [];
    } catch (e) {
      console.warn('listPhotos error:', e);
      return [];
    }
  }

  // Max dimension for photos in the PDF — 1200px is plenty for print quality
  const PDF_PHOTO_MAX_PX = 1200;
  const PDF_PHOTO_QUALITY = 0.60;

  // Resize an Image element to max dimension and return JPEG base64
  function resizeImageToBase64(img) {
    const MAX = PDF_PHOTO_MAX_PX;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (w > MAX || h > MAX) {
      if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
      else        { w = Math.round(w * MAX / h); h = MAX; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', PDF_PHOTO_QUALITY).split(',')[1];
  }

  // Convert HEIC base64 → resize → JPEG base64
  // Works on ALL browsers including Chrome via heic2any library
  async function heicToJpegBase64(heicBase64) {
    // Load heic2any from CDN if not already loaded
    if (!window.heic2any) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    // HEIC → JPEG blob (no quality arg here — we resize+compress via canvas below)
    const byteChars = atob(heicBase64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const heicBlob = new Blob([byteArr], { type: 'image/heic' });
    const jpegBlob = await window.heic2any({ blob: heicBlob, toType: 'image/jpeg', quality: 1 });

    // Load into an Image so we can resize via canvas
    const bmpUrl = URL.createObjectURL(jpegBlob);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          resolve(resizeImageToBase64(img));
        } finally {
          URL.revokeObjectURL(bmpUrl);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(bmpUrl); reject(new Error('Image load failed')); };
      img.src = bmpUrl;
    });
  }

  // Convert regular image (JPEG/PNG) base64 → resize → JPEG base64
  async function resizeBase64Image(b64, mime) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(resizeImageToBase64(img));
      img.onerror = reject;
      img.src = `data:${mime};base64,${b64}`;
    });
  }

  // Fetch selected photos as base64 from Apps Script (via POST — could be large)
  async function fetchPhotoBase64s(ids, driveFolder) {
    if (!ids.length || !driveFolder) return {};
    // Return any already-cached ones
    const missing = ids.filter(id => !photoBase64Cache[id]);
    if (missing.length) {
      try {
        const r = await fetch(cfg.appsScriptUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'fetchPhotos', fileIds: missing, driveFolder }),
        });
        const text = await r.text();
        console.log('fetchPhotos raw response:', text.substring(0, 200));
        const json = JSON.parse(text);
        if (json.result === 'ok' && json.data) {
          console.log('fetchPhotos: got data for', Object.keys(json.data).length, 'photos');
          // Convert each photo — HEIC needs canvas conversion for jsPDF
          for (const [id, info] of Object.entries(json.data)) {
            try {
              const { base64, mime, name } = info;
              const isHeic = (mime === 'image/heic' || mime === 'image/heif' ||
                              (name || '').toLowerCase().match(/\.heic$|\.heif$/));
              if (isHeic) {
                const jpegB64 = await heicToJpegBase64(base64);
                photoBase64Cache[id] = { base64: jpegB64, fmt: 'JPEG' };
              } else {
                // Resize JPEG/PNG too — iPhone JPEGs can be 5MB+
                const resized = await resizeBase64Image(base64, mime || 'image/jpeg');
                const fmt = (mime === 'image/png') ? 'JPEG' : 'JPEG'; // always JPEG after resize
                photoBase64Cache[id] = { base64: resized, fmt };
              }
            } catch(convErr) {
              console.warn('Photo conversion failed for', id, convErr);
            }
          }
        } else {
          console.warn('fetchPhotos failed:', json.result, json.msg);
        }
      } catch (e) {
        console.warn('fetchPhotos error:', e);
      }
    }
    const result = {};
    ids.forEach(id => { if (photoBase64Cache[id]) result[id] = photoBase64Cache[id]; });
    console.log('fetchPhotoBase64s returning', Object.keys(result).length, 'of', ids.length, 'requested');
    return result; // values are {base64, fmt} objects
  }

  // Render the photo picker after photos are loaded
  function renderPhotoPicker() {
    const body = document.getElementById('loPhotoPickerBody');
    const panel = document.getElementById('loPhotoPanel');
    if (!body || !panel) return;

    if (!photoList.length) {
      body.innerHTML = `<div class="lo-photo-empty">No photos found in Drive folder.</div>`;
      panel.style.display = '';
      return;
    }

    // Group by subfolder
    const groups = {};
    photoList.forEach(p => {
      if (!groups[p.subfolder]) groups[p.subfolder] = [];
      groups[p.subfolder].push(p);
    });

    const subfoldersOrdered = [
      '01_Receiving Photos',
      '02_Inspection Photos',
      '03_Testing Photos',
      '04_Shipping Photos',
    ].filter(s => groups[s]);

    body.innerHTML = subfoldersOrdered.map(subfolder => {
      const photos = groups[subfolder];
      const label = subfolder.replace(/^\d+_/, '').replace(' Photos', '');
      return `
        <div class="lo-photo-group" data-subfolder="${esc(subfolder)}">
          <div class="lo-photo-group-label">
            <span>${esc(label)}</span>
            <button class="lo-photo-group-toggle" onclick="window.reportPhotoToggleGroup('${esc(subfolder)}')">Select all</button>
          </div>
          <div class="lo-photo-grid">
            ${photos.map(p => `
              <div class="lo-photo-item" id="lophoto_${esc(p.id)}"
                   onclick="window.reportPhotoToggle('${esc(p.id)}')"
                   title="${esc(p.name)}">
                <img src="${esc(p.thumbUrl)}" alt="${esc(p.name)}"
                     onerror="this.style.display='none'">
                <div class="lo-photo-item-name">${esc(p.name)}</div>
                <div class="lo-photo-item-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    panel.style.display = '';
    updatePhotoCount();
  }

  function updatePhotoCount() {
    const el = document.getElementById('loPhotoCount');
    if (!el) return;
    const n = selectedPhotoIds.size;
    el.textContent = n ? `(${n} selected)` : '';
  }

  window.reportPhotoToggle = function (id) {
    if (selectedPhotoIds.has(id)) {
      selectedPhotoIds.delete(id);
      document.getElementById('lophoto_' + id)?.classList.remove('selected');
    } else {
      selectedPhotoIds.add(id);
      document.getElementById('lophoto_' + id)?.classList.add('selected');
    }
    updatePhotoCount();
  };

  window.reportPhotoToggleGroup = function (subfolder) {
    const group = document.querySelector(`[data-subfolder="${subfolder}"]`);
    if (!group) return;
    const items = group.querySelectorAll('.lo-photo-item');
    const ids = [...items].map(el => el.id.replace('lophoto_', ''));
    const allSelected = ids.every(id => selectedPhotoIds.has(id));
    const btn = group.querySelector('.lo-photo-group-toggle');
    if (allSelected) {
      ids.forEach(id => { selectedPhotoIds.delete(id); document.getElementById('lophoto_' + id)?.classList.remove('selected'); });
      if (btn) btn.textContent = 'Select all';
    } else {
      ids.forEach(id => { selectedPhotoIds.add(id); document.getElementById('lophoto_' + id)?.classList.add('selected'); });
      if (btn) btn.textContent = 'Deselect all';
    }
    updatePhotoCount();
  };

  // ── Find a job by ID across known data sources ──────────────
  function findJobById(jobId) {
    // dashboard.js exposes `jobs` array; fallback to filtered() result
    if (typeof jobs !== 'undefined' && Array.isArray(jobs)) {
      const j = jobs.find(x => x.jobId === jobId);
      if (j) return j;
    }
    if (typeof window.jobs !== 'undefined' && Array.isArray(window.jobs)) {
      const j = window.jobs.find(x => x.jobId === jobId);
      if (j) return j;
    }
    return null;
  }

  // ── Build report data from a job object (All Jobs row case) ─
  // For rows we have only the kanban-level data; we attempt to load
  // saved sheet from Drive to enrich it.
  async function buildReportDataFromJob(job) {
    // Start with fields that exist on the job object
    const base = {
      jobId: job.jobId || '',
      caseNo: job.caseNo || '',
      name: job.name || '',
      phone: job.phone || '',
      email: job.email || '',
      deviceType: job.deviceType || '',
      brand: job.brand || '',
      model: job.model || '',
      serial: job.serial || '',
      warranty: job.warranty || '',
      issue: job.issue || '',
      driveFolder: job.driveFolder || '',
      date: job.date || '',
      tech: '',
      eta: '',
      svcType: '',
      checklist: [],
      otherGoods: '',
      parts: [],
      postage: 0, discount: 0,
      partsTotal: 0, subtotal: 0, total: 0,
      custRemark: job.issue || '',
      inspectionNote: '',
      repairingNote: '',
      testingNote: '',
      qcNote: '',
      finalRemark: '',
      status: job.status || '',
    };

    // Try to load saved sheet from Drive for richer data
    if (typeof cfg !== 'undefined' && cfg && cfg.appsScriptUrl && job.driveFolder
        && typeof callScript === 'function') {
      try {
        const result = await callScript({
          action: 'loadJobSheet',
          jobId: job.jobId,
          driveFolder: job.driveFolder,
        });
        if (result && result.ok && result.data) {
          // Merge — saved sheet takes precedence for editable fields
          return Object.assign({}, base, result.data);
        }
      } catch (e) {
        console.warn('Could not load saved sheet:', e);
      }
    }

    return base;
  }

  // ── Public: open report modal from current job sheet ────────
  window.reportOpenForCurrentJob = async function () {
    if (typeof jsCurrentJob === 'undefined' || !jsCurrentJob) {
      if (typeof showToast === 'function') {
        showToast('error', 'Open a job sheet first');
      }
      return;
    }
    if (typeof jsCollectData !== 'function') {
      console.error('jsCollectData not available');
      return;
    }
    const data = jsCollectData();
    await openReport(data);
  };

  // ── Public: open report modal from All Jobs row ─────────────
  window.reportOpenForJobId = async function (jobId) {
    const job = findJobById(jobId);
    if (!job) {
      if (typeof showToast === 'function') {
        showToast('error', 'Job not found: ' + jobId);
      }
      return;
    }
    injectStyles(); buildModal();
    showLoading(true, 'Loading job data…');
    document.getElementById('loReportOverlay').classList.add('show');
    document.getElementById('loReportPreview').innerHTML = '';
    try {
      const data = await buildReportDataFromJob(job);
      await openReport(data, /*alreadyOpen*/ true);
    } catch (e) {
      console.error(e);
      if (typeof showToast === 'function') showToast('error', 'Failed to load: ' + e.message);
      window.reportClose();
    }
  };

  // ── Open + render preview ───────────────────────────────────
  async function openReport(data, alreadyOpen) {
    injectStyles(); buildModal();
    currentReportData = data;

    // Reset photo state for fresh open
    photoList = [];
    selectedPhotoIds = new Set();
    photoBase64Cache = {};
    const photoPanel = document.getElementById('loPhotoPanel');
    if (photoPanel) {
      photoPanel.style.display = 'none';
      const body = document.getElementById('loPhotoPickerBody');
      if (body) body.innerHTML = '<div class="lo-photo-loading">Loading photos from Drive…</div>';
    }

    if (!alreadyOpen) {
      document.getElementById('loReportOverlay').classList.add('show');
    }
    showLoading(true, 'Preparing preview…');

    await preloadLogo();

    // Render preview HTML
    document.getElementById('loReportPreview').innerHTML = renderCustomerReport(data);
    document.getElementById('loReportSubtitle').textContent =
      `${data.jobId || 'Job'} — ${data.name || 'Customer'}${data.brand ? ' (' + data.brand + (data.model ? ' ' + data.model : '') + ')' : ''}`;
    document.getElementById('loReportFilename').textContent = buildFilename(data);

    showLoading(false);

    // Load photo list in background — doesn't block the preview
    if (data.driveFolder) {
      fetchPhotoList(data.driveFolder).then(photos => {
        photoList = photos;
        renderPhotoPicker();
      });
    }
  }

  function buildFilename(data) {
    const safe = (s) => String(s || '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    const id = safe(data.jobId) || 'JobSheet';
    const name = safe(data.name);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${id}_Repair-Report${name ? '_' + name : ''}_${dateStr}.pdf`;
  }

  function showLoading(show, msg) {
    const el = document.getElementById('loReportLoading');
    if (!el) return;
    if (msg) document.getElementById('loReportLoadingMsg').textContent = msg;
    el.classList.toggle('show', !!show);
  }

  // ── Close / Confirm / Download ──────────────────────────────
  window.reportClose = function () {
    const el = document.getElementById('loReportOverlay');
    if (el) el.classList.remove('show');
    currentReportData = null;
  };

  window.reportDownload = async function () {
    if (!currentReportData) return;
    showLoading(true, 'Building PDF…');
    try {
      const blob = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildFilename(currentReportData);
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (typeof showToast === 'function') showToast('success', 'PDF downloaded');
    } catch (e) {
      console.error(e);
      if (typeof showToast === 'function') showToast('error', 'PDF build failed: ' + e.message);
    }
    showLoading(false);
  };

  window.reportConfirm = async function () {
    if (!currentReportData) return;
    const data = currentReportData;
    if (!data.driveFolder) {
      if (typeof showToast === 'function') showToast('error', 'No Drive folder linked for this job');
      return;
    }
    if (typeof cfg === 'undefined' || !cfg || !cfg.appsScriptUrl) {
      if (typeof showToast === 'function') showToast('error', 'Apps Script not configured — use Download');
      return;
    }
    if (typeof callScript !== 'function') {
      if (typeof showToast === 'function') showToast('error', 'callScript missing — check dashboard.js');
      return;
    }

    const btn = document.getElementById('loReportConfirmBtn');
    btn.disabled = true;
    showLoading(true, 'Generating PDF…');

    try {
      const blob = await buildPdfBlob();
      showLoading(true, 'Uploading to Drive…');
      const base64 = await blobToBase64(blob);
      const filename = buildFilename(data);

      const result = await uploadReportToDrive({
        action: 'saveReport',
        jobId: data.jobId,
        driveFolder: data.driveFolder,
        filename,
        pdfBase64: base64,
      });

      if (result && result.ok) {
        if (typeof showToast === 'function') showToast('success', 'Report saved to Drive');
        window.reportClose();
      } else {
        const errMsg = (result && result.error) || 'Unknown error';
        if (typeof showToast === 'function') showToast('error', 'Save failed: ' + errMsg);
      }
    } catch (e) {
      console.error(e);
      if (typeof showToast === 'function') showToast('error', 'Failed: ' + e.message);
    } finally {
      btn.disabled = false;
      showLoading(false);
    }
  };

  // ── Inject Job Sheet topbar button ──────────────────────────
  function injectJobSheetButton() {
    const right = document.getElementById('jsTopbarRight');
    if (!right || right.querySelector('[data-lo-report]')) return;
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.dataset.loReport = '1';
    btn.onclick = window.reportOpenForCurrentJob;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      Generate Report
    `;
    // Insert before the Save button so order is: Save Indicator | Print | CSV | Generate Report | Save to Drive
    const saveBtn = document.getElementById('jsSaveBtn');
    if (saveBtn) {
      right.insertBefore(btn, saveBtn);
    } else {
      right.appendChild(btn);
    }
  }

  // ── Inject report icon into All Jobs rows ───────────────────
  // We do this by observing the tBody and adding a button to the
  // Folder column (last column). Re-runs after each render.
  function injectAllJobsButtons() {
    const tBody = document.getElementById('tBody');
    if (!tBody) return;
    const rows = tBody.querySelectorAll('tr');
    rows.forEach(tr => {
      // Try to extract jobId from the first cell
      const idCell = tr.querySelector('.t-job-id');
      if (!idCell) return;
      const jobId = idCell.textContent.trim();
      if (!jobId || jobId === '—') return;

      const folderCell = tr.cells[tr.cells.length - 1];
      if (!folderCell || folderCell.querySelector('.lo-row-report-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'lo-row-report-btn';
      btn.title = 'Generate Repair Report';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      `;
      btn.onclick = (e) => {
        e.stopPropagation();
        window.reportOpenForJobId(jobId);
      };

      // Append at the end of the folder cell with a separator if there's already content
      if (folderCell.textContent.trim() !== '—' && folderCell.children.length) {
        folderCell.appendChild(document.createTextNode(' '));
      }
      folderCell.appendChild(btn);
    });
  }

  // Watch the All Jobs table body for re-renders
  function watchAllJobsTable() {
    const tBody = document.getElementById('tBody');
    if (!tBody) return;
    const obs = new MutationObserver(() => injectAllJobsButtons());
    obs.observe(tBody, { childList: true });
    injectAllJobsButtons();
  }

  // Watch for the Job Sheet topbar becoming visible
  function watchJobSheetTopbar() {
    const right = document.getElementById('jsTopbarRight');
    if (!right) return;
    const obs = new MutationObserver(() => {
      if (right.style.display !== 'none') injectJobSheetButton();
    });
    obs.observe(right, { attributes: true, attributeFilter: ['style'] });
    if (right.style.display !== 'none') injectJobSheetButton();
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildModal();
    watchAllJobsTable();
    watchJobSheetTopbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
