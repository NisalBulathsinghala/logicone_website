/* ============================================================
   Logic One SA — Report Module
   ------------------------------------------------------------
   Self-contained module that hooks into the existing dashboard
   to generate a Customer Report PDF and save it to the job's
   Drive folder via Apps Script.

   Dependencies:
   - jsPDF + html2canvas (loaded on-demand from CDN)
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
  z-index: 9999;
  padding: 24px;
}
.lo-report-overlay.show { display: flex; }
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
  max-width: 794px; margin: 0 auto;
  padding: 36px 44px 44px;
  box-shadow: 0 4px 20px rgba(15,23,42,0.08);
  border-radius: 4px;
  font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px; line-height: 1.5;
  color: #0f172a;
}

/* Report content styles (scoped to .lo-report-preview) */
.lo-report-preview * { box-sizing: border-box; }

.lor-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 24px; padding-bottom: 18px;
  border-bottom: 2px solid #0f172a; margin-bottom: 24px;
}
.lor-header-left { display: flex; align-items: center; gap: 14px; }
.lor-logo {
  height: 56px; width: auto;
  background: #0a0e1a; padding: 5px 9px; border-radius: 6px;
}
.lor-brand-name {
  font-family: 'Orbitron', sans-serif;
  font-weight: 900; font-size: 17px;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: #0f172a; line-height: 1;
}
.lor-brand-tag { margin-top: 4px; font-size: 11px; color: #475569; letter-spacing: 0.04em; }
.lor-header-right { text-align: right; }
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

.lor-prose {
  background: #f5f7fa; border-left: 3px solid #0066cc;
  padding: 12px 16px; font-size: 13px; line-height: 1.6; color: #0f172a;
  border-radius: 0 4px 4px 0; white-space: pre-wrap;
}
.lor-prose ul { margin: 6px 0; padding-left: 18px; }
.lor-prose li { margin-bottom: 4px; }
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
`;

  // ── State ───────────────────────────────────────────────────
  let jsPDFLoaded = false;
  let html2canvasLoaded = false;
  let currentReportData = null;
  let logoDataUrl = null;

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
          <div>
            <div class="lor-brand-name">Logic One SA</div>
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

      <section class="lor-section">
        <div class="lor-section-title">Work Performed</div>
        <div class="lor-prose">${renderProse(d.repairRemark)}</div>
      </section>

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

  // ── Load logo as data URL (so html2canvas can capture it) ───
  async function preloadLogo() {
    if (logoDataUrl) return logoDataUrl;
    try {
      const r = await fetch('images/logo.png');
      const blob = await r.blob();
      logoDataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
      return logoDataUrl;
    } catch (e) {
      console.warn('Logo preload failed:', e);
      return null;
    }
  }

  // ── Lazy-load jsPDF & html2canvas from CDN ──────────────────
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
    if (!html2canvasLoaded) {
      if (typeof html2canvas === 'undefined') {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      }
      html2canvasLoaded = true;
    }
    if (!jsPDFLoaded) {
      if (typeof window.jspdf === 'undefined') {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
      jsPDFLoaded = true;
    }
  }

  // ── Build PDF blob from preview DOM ─────────────────────────
  async function buildPdfBlob() {
    await ensureLibs();
    const preview = document.getElementById('loReportPreview');
    const canvas = await html2canvas(preview, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // jsPDF — A4 portrait (210 x 297 mm). Width in pt for image scaling.
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = 210;
    const pageH = 297;
    const margin = 0; // preview already includes its own padding equivalent to print margins

    const imgW = pageW - margin * 2;
    const imgH = canvas.height * (imgW / canvas.width);
    const imgData = canvas.toDataURL('image/png');

    if (imgH <= pageH - margin * 2) {
      pdf.addImage(imgData, 'PNG', margin, margin, imgW, imgH);
    } else {
      // Multi-page: slice the canvas
      let remaining = imgH;
      let yPos = 0;
      const pageContentH = pageH - margin * 2;
      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', margin, margin - yPos, imgW, imgH);
        remaining -= pageContentH;
        if (remaining > 0) {
          pdf.addPage();
          yPos += pageContentH;
        }
      }
    }

    return pdf.output('blob');
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
      repairRemark: '',
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

      const result = await callScript({
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
