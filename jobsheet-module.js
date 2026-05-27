// Logic One SA — Job Sheet Module
// Injects styles, builds the job sheet view, handles Drive save/load

(function() {
  // Inject jobsheet styles into <head>
  const style = document.createElement('style');
  style.textContent = `
/* ===== JOB SHEET VIEW ===== */
.js-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 28px; background: var(--bg-surface);
  border-bottom: 1px solid var(--border); flex-shrink: 0; gap: 16px;
}
/* Sticky only inside the job sheet view's own scroll container */
#view-jobsheet.active .js-topbar {
  position: sticky; top: 0; z-index: 10;
}
.js-topbar-left { display: flex; align-items: center; gap: 16px; min-width: 0; }
.js-topbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.js-back-btn { white-space: nowrap; }
.js-job-title { font-size: 14px; font-weight: 600; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.js-save-ind {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-secondary); font-weight: 500;
  padding: 5px 12px; border-radius: 20px; border: 1px solid var(--border);
  white-space: nowrap;
}
.js-save-ind.saved { color: #059669; border-color: rgba(5,150,105,0.3); background: rgba(5,150,105,0.05); }
.js-section { padding: 24px 28px; }
.js-picker-search { margin-bottom: 16px; }
.js-picker-search input {
  width: 100%; max-width: 600px; padding: 9px 14px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  font-family: 'Inter', sans-serif; font-size: 13px;
  background: var(--bg-surface); color: var(--text-primary);
}
.js-picker-search input:focus { outline: none; border-color: var(--accent); }
.js-picker-table-wrap { border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border); }
.js-open-btn { font-size: 12px; color: var(--accent); font-weight: 600; cursor: pointer; }
.js-sheet-wrap { max-width: 960px; }
.js-card {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 22px 24px; margin-bottom: 14px;
  box-shadow: var(--shadow-sm);
}
.js-header-card { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.js-header-left { display: flex; align-items: center; gap: 14px; }
.js-logo { font-family: 'Orbitron', sans-serif; font-size: 15px; font-weight: 700; }
.js-logo span { color: var(--accent); }
.js-badge {
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--accent); background: rgba(0,180,216,0.1); border: 1px solid rgba(0,180,216,0.25);
  padding: 3px 10px; border-radius: 20px;
}
.js-header-ids { display: flex; gap: 24px; flex-wrap: wrap; }
.js-id-block { }
.js-id-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 3px; }
.js-id-val { font-size: 13px; font-weight: 700; font-family: 'Orbitron', sans-serif; letter-spacing: 0.3px; }
.js-id-muted { font-size: 12px; font-family: 'Inter', sans-serif; font-weight: 400; color: var(--text-secondary); }
.js-card-title {
  font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--text-secondary); margin-bottom: 16px;
  display: flex; align-items: center; gap: 8px;
}
.js-card-title::after { content: ''; flex: 1; height: 1px; background: var(--border-light); }
.js-fg { display: grid; gap: 12px; }
.js-fg3 { grid-template-columns: 1fr 1fr 1fr; }
.js-f { display: flex; flex-direction: column; gap: 4px; }
.js-f label, .js-f-label {
  font-size: 10.5px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--text-secondary);
}
.js-f-label { margin-bottom: 6px; }
.js-f input, .js-f select, .js-f textarea {
  padding: 8px 12px; font-family: 'Inter', sans-serif; font-size: 13px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg-surface); color: var(--text-primary); transition: border-color 0.15s;
}
.js-f input:focus, .js-f select:focus, .js-f textarea:focus { outline: none; border-color: var(--accent); }
.js-f input[readonly] { background: var(--bg-primary); color: var(--text-secondary); }
.js-f textarea { resize: vertical; min-height: 70px; line-height: 1.5; }
.js-checklist { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.js-check-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border: 1px solid var(--border);
  border-radius: var(--radius-sm); font-size: 13px; cursor: pointer;
  user-select: none; transition: all 0.15s;
}
.js-check-item:hover { border-color: var(--accent); }
.js-check-item.checked { border-color: var(--accent); background: rgba(0,180,216,0.08); color: #0369a1; }
.js-check-item input[type=checkbox] { width: 14px; height: 14px; accent-color: var(--accent); flex-shrink: 0; }
.js-svc-grid { display: flex; gap: 10px; margin-bottom: 4px; }
.js-svc-btn {
  flex: 1; padding: 9px 12px; text-align: center; font-size: 13px; font-weight: 500;
  border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;
  background: var(--bg-surface); color: var(--text-secondary); transition: all 0.15s;
}
.js-svc-btn:hover { border-color: var(--accent); }
.js-svc-btn.active { background: rgba(0,180,216,0.1); border-color: var(--accent); color: #0369a1; }
.js-parts-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.js-parts-table th {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--text-secondary); padding: 8px 10px; border-bottom: 1px solid var(--border);
  background: var(--bg-primary); text-align: left;
}
.js-parts-table td { padding: 5px 4px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
.js-parts-table td input {
  width: 100%; padding: 6px 8px; font-family: 'Inter', sans-serif; font-size: 13px;
  border: 1px solid transparent; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-primary);
}
.js-parts-table td input:focus { border-color: var(--accent); background: var(--bg-surface); outline: none; }
.js-parts-del { background: none; border: none; cursor: pointer; color: var(--text-secondary); font-size: 18px; padding: 2px 6px; border-radius: 4px; line-height: 1; }
.js-parts-del:hover { color: #dc2626; background: #fef2f2; }
.js-add-part-btn {
  margin-top: 10px; font-size: 12px; font-family: 'Inter', sans-serif; font-weight: 500;
  color: var(--accent); background: none; border: 1px dashed rgba(0,180,216,0.4);
  border-radius: var(--radius-sm); padding: 7px 16px; cursor: pointer; transition: all 0.15s; width: 100%;
}
.js-add-part-btn:hover { background: rgba(0,180,216,0.08); border-color: var(--accent); }
.js-cost-box { width: 280px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
.js-cost-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 14px; border-bottom: 1px solid var(--border-light); font-size: 13px; }
.js-cost-row:last-child { border-bottom: none; }
.js-cost-row span:first-child { color: var(--text-secondary); }
.js-cost-row span:last-child { font-weight: 500; }
.js-cost-total { background: rgba(0,180,216,0.08); }
.js-cost-total span:first-child { font-weight: 600; color: var(--text-primary); }
.js-cost-total span:last-child { font-size: 16px; font-weight: 700; color: #0369a1; }
.js-cost-inp {
  width: 100px; text-align: right; padding: 4px 8px; font-family: 'Inter', sans-serif;
  font-size: 13px; border: 1px solid var(--border); border-radius: 4px;
  background: var(--bg-surface); color: var(--text-primary);
}
.js-cost-inp:focus { outline: none; border-color: var(--accent); }
.js-status-flow { display: flex; gap: 8px; flex-wrap: wrap; }
.js-status-pill {
  padding: 7px 16px; font-size: 12px; font-weight: 500;
  border: 1px solid var(--border); border-radius: 30px; cursor: pointer;
  background: var(--bg-surface); color: var(--text-secondary); transition: all 0.15s;
}
.js-status-pill:hover { border-color: var(--accent); }
.js-status-pill.active { background: rgba(0,180,216,0.1); border-color: var(--accent); color: #0369a1; }
.js-status-pill.js-done.active { background: rgba(16,185,129,0.1); border-color: #10b981; color: #065f46; }
.js-zoho-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 18px; font-size: 12.5px; font-weight: 500; font-family: 'Inter', sans-serif;
  border: 1px solid rgba(231,76,60,0.25); border-radius: 30px; cursor: pointer;
  background: rgba(231,76,60,0.07); color: #c0392b; transition: all 0.15s;
}
.js-zoho-btn:hover:not(:disabled) { background: rgba(231,76,60,0.15); }
.js-zoho-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.js-zoho-btn-quote {
  background: rgba(99,102,241,0.07); color: #4338ca;
  border-color: rgba(99,102,241,0.25);
}
.js-zoho-btn-quote:hover:not(:disabled) { background: rgba(99,102,241,0.15); }
.js-zoho-btn.done { background: rgba(5,150,105,0.1); color: #065f46; border-color: rgba(5,150,105,0.3); }
.js-drive-link { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--accent); text-decoration: none; font-weight: 500; }
.js-drive-link:hover { text-decoration: underline; }
/* Job sheet loading overlay */
#jsLoadingOverlay {
  position: sticky; top: 52px; left: 0; right: 0; bottom: 0;
  height: calc(100vh - 52px); z-index: 200;
  background: rgba(240,242,245,0.93); backdrop-filter: blur(3px);
  display: none; flex-direction: column;
  align-items: center; justify-content: center; gap: 14px;
}
#jsLoadingOverlay.show { display: flex; }
#jsLoadingOverlay .js-spinner {
  width: 32px; height: 32px; border: 3px solid var(--border);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
#jsLoadingOverlay .js-loading-msg {
  font-size: 13px; font-weight: 500; color: var(--text-secondary);
}

/* Stage notes grid */
.js-stage-notes {
  display: flex; flex-direction: column; gap: 14px;
}
.js-stage-note-block {
  display: flex; flex-direction: column; gap: 7px;
}
.js-stage-note-header {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.6px; color: var(--text-secondary);
}
.js-stage-note-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.js-stage-textarea {
  width: 100%; padding: 10px 12px; font-family: 'Inter', sans-serif;
  font-size: 13px; line-height: 1.7; resize: vertical; min-height: 110px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg-surface); color: var(--text-primary);
  transition: border-color 0.15s;
}
.js-stage-textarea:focus { outline: none; border-color: var(--accent); }

@media (max-width: 900px) {
  .js-fg3 { grid-template-columns: 1fr 1fr; }
  .js-checklist { grid-template-columns: repeat(2, 1fr); }

  .js-section { padding: 16px; }
  .js-topbar { padding: 12px 16px; }
}
/* Day counter badge on kanban cards */
.card-day-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 700;
  padding: 2px 7px; border-radius: 10px;
  background: rgba(100,116,139,0.1); color: #475569;
}
.card-day-badge.warn { background: rgba(245,158,11,0.12); color: #d97706; }
.card-day-badge.alert { background: rgba(239,68,68,0.12); color: #dc2626; }

/* Status timeline in job sheet */
.js-timeline { display: flex; flex-direction: column; gap: 0; }
.js-tl-row {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 10px 0; border-bottom: 1px solid var(--border-light);
  font-size: 13px;
}
.js-tl-row:last-child { border-bottom: none; }
.js-tl-dot-wrap { display: flex; flex-direction: column; align-items: center; padding-top: 3px; }
.js-tl-dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--border); background: var(--bg-surface);
}
.js-tl-dot.done { border-color: var(--accent); background: var(--accent); }
.js-tl-dot.current { border-color: var(--accent); background: var(--bg-surface); box-shadow: 0 0 0 3px rgba(0,180,216,0.2); }
.js-tl-line { width: 2px; flex: 1; min-height: 10px; background: var(--border-light); margin-top: 3px; }
.js-tl-row:last-child .js-tl-line { display: none; }
.js-tl-label { font-weight: 600; font-size: 13px; min-width: 130px; }
.js-tl-time { color: var(--text-secondary); font-size: 12px; }
.js-tl-duration { color: var(--accent); font-size: 11px; font-weight: 600; margin-left: auto; white-space: nowrap; }

/* Repair level select */
.js-repair-level-select {
  padding: 8px 12px; font-family: 'Inter', sans-serif; font-size: 13px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg-surface); color: var(--text-primary); cursor: pointer;
  min-width: 200px;
}
.js-repair-level-select:focus { outline: none; border-color: var(--accent); }
.js-repair-level-hint {
  font-size: 12px; color: var(--text-secondary); font-style: italic;
}

/* Scooter inspection checklist */
.js-scooter-cl-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
}
.js-scooter-cl-section { display: flex; flex-direction: column; gap: 6px; }
.js-scooter-cl-label {
  font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 4px;
  padding-bottom: 6px; border-bottom: 1px solid var(--border-light);
}
.js-scooter-cl-item {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--text-primary); cursor: pointer;
  padding: 5px 8px; border-radius: var(--radius-sm);
  transition: background 0.1s;
}
.js-scooter-cl-item:hover { background: rgba(0,180,216,0.05); }
.js-scooter-cl-item input[type=checkbox] { accent-color: var(--accent); width: 14px; height: 14px; flex-shrink: 0; }

/* Order numbers */
.js-order-row {
  display: flex; align-items: center; gap: 8px;
}
.js-order-row input {
  flex: 1; padding: 7px 10px; font-family: 'Inter', sans-serif; font-size: 13px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg-surface); color: var(--text-primary);
}
.js-order-row input:focus { outline: none; border-color: var(--accent); }
.js-order-del {
  background: none; border: none; cursor: pointer; color: var(--text-secondary);
  font-size: 18px; padding: 2px 6px; border-radius: 4px; line-height: 1; flex-shrink: 0;
}
.js-order-del:hover { color: #dc2626; background: #fef2f2; }

/* Scroll arrow */
.js-scroll-arrow {
  position: fixed; bottom: 28px; right: 28px; z-index: 50;
  width: 42px; height: 42px; border-radius: 50%;
  background: var(--accent); color: white; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(0,180,216,0.35);
  transition: opacity 0.2s, transform 0.2s, background 0.15s;
  opacity: 0; pointer-events: none;
}
.js-scroll-arrow.visible { opacity: 1; pointer-events: auto; }
.js-scroll-arrow.up { background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
.js-scroll-arrow:hover { transform: scale(1.1); }

@media (max-width: 900px) {
  .js-scooter-cl-grid { grid-template-columns: 1fr 1fr; }
}

@media print {
  .sidebar, .js-topbar, .js-parts-del, .js-add-part-btn { display: none !important; }
  .main-content { height: auto; overflow: visible; }
  #view-jobsheet, #jsScrollArea { overflow: visible; height: auto; }
  .js-card { box-shadow: none; page-break-inside: avoid; }
}

/* Save overlay */
.js-save-overlay {
  position: absolute; inset: 0;
  background: rgba(255,255,255,0.82);
  backdrop-filter: blur(3px);
  display: none; align-items: center; justify-content: center;
  flex-direction: column; gap: 14px;
  z-index: 800; border-radius: inherit;
  font-family: 'Inter', sans-serif;
}
.js-save-overlay.show { display: flex; }
.js-save-overlay-spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(0,180,216,0.15);
  border-top-color: var(--accent, #00b4d8);
  border-radius: 50%;
  animation: lo-spin .7s linear infinite;
}
.js-save-overlay-msg {
  font-size: 13px; font-weight: 600;
  color: var(--text-secondary, #64748b);
  letter-spacing: 0.02em;
}
@keyframes lo-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

  // Create scroll arrow button
  const scrollArrow = document.createElement('button');
  scrollArrow.id = 'jsScrollArrow';
  scrollArrow.className = 'js-scroll-arrow';
  scrollArrow.title = 'Scroll';
  scrollArrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><polyline points="6 9 12 15 18 9"/></svg>';
  scrollArrow.onclick = function() {
    const area = document.getElementById('jsScrollArea');
    if (!area) return;
    const isNearBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
    if (isNearBottom) {
      area.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
    }
  };
  document.body.appendChild(scrollArrow);

  // Show/hide and flip arrow based on scroll position
  document.addEventListener('DOMContentLoaded', () => {
    const area = document.getElementById('jsScrollArea');
    if (area) {
      area.addEventListener('scroll', () => {
        const isNearBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
        const hasScroll = area.scrollHeight > area.clientHeight + 40;
        const view = document.getElementById('view-jobsheet');
        const isActive = view && view.classList.contains('active');
        scrollArrow.classList.toggle('visible', hasScroll && isActive);
        // Flip arrow direction
        const svg = scrollArrow.querySelector('svg');
        if (isNearBottom) {
          svg.querySelector('polyline').setAttribute('points', '18 15 12 9 6 15');
        } else {
          svg.querySelector('polyline').setAttribute('points', '6 9 12 15 18 9');
        }
      });
    }
  });
})();

// ============================================================
// STATE
// ============================================================
let jsParts = [];
let jsCurrentJob = null;

const STATUS_ORDER = ['Intake','Diagnosis','Awaiting Parts','In Repair','Testing','Complete','Collected'];

// JOB SHEET VIEW
// ============================================================

function jsRenderJobList() {
  const tbody = document.getElementById('jsJobListBody');
  if (!tbody) return;
  const term = (document.getElementById('jsSearch')?.value || '').toLowerCase();
  const list = term ? jobs.filter(j =>
    (j.jobId||'').toLowerCase().includes(term) ||
    (j.caseNo||'').toLowerCase().includes(term) ||
    (j.name||'').toLowerCase().includes(term) ||
    (j.brand||'').toLowerCase().includes(term) ||
    (j.model||'').toLowerCase().includes(term)
  ) : jobs;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-secondary);font-size:13px;">${jobs.length ? 'No matching jobs.' : 'No jobs loaded.'}</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(j => {
    const sc = SC[j.status] || { bg:'#f1f5f9', c:'#475569' };
    return `<tr onclick="jsOpenJob('${j.jobId.replace(/'/g,"\\'")}')">
      <td><span class="t-job-id">${j.jobId||'—'}</span></td>
      <td style="font-size:12px;color:var(--text-secondary)">${j.caseNo||'—'}</td>
      <td>${j.name||'—'}</td>
      <td>${j.brand||''} ${j.model||''}</td>
      <td><span class="t-status" style="background:${sc.bg};color:${sc.c};">${j.status||'Intake'}</span></td>
      <td style="font-size:12px">${j.warranty||'—'}</td>
      <td><span class="js-open-btn">Open →</span></td>
    </tr>`;
  }).join('');
}

function jsFilterJobs() { jsRenderJobList(); }

function jsCloseSheet() {
  jsCurrentJob = null;
  jsParts = [];
  document.getElementById('jsSheetForm').style.display = 'none';
  document.getElementById('jsJobPicker').style.display = 'block';
  document.getElementById('jsTopbarRight').style.display = 'none';
  document.getElementById('jsBackToList').style.display = 'none';
  document.getElementById('jsJobTitle').textContent = 'Select a job to open its sheet';
  document.getElementById('viewTitle').textContent = 'JOB SHEETS';
  jsRenderJobList();
}

function jsOpenJobFromDetail(jobId) {
  switchView('jobsheet');
  jsOpenJob(jobId);
}

function jsShowLoadingOverlay(msg) {
  const el = document.getElementById('jsLoadingOverlay');
  const msgEl = document.getElementById('jsLoadingMsg');
  if (el) { el.classList.add('show'); }
  if (msgEl) msgEl.textContent = msg || 'Loading…';
}

function jsHideLoadingOverlay() {
  const el = document.getElementById('jsLoadingOverlay');
  if (el) el.classList.remove('show');
}

async function jsOpenJob(jobId) {
  const j = jobs.find(x => x.jobId === jobId);
  if (!j) return;
  jsCurrentJob = j;
  jsParts = [];
  jsOrderNums = [];
  window._jsRepairLevelCostOverride = null;

  // Load costs.json from Drive (non-blocking — updates hints/costs when ready)
  jsLoadCosts();

  // Populate read-only intake fields immediately
  jsPopulateIntake(j);
  jsUpdateScooterChecklist(j.deviceType || '');

  // Show the form with loading overlay covering editable content
  document.getElementById('jsJobPicker').style.display = 'none';
  document.getElementById('jsSheetForm').style.display = 'block';
  document.getElementById('jsTopbarRight').style.display = 'flex';
  document.getElementById('jsBackToList').style.display = 'inline-flex';
  document.getElementById('jsJobTitle').textContent = jobId + ' — ' + (j.name||'') + ' (' + (j.brand||'') + ' ' + (j.model||'') + ')';
  document.getElementById('viewTitle').textContent = jobId;
  jsSetSaveIndicator(false);
  jsRenderTimeline(j);
  jsUpdateZohoCard(j);

  // No Apps Script configured — just show fresh defaults
  if (!cfg.appsScriptUrl || !j.driveFolder) {
    jsResetEditableFields(j);
    return;
  }

  // Show loading overlay
  jsShowLoadingOverlay('Loading job sheet…');

  let driveDataLoaded = false;

  // Step 1: Load timestamps.json — pass driveFolder directly, no sheet lookup needed
  try {
    const tsResult = await callScript({ action: 'loadTimestamps', jobId, driveFolder: j.driveFolder });
    if (tsResult.ok && tsResult.data) {
      j.statusTimestamps = Object.assign({}, j.statusTimestamps || {}, tsResult.data);
      jsRenderTimeline(j);
    } else {
      console.log('loadTimestamps:', tsResult);
    }
  } catch(e) { console.warn('loadTimestamps error:', e); }

  // Step 2: Load saved job sheet JSON — pass driveFolder directly
  jsShowLoadingOverlay('Loading saved data…');
  try {
    const sheetResult = await callScript({ action: 'loadJobSheet', jobId, driveFolder: j.driveFolder });
    console.log('loadJobSheet response:', JSON.stringify(sheetResult).substring(0, 200));
    if (sheetResult.ok && sheetResult.data) {
      const saved = sheetResult.data;
      if (saved.statusTimestamps) {
        j.statusTimestamps = Object.assign({}, saved.statusTimestamps, j.statusTimestamps);
        jsRenderTimeline(j);
      }
      jsLoadFromData(saved);
      jsSetSaveIndicator(true, saved.savedAt);
      driveDataLoaded = true;
    } else {
      console.warn('loadJobSheet not found or error:', sheetResult);
    }
  } catch(e) { console.warn('loadJobSheet error:', e); }

  // Hide overlay — show form with loaded (or fresh) data
  jsHideLoadingOverlay();

  if (!driveDataLoaded) {
    jsResetEditableFields(j);
    jsSetSaveIndicator(false);
  }
}


function jsRenderTimeline(j) {
  const tl = document.getElementById('jsTimeline');
  if (!tl) return;
  const timestamps = parseTimestamps(j);
  // Ensure intake timestamp is recorded
  if (j.ts && !timestamps['Intake']) timestamps['Intake'] = j.ts;
  const currentIdx = STATUS_ORDER.indexOf(j.status);

  tl.innerHTML = STATUS_ORDER.map((status, idx) => {
    const ts = timestamps[status];
    const isDone = ts || idx < currentIdx;
    const isCurrent = status === j.status;
    const dotClass = isCurrent ? 'current' : isDone ? 'done' : '';

    // Calculate duration in this status
    let duration = '';
    if (ts) {
      const nextStatus = STATUS_ORDER.find((s, i) => i > idx && timestamps[s]);
      const end = nextStatus ? new Date(timestamps[nextStatus]) : (isCurrent ? new Date() : null);
      if (end) {
        const days = Math.floor((end - new Date(ts)) / 86400000);
        const hrs  = Math.floor(((end - new Date(ts)) % 86400000) / 3600000);
        duration = days > 0 ? `${days}d ${hrs}h` : `${hrs}h`;
      }
    }

    return `<div class="js-tl-row">
      <div class="js-tl-dot-wrap">
        <div class="js-tl-dot ${dotClass}"></div>
        <div class="js-tl-line"></div>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">
          <span class="js-tl-label" style="${isCurrent ? 'color:var(--accent)' : !isDone ? 'color:var(--text-secondary)' : ''}">${status}</span>
          <span class="js-tl-time">${ts ? fmtDateTime(ts) : '—'}</span>
          ${duration ? `<span class="js-tl-duration">${duration}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function jsPopulateIntake(j) {
  // Header IDs
  document.getElementById('jsDispJobId').textContent = j.jobId || '—';
  document.getElementById('jsDispCaseNo').textContent = j.caseNo || '—';
  if (j.driveFolder && !String(j.driveFolder).startsWith('ERROR')) {
    document.getElementById('jsDispDrive').innerHTML =
      `<a class="js-drive-link" href="${j.driveFolder}" target="_blank"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>Open Drive Folder</a>`;
  } else {
    document.getElementById('jsDispDrive').innerHTML = '<span class="js-id-muted">Not linked</span>';
  }
  // Read-only intake fields from Google Sheet
  document.getElementById('jsFName').value = j.name || '';
  document.getElementById('jsFPhone').value = j.phone || '';
  document.getElementById('jsFEmail').value = j.email || '';
  document.getElementById('jsFDeviceType').value = j.deviceType || '';
  document.getElementById('jsFBrand').value = j.brand || '';
  document.getElementById('jsFModel').value = j.model || '';
  document.getElementById('jsFSerial').value = j.serial || '';
  document.getElementById('jsFWarranty').value = j.warranty || '';
  document.getElementById('jsFIssue').value = j.issue || '';
}

// Only called when no saved Drive data exists — sets sensible defaults for a fresh job sheet
function jsResetEditableFields(j) {
  document.getElementById('jsFDate').valueAsDate = new Date();
  document.getElementById('jsFFTech').value = '';
  document.getElementById('jsFETA').value = '';
  document.getElementById('jsFSvcType').value = '';
  document.getElementById('jsFPostage').value = '';
  document.getElementById('jsFDiscount').value = '';
  document.getElementById('jsFCustRemark').value = j.issue || '';
  document.getElementById('jsFInspectionNote').value = '';
  document.getElementById('jsFRepairingNote').value  = '';
  document.getElementById('jsFTestingNote').value    = '';
  document.getElementById('jsFQcNote').value         = '';
  document.getElementById('jsFinalRemark').value = '';
  document.getElementById('jsFOtherGoods').value = '';
  const repLvl = document.getElementById('jsFRepairLevel');
  if (repLvl) repLvl.value = '';
  jsUpdateRepairLevelHint();
  document.querySelectorAll('.js-svc-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.js-status-pill').forEach(p => p.classList.remove('active'));
  if ((j.warranty||'').toLowerCase().includes('in warranty')) {
    const btn = [...document.querySelectorAll('.js-svc-btn')].find(b => b.textContent.includes('In Warranty'));
    if (btn) jsSetSvc(btn, 'In Warranty Repair');
  }
  const sp = [...document.querySelectorAll('.js-status-pill')].find(p => p.textContent.trim() === (j.status||'Intake'));
  if (sp) sp.classList.add('active');
  jsBuildChecklist(j.accessories || '', j.deviceType || '');
  jsUpdateScooterChecklist(j.deviceType || '');
  jsClearScooterChecklist();
  jsOrderNums = [];
  jsRenderOrderNums();
  jsParts = [];
  jsRenderParts();
  jsCalcCost();
}

// Device-specific accessories
const JS_ACCESSORIES = {
  'Robot Vacuum': ['Auto Empty Dock','Charging Cable','Charging Dock','Dust Bin','Main Brush','Mop Cloth Mount','Original Box','Robot Vacuum','Water Tank'],
  'Scooter':      ['Charger','Extended Inflation','Go-Kart Accessories','Original Box','Password Lock','Scooter Body','Stem Hook','Stem Screws','Wrench'],
};

// Resolve a raw deviceType string to a canonical key, tolerating
// case differences and alternate names from the Google Form.
function jsResolveDeviceType(deviceType) {
  if (!deviceType) return null;
  const s = deviceType.toLowerCase().trim();
  if (s.includes('scooter') || s.includes('ninebot') || s.includes('segway') || s.includes('electric')) return 'Scooter';
  if (s.includes('robot') || s.includes('vacuum') || s.includes('roborock') || s.includes('roomba')) return 'Robot Vacuum';
  return null;
}

function jsBuildChecklist(accessoriesStr, deviceType) {
  const canonical = jsResolveDeviceType(deviceType);
  const items = canonical ? JS_ACCESSORIES[canonical] : [];
  const received = (accessoriesStr || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const el = document.getElementById('jsChecklist');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);font-style:italic;">No accessories list for this device type.</span>';
    return;
  }
  el.innerHTML = items.map(item => {
    const checked = received.some(r => r.includes(item.toLowerCase()) || item.toLowerCase().includes(r));
    return `<label class="js-check-item ${checked ? 'checked' : ''}" onclick="jsToggleCheck(this)">
      <input type="checkbox" ${checked ? 'checked' : ''}> ${item}
    </label>`;
  }).join('');
}

// Show/hide scooter inspection checklist
const SCOOTER_CL_IDS = ['jsSclAppearance','jsSclCharge','jsSclPower','jsSclHeadlight','jsSclTurnSignal','jsSclTaillight','jsSclBrake','jsSclThrottle','jsSclTyrePressure','jsSclNoNoise','jsSclStemTurning','jsSclStemShaking','jsSclNoShaking'];

function jsClearScooterChecklist() {
  SCOOTER_CL_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
}

// Shows/hides the scooter checklist card and rebuilds the accessories checklist
function jsUpdateScooterChecklist(deviceType) {
  const card = document.getElementById('jsScooterChecklist');
  if (card) card.style.display = (jsResolveDeviceType(deviceType) === 'Scooter') ? 'block' : 'none';
  if (jsCurrentJob) jsBuildChecklist(jsCurrentJob.accessories || '', deviceType);
}

// Order numbers management
let jsOrderNums = [];

function jsRenderOrderNums() {
  const list = document.getElementById('jsOrderNumsList');
  if (!list) return;
  if (!jsOrderNums.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);padding:4px 0;">No order numbers added</div>';
    return;
  }
  list.innerHTML = jsOrderNums.map((num, i) =>
    `<div class="js-order-row">
      <input type="text" value="${(num||'').replace(/"/g,'&quot;')}" placeholder="Order number (e.g. AUS-12345)" oninput="jsOrderNums[${i}]=this.value">
      <button class="js-order-del" onclick="jsRemoveOrderNum(${i})" title="Remove">×</button>
    </div>`
  ).join('');
}

function jsAddOrderNum() {
  jsOrderNums.push('');
  jsRenderOrderNums();
  // Focus the new input
  setTimeout(() => {
    const inputs = document.querySelectorAll('#jsOrderNumsList input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}

function jsRemoveOrderNum(i) {
  jsOrderNums.splice(i, 1);
  jsRenderOrderNums();
}

// Repair level hint text
// Repair level hints and costs — seeded from hardcoded defaults,
// overwritten by costs.json from Drive when a job is opened.
let REPAIR_LEVEL_HINTS = {
  'Level 1 — $85':  'External works only; adjustments, external parts, machinery',
  'Level 2 — $100': 'Internal repairs; PCB, motors, batteries, front fork',
  'Level 3 — $125': 'Full disassembly; frame & structural parts, 2+ major errors',
};
let REPAIR_LEVEL_COSTS = {
  'Level 1 — $85':  85,
  'Level 2 — $100': 100,
  'Level 3 — $125': 125,
};

// Load costs.json from Drive and merge into local lookups
async function jsLoadCosts() {
  if (!cfg || !cfg.appsScriptUrl || typeof callScript !== 'function') return;
  try {
    const res = await callScript({ action: 'loadCosts' });
    if (res && res.ok && res.data && res.data.repairLevels) {
      Object.entries(res.data.repairLevels).forEach(([label, obj]) => {
        REPAIR_LEVEL_COSTS[label] = typeof obj === 'object' ? obj.cost : obj;
        if (typeof obj === 'object' && obj.description) {
          REPAIR_LEVEL_HINTS[label] = obj.description;
        }
      });
    }
  } catch (e) { /* keep defaults */ }
}

function jsUpdateRepairLevelHint() {
  const sel  = document.getElementById('jsFRepairLevel');
  const hint = document.getElementById('jsRepairLevelHint');
  if (!sel) return;
  if (hint) hint.textContent = REPAIR_LEVEL_HINTS[sel.value] || '';
  // Auto-fill the service total from the cost lookup when no manual total is set
  const cost = REPAIR_LEVEL_COSTS[sel.value];
  if (cost != null) {
    const currentTotal = parseFloat(document.getElementById('jsCTotal')?.textContent?.replace('$','')) || 0;
    // Only auto-fill if total is still 0 (user hasn't manually entered parts/costs)
    if (currentTotal === 0) {
      const discountEl = document.getElementById('jsFDiscount');
      const postageEl  = document.getElementById('jsFPostage');
      // Set subtotal via discount=0, postage=0, and inject a zero-price labour line
      // The simplest approach: just store it for jsCollectData to pick up
      if (!window._jsRepairLevelCostOverride) {
        window._jsRepairLevelCostOverride = cost;
      }
    }
  }
}



function jsToggleCheck(el) { setTimeout(() => el.classList.toggle('checked', el.querySelector('input').checked), 0); }

function jsSetSvc(el, val) {
  document.querySelectorAll('.js-svc-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('jsFSvcType').value = val;
}

async function jsSetStatus(el) {
  document.querySelectorAll('.js-status-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  const newStatus = el.textContent.trim();
  if (!jsCurrentJob) return;

  const oldStatus = jsCurrentJob.status;
  if (newStatus === oldStatus) return;

  if (!jsCurrentJob.statusTimestamps) jsCurrentJob.statusTimestamps = parseTimestamps(jsCurrentJob);
  // Only record the first time a status is entered — never overwrite
  if (!jsCurrentJob.statusTimestamps[newStatus]) {
    jsCurrentJob.statusTimestamps[newStatus] = new Date().toISOString();
  }
  jsCurrentJob.status = newStatus;
  jsRenderTimeline(jsCurrentJob);

  // Update the jobs array so kanban re-renders with the new status
  const jobInList = jobs.find(j => j.jobId === jsCurrentJob.jobId);
  if (jobInList) {
    jobInList.status = newStatus;
    jobInList.statusTimestamps = jsCurrentJob.statusTimestamps;
    renderAll(); // refresh kanban cards and list
  }

  if (cfg.appsScriptUrl) {
    const statusResult = await callScript({ action: 'updateStatus', jobId: jsCurrentJob.jobId, status: newStatus });
    if (!statusResult.ok) {
      jsCurrentJob.status = oldStatus;
      if (jobInList) { jobInList.status = oldStatus; jobInList.statusTimestamps = jsCurrentJob.statusTimestamps; }
      document.querySelectorAll('.js-status-pill').forEach(p => p.classList.remove('active'));
      const revertPill = [...document.querySelectorAll('.js-status-pill')].find(p => p.textContent.trim() === oldStatus);
      if (revertPill) revertPill.classList.add('active');
      jsRenderTimeline(jsCurrentJob);
      renderAll();
      if (typeof showToast === 'function') showToast('error', 'Status update failed — sheet not updated');
      return;
    }
    if (jsCurrentJob.driveFolder) {
      callScript({
        action: 'saveTimestamps',
        jobId: jsCurrentJob.jobId,
        driveFolder: jsCurrentJob.driveFolder,
        timestamps: JSON.stringify(jsCurrentJob.statusTimestamps)
      });
    }
  }
}

function jsAddPart() {
  jsParts.push({ partno:'', loc:'', name:'', qty:1, price:'' });
  jsRenderParts();
}

function jsRemovePart(i) {
  jsParts.splice(i, 1);
  jsRenderParts();
  jsCalcCost();
}

function jsRenderParts() {
  const body = document.getElementById('jsPartsBody');
  if (!jsParts.length) {
    body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:14px;color:var(--text-secondary);font-size:12px;">No parts added</td></tr>`;
    return;
  }
  body.innerHTML = jsParts.map((p, i) => {
    const line = ((parseFloat(p.qty)||0)*(parseFloat(p.price)||0)).toFixed(2);
    return `<tr>
      <td style="width:30px;text-align:center;color:var(--text-secondary);font-size:12px;">${i+1}</td>
      <td><input type="text" value="${(p.partno||'').replace(/"/g,'&quot;')}" oninput="jsParts[${i}].partno=this.value" placeholder="Part #" style="width:120px"></td>
      <td><input type="text" value="${(p.loc||'').replace(/"/g,'&quot;')}" oninput="jsParts[${i}].loc=this.value" placeholder="Location" style="width:100px"></td>
      <td><input type="text" value="${(p.name||'').replace(/"/g,'&quot;')}" oninput="jsParts[${i}].name=this.value" placeholder="Part name" style="width:100%"></td>
      <td><input type="text" inputmode="decimal" value="${p.qty}" oninput="jsParts[${i}].qty=this.value;jsCalcCost()" style="width:55px;text-align:center;"></td>
      <td><input type="text" inputmode="decimal" value="${p.price}" oninput="jsParts[${i}].price=this.value;jsCalcCost()" placeholder="0.00" style="width:88px;text-align:right;"></td>
      <td class="js-line-total" style="text-align:right;font-weight:500;padding-right:10px;">$${line}</td>
      <td><button class="js-parts-del" onclick="jsRemovePart(${i})">×</button></td>
    </tr>`;
  }).join('');
}

function jsCalcCost() {
  const partsSum = jsParts.reduce((s,p) => s + (parseFloat(p.qty)||0)*(parseFloat(p.price)||0), 0);
  const postage  = parseFloat(document.getElementById('jsFPostage').value) || 0;
  const discount = parseFloat(document.getElementById('jsFDiscount').value) || 0;
  const sub = partsSum + postage;
  const total = Math.max(0, sub - discount);
  document.getElementById('jsCPartsTotal').textContent = '$' + partsSum.toFixed(2);
  document.getElementById('jsCSubtotal').textContent   = '$' + sub.toFixed(2);
  document.getElementById('jsCTotal').textContent      = '$' + total.toFixed(2);
  // Update only the line-total cells (don't rebuild inputs — that loses focus & blocks decimals)
  jsUpdateLineTotals();
}

function jsUpdateLineTotals() {
  const rows = document.querySelectorAll('#jsPartsBody tr');
  rows.forEach((tr, i) => {
    const p = jsParts[i];
    if (!p) return;
    const cell = tr.querySelector('.js-line-total');
    if (cell) {
      const line = ((parseFloat(p.qty)||0)*(parseFloat(p.price)||0)).toFixed(2);
      cell.textContent = '$' + line;
    }
  });
}

function jsCollectData() {
  const checklist = [...document.querySelectorAll('.js-check-item input:checked')].map(cb => cb.parentElement.textContent.trim());
  const status = document.querySelector('.js-status-pill.active')?.textContent.trim() || 'Intake';

  // Collect scooter checklist
  const scooterChecklist = {};
  SCOOTER_CL_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) scooterChecklist[id] = el.checked;
  });

  const j = jsCurrentJob || {};
  return {
    jobId: j.jobId||'', caseNo: j.caseNo||'', name: j.name||'',
    phone: j.phone||'', email: j.email||'', deviceType: j.deviceType||'',
    brand: j.brand||'', model: j.model||'', serial: j.serial||'',
    warranty: j.warranty||'', issue: j.issue||'', driveFolder: j.driveFolder||'',
    date: document.getElementById('jsFDate').value,
    tech: document.getElementById('jsFFTech').value,
    eta: document.getElementById('jsFETA').value,
    svcType: document.getElementById('jsFSvcType').value,
    repairLevel: document.getElementById('jsFRepairLevel')?.value || '',
    checklist,
    otherGoods: document.getElementById('jsFOtherGoods').value,
    scooterChecklist,
    orderNums: [...jsOrderNums],
    parts: jsParts.map(p => ({...p, qty:parseFloat(p.qty)||0, price:parseFloat(p.price)||0})),
    postage: parseFloat(document.getElementById('jsFPostage').value)||0,
    discount: parseFloat(document.getElementById('jsFDiscount').value)||0,
    partsTotal: parseFloat(document.getElementById('jsCPartsTotal').textContent.replace('$',''))||0,
    subtotal:   parseFloat(document.getElementById('jsCSubtotal').textContent.replace('$',''))||0,
    total:      (() => {
      const t = parseFloat(document.getElementById('jsCTotal').textContent.replace('$','')) || 0;
      if (t > 0) return t;
      // Fall back to repair level cost from costs.json when no parts/costs entered
      const lvl = document.getElementById('jsFRepairLevel')?.value || '';
      return REPAIR_LEVEL_COSTS[lvl] || 0;
    })(),
    custRemark:   document.getElementById('jsFCustRemark').value,
    inspectionNote: document.getElementById('jsFInspectionNote').value,
    repairingNote:  document.getElementById('jsFRepairingNote').value,
    testingNote:    document.getElementById('jsFTestingNote').value,
    qcNote:         document.getElementById('jsFQcNote').value,
    finalRemark:  document.getElementById('jsFinalRemark').value,
    status,
    statusTimestamps: jsCurrentJob ? parseTimestamps(jsCurrentJob) : {},
    savedAt: new Date().toISOString(),
  };
}

function jsLoadFromData(data) {
  // Always set all editable fields — use '' fallback so even empty values restore correctly
  document.getElementById('jsFFTech').value = data.tech || '';
  document.getElementById('jsFDate').value  = data.date || '';
  document.getElementById('jsFETA').value   = data.eta  || '';
  document.getElementById('jsFOtherGoods').value = data.otherGoods || '';
  document.getElementById('jsFPostage').value  = data.postage  != null ? data.postage  : '';
  document.getElementById('jsFDiscount').value = data.discount != null ? data.discount : '';
  document.getElementById('jsFCustRemark').value   = data.custRemark   || '';
  document.getElementById('jsFInspectionNote').value = data.inspectionNote || '';
  document.getElementById('jsFRepairingNote').value  = data.repairingNote  || '';
  document.getElementById('jsFTestingNote').value    = data.testingNote    || '';
  document.getElementById('jsFQcNote').value         = data.qcNote         || '';
  document.getElementById('jsFinalRemark').value   = data.finalRemark  || '';

  // Repair level
  const repLvl = document.getElementById('jsFRepairLevel');
  if (repLvl) { repLvl.value = data.repairLevel || ''; jsUpdateRepairLevelHint(); }

  // Service type
  document.querySelectorAll('.js-svc-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('jsFSvcType').value = data.svcType || '';
  if (data.svcType) {
    const btn = [...document.querySelectorAll('.js-svc-btn')].find(b => b.textContent.trim() === data.svcType);
    if (btn) btn.classList.add('active');
  }

  // Checklist — always build full item list first, then apply saved ticked state on top.
  // Falls back to saved checklist items as the accessories string if the sheet cell is blank.
  if (jsCurrentJob) {
    const accessoriesStr = jsCurrentJob.accessories ||
      (Array.isArray(data.checklist) ? data.checklist.join(', ') : '');
    jsBuildChecklist(accessoriesStr, jsCurrentJob.deviceType || '');
  }
  if (data.checklist && Array.isArray(data.checklist) && data.checklist.length) {
    document.querySelectorAll('.js-check-item').forEach(el => {
      const cb = el.querySelector('input');
      const lbl = el.textContent.trim();
      const checked = data.checklist.includes(lbl);
      cb.checked = checked;
      el.classList.toggle('checked', checked);
    });
  }

  // Scooter checklist — always clear first, then restore saved state
  jsUpdateScooterChecklist(jsCurrentJob?.deviceType || '');
  jsClearScooterChecklist();
  if (data.scooterChecklist && typeof data.scooterChecklist === 'object') {
    Object.entries(data.scooterChecklist).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.checked = val;
    });
  }

  // Order numbers
  jsOrderNums = Array.isArray(data.orderNums) ? [...data.orderNums] : [];
  jsRenderOrderNums();

  // Parts
  jsParts = Array.isArray(data.parts) ? data.parts : [];

  // Status pill — Drive JSON is now always in sync with kanban (patchJobStatus
  // updates it on every kanban move), so use it as the direct source of truth.
  document.querySelectorAll('.js-status-pill').forEach(p => p.classList.remove('active'));
  if (data.status) {
    if (jsCurrentJob) jsCurrentJob.status = data.status;
    const jobInList = (typeof jobs !== 'undefined') && jobs.find(j => j.jobId === jsCurrentJob?.jobId);
    if (jobInList) jobInList.status = data.status;
    const pill = [...document.querySelectorAll('.js-status-pill')].find(p => p.textContent.trim() === data.status);
    if (pill) pill.classList.add('active');
  }

  // Timestamps — Drive timestamps.json already merged into jsCurrentJob before this runs
  // Only apply saved timestamps for statuses not already in Drive data
  if (data.statusTimestamps && jsCurrentJob) {
    jsCurrentJob.statusTimestamps = Object.assign({}, data.statusTimestamps, jsCurrentJob.statusTimestamps);
    jsRenderTimeline(jsCurrentJob);
  }

  jsRenderParts();
  jsCalcCost();
}

// ── Save overlay ─────────────────────────────────────────────
function jsSaveOverlayShow(msg) {
  // Inject overlay into the jobsheet panel if not already there
  const panel = document.getElementById('jobsheetPanel') || document.querySelector('.js-panel');
  if (!panel) return;
  if (!panel.style.position || panel.style.position === 'static') {
    panel.style.position = 'relative';
  }
  let overlay = document.getElementById('jsSaveOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'jsSaveOverlay';
    overlay.className = 'js-save-overlay';
    overlay.innerHTML = `
      <div class="js-save-overlay-spinner"></div>
      <div class="js-save-overlay-msg" id="jsSaveOverlayMsg">${msg || 'Saving…'}</div>`;
    panel.appendChild(overlay);
  } else {
    const msgEl = document.getElementById('jsSaveOverlayMsg');
    if (msgEl) msgEl.textContent = msg || 'Saving…';
  }
  overlay.classList.add('show');
}

function jsSaveOverlayHide() {
  const overlay = document.getElementById('jsSaveOverlay');
  if (overlay) overlay.classList.remove('show');
}

async function jsSaveSheet() {
  const data = jsCollectData();
  const btn = document.getElementById('jsSaveBtn');
  btn.disabled = true;
  btn.innerHTML = `
    <svg style="animation:lo-spin .7s linear infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
    Saving…`;

  // Show save overlay with cycling messages so it's clear something is happening
  jsSaveOverlayShow('Saving to Drive…');
  const _saveMessages = ['Saving to Drive…', 'Writing job sheet…', 'Syncing to sheet…'];
  let _saveMsgIdx = 0;
  const _saveMsgTimer = setInterval(() => {
    _saveMsgIdx = (_saveMsgIdx + 1) % _saveMessages.length;
    const el = document.getElementById('jsSaveOverlayMsg');
    if (el) el.textContent = _saveMessages[_saveMsgIdx];
  }, 2000);

  if (!cfg.appsScriptUrl) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `job-${data.jobId||'sheet'}.json`; a.click();
    showToast('success', 'Downloaded locally');
    jsSetSaveIndicator(true);
  } else {
    const result = await callScript({ action: 'saveJobSheet', data: JSON.stringify(data) });
    if (result.ok) {
      jsSetSaveIndicator(true);
      jsSaveOverlayHide();

      // Build the checklist string from ticked items for the Accessories column
      const tickedItems = [...document.querySelectorAll('.js-check-item input:checked')]
        .map(cb => cb.parentElement.textContent.trim()).filter(Boolean);
      const accessoriesStr = tickedItems.join(', ');

      // Build parts summary string
      const partsStr = (data.parts || []).map(p =>
        [p.partno, p.name, p.qty > 1 ? `x${p.qty}` : ''].filter(Boolean).join(' ')
      ).join('; ');

      // Sync key fields back to the Google Sheet row so the sheet stays up-to-date
      const syncResult = await callScript({
        action: 'syncJobFields',
        jobId: data.jobId,
        fields: {
          status:       data.status || '',
          accessories:  accessoriesStr,
          repairLevel:  data.repairLevel || '',
          parts:        partsStr,
          total:        data.total != null ? String(data.total) : '',
          tech:         data.tech || '',
          svcType:      data.svcType || '',
        }
      });

      // Update local state so kanban reflects new status without a full reload
      if (jsCurrentJob) {
        jsCurrentJob.status = data.status;
        const jobInList = (typeof jobs !== 'undefined') && jobs.find(j => j.jobId === data.jobId);
        if (jobInList) {
          jobInList.status       = data.status;
          jobInList.accessories  = accessoriesStr;
          jobInList.repairLevel  = data.repairLevel;
        }
        renderAll();
      }

      if (!syncResult.ok) {
        // Non-fatal — Drive save succeeded, sheet sync failed
        showToast('success', 'Saved to Drive (sheet sync failed — ' + syncResult.error + ')');
      } else {
        showToast('success', 'Job sheet saved');
      }
    } else {
      jsSaveOverlayHide();
      showToast('error', 'Save failed: ' + result.error);
    }
  }

  clearInterval(_saveMsgTimer);
  jsSaveOverlayHide();
  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save to Drive';
}

function jsExportCSV() {
  const d = jsCollectData();
  const partsStr = d.parts.map(p => `${p.partno}:${p.name}(${p.qty}x$${p.price})`).join('; ');
  const headers = ['Job ID','Case Number','Customer','Phone','Email','Device','Brand','Model','Serial','Warranty','Service Type','Technician','Date','ETA','Status','Parts','Parts Total','Postage','Discount','Total','Inspection Notes','Repairing Notes','Testing Notes','QC Notes','Final Remark'];
  const row = [d.jobId,d.caseNo,d.name,d.phone,d.email,d.deviceType,d.brand,d.model,d.serial,d.warranty,d.svcType,d.tech,d.date,d.eta,d.status,partsStr,d.partsTotal,d.postage,d.discount,d.total,d.inspectionNote,d.repairingNote,d.testingNote,d.qcNote,d.finalRemark];
  const csv = [headers,row].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `job-${d.jobId||'export'}.csv`; a.click();
  showToast('success', 'CSV exported');
}

function jsSetSaveIndicator(saved, at) {
  const el = document.getElementById('jsSaveInd');
  if (!el) return;
  if (saved) {
    el.className = 'js-save-ind saved';
    const t = at ? new Date(at).toLocaleString('en-AU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Saved${t ? ' '+t : ''}`;
  } else {
    el.className = 'js-save-ind';
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Not saved`;
  }
}

// ============================================================
// ZOHO BOOKS ACTIONS
// ============================================================

// Show Zoho card only for out-of-warranty jobs
function jsUpdateZohoCard(j) {
  const card = document.getElementById('jsZohoCard');
  if (!card) return;
  card.style.display = (j && j.warranty === 'Out of Warranty') ? 'block' : 'none';
  // Reset status line when opening a new job
  const status = document.getElementById('jsZohoStatus');
  if (status) { status.style.display = 'none'; status.textContent = ''; }
}

function jsSetZohoStatus(msg, type) {
  const el = document.getElementById('jsZohoStatus');
  if (!el) return;
  el.style.display = 'block';
  el.style.color = type === 'error' ? '#dc2626' : type === 'success' ? '#059669' : 'var(--text-secondary)';
  el.textContent = msg;
}

async function jsCreateZohoInvoice() {
  const j = jsCurrentJob;
  if (!j) return;
  const btn = document.getElementById('jsZohoBtnInvoice');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  jsSetZohoStatus('Creating inspection invoice in Zoho Books…', 'info');

  try {
    const res = await fetch('/.netlify/functions/zoho-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'invoice',
        jobId: j.jobId, name: j.name, email: j.email,
        phone: j.phone, brand: j.brand, model: j.model,
        serial: j.serial, issue: j.issue,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      btn.classList.add('done');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> ${data.invoiceNumber}`;
      jsSetZohoStatus(`✓ Draft invoice ${data.invoiceNumber} created${data.isNewContact ? ' · new customer added' : ''}`, 'success');
      showToast('success', `Zoho invoice ${data.invoiceNumber} created`);
    } else {
      btn.disabled = false;
      btn.textContent = 'Create Inspection Invoice';
      jsSetZohoStatus('Error: ' + (data.error || 'Unknown error'), 'error');
      showToast('error', 'Zoho invoice failed');
    }
  } catch(err) {
    btn.disabled = false;
    btn.textContent = 'Create Inspection Invoice';
    jsSetZohoStatus('Error: ' + err.message, 'error');
    showToast('error', 'Zoho error: ' + err.message);
  }
}

async function jsCreateZohoQuote() {
  const j = jsCurrentJob;
  if (!j) return;

  // Collect current parts from the sheet
  const data = jsCollectData();
  if (!data.parts || data.parts.length === 0) {
    jsSetZohoStatus('No parts found — add parts to the job sheet before creating a quote.', 'error');
    showToast('error', 'Add parts to the job sheet first');
    return;
  }

  const btn = document.getElementById('jsZohoBtnQuote');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  jsSetZohoStatus('Creating quote in Zoho Books…', 'info');

  try {
    const res = await fetch('/.netlify/functions/zoho-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'quote',
        jobId: j.jobId, name: j.name, email: j.email,
        phone: j.phone, brand: j.brand, model: j.model,
        serial: j.serial, issue: j.issue,
        parts: data.parts,
        postage: data.postage,
        discount: data.discount,
      }),
    });
    const data2 = await res.json();
    if (data2.ok) {
      btn.classList.add('done');
      btn.style.background = 'rgba(5,150,105,0.1)';
      btn.style.color = '#065f46';
      btn.style.borderColor = 'rgba(5,150,105,0.3)';
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> ${data2.estimateNumber}`;
      jsSetZohoStatus(`✓ Draft quote ${data2.estimateNumber} created`, 'success');
      showToast('success', `Zoho quote ${data2.estimateNumber} created`);
    } else {
      btn.disabled = false;
      btn.textContent = 'Create Quote';
      jsSetZohoStatus('Error: ' + (data2.error || 'Unknown error'), 'error');
      showToast('error', 'Zoho quote failed');
    }
  } catch(err) {
    btn.disabled = false;
    btn.textContent = 'Create Quote';
    jsSetZohoStatus('Error: ' + err.message, 'error');
    showToast('error', 'Zoho error: ' + err.message);
  }
}