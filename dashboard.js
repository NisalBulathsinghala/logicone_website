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
  'receive method':'receiveMethod','receiving method':'receiveMethod',
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

// Labels/colors mirror the SMS_TEMPLATES built per-job in showDetail() —
// kept separate here since the card indicator only needs label+color,
// not the interpolated per-job message text.
const SMS_TEMPLATE_META = [
  { label: 'Received',      color: '#6366f1' },
  { label: 'Parts Ordered', color: '#f59e0b' },
  { label: 'Repair Done',   color: '#10b981' },
  { label: 'Cannot Repair', color: '#ef4444' },
];

// Builds the interpolated SMS_TEMPLATES array for a given job — shared by
// the detail modal (showDetail) and the jobsheet's Communications tab
// (jobsheet-module.js) so both render/send the exact same wording from
// one place instead of two copies drifting apart.
function buildSmsTemplates(j) {
  const firstName = (j.name || '').split(' ')[0];
  const device = `${j.brand} ${j.model}`.trim();

  return [
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
      text: `Hi ${firstName},\n\nGreat news! Your ${device} (Job No: ${j.jobId}) has been repaired and is ready for collection. Our workshop is open Mon, Wed, Fri 10am–5pm and Sat 10am–2pm. Please bring this message as reference.\n\nThank you for choosing Logic One SA!`
    },
    {
      label: 'Cannot Repair',
      icon: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.08)',
      text: `Hi ${firstName},\n\nUnfortunately, after thorough inspection we are unable to repair your ${device} (Job No: ${j.jobId}). Please contact us to arrange collection of your device. We apologise for any inconvenience.\n\nThank you.\n\nLogic One SA`
    },
  ];
}


// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  buildBoard();
  loadData();

  // Load SMS conversation data immediately so kanban badges show
  // unread counts without requiring a visit to the SMS tab first
  smsInboxRefresh().then(() => smsRefreshKanbanBadges());

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

  njWireInputs();

  // Kanban scroll button visibility
  const kw = document.getElementById('kanbanWrapper');
  if (kw) {
    kw.addEventListener('scroll', kUpdateScrollBtns);
    // Re-check whenever the wrapper is resized (sidebar collapse, window resize)
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => kUpdateScrollBtns()).observe(kw);
    }
    window.addEventListener('resize', kUpdateScrollBtns);
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
  // tcLookup.init() is called by the module itself after it defines window.tcLookup
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

    // Background sync: push every job record into Firestore too.
    // Sheets stays the write path for now (intake form still writes here);
    // this just keeps a synced copy in Firestore so nothing has to change
    // upstream. Runs on every load, so it also backfills existing jobs
    // the first time it runs after deploy.
    syncJobsToFirestore(jobs);

    // Load which SMS templates have already been sent per job, so kanban
    // cards can show sent/not-sent. Merged in after the fact since this
    // lives in Firestore, not the Sheet — re-renders once it's in.
    loadSmsSentStatus();

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

// Push the full job list to Firestore in one batched call. Fire-and-forget —
// Sheets is still the source of truth for rendering, this is a side sync.
function syncJobsToFirestore(jobList) {
  const records = (jobList || []).filter(j => j.jobId);
  if (!records.length) return;
  fetch('/.netlify/functions/firestore-jobsheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save-records-batch', records })
  })
    .then(r => r.json())
    .then(res => { if (!res.ok) console.warn('Firestore job sync failed:', res.error); })
    .catch(e => console.warn('Firestore job sync error:', e));
}

// Fetch { jobId: { "Received": "2026-...", ... } } for every job and merge
// it onto the in-memory jobs array, then re-render so cards pick it up.
function loadSmsSentStatus() {
  fetch('/.netlify/functions/firestore-jobsheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'load-sms-status-batch' })
  })
    .then(r => r.json())
    .then(res => {
      if (!res.ok || !res.data) return;
      jobs.forEach(j => { j.smsSentTemplates = res.data[j.jobId] || j.smsSentTemplates || {}; });
      renderAll();
    })
    .catch(e => console.warn('loadSmsSentStatus error:', e));
}

// Called after a template SMS successfully sends (from sms-module.js).
// Updates local state immediately and persists to Firestore.
function markSmsTemplateSent(jobId, templateLabel) {
  const sentAt = new Date().toISOString();
  const job = jobs.find(j => j.jobId === jobId);
  if (job) {
    if (!job.smsSentTemplates) job.smsSentTemplates = {};
    job.smsSentTemplates[templateLabel] = sentAt;
    renderAll();
  }
  fetch('/.netlify/functions/firestore-jobsheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mark-sms-sent', jobId, template: templateLabel, sentAt })
  }).catch(e => console.warn('markSmsTemplateSent error:', e));
}

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
  setTimeout(kUpdateScrollBtns, 200);
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
  const rmTag = j.receiveMethod === 'Courier'
    ? `<span class="tag-sm tag-courier">📦 Courier</span>`
    : j.receiveMethod === 'Local Drop-off'
    ? `<span class="tag-sm tag-dropoff">🚶 Drop-off</span>`
    : '';

  let caseH = '';
  if (j.caseNo) {
    caseH = `<div class="card-case"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${j.caseNo}</div>`;
  }

  let folderH = '';
  if (j.driveFolder && !String(j.driveFolder).startsWith('ERROR')) {
    folderH = `<a class="card-folder" href="${j.driveFolder}" target="_blank" title="Open Drive folder" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></a>`;
  }

  const totalDays = getTotalDays(j);
  const dayClass = totalDays >= 7 ? 'alert' : totalDays >= 3 ? 'warn' : '';
  const dayBadge = `<span class="card-day-badge ${dayClass}">${totalDays === '—' ? '—' : totalDays + 'd'}</span>`;

  const smsBadgeHtml = (() => {
    const conv = typeof _smsConvs !== 'undefined' && _smsConvs.find(c => c.jobId === j.jobId);
    const n = conv ? (conv.unread || 0) : 0;
    return n > 0 ? `<span class="card-sms-badge" title="SMS replies" onclick="event.stopPropagation();switchView('sms');setTimeout(()=>smsOpenConv('${conv.phone}'),100)">${n}</span>` : '';
  })();

  const smsSentHtml = (() => {
    const sent = j.smsSentTemplates || {};
    const dots = SMS_TEMPLATE_META.map(t => {
      const sentAt = sent[t.label];
      const cls = sentAt ? 'sms-dot-sent' : '';
      const tip = t.label + ': ' + (sentAt ? 'sent ' + fmtDate(sentAt) : 'not sent');
      return `<span class="sms-progress-dot ${cls}" style="--dot-color:${t.color}" title="${tip}"></span>`;
    }).join('');
    return `<div class="card-sms-progress">${dots}</div>`;
  })();

  card.innerHTML = `
    <div class="card-top"><span class="card-id">${j.jobId||'—'}</span><span class="card-brand-tag ${bt}">${j.brand||'—'}</span>${smsBadgeHtml}</div>
    <div class="card-device">${j.brand||''} ${j.model||''}</div>
    <div class="card-tags">
      ${j.deviceType ? `<span class="tag-sm tag-type">${j.deviceType}</span>` : ''}
      <span class="tag-sm ${wtc}">${wt}</span>
      ${rmTag}
    </div>
    ${caseH}
    <div class="card-issue">${j.issue||'—'}</div>
    ${smsSentHtml}
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
// KANBAN TILE FILTER — click a stat tile to swap the columns for a
// table of just that status. "Awaiting Parts" gets extra columns
// (parts + order numbers), pulled in a single batched Firestore read
// rather than one request per job.
// ============================================================
function kFilterByStatus(status) {
  document.getElementById('statsRow').classList.add('filter-mode');
  document.querySelector('.kanban-scroll-wrap').style.display = 'none';
  document.getElementById('kanbanFilterTableWrap').style.display = '';

  const list = jobs.filter(j => j.status === status);
  const subEl = document.getElementById('statBackSub');
  if (subEl) subEl.textContent = `${list.length} job${list.length === 1 ? '' : 's'} — ${status}`;

  if (status === 'Awaiting Parts') kRenderAwaitingPartsTable(list);
  else kRenderSimpleJobTable(list);
}

function kShowKanban() {
  document.getElementById('statsRow').classList.remove('filter-mode');
  document.querySelector('.kanban-scroll-wrap').style.display = '';
  document.getElementById('kanbanFilterTableWrap').style.display = 'none';
}

function kRenderSimpleJobTable(list) {
  const thead = document.getElementById('kanbanFilterThead');
  const tbody = document.getElementById('kanbanFilterBody');
  thead.innerHTML = `<tr><th>Job ID</th><th>Brand</th><th>Model</th><th>Type</th><th>Customer</th><th>Case No.</th><th>Warranty</th><th>Status</th><th>Date In</th><th>Total Days</th><th>Folder</th></tr>`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--text-secondary);">No jobs in this status</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  list.forEach(j => {
    const bt = j.brand === 'Roborock' ? 't-roborock' : j.brand === 'Segway' ? 't-segway' : 't-other';
    const sc = SC[j.status] || { bg: '#f1f5f9', c: '#475569' };
    const wtVal = j.warranty || '—';
    const wtStyle = j.warranty === 'In Warranty'
      ? 'background:rgba(16,185,129,0.1);color:#059669;'
      : j.warranty === 'Out of Warranty'
      ? 'background:rgba(239,68,68,0.1);color:#dc2626;'
      : '';
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = () => showDetail(j);
    tr.innerHTML = `
      <td><span class="t-job-id">${j.jobId || '—'}</span></td>
      <td><span class="card-brand-tag ${bt}" style="font-size:10.5px;">${j.brand || '—'}</span></td>
      <td style="font-weight:600;">${j.model || '—'}</td>
      <td style="font-size:12.5px;">${j.deviceType || '—'}</td>
      <td>${j.name || '—'}</td>
      <td><span class="t-case">${j.caseNo || '—'}</span></td>
      <td><span class="t-status" style="${wtStyle}font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:20px;display:inline-block;">${wtVal}</span></td>
      <td><span class="t-status" style="background:${sc.bg};color:${sc.c};">${j.status || '—'}</span></td>
      <td style="font-size:12.5px;color:var(--text-secondary);">${fmtDate(j.ts)}</td>
      <td>${getTotalDays(j)}<span style="font-size:11px;color:var(--text-secondary);">d</span></td>
      <td>${j.driveFolder && !String(j.driveFolder).startsWith('ERROR') ? `<a href="${j.driveFolder}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent);font-size:12px;">Open</a>` : '—'}</td>`;
    tbody.appendChild(tr);
  });
}

async function kRenderAwaitingPartsTable(list) {
  const thead = document.getElementById('kanbanFilterThead');
  const tbody = document.getElementById('kanbanFilterBody');
  thead.innerHTML = `<tr><th>Job ID</th><th>Customer</th><th>Brand</th><th>Model</th><th>Parts</th><th>Order Numbers</th><th>Days Waiting</th></tr>`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-secondary);">No jobs awaiting parts</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-secondary);">Loading parts info…</td></tr>`;

  let partsData = {};
  try {
    const res = await fetch('/.netlify/functions/firestore-jobsheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load-parts-batch', jobIds: list.map(j => j.jobId) }),
    }).then(r => r.json());
    if (res.ok) partsData = res.data || {};
    else console.warn('load-parts-batch failed:', res.error);
  } catch (e) {
    console.warn('load-parts-batch error:', e.message);
  }

  // Bail out quietly if the tile was clicked again (or Back was hit)
  // while this fetch was still in flight — don't stomp on newer content.
  if (document.getElementById('kanbanFilterTableWrap').style.display === 'none') return;

  tbody.innerHTML = '';
  list.forEach(j => {
    const pd = partsData[j.jobId] || { parts: [], orderNums: [] };
    const parts = (pd.parts || []).filter(p => p && (p.name || p.partno));
    const orders = (pd.orderNums || []).filter(Boolean);

    const partsText = parts.length
      ? parts.map(p => `<div>${p.name || p.partno || 'Unnamed part'}${p.qty ? ' ×' + p.qty : ''}</div>`).join('')
      : '<span style="color:var(--text-secondary);font-style:italic;">None listed</span>';
    const ordersText = orders.length
      ? orders.map(o => `<div>${o}</div>`).join('')
      : '<span style="color:var(--text-secondary);font-style:italic;">—</span>';

    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = () => showDetail(j);
    tr.innerHTML = `
      <td><span class="t-job-id">${j.jobId || '—'}</span></td>
      <td>${j.name || '—'}</td>
      <td>${j.brand || '—'}</td>
      <td style="font-weight:600;">${j.model || '—'}</td>
      <td class="t-wrap-cell" style="font-size:12.5px;max-width:280px;">${partsText}</td>
      <td class="t-wrap-cell" style="font-size:12.5px;font-family:'SF Mono','Fira Code',monospace;max-width:160px;">${ordersText}</td>
      <td>${getTotalDays(j)}<span style="font-size:11px;color:var(--text-secondary);">d</span></td>`;
    tbody.appendChild(tr);
  });
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
  // Clear photo cache on every open so stale photos from previous job don't show
  Object.keys(_dPhotoCache).forEach(k => delete _dPhotoCache[k]);
  document.getElementById('dTitle').textContent = j.jobId || 'Job Details';
  const fields = [
    ['Job ID', j.jobId, true], ['Case Number', j.caseNo, true],
    ['Brand', j.brand], ['Model', j.model],
    ['Device Type', j.deviceType], ['Serial Number', j.serial],
    ['Customer', j.name], ['Phone', j.phone],
    ['Email', j.email], ['Address', j.address],
    ['Issue', j.issue, false, true],
    ['Warranty Status', j.warranty], ['Receive Method', j.receiveMethod],
    ['Repaired Before', j.repairedBefore],
    ['When Started', j.whenStarted], ['Known Issues', j.knownIssues],
    ['Accessories', j.accessories],
    ['Status', j.status], ['Date In', fmtDate(j.ts)],
  ];

  // ── Top action bar ──────────────────────────────────────────
  let h = '<div class="d-action-bar">';
  // 1. Job Sheet — primary blue
  h += `<button class="d-action-btn d-btn-jobsheet" onclick="jsOpenJobFromDetail('${j.jobId}');closeModal('detailModal');"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Job Sheet</button>`;
  // 2. Drive Folder — green (only if available)
  if (j.driveFolder && !String(j.driveFolder).startsWith('ERROR')) {
    h += `<a href="${j.driveFolder}" target="_blank" class="d-action-btn d-btn-drive" title="Open Drive Folder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> Drive</a>`;
  }
  // 3. Print Receipt — amber
  h += `<button class="d-action-btn d-btn-receipt" onclick="reprintReceipt('${j.jobId}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Receipt</button>`;
  // 4. Status selector — pushed to the right
  h += `<div class="d-action-status"><select id="dSel" class="d-status-sel">`;
  COLS.forEach(c => { h += `<option value="${c.id}" ${c.id === j.status ? 'selected' : ''}>${c.label}</option>`; });
  h += `</select><button class="d-btn-update" onclick="moveFromDetail('${j.jobId}')">Update</button></div>`;
  h += '</div>';

  // ── Info grid ───────────────────────────────────────────────
  h += '<div class="d-grid">';
  fields.forEach(([lbl, val, mono, full]) => {
    if (!val) return;
    h += `<div class="d-item ${full ? 'd-full' : ''}"><label>${lbl}</label><div class="d-val ${mono ? 'd-mono' : ''}">${val}</div></div>`;
  });
  h += '</div>';

  // ── Photos section ──────────────────────────────────────────
  if (j.driveFolder && !String(j.driveFolder).startsWith('ERROR')) {
    h += `<div class="d-photos-section" id="dPhotosSection">
      <div class="d-photos-header">
        <span>Photos</span>
        <div class="d-photo-tabs">
          <button class="d-photo-tab active" data-folder="01_Receiving Photos" onclick="dLoadPhotoTab(this,'${j.driveFolder}')">Receiving</button>
          <button class="d-photo-tab" data-folder="02_Inspection Photos" onclick="dLoadPhotoTab(this,'${j.driveFolder}')">Inspection</button>
          <button class="d-photo-tab" data-folder="03_Testing Photos" onclick="dLoadPhotoTab(this,'${j.driveFolder}')">Testing</button>
          <button class="d-photo-tab" data-folder="04_Shipping Photos" onclick="dLoadPhotoTab(this,'${j.driveFolder}')">Shipping</button>
        </div>
      </div>
      <div class="d-photo-grid" id="dPhotoGrid">
        <div class="d-photo-loading"><div class="d-photo-spinner"></div><span>Loading photos…</span></div>
      </div>
    </div>`;
  }

  // ── SMS Templates ───────────────────────────────────────────
  const SMS_TEMPLATES = buildSmsTemplates(j);

  h += `
    <div class="sms-panel">
      <div class="sms-panel-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        SMS Templates
      </div>
      <div class="sms-grid">`;

  SMS_TEMPLATES.forEach((t, i) => {
    const sentAt = (j.smsSentTemplates || {})[t.label];
    const sentBadge = sentAt
      ? `<span class="sms-sent-badge" title="Sent ${fmtDateTime(sentAt)}">✓ Sent ${fmtDate(sentAt)}</span>`
      : '';
    h += `
        <div class="sms-card" style="--sms-color:${t.color};--sms-bg:${t.bg};">
          <div class="sms-card-top">
            <div class="sms-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14" style="color:${t.color};">${t.icon}</svg>
              ${t.label}
              ${sentBadge}
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

  // Footer — just close button now; all actions moved to top action bar
  document.getElementById('dFoot').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('detailModal')">Close</button>`;

  openModal('detailModal');

  // Initialise SMS send/call buttons (sms-module.js)
  if (typeof window.smsModuleInit === 'function') {
    setTimeout(() => window.smsModuleInit(j), 50);
  }

  // Show unread SMS dot on the SMS panel title if there are unread replies
  setTimeout(() => {
    const conv   = _smsConvs && _smsConvs.find(c => c.jobId === j.jobId);
    const unread = conv ? (conv.unread || 0) : 0;
    const smsTitle = document.querySelector('.sms-panel-title');
    if (smsTitle) {
      const existing = smsTitle.querySelector('.sms-unread-dot');
      if (existing) existing.remove();
      if (unread > 0) {
        const dot = document.createElement('span');
        dot.className = 'sms-unread-dot';
        dot.textContent = unread;
        smsTitle.appendChild(dot);
      }
    }
  }, 60);

  // Clear photo grid immediately before loading new photos
  const oldGrid = document.getElementById('dPhotoGrid');
  if (oldGrid) oldGrid.innerHTML = '<div class="d-photo-loading"><div class="d-photo-spinner"></div><span>Loading photos…</span></div>';

  // Reset tabs to first tab
  document.querySelectorAll('.d-photo-tab').forEach((t, i) => t.classList.toggle('active', i === 0));

  // Auto-load first photo tab if drive folder exists
  if (j.driveFolder && !String(j.driveFolder).startsWith('ERROR')) {
    const firstTab = document.querySelector('#dPhotosSection .d-photo-tab');
    if (firstTab) dLoadPhotoTab(firstTab, j.driveFolder);
  }
}

// ── Detail modal photo loader ────────────────────────────────
let _dPhotoCache = {}; // driveFolder+folder → [{id,name,mimeType,thumbUrl}]

async function dLoadPhotoTab(tabEl, driveFolder) {
  tabEl.closest('.d-photo-tabs').querySelectorAll('.d-photo-tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  const folderName = tabEl.dataset.folder;
  const cacheKey   = driveFolder + '|' + folderName;
  const grid       = document.getElementById('dPhotoGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="d-photo-loading"><div class="d-photo-spinner"></div><span>Loading photos…</span></div>';
  if (_dPhotoCache[cacheKey]) { dRenderPhotoGrid(grid, _dPhotoCache[cacheKey]); return; }
  try {
    // Always use Apps Script with per-job driveFolder — never use stale _photoFolderIds
    const res = await callScript({ action: 'listPhotos', driveFolder });
    if (res.ok && res.data) {
      const items = res.data
        .filter(f => f.subfolder === folderName)
        .map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType || '', thumbUrl: f.thumbUrl || `https://drive.google.com/thumbnail?id=${f.id}&sz=w400`, viewUrl: f.viewUrl || '' }));
      _dPhotoCache[cacheKey] = items;
      dRenderPhotoGrid(grid, items);
    } else {
      grid.innerHTML = '<div class="d-photo-empty">Could not load photos</div>';
    }
  } catch (e) {
    grid.innerHTML = '<div class="d-photo-empty">Could not load photos</div>';
  }
}

function dRenderPhotoGrid(grid, items) {
  if (!items.length) {
    grid.innerHTML = '<div class="d-photo-empty">No photos in this stage yet</div>';
    return;
  }
  grid.innerHTML = items.map(item => {
    const isVideo = (item.mimeType || '').startsWith('video/');
    return `<div class="d-photo-thumb" onclick="dOpenLightbox('${item.id}','${item.name.replace(/'/g,"\'")}','${item.mimeType || ''}','${item.viewUrl || ''}','${item.thumbUrl}')" title="${item.name}">
      ${isVideo && !item.thumbUrl
        ? `<div class="d-photo-vid-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg></div>`
        : `<img src="${item.thumbUrl}" alt="${item.name}" loading="lazy" onerror="loThumbRetry(this,'${item.id}',dPhotoThumbGiveUp)">`
      }
      ${isVideo ? '<div class="d-photo-vid-badge">VIDEO</div>' : ''}
    </div>`;
  }).join('');
}

function dPhotoThumbGiveUp(img) {
  img.parentElement.innerHTML = '<div class="d-photo-vid-icon">?</div>';
}

function dOpenLightbox(id, name, mimeType, viewUrl, thumbUrl) {
  if (mimeType.startsWith('video/')) {
    window.open(viewUrl || `https://drive.google.com/file/d/${id}/view`, '_blank');
    return;
  }
  // Reuse the photo module lightbox if available
  if (typeof jsPhotoLightboxOpen === 'function') {
    jsPhotoLightboxOpen({ id, name, mimeType, viewUrl, thumbUrl });
  } else {
    window.open(`https://drive.google.com/file/d/${id}/view`, '_blank');
  }
}

// Clear photo cache when detail modal closes so fresh data loads next open
const _origCloseModal = window.closeModal;
window.closeModal = function(id) {
  if (id === 'detailModal') Object.keys(_dPhotoCache).forEach(k => delete _dPhotoCache[k]);
  if (_origCloseModal) _origCloseModal(id);
};

// ── Load first tab when detail opens ─────────────────────────
const _origShowDetail = window.showDetail;

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
// Once a job reaches its terminal status there's no legitimate reason for
// its "scan to upload from phone" link to keep working — Shipping photos
// are typically the last ones taken, and those happen before Collected,
// not after. Fire-and-forget: this never blocks a status update, and
// mint() will happily generate a fresh token later if the job is ever
// reopened (e.g. the same device comes back for a follow-up issue).
function maybeClearQrToken(jobId, newStatus) {
  if (newStatus !== 'Collected') return;
  fetch('/.netlify/functions/qr-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'clear', jobId }),
  }).catch(e => console.warn('qr-photo clear failed (non-fatal):', e.message));
}

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
    // 3. Dual-write status + timestamps to Firestore (fire and forget)
    fetch('/.netlify/functions/firestore-jobsheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'timestamps-save',
        jobId: id,
        timestamps: { ...j.statusTimestamps, _status: newStatus },
      }),
    }).catch(e => console.warn('Firestore status write failed (non-fatal):', e.message));

    maybeClearQrToken(id, newStatus);
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

// Checks the already-loaded jobs list for a likely duplicate before a new
// job is created. Serial number and case number should each be unique to
// one physical repair case, so either matching is a strong signal. Phone +
// model matching an already-open (not yet Collected) job is a weaker
// signal, but still worth a heads-up — someone re-submitting the same form
// by accident is the most common real-world case this catches.
// "N/A", "none", etc. mean "no case number" / "no serial" — not a real
// value to match on. Without this, every out-of-warranty job with "N/A"
// typed into Case Number matches every OTHER job with "N/A" typed there,
// since jobs.find() just returns whichever one happens to come first.
const NJ_PLACEHOLDER_VALUES = new Set(['n/a', 'na', 'none', 'nil', 'unknown', '-', '--']);

function checkForDuplicateJob(newJob) {
  const serial = (newJob.serial || '').trim().toLowerCase();
  const caseNo = (newJob.caseNo || '').trim().toLowerCase();
  const phone  = (newJob.phone  || '').trim();
  const model  = (newJob.model  || '').trim().toLowerCase();

  if (serial && !NJ_PLACEHOLDER_VALUES.has(serial)) {
    const match = jobs.find(j => (j.serial || '').trim().toLowerCase() === serial);
    if (match) return { job: match, reason: 'same serial number' };
  }
  if (caseNo && !NJ_PLACEHOLDER_VALUES.has(caseNo)) {
    const match = jobs.find(j => (j.caseNo || '').trim().toLowerCase() === caseNo);
    if (match) return { job: match, reason: 'same case number' };
  }
  if (phone && model) {
    const match = jobs.find(j =>
      (j.phone || '').trim() === phone &&
      (j.model || '').trim().toLowerCase() === model &&
      j.status !== 'Collected'
    );
    if (match) return { job: match, reason: 'same phone number and model, already open' };
  }
  return null;
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
    receiveMethod: document.getElementById('nReceiveMethod').value,
    repairedBefore: document.getElementById('nRepaired').value,
    whenStarted: '', knownIssues: '',
    status:     'Intake',
    driveFolder: '',
  };

  // ── Check for a likely duplicate before creating a new job ────
  const dup = checkForDuplicateJob(newJob);
  if (dup) {
    const proceed = confirm(
      `This looks like it might already be in the system — ${dup.reason}.\n\n` +
      `Existing job: ${dup.job.jobId} — ${dup.job.name || '—'} (currently: ${dup.job.status || '—'})\n\n` +
      `Create a new job anyway?`
    );
    if (!proceed) {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Create Job';
      return;
    }
  }

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
      receiveMethod:  newJob.receiveMethod,
      repairedBefore: newJob.repairedBefore,
      status:         'Intake',
    });

    if (result.ok) {
      // Fire-and-forget, same pattern as the receipt below — and it has to
      // happen before closeModal(), which resets the form (and with it,
      // the photo queue) via resetNewJobForm().
      njUploadQueuedPhotos(newJob.jobId, result.data && result.data.driveFolder);

      // Sheet saved — now reload from sheet so card shows real data
      closeModal('newJobModal');
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
      const isTimeout = result.error && result.error.includes('timed out');
      errDiv.textContent = isTimeout
        ? 'Apps Script timed out creating the Drive folder. The job may have been saved — check the sheet before trying again.'
        : 'Sheet sync failed: ' + result.error + '. Please try again.';
      errDiv.style.display = 'block';
      showToast('error', isTimeout ? 'Drive folder creation timed out — check sheet before retrying' : 'Failed to save to sheet');
    }
  } else {
    // No Apps Script configured — add locally only
    jobs.unshift(newJob);
    renderAll();
    closeModal('newJobModal');
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
// Sends data to Apps Script as a POST with the payload in the body —
// NOT a GET with the payload in the query string. That was the original
// approach, and it silently breaks for anything with a real payload
// (e.g. saveReport's base64 PDF): URLs have practical length limits well
// under what a base64-encoded file needs, so the request can fail before
// it even reaches Apps Script. doPost already reads e.postData.contents
// and forwards to the exact same doGet logic, so this needed no Apps
// Script changes — report-module.js's fetchPhotos call already used this
// same POST pattern, this just brings every other action in line with it.
//
// addJob creates a Drive folder which can take 5-15s — we use a
// longer timeout for that action and retry once on network errors.
async function callScript(data, { timeoutMs, retries } = {}) {
  // addJob does heavy Drive work — give it more time and one retry
  const isHeavy = data.action === 'addJob';
  const timeout = timeoutMs || (isHeavy ? 45000 : 25000);
  const maxTries = retries != null ? retries : (isHeavy ? 2 : 1);

  async function attempt() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const r = await fetch(cfg.appsScriptUrl, {
        method:  'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids a CORS preflight against Apps Script
        body:    JSON.stringify(data),
        signal:  controller.signal,
      });
      clearTimeout(timer);
      const text = await r.text();
      try {
        const json = JSON.parse(text);
        if (json.result === 'ok') return { ok: true, data: json.data || null };
        return { ok: false, error: json.msg || json.result || 'Unknown error' };
      } catch {
        return { ok: false, error: 'Bad response: ' + text.substring(0, 120) };
      }
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err.name === 'AbortError';
      return { ok: false, error: isAbort ? 'Request timed out — Apps Script took too long' : err.message, transient: true };
    }
  }

  let result;
  for (let i = 0; i < maxTries; i++) {
    result = await attempt();
    if (result.ok || !result.transient) break;
    if (i < maxTries - 1) {
      // Brief pause before retry
      await new Promise(res => setTimeout(res, 2000));
    }
  }
  return result;
}

function resetNewJobForm() {
  if (window.tcLookup) tcLookup.reset();
  njResetPhotos();
  ['nModel','nSerial','nCase','nIssue','nName','nPhone','nEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('field-err'); }
  });
  document.getElementById('nType').value = 'Robot Vacuum';
  document.getElementById('nBrand').value = '';
  document.getElementById('nBrand').classList.remove('field-err');
  document.getElementById('nWarranty').value = 'In Warranty';
  document.getElementById('nReceiveMethod').value = '';
  document.getElementById('nRepaired').value = 'No';
  document.querySelectorAll('#newJobModal .cb-group input').forEach(cb => cb.checked = false);
  document.getElementById('nJobError').style.display = 'none';
}

// ============================================================
// NEW JOB — optional photo capture ("Include photos" toggle)
// ------------------------------------------------------------
// Photos are organised into labeled shot slots rather than one flat
// pile — the suggested list changes with Receive Method, and custom
// slots can be added per job. Queued client-side (converted to JPEG
// immediately via photo-convert.js) while the form is being filled in,
// then uploaded straight to the new job's 01_Receiving Photos folder
// right after addJob succeeds, filenames stamped with the slot label so
// the Drive folder is self-explanatory afterward. Same resumable Drive
// upload flow photo-module.js uses, just without a queue-row UI since
// the modal is already closed by the time it runs. Fire-and-forget,
// same pattern as the intake receipt: it never blocks job creation.
// ============================================================
const NJ_PHOTO_SLOTS = {
  'Robot Vacuum': {
    'Courier': [
      'Box', 'Shipping label', 'Box open', 'All components',
      'Robot underside', 'Robot serial number', 'Dock serial number',
    ],
    'Local Drop-off': [
      'All components', 'Robot underside', 'Robot serial number', 'Dock serial number',
    ],
  },
  'Scooter': {
    'Courier': [
      'Box', 'Shipping label', 'Box open', 'All components', 'Scooter serial number',
    ],
    'Local Drop-off': [
      'All components', 'Scooter serial number',
    ],
  },
};

let njPhotoQueue  = []; // [{ id, file (converted File), url (object URL for the thumb), label }]
let njCustomSlots = []; // extra labels added ad hoc for this job — reset with the rest of the form
let njActiveSlot  = null; // which label the next capture/library pick tags its result with

function njEscHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function njSlugify(label) {
  return String(label || 'photo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'photo';
}

// The suggested list for the current Device Type + Receive Method, plus
// any custom slots, plus any label that already has photos under it —
// switching either field after taking some shots never hides photos
// you've already taken, it only changes which *empty* slots are shown.
function njCurrentSlotLabels() {
  const type   = (document.getElementById('nType') || {}).value || 'Robot Vacuum';
  const method = (document.getElementById('nReceiveMethod') || {}).value || '';
  const base = (NJ_PHOTO_SLOTS[type] && NJ_PHOTO_SLOTS[type][method]) || [];
  const withPhotos = njPhotoQueue.map(p => p.label);
  return [...new Set([...base, ...njCustomSlots, ...withPhotos])];
}

function njToggleCapture() {
  const on = document.getElementById('nIncludePhotos').checked;
  const section = document.getElementById('nPhotoCapture');
  if (section) section.style.display = on ? '' : 'none';
  if (on) njRenderSlots();
}

function njWireInputs() {
  const cam = document.getElementById('njCameraInput');
  const lib = document.getElementById('njLibraryInput');
  const custom = document.getElementById('npCustomLabel');
  // Reset .value after each use so the same photo can be re-picked and so
  // a fresh 'change' event fires every time — camera taps especially need
  // this since a slot can take more than one shot.
  if (cam) cam.addEventListener('change', async () => { await njHandleFiles(cam.files); cam.value = ''; });
  if (lib) lib.addEventListener('change', async () => { await njHandleFiles(lib.files); lib.value = ''; });
  if (custom) custom.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); njAddCustomSlot(); } });
}

// Native camera capture, per slot. A live in-page camera (getUserMedia)
// was tried here instead, but on iOS Safari that pipeline is capped to a
// lower resolution than an actual photo capture and doesn't expose focus
// control to web pages at all — the native camera app doesn't have
// either limitation, so it stays the primary path even though it means
// one round trip per shot.
function njSlotCapture(i) {
  njActiveSlot = (window._njSlotLabels || [])[i];
  const el = document.getElementById('njCameraInput');
  if (el) el.click();
}
function njSlotLibrary(i) {
  njActiveSlot = (window._njSlotLabels || [])[i];
  const el = document.getElementById('njLibraryInput');
  if (el) el.click();
}

function njAddCustomSlot() {
  const input = document.getElementById('npCustomLabel');
  if (!input) return;
  const label = input.value.trim();
  if (!label) return;
  const exists = njCurrentSlotLabels().some(l => l.toLowerCase() === label.toLowerCase());
  if (!exists) njCustomSlots.push(label);
  input.value = '';
  njRenderSlots();
}

async function njHandleFiles(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const label = njActiveSlot || 'Other';
  njActiveSlot = null;

  for (const raw of files) {
    const converted = (typeof window.loConvertToJpeg === 'function')
      ? await window.loConvertToJpeg(raw)
      : raw;
    njPhotoQueue.push({
      id:    'p' + Date.now() + Math.random().toString(36).slice(2, 6),
      file:  converted,
      url:   URL.createObjectURL(converted),
      label,
    });
  }
  njRenderSlots();
}

function njRemovePhoto(id) {
  const idx = njPhotoQueue.findIndex(p => p.id === id);
  if (idx === -1) return;
  URL.revokeObjectURL(njPhotoQueue[idx].url);
  njPhotoQueue.splice(idx, 1);
  njRenderSlots();
}

function njRenderSlots() {
  const wrap = document.getElementById('npSlots');
  if (!wrap) return;
  const labels = njCurrentSlotLabels();
  window._njSlotLabels = labels; // index -> label lookup for njSlotCapture/njSlotLibrary

  if (!labels.length) {
    wrap.innerHTML = '<div class="np-hint">Select a receive method above for a suggested shot list, or add a custom one below.</div>';
    return;
  }

  const camIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  const libIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';

  wrap.innerHTML = labels.map((label, i) => {
    const photos = njPhotoQueue.filter(p => p.label === label);
    const safeLabel = njEscHtml(label);
    return `
      <div class="np-slot ${photos.length ? 'done' : ''}">
        <div class="np-slot-top">
          <span class="np-slot-label">${photos.length ? '<span class="np-slot-check">✓</span>' : ''}${safeLabel}</span>
          <div class="np-slot-btns">
            <button type="button" class="np-slot-btn" onclick="njSlotCapture(${i})" aria-label="Take photo — ${safeLabel}">${camIcon}</button>
            <button type="button" class="np-slot-btn" onclick="njSlotLibrary(${i})" aria-label="Choose from library — ${safeLabel}">${libIcon}</button>
          </div>
        </div>
        ${photos.length ? `<div class="np-slot-thumbs">${photos.map(p => `
          <div class="np-thumb-sm">
            <img src="${p.url}" alt="">
            <button type="button" class="np-thumb-sm-remove" onclick="njRemovePhoto('${p.id}')">✕</button>
          </div>`).join('')}</div>` : ''}
      </div>`;
  }).join('');
}

function njResetPhotos() {
  njPhotoQueue.forEach(p => URL.revokeObjectURL(p.url));
  njPhotoQueue  = [];
  njCustomSlots = [];
  njActiveSlot  = null;
  const chk = document.getElementById('nIncludePhotos'); if (chk) chk.checked = false;
  const section = document.getElementById('nPhotoCapture'); if (section) section.style.display = 'none';
  const wrap = document.getElementById('npSlots'); if (wrap) wrap.innerHTML = '';
  const custom = document.getElementById('npCustomLabel'); if (custom) custom.value = '';
  const cam = document.getElementById('njCameraInput');  if (cam) cam.value = '';
  const lib = document.getElementById('njLibraryInput'); if (lib) lib.value = '';
}

// Uploads whatever was queued to the freshly-created job's Receiving
// Photos folder. Safe to call with an empty queue or a missing
// driveFolder — both are handled as no-ops or a clear error toast rather
// than a thrown error, since this always runs after the job itself has
// already been saved.
async function njUploadQueuedPhotos(jobId, driveFolder) {
  if (!njPhotoQueue.length) return;
  const queued = njPhotoQueue.slice(); // snapshot — resetNewJobForm() clears the live array right after this call

  if (!driveFolder) {
    showToast('error', `${queued.length} photo${queued.length === 1 ? '' : 's'} not uploaded — ${jobId}'s Drive folder wasn't ready. Add them from the Photos tab once it's set up.`);
    queued.forEach(p => URL.revokeObjectURL(p.url));
    return;
  }

  showToast('success', `Uploading ${queued.length} photo${queued.length === 1 ? '' : 's'} to ${jobId}…`);

  try {
    const tokenRes = await callScript({ action: 'getUploadToken', driveFolder });
    if (!tokenRes.ok || !tokenRes.data) throw new Error(tokenRes.error || 'Could not get an upload token');
    const token    = tokenRes.data.token;
    const folderId = tokenRes.data.stageFolderIds && tokenRes.data.stageFolderIds['01_Receiving Photos'];
    if (!token || !folderId) throw new Error('Receiving Photos folder not found');

    let done = 0, failed = 0;
    const seqByLabel = {};
    for (let i = 0; i < queued.length; i++) {
      const slug = njSlugify(queued[i].label);
      seqByLabel[slug] = (seqByLabel[slug] || 0) + 1;
      try { await njUploadOneFile(queued[i].file, folderId, token, jobId, slug, seqByLabel[slug]); done++; }
      catch (e) { console.warn('New job photo upload failed:', e.message); failed++; }
    }

    if (failed === 0) showToast('success', `✓ ${done} photo${done === 1 ? '' : 's'} added to ${jobId}`);
    else showToast('error', `${done} of ${queued.length} uploaded — the rest can be added from ${jobId}'s Photos tab`);

  } catch (err) {
    console.error('njUploadQueuedPhotos error:', err);
    showToast('error', `Photo upload failed (${err.message}) — add them from ${jobId}'s Photos tab instead`);
  } finally {
    queued.forEach(p => URL.revokeObjectURL(p.url));
  }
}

// Minimal resumable Drive upload — same flow as photo-module.js's
// jsPhotoUploadFile, without the per-row queue UI (this runs after the
// New Job modal has already closed). File names are stamped with the
// job ID, stage code, and the slot label (e.g.
// LO-260710-001-RCV-shipping-label-1.jpg) so the folder is
// self-explanatory without opening every thumbnail.
async function njUploadOneFile(file, folderId, token, jobId, slug, seq) {
  const name = `${jobId}-RCV-${slug}-${seq}.jpg`;

  const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'application/json',
      'X-Upload-Content-Type':   file.type || 'image/jpeg',
      'X-Upload-Content-Length': file.size,
    },
    body: JSON.stringify({ name, parents: [folderId] }),
  });
  if (!initRes.ok) throw new Error('Session init failed: ' + initRes.status);
  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('No upload URL returned');

  const CHUNK = 8 * 1024 * 1024;
  let offset = 0;
  while (offset < file.size) {
    const end   = Math.min(offset + CHUNK, file.size);
    const chunk = file.slice(offset, end);
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${offset}-${end - 1}/${file.size}`,
        'Content-Type':  file.type || 'image/jpeg',
      },
      body: chunk,
    });
    if (res.status === 308) {
      const rangeHeader = res.headers.get('Range');
      offset = rangeHeader ? parseInt(rangeHeader.split('-')[1]) + 1 : end;
    } else if (res.status === 200 || res.status === 201) {
      return;
    } else {
      throw new Error('Upload chunk failed: ' + res.status);
    }
  }
  if (file.size === 0) return; // zero-byte edge case, matches jsPhotoUploadFile
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
  const canScrollLeft  = w.scrollLeft > 4;
  const canScrollRight = w.scrollWidth > w.clientWidth + 4;
  const atRight        = w.scrollLeft >= w.scrollWidth - w.clientWidth - 4;
  l.classList.toggle('hidden', !canScrollLeft);
  r.classList.toggle('hidden', !canScrollRight || atRight);
}

function switchView(v) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  const navEl = document.querySelector(`[data-view="${v}"]`);
  if (navEl) navEl.classList.add('active');
  const titles = { kanban:'KANBAN BOARD', list:'ALL JOBS', jobsheet:'JOB SHEETS', sms:'SMS INBOX' };
  document.getElementById('viewTitle').textContent = titles[v] || '';
  // Show/hide search bar (not relevant on job sheet or sms)
  const searchBar = document.querySelector('.search-bar');
  if (searchBar) searchBar.style.display = (v === 'jobsheet' || v === 'sms') ? 'none' : '';
  if (v === 'jobsheet') jsRenderJobList();
  if (v === 'kanban') setTimeout(kUpdateScrollBtns, 50);
  if (v === 'sms') smsInboxInit();
  // Show/hide scroll arrow
  const arrow = document.getElementById('jsScrollArrow');
  if (arrow) arrow.classList.toggle('visible', v === 'jobsheet');
  closeSidebar();
}

function openModal(id) {
  document.getElementById(id).classList.add('show');
  if (id === 'newJobModal') {
    updateNewJobAccessories();
    if (window.tcLookup) { tcLookup.injectUI(); }
  }
}
function closeModal(id) {
  document.getElementById(id).classList.remove('show');
  if (id === 'newJobModal') resetNewJobForm();
}
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

// ============================================================
// SMS INBOX VIEW
// ============================================================

let _smsConvs       = [];   // conversation metadata from index (no messages)
let _smsThreads     = {};   // phone → full message array, loaded on demand
let _smsActiveConv  = null;
let _smsLoaded      = false;
let _smsFilter      = 'all'; // 'all' | 'unread' | 'needs'
let _smsSearch      = '';

async function smsInboxInit() {
  if (_smsLoaded) { smsRenderConvList(_smsConvs); return; }
  document.getElementById('smsConvItems').innerHTML = '<div class="sms-conv-loading">Loading conversations…</div>';
  await smsInboxRefresh();
}

async function smsInboxRefresh() {
  const isFirst = !_smsLoaded;
  try {
    const fsRes  = await fetch('/.netlify/functions/firestore-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load-inbox' }),
    });
    const fsData = await fsRes.json();

    if (fsData.ok && fsData.data && fsData.data.conversations) {
      const incoming = fsData.data.conversations;

      // Invalidate thread cache for convs with new messages
      incoming.forEach(c => {
        const prev = _smsConvs.find(p => p.phone === c.phone);
        if (prev && prev.lastMessageAt !== c.lastMessageAt) {
          delete _smsThreads[c.phone];
          if (_smsActiveConv && _smsActiveConv.phone === c.phone) {
            _smsActiveConv = c;
            smsLoadThread(c.phone);
          }
        }
      });

      _smsConvs  = incoming;
      _smsLoaded = true;
      smsApplyFilter();
      smsUpdateBadge(_smsConvs);
      smsRefreshKanbanBadges();
    } else if (isFirst) {
      document.getElementById('smsConvItems').innerHTML = '<div class="sms-conv-empty">No conversations yet</div>';
    }
  } catch (e) {
    if (isFirst) document.getElementById('smsConvItems').innerHTML = '<div class="sms-conv-empty">Could not load messages</div>';
  }
}

function smsRenderConvList(convs) {
  const el = document.getElementById('smsConvItems');
  if (!convs.length) {
    el.innerHTML = '<div class="sms-conv-empty">No conversations yet</div>';
    return;
  }
  // Already sorted by server (most recent first)
  el.innerHTML = convs.map(c => {
    const unread  = c.unread || 0;
    const preview = escHtmlSms((c.lastMessageBody || '—').slice(0, 60));
    const time    = c.lastMessageAt ? smsFmtTime(c.lastMessageAt) : '';
    const active  = _smsActiveConv && _smsActiveConv.phone === c.phone ? 'active' : '';
    const dirArrow = c.lastMessageDirection === 'out' ? '↑ ' : '';
    const displayName = c.customerName || (c.jobId && (jobs.find(j => j.jobId === c.jobId) || {}).name) || c.phone || 'Unknown';
    const metaLine = c.jobId
      ? `${escHtmlSms(c.jobId)} · ${escHtmlSms(c.phone || '')}`
      : `${escHtmlSms(c.phone || '')} · no job linked`;
    return `<div class="sms-conv-item ${active} ${unread ? 'unread' : ''}" onclick="smsOpenConv('${c.phone}')">
      <div class="sms-conv-item-top">
        <span class="sms-conv-name">${escHtmlSms(displayName)}</span>
        <span class="sms-conv-time">${time}</span>
      </div>
      <div class="sms-conv-item-bottom">
        <span class="sms-conv-preview">${dirArrow}${preview}</span>
        ${unread ? `<span class="sms-conv-unread">${unread}</span>` : ''}
      </div>
      <div class="sms-conv-meta">${metaLine}</div>
    </div>`;
  }).join('');
}

function smsSetFilter(f) {
  _smsFilter = f;
  ['all','unread','needs'].forEach(id => {
    const btn = document.getElementById('smsFilter' + id.charAt(0).toUpperCase() + id.slice(1));
    if (btn) btn.classList.toggle('active', id === f);
  });
  smsApplyFilter();
}

function smsFilterConvs(q) {
  _smsSearch = q;
  smsApplyFilter();
}

function smsApplyFilter() {
  let convs = _smsConvs;
  // Search
  if (_smsSearch) {
    const lq = _smsSearch.toLowerCase();
    convs = convs.filter(c =>
      (c.customerName || '').toLowerCase().includes(lq) ||
      (c.jobId        || '').toLowerCase().includes(lq) ||
      (c.phone        || '').includes(lq)
    );
  }
  // Filter
  if (_smsFilter === 'unread') convs = convs.filter(c => (c.unread || 0) > 0);
  if (_smsFilter === 'needs')  convs = convs.filter(c => c.lastMessageDirection === 'in');
  smsRenderConvList(convs);
}

async function smsOpenConv(phone) {
  const conv = _smsConvs.find(c => c.phone === phone);
  if (!conv) return;
  _smsActiveConv = conv;

  // Mark as read in UI immediately
  conv.unread = 0;
  smsRenderConvList(_smsConvs);
  smsUpdateBadge(_smsConvs);

  // Mark as read on server — Firestore only
  fetch('/.netlify/functions/firestore-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mark-read', phone }),
  }).catch(() => {});

  // Show thread panel
  document.getElementById('smsThreadEmpty').style.display = 'none';
  document.getElementById('smsThreadWrap').style.display  = 'flex';

  // Header
  const job = conv.jobId ? jobs.find(j => j.jobId === conv.jobId) : null;
  const headerName = conv.customerName || (job || {}).name || phone;
  document.getElementById('smsThreadHeader').innerHTML = `
    <div class="sms-thread-header-info">
      <div class="sms-thread-name">${escHtmlSms(headerName)}</div>
      <div class="sms-thread-sub">${escHtmlSms(phone)}${conv.jobId ? ' · ' + escHtmlSms(conv.jobId) : ''}</div>
    </div>
    ${job ? `<button class="sms-thread-open-job" onclick="showDetail('${conv.jobId}')">Open Job</button>` : ''}`;

  await smsLoadThread(phone);
  document.getElementById('smsComposeText').focus();
  smsInitQuickReplies();
}

async function smsLoadThread(phone) {
  const msgEl = document.getElementById('smsThreadMessages');
  if (!msgEl) return;

  if (_smsThreads[phone]) {
    smsRenderThread(_smsThreads[phone]);
    return;
  }

  msgEl.innerHTML = '<div class="sms-thread-no-msgs" style="opacity:0.5">Loading…</div>';
  try {
    const fsRes  = await fetch('/.netlify/functions/firestore-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load-thread', phone }),
    });
    const fsData = await fsRes.json();
    if (fsData.ok && fsData.data) {
      _smsThreads[phone] = fsData.data;
      smsRenderThread(fsData.data);
    } else {
      msgEl.innerHTML = '<div class="sms-thread-no-msgs">No messages yet — send the first one below</div>';
    }
  } catch (e) {
    msgEl.innerHTML = '<div class="sms-thread-no-msgs">Could not load messages</div>';
  }
}

function smsRenderThread(msgs) {
  const el = document.getElementById('smsThreadMessages');
  if (!msgs || !msgs.length) {
    el.innerHTML = '<div class="sms-thread-no-msgs">No messages yet — send the first one below</div>';
    return;
  }
  el.innerHTML = msgs.map(m => {
    const statusLabel = m.direction === 'out'
      ? m.failed ? '<span class="sms-msg-status failed">✗ Failed</span>'
                 : '<span class="sms-msg-status sent">✓ Sent</span>'
      : '<span class="sms-msg-status received">Received</span>';
    const imageHtml = m.mediaUrl
      ? `<img class="sms-msg-image" src="${escHtmlSms(m.mediaUrl)}" onclick="window.open('${escHtmlSms(m.mediaUrl)}','_blank')" alt="attached image">`
      : '';
    const textHtml = m.body ? escHtmlSms(m.body).replace(/\n/g, '<br>') : '';
    return `<div class="sms-msg sms-msg-${m.direction || 'in'}${m.failed ? ' sms-msg-failed' : ''}">
      <div class="sms-msg-bubble${m.mediaUrl ? ' has-image' : ''}">${imageHtml}${textHtml}</div>
      <div class="sms-msg-time">${smsFmtTime(m.timestamp)} ${statusLabel}</div>
    </div>`;
  }).join('');
  setTimeout(() => { el.scrollTop = el.scrollHeight; }, 30);
}

// Quick reply templates — injected into compose box on click
const SMS_QUICK_REPLIES = [
  { label: 'Received',         text: "Hi, we've received your device and it's now in our queue for inspection. We'll be in touch shortly with an update." },
  { label: 'Inspection done',  text: "Hi, we've completed the inspection on your device. We'll send through the report and repair quote shortly." },
  { label: 'Parts ordered',    text: "Hi, parts for your repair have been ordered. We'll update you as soon as they arrive." },
  { label: 'Parts arrived',    text: "Hi, the parts for your repair have arrived and we'll be getting started shortly." },
  { label: 'Repair complete',  text: "Hi, great news — your device has been repaired and is ready for collection. Our workshop is open Mon, Wed, Fri 10am–5pm and Sat 10am–2pm. Please bring your receipt." },
  { label: 'Ready to collect', text: "Hi, just a reminder that your device is ready for collection at Logic One SA. Let us know if you need to arrange a different time." },
  { label: 'Delay update',     text: "Hi, we wanted to let you know there's been a slight delay with your repair. We'll keep you updated and apologise for the inconvenience." },
];

function smsInitQuickReplies() {
  const chips = document.getElementById('smsQrChips');
  if (!chips) return;
  chips.innerHTML = SMS_QUICK_REPLIES.map((r, i) =>
    `<button class="sms-qr-chip" onclick="smsInsertQuickReply(${i})">${escHtmlSms(r.label)}</button>`
  ).join('');
}

function smsInsertQuickReply(index) {
  const r = SMS_QUICK_REPLIES[index];
  if (!r) return;
  const ta = document.getElementById('smsComposeText');
  if (!ta) return;
  ta.value = r.text;
  smsComposeResize(ta);
  ta.focus();
}

// Resize + compress an image client-side before sending as MMS, so it
// comfortably fits under Firestore's ~1MiB document limit (base64 adds
// roughly a third on top of the raw bytes, so keep the source modest).
function jsResizeImageForMms(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image'));
      img.onload = () => {
        const MAX_DIM = 1280;
        let width = img.width, height = img.height;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 900000 && quality > 0.4) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Uploads a resized image to sms-media.js and returns its public URL
async function jsUploadSmsMedia(dataUrl) {
  const res = await fetch('/.netlify/functions/sms-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'store', dataUrl }),
  }).then(r => r.json());
  if (!res.ok) throw new Error(res.error || 'Image upload failed');
  return res.url;
}

let _smsThreadAttachedImage = null; // resized data URL, or null

async function smsThreadHandleImage(file) {
  if (!file) return;
  const preview = document.getElementById('smsThreadImagePreview');
  preview.style.display = 'flex';
  preview.innerHTML = '<span>Preparing image…</span>';
  try {
    _smsThreadAttachedImage = await jsResizeImageForMms(file);
    preview.innerHTML = `<img src="${_smsThreadAttachedImage}"><span>Image attached</span>
      <button class="sms-attach-preview-remove" onclick="smsRemoveThreadAttachment()" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
  } catch (e) {
    preview.style.display = 'none';
    showToast('error', 'Could not attach image: ' + e.message);
  }
  document.getElementById('smsThreadImageInput').value = '';
}

function smsRemoveThreadAttachment() {
  _smsThreadAttachedImage = null;
  const preview = document.getElementById('smsThreadImagePreview');
  preview.style.display = 'none';
  preview.innerHTML = '';
}

async function smsThreadSend() {
  if (!_smsActiveConv) return;
  const textarea = document.getElementById('smsComposeText');
  const text = textarea.value.trim();
  const attachedImage = _smsThreadAttachedImage;
  if (!text && !attachedImage) return;

  const btn = document.getElementById('smsThreadSendBtn');
  btn.disabled = true;
  textarea.disabled = true;

  try {
    let mediaUrl = null;
    if (attachedImage) {
      btn.title = 'Uploading image…';
      mediaUrl = await jsUploadSmsMedia(attachedImage);
    }

    const res = await fetch('/.netlify/functions/sms-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to:           _smsActiveConv.phone,
        body:         text,
        mediaUrl:     mediaUrl,
        jobId:        _smsActiveConv.jobId || null,
        customerName: _smsActiveConv.customerName || '',
      }),
    });
    const data = await res.json();

    if (data.ok) {
      const phone = _smsActiveConv.phone;
      const msg   = { direction: 'out', body: text, mediaUrl, timestamp: new Date().toISOString(), msgSid: data.sid || '', read: true };

      // Add to thread cache
      if (!_smsThreads[phone]) _smsThreads[phone] = [];
      _smsThreads[phone].push(msg);
      smsRenderThread(_smsThreads[phone]);

      // Update conversation list metadata
      let conv = _smsConvs.find(c => c.phone === phone);
      if (!conv) {
        conv = { ..._smsActiveConv, unread: 0 };
        _smsConvs.unshift(conv);
      }
      conv.lastMessageAt        = msg.timestamp;
      conv.lastMessageBody      = mediaUrl ? '📷 Image' : text.slice(0, 100);
      conv.lastMessageDirection = 'out';
      smsRenderConvList(_smsConvs);

      textarea.value = '';
      textarea.style.height = '';
      smsRemoveThreadAttachment();
      showToast('success', '✓ SMS sent');
    } else {
      // Show failed message bubble in thread
      const phone = _smsActiveConv.phone;
      const failedMsg = { direction: 'out', body: text, mediaUrl, timestamp: new Date().toISOString(), failed: true, read: true };
      if (!_smsThreads[phone]) _smsThreads[phone] = [];
      _smsThreads[phone].push(failedMsg);
      smsRenderThread(_smsThreads[phone]);
      showToast('error', 'Failed: ' + (data.error || 'Unknown error'));
    }
  } catch (e) {
    showToast('error', 'SMS error: ' + e.message);
  } finally {
    btn.disabled  = false;
    btn.title = '';
    textarea.disabled = false;
    textarea.focus();
  }
}

function smsComposeResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function smsComposeKeydown(e) {
  // Cmd+Enter or Ctrl+Enter to send
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    smsThreadSend();
  }
}

// ── New Message (send to any number, not just an existing conversation) ──
let _smsNewMsgAttachedImage = null;

function smsOpenComposeNew() {
  document.getElementById('smsNewPhone').value = '';
  document.getElementById('smsNewText').value = '';
  document.getElementById('smsNewMsgError').style.display = 'none';
  smsRemoveNewMsgAttachment();
  openModal('smsNewMsgModal');
  setTimeout(() => document.getElementById('smsNewPhone').focus(), 50);
}

async function smsNewMsgHandleImage(file) {
  if (!file) return;
  const preview = document.getElementById('smsNewImagePreview');
  preview.style.display = 'flex';
  preview.innerHTML = '<span>Preparing image…</span>';
  try {
    _smsNewMsgAttachedImage = await jsResizeImageForMms(file);
    preview.innerHTML = `<img src="${_smsNewMsgAttachedImage}"><span>Image attached</span>
      <button class="sms-attach-preview-remove" onclick="smsRemoveNewMsgAttachment()" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
  } catch (e) {
    preview.style.display = 'none';
    showToast('error', 'Could not attach image: ' + e.message);
  }
  document.getElementById('smsNewImageInput').value = '';
}

function smsRemoveNewMsgAttachment() {
  _smsNewMsgAttachedImage = null;
  const preview = document.getElementById('smsNewImagePreview');
  if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
}

async function smsSendNewMessage() {
  const phoneInput = document.getElementById('smsNewPhone');
  const textInput  = document.getElementById('smsNewText');
  const errDiv     = document.getElementById('smsNewMsgError');
  const phone = phoneInput.value.trim();
  const text  = textInput.value.trim();
  const attachedImage = _smsNewMsgAttachedImage;
  errDiv.style.display = 'none';

  if (!phone) {
    errDiv.textContent = 'Enter a phone number';
    errDiv.style.display = 'block';
    return;
  }
  if (!text && !attachedImage) {
    errDiv.textContent = 'Enter a message or attach an image';
    errDiv.style.display = 'block';
    return;
  }

  const btn = document.getElementById('smsNewMsgSendBtn');
  btn.disabled = true;
  btn.textContent = attachedImage ? 'Uploading image…' : 'Sending…';

  try {
    let mediaUrl = null;
    if (attachedImage) mediaUrl = await jsUploadSmsMedia(attachedImage);

    btn.textContent = 'Sending…';
    const res = await fetch('/.netlify/functions/sms-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, body: text, mediaUrl }),
    });
    const data = await res.json();

    if (!data.ok) {
      errDiv.textContent = 'Failed: ' + (data.error || 'Unknown error');
      errDiv.style.display = 'block';
      return;
    }

    showToast('success', '✓ SMS sent');
    closeModal('smsNewMsgModal');

    // Refresh the inbox so the new (or existing) conversation shows up,
    // then open it directly
    await smsInboxRefresh();
    const normPhone = data.to || phone;
    const conv = _smsConvs.find(c => c.phone === normPhone);
    if (conv) smsOpenConv(conv.phone);
  } catch (e) {
    errDiv.textContent = 'Error: ' + e.message;
    errDiv.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send';
  }
}

function smsUpdateBadge(convs) {
  // Unread count comes from server-side index — survives page reloads
  const unread = convs.reduce((n, c) => n + (c.unread || 0), 0);
  const badge  = document.getElementById('smsBadge');
  if (!badge) return;
  if (unread > 0) {
    badge.textContent = unread;
    badge.style.display = '';
    badge.style.background = '#ef4444';
    badge.style.color = '#fff';
  } else {
    badge.style.display = 'none';
  }
}

// Periodically poll for new inbound messages (every 30s)
// Refreshes the inbox and kanban badges regardless of which view is active.
// Was 10s — that meant a full, unpaginated scan of sms/_index/conversations
// six times a minute, continuously, every minute the dashboard is open.
// Combined with the leftover jobId-keyed docs from before the phone-key
// migration (never cleaned up), this was almost certainly the single
// biggest contributor to the RESOURCE_EXHAUSTED quota errors.
setInterval(async () => {
  await smsInboxRefresh();
  smsRefreshKanbanBadges();
}, 30000);

// Immediate refresh when returning to the tab — catches replies that
// arrived while the dashboard was backgrounded
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    smsInboxRefresh().then(() => smsRefreshKanbanBadges());
  }
});

// Refresh SMS unread badges on all visible kanban cards
function smsRefreshKanbanBadges() {
  if (typeof _smsConvs === 'undefined' || !_smsConvs.length) return;
  document.querySelectorAll('.kanban-card').forEach(card => {
    const jobId = card.dataset.jobId;
    if (!jobId) return;
    const conv = _smsConvs.find(c => c.jobId === jobId);
    const n    = conv ? (conv.unread || 0) : 0;
    let badge  = card.querySelector('.card-sms-badge');
    if (n > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'card-sms-badge';
        badge.onclick = e => {
          e.stopPropagation();
          switchView('sms');
          const c = _smsConvs.find(x => x.jobId === jobId);
          if (c) setTimeout(() => smsOpenConv(c.phone), 100);
        };
        const top = card.querySelector('.card-top');
        if (top) top.appendChild(badge);
      }
      badge.textContent = n;
    } else if (badge) {
      badge.remove();
    }
  });
}

function escHtmlSms(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function smsFmtTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit' });
    return d.toLocaleDateString('en-AU', { day:'numeric', month:'short' });
  } catch { return ''; }
}
