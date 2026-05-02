/* ============================================================
   Logic One SA — Technocity Invoice Export Module
   ------------------------------------------------------------
   Generates an .xlsx file with two sheets (Roborock / Segway)
   containing completed jobs ready to send to Technocity for
   invoicing.

   Columns per sheet:
     Case No. | Unit Model | Fault | Completion Date |
     Repair Level | Parts Ordered | Repair Cost

   A job is included if its status is "Complete" or "Collected"
   and its brand matches the sheet (case-insensitive).

   Data is enriched from saved Drive job sheets where available
   — falls back gracefully to kanban-level data.

   Dependencies:
   - SheetJS (xlsx) loaded on-demand from CDN
   - Existing globals: jobs, cfg, callScript, showToast

   Public API:
     window.invoiceExportOpen()   → opens the modal
   ============================================================ */

(function () {
  'use strict';

  // ── Style ────────────────────────────────────────────────────
  const STYLE = `
.lo-inv-overlay {
  position: fixed; inset: 0;
  background: rgba(15,23,42,0.55);
  backdrop-filter: blur(4px);
  display: none; align-items: center; justify-content: center;
  z-index: 9100; padding: 24px;
}
.lo-inv-overlay.show { display: flex; }
.lo-inv-modal {
  background: var(--bg-card, #fff);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.28);
  width: 100%; max-width: 760px;
  max-height: 88vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
}
.lo-inv-header {
  padding: 18px 24px;
  border-bottom: 1px solid var(--border, #e2e8f0);
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  flex-shrink: 0;
}
.lo-inv-header h2 {
  margin: 0; font-size: 16px; font-weight: 700;
  font-family: 'Orbitron', sans-serif; letter-spacing: 0.04em;
  color: var(--text-primary, #0f172a);
}
.lo-inv-header-sub { font-size: 12px; color: var(--text-secondary, #64748b); margin-top: 3px; }
.lo-inv-close {
  background: none; border: 0; cursor: pointer;
  width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary, #64748b); transition: background 0.15s;
}
.lo-inv-close:hover { background: var(--bg-hover, #f1f5f9); color: var(--text-primary, #0f172a); }

.lo-inv-body {
  flex: 1; overflow-y: auto; padding: 20px 24px;
}

/* Summary cards */
.lo-inv-summary {
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;
}
.lo-inv-brand-card {
  border: 1.5px solid var(--border, #e2e8f0);
  border-radius: 10px; padding: 16px 18px;
  display: flex; flex-direction: column; gap: 4px;
}
.lo-inv-brand-card.roborock { border-color: rgba(220,38,38,0.25); background: rgba(220,38,38,0.03); }
.lo-inv-brand-card.segway   { border-color: rgba(37,99,235,0.25); background: rgba(37,99,235,0.03); }
.lo-inv-brand-name {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-secondary, #64748b);
}
.lo-inv-brand-card.roborock .lo-inv-brand-name { color: #dc2626; }
.lo-inv-brand-card.segway   .lo-inv-brand-name { color: #2563eb; }
.lo-inv-brand-count {
  font-size: 28px; font-weight: 800; color: var(--text-primary, #0f172a);
  font-family: 'Orbitron', sans-serif; line-height: 1;
}
.lo-inv-brand-meta { font-size: 12px; color: var(--text-secondary, #64748b); margin-top: 2px; }

/* Filter row */
.lo-inv-filters {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  margin-bottom: 16px; padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light, #f1f5f9);
}
.lo-inv-filter-label {
  font-size: 12px; font-weight: 600; color: var(--text-secondary, #64748b);
  text-transform: uppercase; letter-spacing: 0.06em; flex-shrink: 0;
}
.lo-inv-filter-select {
  padding: 7px 10px; border: 1.5px solid var(--border, #e2e8f0);
  border-radius: 7px; font-size: 13px; font-family: 'Inter', sans-serif;
  color: var(--text-primary, #0f172a); background: var(--bg-input, #fff);
  outline: none; cursor: pointer;
}
.lo-inv-filter-select:focus { border-color: var(--accent, #00b4d8); }

/* Preview table */
.lo-inv-table-wrap { overflow-x: auto; }
.lo-inv-table {
  width: 100%; border-collapse: collapse; font-size: 12.5px;
}
.lo-inv-table th {
  text-align: left; padding: 9px 10px;
  font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--text-secondary, #64748b);
  border-bottom: 2px solid var(--border, #e2e8f0);
  white-space: nowrap; background: var(--bg-surface, #f8fafc);
}
.lo-inv-table td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-light, #f1f5f9);
  color: var(--text-primary, #0f172a); vertical-align: top;
}
.lo-inv-table tr:hover td { background: var(--bg-hover, #f8fafc); }
.lo-inv-brand-pill {
  display: inline-block; padding: 2px 7px; font-size: 10px; font-weight: 700;
  border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em;
}
.lo-inv-brand-pill.roborock { background: rgba(220,38,38,0.1); color: #dc2626; }
.lo-inv-brand-pill.segway   { background: rgba(37,99,235,0.1);  color: #2563eb; }
.lo-inv-empty {
  text-align: center; padding: 32px 16px;
  color: var(--text-secondary, #64748b); font-size: 13px; font-style: italic;
}

/* Loading spinner */
.lo-inv-loading {
  display: none; align-items: center; gap: 10px;
  padding: 16px 0; color: var(--text-secondary, #64748b); font-size: 13px;
}
.lo-inv-loading.show { display: flex; }
.lo-inv-spinner {
  width: 18px; height: 18px; flex-shrink: 0;
  border: 2px solid var(--border, #e2e8f0); border-top-color: var(--accent, #00b4d8);
  border-radius: 50%; animation: lo-inv-spin 0.7s linear infinite;
}
@keyframes lo-inv-spin { to { transform: rotate(360deg); } }

/* Footer */
.lo-inv-footer {
  padding: 14px 24px;
  border-top: 1px solid var(--border, #e2e8f0);
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: var(--bg-card, #fff); flex-shrink: 0;
}
.lo-inv-footer-info { font-size: 12px; color: var(--text-secondary, #64748b); }
.lo-inv-footer-actions { display: flex; gap: 10px; }
`;

  // ── SheetJS loader ───────────────────────────────────────────
  let xlsxLoaded = false;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }
  async function ensureXlsx() {
    if (xlsxLoaded || typeof window.XLSX !== 'undefined') { xlsxLoaded = true; return; }
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    xlsxLoaded = true;
  }

  // ── State ────────────────────────────────────────────────────
  let enrichedJobs = [];   // jobs enriched with Drive sheet data
  let filterMonth  = '';   // '' = all time, or 'YYYY-MM'

  // ── Helpers ─────────────────────────────────────────────────
  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const completionDate = (job) => {
    const ts = job.statusTimestamps || {};
    return ts['Collected'] || ts['Complete'] || '';
  };

  const isCompleted = (job) =>
    job.status === 'Complete' || job.status === 'Collected';

  const isBrand = (job, brand) =>
    (job.brand || '').toLowerCase().includes(brand.toLowerCase());

  const matchesMonthFilter = (job) => {
    if (!filterMonth) return true;
    const cd = completionDate(job);
    if (!cd) return false;
    // cd is ISO string — compare YYYY-MM prefix
    return cd.startsWith(filterMonth);
  };

  const partsOrderedStr = (job) => {
    // Prefer enriched parts array; fall back to orderNums
    if (job.parts && job.parts.length) {
      return job.parts.map(p =>
        [p.partno || p.partNumber || '', p.name || p.partName || '']
          .filter(Boolean).join(' – ')
          || 'Part'
      ).join('; ');
    }
    if (job.orderNums && job.orderNums.length) {
      return job.orderNums.filter(Boolean).join('; ');
    }
    return '—';
  };

  const faultStr = (job) =>
    job.finalRemark || job.inspectionNote || job.issue || '—';

  const repairCostStr = (job) => {
    const n = parseFloat(job.total);
    if (!isNaN(n) && n > 0) return '$' + n.toFixed(2);
    return '—';
  };

  // ── Enrich jobs from Drive ───────────────────────────────────
  // Loads saved job sheet JSON for each completed job so we get
  // the richer data (parts, notes, repair level, totals, etc.)
  async function enrichJobs(baseJobs) {
    const canEnrich = typeof cfg !== 'undefined' && cfg && cfg.appsScriptUrl
      && typeof callScript === 'function';

    const results = await Promise.allSettled(
      baseJobs.map(async (job) => {
        if (!canEnrich || !job.driveFolder) return job;
        try {
          const res = await callScript({
            action: 'loadJobSheet',
            jobId: job.jobId,
            driveFolder: job.driveFolder,
          });
          if (res && res.ok && res.data) {
            return Object.assign({}, job, res.data);
          }
        } catch (e) { /* ignore */ }
        return job;
      })
    );
    return results.map(r => r.status === 'fulfilled' ? r.value : r.reason);
  }

  // ── Build available month options ────────────────────────────
  function buildMonthOptions(jobs) {
    const seen = new Set();
    jobs.forEach(j => {
      const cd = completionDate(j);
      if (cd) seen.add(cd.slice(0, 7)); // YYYY-MM
    });
    return [...seen].sort().reverse();
  }

  // ── Filtered job list for preview ───────────────────────────
  function filteredJobs() {
    return enrichedJobs.filter(j => isCompleted(j) && matchesMonthFilter(j));
  }

  // ── Inject styles & build modal ─────────────────────────────
  function injectStyles() {
    if (document.getElementById('lo-inv-styles')) return;
    const s = document.createElement('style');
    s.id = 'lo-inv-styles'; s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function buildModal() {
    if (document.getElementById('loInvOverlay')) return;
    const el = document.createElement('div');
    el.className = 'lo-inv-overlay'; el.id = 'loInvOverlay';
    el.innerHTML = `
      <div class="lo-inv-modal">
        <div class="lo-inv-header">
          <div>
            <h2>Technocity Invoice Export</h2>
            <div class="lo-inv-header-sub">Export completed jobs as .xlsx for invoicing</div>
          </div>
          <button class="lo-inv-close" onclick="window.invoiceExportClose()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="lo-inv-body">
          <div class="lo-inv-loading show" id="loInvLoading">
            <div class="lo-inv-spinner"></div>
            <span id="loInvLoadingMsg">Loading completed jobs…</span>
          </div>
          <div id="loInvContent" style="display:none;">
            <!-- Summary cards -->
            <div class="lo-inv-summary">
              <div class="lo-inv-brand-card roborock">
                <div class="lo-inv-brand-name">Roborock</div>
                <div class="lo-inv-brand-count" id="loInvRoboCount">0</div>
                <div class="lo-inv-brand-meta" id="loInvRoboMeta">completed jobs</div>
              </div>
              <div class="lo-inv-brand-card segway">
                <div class="lo-inv-brand-name">Segway</div>
                <div class="lo-inv-brand-count" id="loInvSegCount">0</div>
                <div class="lo-inv-brand-meta" id="loInvSegMeta">completed jobs</div>
              </div>
            </div>

            <!-- Filters -->
            <div class="lo-inv-filters">
              <span class="lo-inv-filter-label">Period</span>
              <select class="lo-inv-filter-select" id="loInvMonthFilter" onchange="window.invoiceExportSetMonth(this.value)">
                <option value="">All time</option>
              </select>
            </div>

            <!-- Preview table -->
            <div class="lo-inv-table-wrap">
              <table class="lo-inv-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Case No.</th>
                    <th>Unit Model</th>
                    <th>Fault</th>
                    <th>Completed</th>
                    <th>Repair Level</th>
                    <th>Parts Ordered</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody id="loInvTableBody"></tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="lo-inv-footer">
          <div class="lo-inv-footer-info" id="loInvFooterInfo">—</div>
          <div class="lo-inv-footer-actions">
            <button class="btn btn-secondary" onclick="window.invoiceExportClose()">Cancel</button>
            <button class="btn btn-primary" id="loInvExportBtn" onclick="window.invoiceExportDownload()" disabled>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download .xlsx
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) window.invoiceExportClose(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && el.classList.contains('show')) window.invoiceExportClose();
    });
  }

  // ── Render preview table ─────────────────────────────────────
  function renderTable() {
    const jobs = filteredJobs();
    const body = document.getElementById('loInvTableBody');
    if (!body) return;

    // Update summary counts (filtered)
    const rCount = jobs.filter(j => isBrand(j, 'roborock')).length;
    const sCount = jobs.filter(j => isBrand(j, 'segway')).length;

    document.getElementById('loInvRoboCount').textContent = rCount;
    document.getElementById('loInvSegCount').textContent  = sCount;
    document.getElementById('loInvRoboMeta').textContent  = 'completed jobs';
    document.getElementById('loInvSegMeta').textContent   = 'completed jobs';

    const total = rCount + sCount;
    const other = jobs.length - total;

    document.getElementById('loInvFooterInfo').textContent =
      `${total} job${total !== 1 ? 's' : ''} across ${rCount} Roborock + ${sCount} Segway` +
      (other > 0 ? ` (${other} other brand${other > 1 ? 's' : ''} excluded)` : '');

    const exportBtn = document.getElementById('loInvExportBtn');
    if (exportBtn) exportBtn.disabled = total === 0;

    if (!total) {
      body.innerHTML = `<tr><td colspan="8" class="lo-inv-empty">No completed Roborock or Segway jobs found${filterMonth ? ' for this period' : ''}.</td></tr>`;
      return;
    }

    // Sort: Roborock first, then Segway; within each brand by completion date desc
    const sorted = [...jobs]
      .filter(j => isBrand(j, 'roborock') || isBrand(j, 'segway'))
      .sort((a, b) => {
        const ab = isBrand(a, 'roborock') ? 0 : 1;
        const bb = isBrand(b, 'roborock') ? 0 : 1;
        if (ab !== bb) return ab - bb;
        return (completionDate(b) || '').localeCompare(completionDate(a) || '');
      });

    body.innerHTML = sorted.map(job => {
      const brand = isBrand(job, 'roborock') ? 'roborock' : 'segway';
      const fault = faultStr(job);
      const faultShort = fault.length > 55 ? fault.slice(0, 52) + '…' : fault;
      const parts = partsOrderedStr(job);
      const partsShort = parts.length > 45 ? parts.slice(0, 42) + '…' : parts;
      return `
        <tr>
          <td><span class="lo-inv-brand-pill ${brand}">${job.brand || brand}</span></td>
          <td style="font-family:monospace;font-size:11.5px;">${job.caseNo || '—'}</td>
          <td>${job.model || '—'}</td>
          <td title="${fault.replace(/"/g, '&quot;')}" style="max-width:180px;">${faultShort}</td>
          <td style="white-space:nowrap;">${fmtDate(completionDate(job))}</td>
          <td style="white-space:nowrap;">${job.repairLevel || '—'}</td>
          <td title="${parts.replace(/"/g, '&quot;')}" style="max-width:160px;">${partsShort}</td>
          <td style="white-space:nowrap;">${repairCostStr(job)}</td>
        </tr>`;
    }).join('');
  }

  function renderMonthFilter() {
    const sel = document.getElementById('loInvMonthFilter');
    if (!sel) return;
    const months = buildMonthOptions(enrichedJobs.filter(j => isCompleted(j)));
    const current = sel.value;
    sel.innerHTML = '<option value="">All time</option>' +
      months.map(m => {
        const d = new Date(m + '-01');
        const label = d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
        return `<option value="${m}"${m === current ? ' selected' : ''}>${label}</option>`;
      }).join('');
  }

  // ── Build & download xlsx ────────────────────────────────────
  async function buildXlsx() {
    await ensureXlsx();
    const XLSX = window.XLSX;

    const jobs = filteredJobs()
      .filter(j => isBrand(j, 'roborock') || isBrand(j, 'segway'));

    // Column headers
    const HEADERS = [
      'Case No.',
      'Unit Model',
      'Fault',
      'Completion Date',
      'Repair Level',
      'Parts Ordered',
      'Repair Cost ($)',
    ];

    // Build row for a job
    const toRow = (job) => [
      job.caseNo || '',
      job.model  || '',
      faultStr(job),
      fmtDate(completionDate(job)),
      job.repairLevel || '',
      partsOrderedStr(job),
      parseFloat(job.total) || 0,
    ];

    const roboJobs = jobs
      .filter(j => isBrand(j, 'roborock'))
      .sort((a, b) => (completionDate(b) || '').localeCompare(completionDate(a) || ''));

    const segJobs = jobs
      .filter(j => isBrand(j, 'segway'))
      .sort((a, b) => (completionDate(b) || '').localeCompare(completionDate(a) || ''));

    const wb = XLSX.utils.book_new();

    // ── Sheet builder ─────────────────────────────────────────
    const buildSheet = (jobList, brand) => {
      const ws = XLSX.utils.aoa_to_sheet([]);

      // ── Title rows ──────────────────────────────────────────
      const periodLabel = filterMonth
        ? (() => {
            const d = new Date(filterMonth + '-01');
            return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
          })()
        : 'All Periods';

      XLSX.utils.sheet_add_aoa(ws, [
        [`Logic One SA — ${brand} Warranty Repair Invoice`],
        [`Generated: ${new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' })}   |   Period: ${periodLabel}   |   Jobs: ${jobList.length}`],
        [],  // blank spacer row
        HEADERS,
        ...jobList.map(toRow),
        [],  // blank row before totals
        ['', '', '', '', '', 'Total Repair Cost', `=SUM(G5:G${4 + jobList.length})`],
      ], { origin: 'A1' });

      // ── Column widths ────────────────────────────────────────
      ws['!cols'] = [
        { wch: 24 },  // Case No.
        { wch: 22 },  // Unit Model
        { wch: 40 },  // Fault
        { wch: 18 },  // Completion Date
        { wch: 20 },  // Repair Level
        { wch: 38 },  // Parts Ordered
        { wch: 16 },  // Repair Cost
      ];

      // ── Row heights ──────────────────────────────────────────
      ws['!rows'] = [{ hpt: 22 }, { hpt: 16 }, { hpt: 6 }, { hpt: 18 }];

      // ── Styles via cell format strings ───────────────────────
      // Note: SheetJS free tier supports number formats but not
      // fill colours — we still apply number formats for cost column.
      const costCol = 'G';
      const dataStart = 5;
      const dataEnd = 4 + jobList.length;

      for (let r = dataStart; r <= dataEnd; r++) {
        const addr = `${costCol}${r}`;
        if (ws[addr]) {
          ws[addr].z = '"$"#,##0.00';
        }
      }
      // Total formula cell
      const totalAddr = `${costCol}${dataEnd + 2}`;
      if (ws[totalAddr]) ws[totalAddr].z = '"$"#,##0.00';

      return ws;
    };

    const roboSheet = buildSheet(roboJobs, 'Roborock');
    const segSheet  = buildSheet(segJobs,  'Segway Ninebot');

    XLSX.utils.book_append_sheet(wb, roboSheet, 'Roborock');
    XLSX.utils.book_append_sheet(wb, segSheet,  'Segway');

    return wb;
  }

  // ── Build filename ───────────────────────────────────────────
  function buildFilename() {
    const period = filterMonth
      ? (() => {
          const d = new Date(filterMonth + '-01');
          return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }).replace(' ', '-');
        })()
      : 'All';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LogicOneSA_Technocity_Invoice_${period}_${dateStr}.xlsx`;
  }

  // ── Public: open modal ───────────────────────────────────────
  window.invoiceExportOpen = async function () {
    injectStyles(); buildModal();

    // Show modal with loading state
    document.getElementById('loInvOverlay').classList.add('show');
    document.getElementById('loInvContent').style.display = 'none';
    document.getElementById('loInvLoading').classList.add('show');
    document.getElementById('loInvLoadingMsg').textContent = 'Loading completed jobs…';
    if (document.getElementById('loInvExportBtn'))
      document.getElementById('loInvExportBtn').disabled = true;

    // Grab completed jobs from the global jobs array
    const allJobs = (typeof jobs !== 'undefined' && Array.isArray(jobs)) ? jobs : [];
    const completedJobs = allJobs.filter(isCompleted);

    if (completedJobs.length) {
      document.getElementById('loInvLoadingMsg').textContent =
        `Enriching ${completedJobs.length} job${completedJobs.length > 1 ? 's' : ''} from Drive…`;
    }

    enrichedJobs = await enrichJobs(completedJobs);
    filterMonth  = '';

    // Render
    renderMonthFilter();
    renderTable();

    document.getElementById('loInvLoading').classList.remove('show');
    document.getElementById('loInvContent').style.display = '';
  };

  // ── Public: month filter change ──────────────────────────────
  window.invoiceExportSetMonth = function (val) {
    filterMonth = val;
    renderTable();
  };

  // ── Public: download xlsx ────────────────────────────────────
  window.invoiceExportDownload = async function () {
    const btn = document.getElementById('loInvExportBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Building…'; }

    try {
      const wb = await buildXlsx();
      const XLSX = window.XLSX;
      XLSX.writeFile(wb, buildFilename());
      if (typeof showToast === 'function') showToast('success', 'Invoice spreadsheet downloaded');
      window.invoiceExportClose();
    } catch (e) {
      console.error('Invoice export failed:', e);
      if (typeof showToast === 'function') showToast('error', 'Export failed: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download .xlsx`; }
    }
  };

  // ── Public: close ────────────────────────────────────────────
  window.invoiceExportClose = function () {
    const el = document.getElementById('loInvOverlay');
    if (el) el.classList.remove('show');
  };

  // ── Inject sidebar nav item ──────────────────────────────────
  // Adds "Invoice Export" under the existing nav items.
  function injectNavItem() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav || nav.querySelector('[data-lo-invoice]')) return;

    const item = document.createElement('a');
    item.className = 'nav-item';
    item.dataset.loInvoice = '1';
    item.title = 'Technocity Invoice Export';
    item.style.cursor = 'pointer';
    item.onclick = () => window.invoiceExportOpen();
    item.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
        <line x1="7" y1="8" x2="7" y2="13"/>
        <line x1="12" y1="7" x2="12" y2="13"/>
        <line x1="17" y1="10" x2="17" y2="13"/>
      </svg>
      <span class="nav-label">Invoice Export</span>
    `;

    // Insert a section label before the item if not already there
    const existingLabel = [...nav.querySelectorAll('.sidebar-section-label')]
      .find(el => el.textContent.trim() === 'Reports');
    if (!existingLabel) {
      const label = document.createElement('div');
      label.className = 'sidebar-section-label';
      label.textContent = 'Reports';
      nav.appendChild(label);
    }
    nav.appendChild(item);
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildModal();
    injectNavItem();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
