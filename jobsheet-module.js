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
.js-drive-link { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--accent); text-decoration: none; font-weight: 500; }
.js-drive-link:hover { text-decoration: underline; }
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

@media print {
  .sidebar, .js-topbar, .js-parts-del, .js-add-part-btn { display: none !important; }
  .main-content { height: auto; overflow: visible; }
  #view-jobsheet { overflow: visible; }
  .js-card { box-shadow: none; page-break-inside: avoid; }
}
  `;
  document.head.appendChild(style);
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

function jsOpenJobFromDetail(jobId) {
  switchView('jobsheet');
  jsOpenJob(jobId);
}

async function jsOpenJob(jobId) {
  const j = jobs.find(x => x.jobId === jobId);
  if (!j) return;
  jsCurrentJob = j;
  jsParts = [];
  jsPopulateIntake(j);
  jsRenderTimeline(j);
  document.getElementById('jsJobPicker').style.display = 'none';
  document.getElementById('jsSheetForm').style.display = 'block';
  document.getElementById('jsTopbarRight').style.display = 'flex';
  document.getElementById('jsJobTitle').textContent = jobId + ' — ' + (j.name||'') + ' (' + (j.brand||'') + ' ' + (j.model||'') + ')';
  document.getElementById('viewTitle').textContent = jobId;
  jsSetSaveIndicator(false);

  // Try to load saved sheet from Drive
  if (cfg.appsScriptUrl && j.driveFolder) {
    try {
      const result = await callScript({ action: 'loadJobSheet', jobId });
      if (result.ok && result.data) {
        jsLoadFromData(result.data);
        jsSetSaveIndicator(true, result.data.savedAt);
        showToast('success', 'Job sheet loaded from Drive');
      }
    } catch(e) {}
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
  document.getElementById('jsDispJobId').textContent = j.jobId || '—';
  document.getElementById('jsDispCaseNo').textContent = j.caseNo || '—';
  if (j.driveFolder && !String(j.driveFolder).startsWith('ERROR')) {
    document.getElementById('jsDispDrive').innerHTML =
      `<a class="js-drive-link" href="${j.driveFolder}" target="_blank"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>Open Drive Folder</a>`;
  } else {
    document.getElementById('jsDispDrive').innerHTML = '<span class="js-id-muted">Not linked</span>';
  }
  document.getElementById('jsFName').value = j.name || '';
  document.getElementById('jsFPhone').value = j.phone || '';
  document.getElementById('jsFEmail').value = j.email || '';
  document.getElementById('jsFDeviceType').value = j.deviceType || '';
  document.getElementById('jsFBrand').value = j.brand || '';
  document.getElementById('jsFModel').value = j.model || '';
  document.getElementById('jsFSerial').value = j.serial || '';
  document.getElementById('jsFWarranty').value = j.warranty || '';
  document.getElementById('jsFIssue').value = j.issue || '';
  document.getElementById('jsFDate').valueAsDate = new Date();
  document.getElementById('jsFFTech').value = '';
  document.getElementById('jsFETA').value = '';
  document.getElementById('jsFSvcType').value = '';
  document.getElementById('jsFPostage').value = '';
  document.getElementById('jsFDiscount').value = '';
  document.getElementById('jsFCustRemark').value = j.issue || '';
  document.getElementById('jsFRepairRemark').value = '';
  document.getElementById('jsFinalRemark').value = '';
  document.querySelectorAll('.js-svc-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.js-status-pill').forEach(p => p.classList.remove('active'));
  // Auto-set warranty type
  if ((j.warranty||'').toLowerCase().includes('in warranty')) {
    const btn = [...document.querySelectorAll('.js-svc-btn')].find(b => b.textContent.includes('In Warranty'));
    if (btn) jsSetSvc(btn, 'In Warranty Repair');
  }
  // Status from sheet
  const sp = [...document.querySelectorAll('.js-status-pill')].find(p => p.textContent.trim() === (j.status||'Intake'));
  if (sp) sp.classList.add('active');
  jsBuildChecklist(j.accessories || '');
  jsParts = [];
  jsRenderParts();
  jsCalcCost();
}

function jsBuildChecklist(accessoriesStr) {
  const items = ['Charger','Original Box','Scooter Body','Stem Hook','Stem Screws','Wrench','Password Lock','Dock','Mop','Water Tank','Manual','Adapter'];
  const received = accessoriesStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  document.getElementById('jsChecklist').innerHTML = items.map(item => {
    const checked = received.some(r => r.includes(item.toLowerCase()) || item.toLowerCase().includes(r));
    return `<label class="js-check-item ${checked ? 'checked' : ''}" onclick="jsToggleCheck(this)">
      <input type="checkbox" ${checked ? 'checked' : ''}> ${item}
    </label>`;
  }).join('');
}

function jsToggleCheck(el) { setTimeout(() => el.classList.toggle('checked', el.querySelector('input').checked), 0); }

function jsSetSvc(el, val) {
  document.querySelectorAll('.js-svc-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('jsFSvcType').value = val;
}

function jsSetStatus(el) {
  document.querySelectorAll('.js-status-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  const newStatus = el.textContent.trim();
  if (jsCurrentJob) {
    if (!jsCurrentJob.statusTimestamps) jsCurrentJob.statusTimestamps = parseTimestamps(jsCurrentJob);
    if (!jsCurrentJob.statusTimestamps[newStatus]) {
      jsCurrentJob.statusTimestamps[newStatus] = new Date().toISOString();
    }
    jsCurrentJob.status = newStatus;
    jsRenderTimeline(jsCurrentJob);
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
      <td><input type="number" value="${p.qty}" min="1" oninput="jsParts[${i}].qty=this.value;jsCalcCost()" style="width:55px"></td>
      <td><input type="number" value="${p.price}" min="0" step="0.01" oninput="jsParts[${i}].price=this.value;jsCalcCost()" placeholder="0.00" style="width:88px"></td>
      <td style="text-align:right;font-weight:500;padding-right:10px;">$${line}</td>
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
  jsRenderParts();
}

function jsCollectData() {
  const checklist = [...document.querySelectorAll('.js-check-item input:checked')].map(cb => cb.parentElement.textContent.trim());
  const status = document.querySelector('.js-status-pill.active')?.textContent.trim() || 'Intake';
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
    checklist,
    otherGoods: document.getElementById('jsFOtherGoods').value,
    parts: jsParts.map(p => ({...p, qty:parseFloat(p.qty)||0, price:parseFloat(p.price)||0})),
    postage: parseFloat(document.getElementById('jsFPostage').value)||0,
    discount: parseFloat(document.getElementById('jsFDiscount').value)||0,
    partsTotal: parseFloat(document.getElementById('jsCPartsTotal').textContent.replace('$',''))||0,
    subtotal:   parseFloat(document.getElementById('jsCSubtotal').textContent.replace('$',''))||0,
    total:      parseFloat(document.getElementById('jsCTotal').textContent.replace('$',''))||0,
    custRemark:   document.getElementById('jsFCustRemark').value,
    repairRemark: document.getElementById('jsFRepairRemark').value,
    finalRemark:  document.getElementById('jsFinalRemark').value,
    status,
    statusTimestamps: jsCurrentJob ? parseTimestamps(jsCurrentJob) : {},
    savedAt: new Date().toISOString(),
  };
}

function jsLoadFromData(data) {
  if (data.tech)         document.getElementById('jsFFTech').value = data.tech;
  if (data.date)         document.getElementById('jsFDate').value  = data.date;
  if (data.eta)          document.getElementById('jsFETA').value   = data.eta;
  if (data.otherGoods)   document.getElementById('jsFOtherGoods').value = data.otherGoods;
  if (data.svcType) {
    document.getElementById('jsFSvcType').value = data.svcType;
    const btn = [...document.querySelectorAll('.js-svc-btn')].find(b => b.textContent.trim() === data.svcType);
    if (btn) btn.classList.add('active');
  }
  if (data.checklist && Array.isArray(data.checklist)) {
    document.querySelectorAll('.js-check-item').forEach(el => {
      const cb = el.querySelector('input');
      const lbl = el.textContent.trim();
      const v = data.checklist.includes(lbl);
      cb.checked = v; el.classList.toggle('checked', v);
    });
  }
  jsParts = data.parts || [];
  if (data.postage)  document.getElementById('jsFPostage').value  = data.postage;
  if (data.discount) document.getElementById('jsFDiscount').value = data.discount;
  if (data.custRemark)   document.getElementById('jsFCustRemark').value   = data.custRemark;
  if (data.repairRemark) document.getElementById('jsFRepairRemark').value = data.repairRemark;
  if (data.finalRemark)  document.getElementById('jsFinalRemark').value   = data.finalRemark;
  if (data.status) {
    document.querySelectorAll('.js-status-pill').forEach(p => {
      p.classList.toggle('active', p.textContent.trim() === data.status);
    });
  }
  if (data.statusTimestamps && jsCurrentJob) {
    jsCurrentJob.statusTimestamps = data.statusTimestamps;
    jsRenderTimeline(jsCurrentJob);
  }
  jsRenderParts(); jsCalcCost();
}

async function jsSaveSheet() {
  const data = jsCollectData();
  const btn = document.getElementById('jsSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

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
      showToast('success', 'Job sheet saved to Drive');
      // sync status back to sheet
      if (jsCurrentJob && data.status !== jsCurrentJob.status) {
        await callScript({ action: 'updateStatus', jobId: data.jobId, status: data.status });
        jsCurrentJob.status = data.status;
        renderAll();
      }
    } else {
      showToast('error', 'Save failed: ' + result.error);
    }
  }

  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save to Drive';
}

function jsExportCSV() {
  const d = jsCollectData();
  const partsStr = d.parts.map(p => `${p.partno}:${p.name}(${p.qty}x$${p.price})`).join('; ');
  const headers = ['Job ID','Case Number','Customer','Phone','Email','Device','Brand','Model','Serial','Warranty','Service Type','Technician','Date','ETA','Status','Parts','Parts Total','Postage','Discount','Total','Repair Remark','Final Remark'];
  const row = [d.jobId,d.caseNo,d.name,d.phone,d.email,d.deviceType,d.brand,d.model,d.serial,d.warranty,d.svcType,d.tech,d.date,d.eta,d.status,partsStr,d.partsTotal,d.postage,d.discount,d.total,d.repairRemark,d.finalRemark];
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
    const t = at ? new Date(at).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}) : '';
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Saved${t ? ' '+t : ''}`;
  } else {
    el.className = 'js-save-ind';
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Not saved`;
  }
}