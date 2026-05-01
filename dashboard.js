// Logic One SA — Dashboard JS
// Kanban, data fetching, card rendering, modals, status moves

const COLS = [
  { id: 'Intake', label: 'Intake', color: 'var(--col-intake)' },
  { id: 'Diagnosis', label: 'Diagnosis', color: 'var(--col-diagnosis)' },
  { id: 'Awaiting Parts', label: 'Awaiting Parts', color: 'var(--col-awaiting)' },
  { id: 'In Repair', label: 'In Repair', color: 'var(--col-repair)' },
  { id: 'Testing', label: 'Testing', color: 'var(--col-testing)' },
  { id: 'Complete', label: 'Complete', color: 'var(--col-complete)' },
  { id: 'Collected', label: 'Collected', color: 'var(--col-collected)' },
];

const SC = {
  'Intake': { bg:'rgba(99,102,241,0.1)', c:'#6366f1' },
  'Diagnosis': { bg:'rgba(245,158,11,0.1)', c:'#d97706' },
  'Awaiting Parts': { bg:'rgba(239,68,68,0.1)', c:'#dc2626' },
  'In Repair': { bg:'rgba(59,130,246,0.1)', c:'#2563eb' },
  'Testing': { bg:'rgba(139,92,246,0.1)', c:'#7c3aed' },
  'Complete': { bg:'rgba(16,185,129,0.1)', c:'#059669' },
  'Collected': { bg:'rgba(100,116,139,0.1)', c:'#475569' },
};

// Map sheet headers → internal keys
const HMAP = {
  'timestamp':'ts','email address':'email','email':'email',
  'full name':'name','phone number':'phone','phone':'phone',
  'address':'address','case number':'caseNo',
  'device type':'deviceType','brand':'brand','model':'model',
  'serial number':'serial','serial':'serial',
  'accessories':'accessories',
  'describe the issue':'issue','issue':'issue',
  'when did it start?':'whenStarted','when did it start':'whenStarted',
  'repaired before?':'repairedBefore','repaired before':'repairedBefore',
  'known issues':'knownIssues',
  'warranty status':'warranty',
  'job id':'jobId','status':'status','drive folder':'driveFolder',
  'status timestamps':'statusTimestamps',
};

let jobs = [], searchTerm = '';

const FILE_CFG = window.LO_CONFIG || {};

const cfg = {
  sheetId:       FILE_CFG.sheetId       || '',
  sheetTab:      FILE_CFG.sheetTab      || 'Form Responses 1',
  apiKey:        FILE_CFG.apiKey        || '',
  appsScriptUrl: FILE_CFG.appsScriptUrl || '',
};

const DEMO = [];


// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  buildBoard();
  loadData();

  // Restore sidebar collapsed state
  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    document.getElementById('sidebar').classList.add('collapsed');
  }

  // Clear field error highlight as soon as user starts correcting
  ['nBrand','nModel','nIssue','nName','nPhone','nEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => el.classList.remove('field-err'));
    if (el) el.addEventListener('change', () => el.classList.remove('field-err'));
  });

  // Kanban scroll button visibility
  const kw = document.getElementById('kanbanWrapper');
  if (kw) {
    kw.addEventListener('scroll', kUpdateScrollBtns);
    // Initial state — left arrow hidden at start
    kUpdateScrollBtns();
  }
});

// ============================================================
// DATA
// ============================================================
async function loadData() {
  if (cfg.sheetId && cfg.apiKey) { await fetchSheet(); }
  else { jobs = [...DEMO]; renderAll(); }
}

async function fetchSheet() {
  showLoading(true);
  try {
    const tab = encodeURIComponent(cfg.sheetTab || 'Sheet1');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheetId}/values/${tab}?key=${cfg.apiKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`API ${r.status}`);
    const d = await r.json();
    const rows = d.values;
    if (!rows || rows.length < 2) { jobs = []; renderAll(); showLoading(false); return; }

    const headers = rows[0];
    const cMap = {};
    headers.forEach((h, i) => {
      const k = h.trim().toLowerCase().replace(/\s+/g, ' ');
      if (HMAP[k]) cMap[i] = HMAP[k];
    });

    jobs = rows.slice(1).map(row => {
      const o = {};
      Object.entries(cMap).forEach(([i, key]) => { o[key] = row[parseInt(i)] || ''; });
      if (!o.status) o.status = 'Intake';
      // Parse statusTimestamps JSON string from sheet column
      if (o.statusTimestamps) {
        try { o.statusTimestamps = JSON.parse(o.statusTimestamps); } catch(e) { o.statusTimestamps = {}; }
      } else {
        o.statusTimestamps = {};
      }
      // Seed Intake timestamp from submission timestamp if missing
      if (!o.statusTimestamps['Intake'] && o.ts) {
        // o.ts from Sheets is a serial number (days since 1899-12-30)
        // Convert to JS date: (serialDays - 25569) * 86400 * 1000
        try {
          const serial = parseFloat(o.ts);
          if (!isNaN(serial) && serial > 40000) {
            const ms = (serial - 25569) * 86400 * 1000;
            o.statusTimestamps['Intake'] = new Date(ms).toISOString();
          }
        } catch(e) {}
      }
      return o;
    }).filter(j => j.jobId || j.name);

    renderAll();
  } catch (err) {
    // Don't overwrite real job data with demo data on a transient fetch failure.
    // Only fall back to demo if we have no jobs at all (first load).
    if (!jobs || !jobs.length) {
      jobs = [...DEMO];
      showToast('error', 'Could not load sheet — showing demo data');
    } else {
      showToast('error', 'Sync failed — showing last loaded data');
    }
    renderAll();
  }
  showLoading(false);
}

function refreshData() { loadData(); }

// ============================================================
// KANBAN
// ============================================================
function buildBoard() {
  const board = document.getElementById('kanbanBoard');
  board.innerHTML = '';
  COLS.forEach(col => {
    const el = document.createElement('div');
    el.className = 'kanban-column'; el.dataset.status = col.id;
    el.innerHTML = `<div class="column-header"><div class="column-header-left"><div class="column-dot" style="background:${col.color}"></div><h3>${col.label}</h3></div><div class="column-count" data-cnt="${col.id}">0</div></div><div class="column-cards" data-col="${col.id}"></div>`;
    const z = el.querySelector('.column-cards');
    z.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    z.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over'); });
    z.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('drag-over'); moveJob(e.dataTransfer.getData('text/plain'), col.id); });
    board.appendChild(el);
  });
}

function renderAll() {
  renderKanban(); renderStats(); renderTable();
  document.getElementById('totalBadge').textContent = jobs.length;
  setTimeout(kUpdateScrollBtns, 100);
}

function filtered() {
  if (!searchTerm) return jobs;
  const q = searchTerm.toLowerCase();
  return jobs.filter(j => [j.jobId,j.name,j.brand,j.model,j.caseNo,j.issue,j.serial].some(v => (v||'').toLowerCase().includes(q)));
}

function renderKanban() {
  const f = filtered();
  COLS.forEach(col => {
    const c = document.querySelector(`[data-col="${col.id}"]`);
    c.innerHTML = '';
    const cj = f.filter(j => j.status === col.id);
    document.querySelector(`[data-cnt="${col.id}"]`).textContent = cj.length;
    cj.forEach(j => c.appendChild(mkCard(j)));
  });
}

function mkCard(j) {
  const card = document.createElement('div');
  card.className = 'kanban-card'; card.draggable = true; card.dataset.jobId = j.jobId;

  const bt = j.brand === 'Roborock' ? 't-roborock' : j.brand === 'Segway' ? 't-segway' : 't-other';
  const wt = j.warranty || (j.caseNo ? 'In Warranty' : 'Out of Warranty');
  const wtc = wt === 'In Warranty' ? 'tag-wt-in' : 'tag-wt-out';

  let caseH = '';
  if (j.caseNo) {
    caseH = `<div class="card-case"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${j.caseNo}</div>`;
  }

  let folderH = '';
  if (j.driveFolder && !String(j.driveFolder).startsWith('ERROR')) {
    folderH = `<a class="card-folder" href="${j.driveFolder}" target="_blank" title="Open Drive folder" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></a>`;
  }

  const daysInStatus = getDaysInStatus(j);
  const dayClass = daysInStatus >= 7 ? 'alert' : daysInStatus >= 3 ? 'warn' : '';
  const dayBadge = `<span class="card-day-badge ${dayClass}">${daysInStatus}d</span>`;

  card.innerHTML = `
    <div class="card-top"><span class="card-id">${j.jobId||'—'}</span><span class="card-brand-tag ${bt}">${j.brand||'—'}</span></div>
    <div class="card-device">${j.brand||''} ${j.model||''}</div>
    <div class="card-tags">
      ${j.deviceType ? `<span class="tag-sm tag-type">${j.deviceType}</span>` : ''}
      <span class="tag-sm ${wtc}">${wt}</span>
    </div>
    ${caseH}
    <div class="card-issue">${j.issue||'—'}</div>
    <div class="card-footer">
      <span class="card-customer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${j.name||'—'}</span>
      <div class="card-footer-r">${dayBadge}${folderH}</div>
    </div>`;

  card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', j.jobId); card.classList.add('dragging'); });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
  card.addEventListener('click', () => showDetail(j));
  return card;
}

// ============================================================
// STATS
// ============================================================
function renderStats() {
  const intake    = jobs.filter(j => j.status === 'Intake').length;
  const diagnosis = jobs.filter(j => j.status === 'Diagnosis').length;
  const inRepair  = jobs.filter(j => j.status === 'In Repair').length;
  const waiting   = jobs.filter(j => j.status === 'Awaiting Parts').length;
  const testing   = jobs.filter(j => j.status === 'Testing').length;
  const complete  = jobs.filter(j => j.status === 'Complete' || j.status === 'Collected').length;
  // Total active = everything not yet collected/completed
  const total     = jobs.filter(j => j.status !== 'Complete' && j.status !== 'Collected').length;

  document.getElementById('sI').textContent = intake;
  document.getElementById('sD').textContent = diagnosis;
  document.getElementById('sA').textContent = inRepair;
  document.getElementById('sW').textContent = waiting;
  document.getElementById('sC').textContent = complete;
  document.getElementById('sT').textContent = total;
}

// ============================================================
// TABLE
// ============================================================
function renderTable() {
  const tb = document.getElementById('tBody'); tb.innerHTML = '';
  filtered().forEach(j => {
    const bt = j.brand === 'Roborock' ? 't-roborock' : j.brand === 'Segway' ? 't-segway' : 't-other';
    const sc = SC[j.status] || { bg:'#f1f5f9', c:'#475569' };
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer'; tr.onclick = () => showDetail(j);
    const wtVal = j.warranty || '—';
    const wtStyle = j.warranty === 'In Warranty'
      ? 'background:rgba(16,185,129,0.1);color:#059669;'
      : j.warranty === 'Out of Warranty'
      ? 'background:rgba(239,68,68,0.1);color:#dc2626;'
      : '';
    tr.innerHTML = `
      <td><span class="t-job-id">${j.jobId||'—'}</span></td>
      <td><span class="card-brand-tag ${bt}" style="font-size:10.5px;">${j.brand||'—'}</span></td>
      <td style="font-weight:600;">${j.model||'—'}</td>
      <td style="font-size:12.5px;">${j.deviceType||'—'}</td>
      <td>${j.name||'—'}</td>
      <td><span class="t-case">${j.caseNo||'—'}</span></td>
      <td><span class="t-status" style="${wtStyle}font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:20px;display:inline-block;">${wtVal}</span></td>
      <td><span class="t-status" style="background:${sc.bg};color:${sc.c};">${j.status||'—'}</span></td>
      <td style="font-size:12.5px;color:var(--text-secondary);">${fmtDate(j.ts)}</td>
      <td>${getTotalDays(j)}<span style="font-size:11px;color:var(--text-secondary);">d</span></td>
      <td>${j.driveFolder && !String(j.driveFolder).startsWith('ERROR') ? `<a href="${j.driveFolder}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent);font-size:12px;">Open</a>` : '—'}</td>`;
    tb.appendChild(tr);
  });
}

// ============================================================
// DETAIL
// ============================================================
function showDetail(j) {
  document.getElementById('dTitle').textContent = j.jobId || 'Job Details';
  const fields = [
    ['Job ID', j.jobId, true], ['Case Number', j.caseNo, true],
    ['Brand', j.brand], ['Model', j.model],
    ['Device Type', j.deviceType], ['Serial Number', j.serial],
    ['Customer', j.name], ['Phone', j.phone],
    ['Email', j.email], ['Address', j.address],
    ['Issue', j.issue, false, true],
    ['Warranty Status', j.warranty], ['Repaired Before', j.repairedBefore],
    ['When Started', j.whenStarted], ['Known Issues', j.knownIssues],
    ['Accessories', j.accessories],
    ['Status', j.status], ['Date In', fmtDate(j.ts)],
  ];

  let h = '<div class="d-grid">';
  fields.forEach(([lbl, val, mono, full]) => {
    if (!val) return;
    h += `<div class="d-item ${full ? 'd-full' : ''}"><label>${lbl}</label><div class="d-val ${mono ? 'd-mono' : ''}">${val}</div></div>`;
  });
  h += '</div>';

  if (j.driveFolder && !String(j.driveFolder).startsWith('ERROR')) {
    h += `<div style="margin-top:16px;"><a href="${j.driveFolder}" target="_blank" class="btn btn-secondary" style="text-decoration:none;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> Open Drive Folder</a></div>`;
  }

  // ── SMS Templates ───────────────────────────────────────────
  const firstName = (j.name || '').split(' ')[0];
  const device = `${j.brand} ${j.model}`.trim();

  const SMS_TEMPLATES = [
    {
      label: 'Received',
      icon: '<polyline points="20 6 9 17 4 12"/>',
      color: '#6366f1',
      bg: 'rgba(99,102,241,0.08)',
      text: `Hi ${firstName},\n\nYour device has been received and registered under Job No: ${j.jobId} (Ref: ${j.caseNo || '—'}). We will begin the inspection and keep you updated.\n\nThank you!\n\nLogic One SA`
    },
    {
      label: 'Parts Ordered',
      icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.08)',
      text: `Hi ${firstName},\n\nThe required parts for your device (Job No: ${j.jobId}) have been ordered. We'll begin the repair as soon as they arrive. We'll keep you updated.\n\nThank you!\n\nLogic One SA`
    },
    {
      label: 'Repair Done',
      icon: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
      color: '#10b981',
      bg: 'rgba(16,185,129,0.08)',
      text: `Hi ${firstName},\n\nGreat news! Your ${device} (Job No: ${j.jobId}) has been repaired and is ready for collection. Our workshop is open Mon–Fri 9am–5pm. Please bring this message as reference.\n\nThank you for choosing Logic One SA!\n\nLogic One SA`
    },
    {
      label: 'Cannot Repair',
      icon: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.08)',
      text: `Hi ${firstName},\n\nUnfortunately, after thorough inspection we are unable to repair your ${device} (Job No: ${j.jobId}). Please contact us to arrange collection of your device. We apologise for any inconvenience.\n\nThank you.\n\nLogic One SA`
    },
  ];

  h += `
    <div class="sms-panel">
      <div class="sms-panel-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        SMS Templates
      </div>
      <div class="sms-grid">`;

  SMS_TEMPLATES.forEach((t, i) => {
    h += `
        <div class="sms-card" style="--sms-color:${t.color};--sms-bg:${t.bg};">
          <div class="sms-card-top">
            <div class="sms-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14" style="color:${t.color};">${t.icon}</svg>
              ${t.label}
            </div>
            <button class="sms-copy-btn" onclick="copySms(${i}, '${j.jobId}')" id="smsBtn${i}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copy
            </button>
          </div>
          <div class="sms-text" id="smsText${i}">${t.text}</div>
        </div>`;
  });

  h += `
      </div>
    </div>`;

  document.getElementById('dBody').innerHTML = h;

  // Store templates for copy function
  window._smsTemplates = SMS_TEMPLATES;

  let fh = `<div style="display:flex;align-items:center;gap:10px;flex:1;flex-wrap:wrap;"><span style="font-size:12px;color:var(--text-secondary);font-weight:600;">Move to:</span><select id="dSel" style="padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:'Inter',sans-serif;">`;
  COLS.forEach(c => { fh += `<option value="${c.id}" ${c.id === j.status ? 'selected' : ''}>${c.label}</option>`; });
  fh += `</select><button class="btn btn-primary" onclick="moveFromDetail('${j.jobId}')">Update</button></div>`;

  // Zoho invoice button removed

  fh += `<button class="btn btn-secondary" onclick="reprintReceipt('${j.jobId}')" title="Print intake receipt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print Receipt</button>`;
  fh += `<button class="btn btn-secondary" onclick="jsOpenJobFromDetail('${j.jobId}');closeModal('detailModal');"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Job Sheet</button>`;
  document.getElementById('dFoot').innerHTML = fh;

  openModal('detailModal');
}

async function copySms(index, jobId) {
  const template = window._smsTemplates[index];
  if (!template) return;

  try {
    await navigator.clipboard.writeText(template.text);
    const btn = document.getElementById('smsBtn' + index);
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    btn.style.background = 'rgba(16,185,129,0.15)';
    btn.style.color = '#059669';
    btn.style.borderColor = 'rgba(16,185,129,0.3)';
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 2500);
  } catch (err) {
    // Fallback for browsers that block clipboard API
    const el = document.createElement('textarea');
    el.value = template.text;
    el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('success', 'SMS copied to clipboard');
  }
}

function moveFromDetail(id) {
  moveJob(id, document.getElementById('dSel').value);
  closeModal('detailModal');
}

// Re-print an intake receipt for an existing job (also re-saves to Drive).
function reprintReceipt(id) {
  const j = jobs.find(x => x.jobId === id);
  if (!j) { showToast('error', 'Job not found'); return; }
  if (typeof window.receiptGenerateAndPrint !== 'function') {
    showToast('error', 'Receipt module not loaded');
    return;
  }
  window.receiptGenerateAndPrint(j);
}

// ============================================================
// MOVE JOB
// ============================================================
async function moveJob(id, newStatus) {
  const j = jobs.find(x => x.jobId === id);
  if (!j || j.status === newStatus) return;
  const oldStatus = j.status;

  // Record timestamp — only set once per status (don't overwrite if re-entering)
  if (!j.statusTimestamps) j.statusTimestamps = {};
  if (!j.statusTimestamps[newStatus]) {
    j.statusTimestamps[newStatus] = new Date().toISOString();
  }
  j.status = newStatus;
  renderAll();

  if (cfg.appsScriptUrl) {
    // 1. Update status column in sheet
    const statusResult = await callScript({ action: 'updateStatus', jobId: id, status: newStatus });
    if (!statusResult.ok) {
      showToast('error', 'Status update failed: ' + statusResult.error);
      j.status = oldStatus;
      renderAll();
      return;
    }
    // 2. Persist timestamps to Drive immediately — this is the source of truth
    if (j.driveFolder) {
      await callScript({
        action: 'saveTimestamps',
        jobId: id,
        driveFolder: j.driveFolder,
        timestamps: JSON.stringify(j.statusTimestamps)
      });
    }
  }
}

// ============================================================
// NEW JOB
// ============================================================

const ACCESSORIES_BY_TYPE = {
  'Robot Vacuum': ['Auto Empty Dock','Charging Cable','Charging Dock','Dust Bin','Main Brush','Mop Cloth Mount','Original Box','Robot Vacuum','Water Tank'],
  'Scooter':      ['Charger','Extended Inflation','Go-Kart Accessories','Original Box','Password Lock','Scooter Body','Stem Hook','Stem Screws','Wrench'],
};

function resolveDeviceType(type) {
  if (!type) return null;
  const s = type.toLowerCase().trim();
  if (s.includes('scooter') || s.includes('ninebot') || s.includes('segway') || s.includes('electric')) return 'Scooter';
  if (s.includes('robot') || s.includes('vacuum') || s.includes('roborock') || s.includes('roomba')) return 'Robot Vacuum';
  return null;
}

function updateNewJobAccessories() {
  const type = document.getElementById('nType').value;
  const canonical = resolveDeviceType(type) || type;
  const items = ACCESSORIES_BY_TYPE[canonical] || [];
  const group = document.getElementById('nAccessoriesGroup');
  if (!group) return;
  group.innerHTML = items.map(item =>
    `<label><input type="checkbox" value="${item}"> ${item}</label>`
  ).join('');
}

async function submitNewJob() {
  // ── Validation ──────────────────────────────────────────────
  const fields = [
    { id: 'nBrand',  label: 'Brand' },
    { id: 'nModel',  label: 'Model' },
    { id: 'nIssue',  label: 'Issue Description' },
    { id: 'nName',   label: 'Customer Name' },
    { id: 'nPhone',  label: 'Phone' },
    { id: 'nEmail',  label: 'Email' },
  ];

  let missing = [];
  fields.forEach(f => {
    const el = document.getElementById(f.id);
    el.classList.remove('field-err');
    if (!el.value.trim()) { el.classList.add('field-err'); missing.push(f.label); }
  });

  const errDiv = document.getElementById('nJobError');
  if (missing.length > 0) {
    errDiv.textContent = 'Please fill in: ' + missing.join(', ');
    errDiv.style.display = 'block';
    return;
  }
  errDiv.style.display = 'none';

  // ── Disable button while submitting ─────────────────────────
  const btn = document.getElementById('submitJobBtn');
  btn.disabled = true;
  btn.textContent = 'Saving to sheet…';

  // ── Build job object ─────────────────────────────────────────
  const now = new Date();
  const accs = [];
  document.querySelectorAll('#newJobModal .cb-group input:checked').forEach(cb => accs.push(cb.value));

  const newJob = {
    jobId:      genId(now),
    ts:         fmtTimestamp(now),
    name:       document.getElementById('nName').value.trim(),
    phone:      document.getElementById('nPhone').value.trim(),
    email:      document.getElementById('nEmail').value.trim(),
    address:    '',
    caseNo:     document.getElementById('nCase').value.trim(),
    deviceType: document.getElementById('nType').value,
    brand:      document.getElementById('nBrand').value,
    model:      document.getElementById('nModel').value.trim(),
    serial:     document.getElementById('nSerial').value.trim(),
    accessories: accs.join(', '),
    issue:      document.getElementById('nIssue').value.trim(),
    warranty:   document.getElementById('nWarranty').value,
    repairedBefore: document.getElementById('nRepaired').value,
    whenStarted: '', knownIssues: '',
    status:     'Intake',
    driveFolder: '',
  };

  // ── Sync to sheet FIRST, then update UI ──────────────────────
  if (cfg.appsScriptUrl) {
    const result = await callScript({
      action:         'addJob',
      jobId:          newJob.jobId,
      timestamp:      newJob.ts,
      fullName:       newJob.name,
      phone:          newJob.phone,
      email:          newJob.email,
      address:        newJob.address,
      caseNumber:     newJob.caseNo,
      deviceType:     newJob.deviceType,
      brand:          newJob.brand,
      model:          newJob.model,
      serialNumber:   newJob.serial,
      accessories:    newJob.accessories,
      issue:          newJob.issue,
      warranty:       newJob.warranty,
      repairedBefore: newJob.repairedBefore,
      status:         'Intake',
    });

    if (result.ok) {
      // Sheet saved — now reload from sheet so card shows real data
      closeModal('newJobModal');
      resetNewJobForm();
      showToast('success', '✓ ' + newJob.jobId + ' saved to sheet — reloading…');
      await fetchSheet(); // pulls fresh data including Drive folder URL

      // ── Auto-generate intake receipt (print + save to Drive) ─────────────
      // Use the freshly-loaded job so we have the Drive folder URL.
      if (typeof window.receiptGenerateAndPrint === 'function') {
        const savedJob = jobs.find(j => j.jobId === newJob.jobId) || newJob;
        // Fire-and-forget — don't block the UI
        window.receiptGenerateAndPrint(savedJob);
      }

      // ── If out-of-warranty, open detail modal so Zoho button is visible ──
      if (newJob.warranty === 'Out of Warranty') {
        const saved = jobs.find(j => j.jobId === newJob.jobId) || newJob;
        showDetail(saved);
      }
    } else {
      // Sheet failed — show error inside modal, don't close
      const errDiv = document.getElementById('nJobError');
      errDiv.textContent = 'Sheet sync failed: ' + result.error + '. Please try again.';
      errDiv.style.display = 'block';
      showToast('error', 'Failed to save to sheet — see error above');
    }
  } else {
    // No Apps Script configured — add locally only
    jobs.unshift(newJob);
    renderAll();
    closeModal('newJobModal');
    resetNewJobForm();
    showToast('success', '✓ Job ' + newJob.jobId + ' created (not synced — no Apps Script URL)');
  }

  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Create Job';
}

// ── createZohoInvoice ─────────────────────────────────────────
// Called by the "Create Zoho Invoice" button in the detail modal.
async function createZohoInvoice(job) {
  const btn = document.getElementById('zohoInvBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creating…';
  }

  try {
    const res = await fetch('/.netlify/functions/zoho-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId:  job.jobId,
        name:   job.name,
        email:  job.email,
        phone:  job.phone,
        brand:  job.brand,
        model:  job.model,
        serial: job.serial,
        issue:  job.issue,
      }),
    });

    const data = await res.json();

    if (data.ok) {
      const contactNote = data.isNewContact ? ' · new customer created' : ' · existing customer';
      showToast('success', `✓ Draft invoice ${data.invoiceNumber} created in Zoho${contactNote}`);
      // Update button to show it's done
      if (btn) {
        btn.textContent = `✓ ${data.invoiceNumber}`;
        btn.style.background = 'rgba(5,150,105,0.12)';
        btn.style.color = '#059669';
        btn.style.borderColor = 'rgba(5,150,105,0.3)';
        btn.disabled = true;
      }
    } else {
      showToast('error', 'Zoho error: ' + (data.error || 'Unknown error'));
      if (btn) { btn.disabled = false; btn.textContent = 'Create Zoho Invoice'; }
    }
  } catch (err) {
    showToast('error', 'Zoho error: ' + err.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Create Zoho Invoice'; }
  }
}

// ── callScript ────────────────────────────────────────────────
// Sends data to Apps Script via GET + payload param.
// Apps Script redirects to a googeapis.com URL — we follow it
// and parse the JSON response to know if it actually worked.
async function callScript(data) {
  try {
    const url = cfg.appsScriptUrl + '?payload=' + encodeURIComponent(JSON.stringify(data));
    const r = await fetch(url, { redirect: 'follow' });
    const text = await r.text();
    try {
      const json = JSON.parse(text);
      if (json.result === 'ok') return { ok: true, data: json.data || null };
      return { ok: false, error: json.msg || json.result || 'Unknown error' };
    } catch {
      return { ok: false, error: 'Bad response: ' + text.substring(0, 120) };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function resetNewJobForm() {
  ['nModel','nSerial','nCase','nIssue','nName','nPhone','nEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('field-err'); }
  });
  document.getElementById('nBrand').value = '';
  document.getElementById('nBrand').classList.remove('field-err');
  document.getElementById('nWarranty').value = 'In Warranty';
  document.getElementById('nRepaired').value = 'No';
  document.querySelectorAll('#newJobModal .cb-group input').forEach(cb => cb.checked = false);
  document.getElementById('nJobError').style.display = 'none';
}

function showToast(type, msg) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  const icon = document.getElementById('toastIcon');
  msgEl.textContent = msg;
  toast.className = 'toast toast-' + type;
  if (type === 'success') {
    icon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
  } else {
    icon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';
  }
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function genId(d) {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const pfx = `LO-${yy}${mm}${dd}-`;
  const n = jobs.filter(j => (j.jobId||'').startsWith(pfx)).length + 1;
  return pfx + String(n).padStart(3,'0');
}

function fmtTimestamp(d) {
  // Format: M/D/YYYY HH:MM:SS — matches Google Sheets form response format
  const mo = d.getMonth() + 1;
  const da = d.getDate();
  const yr = d.getFullYear();
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  const ss = String(d.getSeconds()).padStart(2,'0');
  return `${mo}/${da}/${yr} ${hh}:${mi}:${ss}`;
}

// ============================================================
// CONFIG
// ============================================================


// ============================================================
// UI
// ============================================================
// Kanban horizontal scroll buttons
function kScroll(dir) {
  const w = document.getElementById('kanbanWrapper');
  if (!w) return;
  w.scrollBy({ left: dir * 320, behavior: 'smooth' });
  setTimeout(kUpdateScrollBtns, 350);
}
function kUpdateScrollBtns() {
  const w = document.getElementById('kanbanWrapper');
  const l = document.getElementById('kScrollLeft');
  const r = document.getElementById('kScrollRight');
  if (!w || !l || !r) return;
  l.classList.toggle('hidden', w.scrollLeft <= 4);
  r.classList.toggle('hidden', w.scrollLeft >= w.scrollWidth - w.clientWidth - 4);
}

function switchView(v) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  const navEl = document.querySelector(`[data-view="${v}"]`);
  if (navEl) navEl.classList.add('active');
  const titles = { kanban:'KANBAN BOARD', list:'ALL JOBS', jobsheet:'JOB SHEETS' };
  document.getElementById('viewTitle').textContent = titles[v] || '';
  // Show/hide search bar (not relevant on job sheet)
  const searchBar = document.querySelector('.search-bar');
  if (searchBar) searchBar.style.display = v === 'jobsheet' ? 'none' : '';
  if (v === 'jobsheet') jsRenderJobList();
  // Show/hide scroll arrow
  const arrow = document.getElementById('jsScrollArrow');
  if (arrow) arrow.classList.toggle('visible', v === 'jobsheet');
  closeSidebar();
}

function openModal(id) {
  document.getElementById(id).classList.add('show');
  if (id === 'newJobModal') updateNewJobAccessories();
}
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('show'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('show'); }
function toggleSidebarCollapse() {
  const s = document.getElementById('sidebar');
  s.classList.toggle('collapsed');
  localStorage.setItem('sidebarCollapsed', s.classList.contains('collapsed'));
}
function showLoading(s) { document.getElementById('kanbanLoading').classList.toggle('show', s); document.getElementById('listLoading').classList.toggle('show', s); }



function handleSearch() { searchTerm = document.getElementById('searchInput').value.trim(); renderKanban(); renderTable(); }

function fmtDate(s) {
  if (!s) return '—';
  try { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return s; }
}

function fmtDateTime(s) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' }) + ' ' +
           d.toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit' });
  } catch { return s; }
}

// Days a job has been in its CURRENT status
function getDaysInStatus(j) {
  const ts = j.statusTimestamps;
  let since = null;
  if (ts) {
    try {
      const parsed = typeof ts === 'string' ? JSON.parse(ts) : ts;
      since = parsed[j.status];
    } catch(e) {}
  }
  // Fallback: use intake timestamp
  if (!since) since = j.ts;
  if (!since) return 0;
  const d = new Date(since);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// Total days since job was received (intake timestamp)
function getTotalDays(j) {
  if (!j.ts) return '—';
  const d = new Date(j.ts);
  if (isNaN(d.getTime())) return '—';
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// Parse statusTimestamps safely (could be JSON string or object)
function parseTimestamps(j) {
  if (!j.statusTimestamps) return {};
  if (typeof j.statusTimestamps === 'object') return j.statusTimestamps;
  try { return JSON.parse(j.statusTimestamps); } catch(e) { return {}; }
}

document.querySelectorAll('.modal-overlay').forEach(o => { o.addEventListener('click', e => { if (e.target === o) o.classList.remove('show'); }); });
