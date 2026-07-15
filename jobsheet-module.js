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
.js-sheet-wrap { flex: 1; min-width: 0; }
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
.js-summary-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.js-badge-sm { padding: 2px 8px; font-size: 9px; flex-shrink: 0; }
.js-header-ids { display: flex; gap: 24px; flex-wrap: wrap; }
.js-id-block { }
.js-id-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 3px; }
.js-id-val { font-size: 13px; font-weight: 700; font-family: 'Orbitron', sans-serif; letter-spacing: 0.3px; }

.js-summary-ids { display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-start; }
.js-summary-id-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 2px; }
.js-summary-id-row { display: flex; align-items: center; gap: 4px; }
.js-summary-id-val { font-size: 12px; font-weight: 700; font-family: 'Orbitron', sans-serif; letter-spacing: 0.3px; }
.js-copy-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 4px; border: none; background: transparent;
  color: var(--text-secondary); cursor: pointer; padding: 0; flex-shrink: 0;
}
.js-copy-btn:hover { background: var(--bg-surface-hover); color: var(--accent); }
.js-copy-btn.copied { color: #10b981; }
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

/* ===== STICKY SUMMARY BAR ===== */
.js-summary-bar {
  position: sticky; top: 0; z-index: 9;
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 14px 28px; margin-bottom: 14px;
  display: flex; flex-direction: column; gap: 16px;
}
.js-summary-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.js-summary-id-group { display: flex; align-items: center; gap: 12px; min-width: 0; }
.js-summary-avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  background: rgba(0,180,216,0.12); color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; font-family: 'Inter', sans-serif;
}
.js-summary-name { font-size: 14px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.js-summary-sub { font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.js-summary-status-row { display: flex; gap: 6px; flex-wrap: wrap; }
.js-summary-status-row .js-status-pill { padding: 5px 12px; font-size: 11px; }

/* ===== JOB SHEET NAV RAIL ===== */
.js-sheet-layout { display: flex; align-items: flex-start; gap: 24px; }
.js-nav-rail { width: 168px; flex-shrink: 0; position: sticky; top: 100px; padding: 12px 0; }
.js-nav-link {
  padding: 7px 10px; font-size: 12px; color: var(--text-secondary);
  border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.js-nav-link:hover { background: var(--bg-surface-hover); color: var(--text-primary); }
.js-nav-link.active { background: rgba(0,180,216,0.1); color: var(--accent); font-weight: 600; }
@media (max-width: 900px) { .js-nav-rail { display: none; } }

/* ===== COMMUNICATIONS (SMS) ===== */
.js-comms-thread { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 10px; margin-bottom: 12px; border: 1px solid var(--border-light); border-radius: var(--radius-md); }
.js-comms-empty { padding: 20px; text-align: center; color: var(--text-secondary); font-size: 12.5px; }
.js-comms-msg { max-width: 75%; padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; word-break: break-word; }
.js-comms-msg-in { align-self: flex-start; background: var(--bg-surface-hover); }
.js-comms-msg-out { align-self: flex-end; background: rgba(0,180,216,0.12); }
.js-comms-msg-time { font-size: 10px; color: var(--text-secondary); margin-top: 3px; }
.js-comms-compose { display: flex; gap: 8px; align-items: flex-end; }
.js-comms-compose textarea { flex: 1; min-height: 44px; max-height: 100px; resize: vertical; }

/* ===== QUOTE / INVOICE SENT TRACKING ===== */
.js-sent-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.js-sent-toggle {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
  font-size: 12px; font-weight: 500; border-radius: 20px; cursor: pointer;
  border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-secondary);
}
.js-sent-toggle.sent { background: rgba(5,150,105,0.1); border-color: rgba(5,150,105,0.3); color: #065f46; }
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
        jsUpdateNavActive();
      });
    }

    // Jump nav: click a link, smooth-scroll the section under the sticky bars
    document.querySelectorAll('.js-nav-link').forEach(link => {
      link.addEventListener('click', () => jsScrollToSection(link.dataset.jump));
    });
  });
})();

const JS_NAV_SECTIONS = ['jsSecCustomer','jsSecComms','jsSecService','jsSecGoods','jsSecNotes','jsSecParts','jsSecCost','jsSecRemarks','jsSecStatus','jsZohoCard','jsPhotosCard'];

function jsScrollToSection(id) {
  const area = document.getElementById('jsScrollArea');
  const target = document.getElementById(id);
  const bar = document.getElementById('jsSummaryBar');
  if (!area || !target) return;
  const areaRect = area.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const barHeight = bar ? bar.offsetHeight : 0;
  const offset = targetRect.top - areaRect.top + area.scrollTop - barHeight - 12;
  area.scrollTo({ top: offset, behavior: 'smooth' });
}

// The summary bar's height isn't fixed (wraps differently at different
// widths, content changes per job) — keep the nav rail's sticky offset
// matched to it so the rail never sits under or floating below the bar.
function jsSyncStickyOffsets() {
  const bar  = document.getElementById('jsSummaryBar');
  const rail = document.getElementById('jsNavRail');
  if (bar && rail) rail.style.top = bar.offsetHeight + 'px';
}
window.addEventListener('resize', jsSyncStickyOffsets);

function jsUpdateNavActive() {
  const area = document.getElementById('jsScrollArea');
  if (!area) return;
  const areaRect = area.getBoundingClientRect();
  let current = null;
  JS_NAV_SECTIONS.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.offsetParent === null) return; // skip hidden sections
    const top = el.getBoundingClientRect().top - areaRect.top;
    if (top <= 80) current = id;
  });
  document.querySelectorAll('.js-nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.jump === current);
  });
}

// ============================================================
// STATE
// ============================================================
let jsParts = [];
let jsCurrentJob = null;

const STATUS_ORDER = ['Intake','Diagnosis','Awaiting Parts','In Repair','Testing','Complete','Collected'];

// The furthest-along status in STATUS_ORDER that actually has a recorded
// timestamp — this is the real current status, since progressing a job
// always writes a new timestamp entry, even when the full jobsheet form
// itself doesn't get re-saved (e.g. status changed via kanban drag).
function jsLatestStatusFromTimestamps(timestamps) {
  if (!timestamps) return null;
  let latest = null;
  STATUS_ORDER.forEach(s => { if (timestamps[s]) latest = s; });
  return latest;
}

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

// Shared helper for all Firestore jobsheet calls (load / save / timestamps).
// Never throws — callers just check result.ok.
async function fsJobsheet(action, payload) {
  try {
    const res = await fetch('/.netlify/functions/firestore-jobsheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action }, payload))
    });
    return await res.json();
  } catch (e) {
    console.warn('firestore-jobsheet ' + action + ' error:', e);
    return { ok: false, error: e.message };
  }
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

  // Init photo/video upload panel
  if (typeof jsPhotoInit === 'function') {
    jsPhotoInit(j);
    // If driveFolder is missing (new job, folder still being created),
    // poll the sheet once after 15s and re-init photos when it appears
    if (!j.driveFolder || !String(j.driveFolder).includes('drive.google.com')) {
      setTimeout(async () => {
        if (typeof fetchSheet === 'function') await fetchSheet();
        const fresh = (typeof jobs !== 'undefined') && jobs.find(x => x.jobId === jobId);
        if (fresh && fresh.driveFolder && String(fresh.driveFolder).includes('drive.google.com')) {
          jsCurrentJob.driveFolder = fresh.driveFolder;
          jsPhotoInit(fresh);
        }
      }, 15000);
    }
  }

  // Populate read-only intake fields immediately
  jsPopulateIntake(j);
  jsUpdateScooterChecklist(j.deviceType || '');
  jsLoadComms(j);
  jsApplySentToggles(j);
  requestAnimationFrame(jsSyncStickyOffsets);

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

  // Show loading overlay
  jsShowLoadingOverlay('Loading job sheet…');

  let driveDataLoaded = false;

  // Step 1: Load timestamps — Firestore first, Apps Script/Drive fallback
  let tsFromFirestore = false;
  const fsTs = await fsJobsheet('timestamps-load', { jobId });
  if (fsTs.ok && fsTs.data) {
    j.statusTimestamps = Object.assign({}, j.statusTimestamps || {}, fsTs.data);
    jsRenderTimeline(j);
    tsFromFirestore = true;
  }

  if (!tsFromFirestore && cfg.appsScriptUrl && j.driveFolder) {
    try {
      const tsResult = await callScript({ action: 'loadTimestamps', jobId, driveFolder: j.driveFolder });
      if (tsResult.ok && tsResult.data) {
        j.statusTimestamps = Object.assign({}, j.statusTimestamps || {}, tsResult.data);
        jsRenderTimeline(j);
      } else {
        console.log('loadTimestamps:', tsResult);
      }
    } catch(e) { console.warn('loadTimestamps error:', e); }
  }

  // Step 2: Load saved job sheet — Firestore first, Apps Script/Drive fallback
  jsShowLoadingOverlay('Loading saved data…');
  const fsSheet = await fsJobsheet('load', { jobId });
  if (fsSheet.ok && fsSheet.data) {
    const saved = fsSheet.data;
    if (saved.statusTimestamps) {
      j.statusTimestamps = Object.assign({}, saved.statusTimestamps, j.statusTimestamps);
      jsRenderTimeline(j);
    }
    jsLoadFromData(saved);
    jsSetSaveIndicator(true, saved._savedAt || saved.savedAt);
    driveDataLoaded = true;
  }

  if (!driveDataLoaded && cfg.appsScriptUrl && j.driveFolder) {
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
  }

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
  // Cancel any pending copy-button revert from a previously open job, and
  // reset both buttons to their plain state — otherwise a checkmark left
  // over from copying the last job's ID can appear to belong to this one.
  Object.values(jsCopyTimeouts).forEach(clearTimeout);
  jsCopyTimeouts = {};
  document.querySelectorAll('.js-copy-btn').forEach(btn => {
    btn.classList.remove('copied');
    btn.innerHTML = JS_COPY_ICON;
  });

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

  // Sticky summary bar
  const nameEl = document.getElementById('jsSummaryName');
  const subEl  = document.getElementById('jsSummarySub');
  const avEl   = document.getElementById('jsSummaryAvatar');
  if (nameEl) nameEl.textContent = j.name || 'Unnamed customer';
  if (subEl)  subEl.textContent  = [j.phone, [j.brand, j.model].filter(Boolean).join(' ')].filter(Boolean).join(' \u00b7 ') || '—';
  if (avEl)   avEl.textContent   = jsInitials(j.name);
}

function jsInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const JS_COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
const JS_CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>';
let jsCopyTimeouts = {}; // elId -> timeout id, so loading a new job can cancel any pending revert

async function jsCopyValue(elId, btn) {
  const el = document.getElementById(elId);
  if (!el) return;
  const text = el.textContent.trim();
  if (!text || text === '—') return;

  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // Clipboard API blocked/unavailable — fall back to a hidden textarea
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e2) { /* give up quietly */ }
    document.body.removeChild(ta);
  }

  if (btn) {
    if (jsCopyTimeouts[elId]) clearTimeout(jsCopyTimeouts[elId]);
    btn.classList.add('copied');
    btn.innerHTML = JS_CHECK_ICON;
    jsCopyTimeouts[elId] = setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = JS_COPY_ICON;
      delete jsCopyTimeouts[elId];
    }, 1200);
  }
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
  document.querySelectorAll('.js-status-pill').forEach(p => p.classList.toggle('active', p.textContent.trim() === (j.status||'Intake')));
  if ((j.warranty||'').toLowerCase().includes('in warranty')) {
    const btn = [...document.querySelectorAll('.js-svc-btn')].find(b => b.textContent.includes('In Warranty'));
    if (btn) jsSetSvc(btn, 'In Warranty Repair');
  }
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
  'Level 0':  'Minor / no-parts fix; cleaning, resets, firmware, cosmetic adjustments',
  'Level 1':  'External works only; adjustments, external parts, machinery',
  'Level 2':  'Internal repairs; PCB, motors, batteries, front fork',
  'Level 3':  'Full disassembly; frame & structural parts, 2+ major errors',
};
let REPAIR_LEVEL_COSTS = {
  'Level 0':  65,
  'Level 1':  85,
  'Level 2':  100,
  'Level 3':  125,
};

// Old jobs may still have a saved value like "Level 1 — $85" from before
// prices were dropped from the label. Strip that suffix so they still
// match a real <option> in the dropdown instead of showing blank.
function jsNormaliseRepairLevel(val) {
  if (!val) return val;
  return String(val).replace(/\s*—\s*\$\d+(?:\.\d+)?\s*$/, '').trim();
}

// Load costs.json — Firestore first (fast, no Apps Script cold start),
// then still refresh from Drive in the background since that's the file
// Nisal actually edits. Whatever Drive returns gets pushed to Firestore
// so the next lookup is fast too.
function jsApplyCostsData(data) {
  if (!data || !data.repairLevels) return;
  Object.entries(data.repairLevels).forEach(([label, obj]) => {
    REPAIR_LEVEL_COSTS[label] = typeof obj === 'object' ? obj.cost : obj;
    if (typeof obj === 'object' && obj.description) {
      REPAIR_LEVEL_HINTS[label] = obj.description;
    }
  });
}

async function jsLoadCosts() {
  try {
    const fsRes = await fetch('/.netlify/functions/firestore-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load' })
    }).then(r => r.json());
    if (fsRes.ok && fsRes.data) jsApplyCostsData(fsRes.data);
  } catch (e) { /* fall through to Drive */ }

  if (!cfg || !cfg.appsScriptUrl || typeof callScript !== 'function') return;
  try {
    const res = await callScript({ action: 'loadCosts' });
    if (res && res.ok && res.data && res.data.repairLevels) {
      jsApplyCostsData(res.data);
      // Sync back to Firestore for next time — fire and forget
      fetch('/.netlify/functions/firestore-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', data: res.data })
      }).catch(() => {});
    }
  } catch (e) { /* keep whatever we already have */ }
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
  // Update Zoho card — invoice visibility depends on service type
  jsUpdateZohoCard(jsCurrentJob);
}

async function jsSetStatus(el) {
  const newStatus = el.textContent.trim();
  document.querySelectorAll('.js-status-pill').forEach(p => p.classList.toggle('active', p.textContent.trim() === newStatus));
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
      document.querySelectorAll('.js-status-pill').forEach(p => p.classList.toggle('active', p.textContent.trim() === oldStatus));
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

    // Dual-write timestamps to Firestore too (doesn't need driveFolder)
    fsJobsheet('timestamps-save', {
      jobId: jsCurrentJob.jobId,
      timestamps: jsCurrentJob.statusTimestamps
    });

    if (typeof maybeClearQrToken === 'function') maybeClearQrToken(jsCurrentJob.jobId, newStatus);
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
    warranty: j.warranty||'', receiveMethod: j.receiveMethod||'', issue: j.issue||'', driveFolder: j.driveFolder||'',
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
  if (repLvl) { repLvl.value = jsNormaliseRepairLevel(data.repairLevel) || ''; jsUpdateRepairLevelHint(); }

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

  // Timestamps — Drive timestamps.json already merged into jsCurrentJob before this runs
  // Only apply saved timestamps for statuses not already in Drive data
  if (data.statusTimestamps && jsCurrentJob) {
    jsCurrentJob.statusTimestamps = Object.assign({}, data.statusTimestamps, jsCurrentJob.statusTimestamps);
  }

  // Status pill — reconcile against timestamps rather than trusting
  // data.status blindly. A status can advance via kanban drag (which
  // updates the Sheet + timestamps) without the jobsheet ever being
  // re-saved, so data.status here can be stale. The furthest-along status
  // that actually has a recorded timestamp is the real current status.
  const timestampStatus = jsLatestStatusFromTimestamps(jsCurrentJob ? jsCurrentJob.statusTimestamps : null);
  const effectiveStatus = timestampStatus || data.status;
  if (effectiveStatus) {
    const jobInList = (typeof jobs !== 'undefined') && jobs.find(j => j.jobId === jsCurrentJob?.jobId);
    // The Sheet's status column is what isCompleted() and the invoice
    // export actually read — not this jobsheet JSON. If what we just
    // reconciled doesn't match what the Sheet has on file, this job would
    // silently keep failing isCompleted() checks (and stay off invoices)
    // even though the display now looks correct. Push the correction back.
    const sheetStatus = jobInList ? jobInList.status : null;
    if (sheetStatus && sheetStatus !== effectiveStatus && cfg && cfg.appsScriptUrl) {
      callScript({ action: 'updateStatus', jobId: jsCurrentJob.jobId, status: effectiveStatus })
        .then(res => {
          if (res && res.ok) {
            console.log(`jobsheet: corrected stale Sheet status for ${jsCurrentJob.jobId}: "${sheetStatus}" → "${effectiveStatus}"`);
            if (typeof maybeClearQrToken === 'function') maybeClearQrToken(jsCurrentJob.jobId, effectiveStatus);
          } else {
            console.warn('jobsheet: Sheet status auto-correction failed:', res);
          }
        })
        .catch(e => console.warn('jobsheet: Sheet status auto-correction error:', e));
    }
    if (jsCurrentJob) jsCurrentJob.status = effectiveStatus;
    if (jobInList) jobInList.status = effectiveStatus;
    document.querySelectorAll('.js-status-pill').forEach(p => p.classList.toggle('active', p.textContent.trim() === effectiveStatus));
  } else {
    document.querySelectorAll('.js-status-pill').forEach(p => p.classList.remove('active'));
  }
  if (jsCurrentJob) jsRenderTimeline(jsCurrentJob);

  jsRenderParts();
  jsCalcCost();
}

// ── Save overlay ─────────────────────────────────────────────
function jsSaveOverlayShow(msg) {
  // Use fixed positioning sized to the panel's bounding rect so overflow:hidden
  // on the panel doesn't clip it. Overlay is appended to document.body.
  const panel = document.getElementById('view-jobsheet') ||
                document.getElementById('jobsheetPanel') ||
                document.querySelector('.js-panel');

  let overlay = document.getElementById('jsSaveOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'jsSaveOverlay';
    overlay.className = 'js-save-overlay';
    overlay.innerHTML = `
      <div class="js-save-overlay-spinner"></div>
      <div class="js-save-overlay-msg" id="jsSaveOverlayMsg">${msg || 'Saving…'}</div>`;
    document.body.appendChild(overlay);
  } else {
    const msgEl = document.getElementById('jsSaveOverlayMsg');
    if (msgEl) msgEl.textContent = msg || 'Saving…';
  }

  // Position to cover the panel exactly
  if (panel) {
    const r = panel.getBoundingClientRect();
    overlay.style.position = 'fixed';
    overlay.style.top      = r.top  + 'px';
    overlay.style.left     = r.left + 'px';
    overlay.style.width    = r.width  + 'px';
    overlay.style.height   = r.height + 'px';
    overlay.style.inset    = '';
  } else {
    overlay.style.position = 'fixed';
    overlay.style.inset    = '0';
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

      // Dual-write the jobsheet to Firestore too
      const fsSaveResult = await fsJobsheet('save', { jobId: data.jobId, data });
      const firestoreSaveOk = !!fsSaveResult.ok;
      if (!firestoreSaveOk) console.warn('Firestore save failed:', fsSaveResult);

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

      if (!syncResult.ok && !firestoreSaveOk) {
        showToast('success', 'Saved to Drive (sheet sync + Firestore both failed)');
      } else if (!syncResult.ok) {
        // Non-fatal — Drive save succeeded, sheet sync failed
        showToast('success', 'Saved to Drive (sheet sync failed — ' + syncResult.error + ')');
      } else if (!firestoreSaveOk) {
        showToast('success', 'Saved to Drive (Firestore sync failed)');
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

// Show Zoho card based on service type selection:
// - Quote: always visible (warranty void cases need a quote even on in-warranty jobs)
// - Invoice: only for No Warranty Repair (chargeable jobs)
function jsUpdateZohoCard(j) {
  const card = document.getElementById('jsZohoCard');
  if (!card) return;
  card.style.display = 'block';

  const svcType = (document.getElementById('jsFSvcType') || {}).value || (j && j.svcType) || '';
  const isChargeable = svcType === 'No Warranty Repair';

  const invoiceBtn = document.getElementById('jsZohoBtnInvoice');
  if (invoiceBtn) invoiceBtn.style.display = isChargeable ? '' : 'none';

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

// ============================================================
// COMMUNICATIONS — per-job SMS thread, keyed by phone (same
// Firestore backend as the main SMS inbox)
// ============================================================
function jsEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function jsLoadComms(job) {
  jsRenderSmsTemplates(job);
  const box = document.getElementById('jsCommsThread');
  if (!box) return;
  if (!job || !job.phone) {
    box.innerHTML = '<div class="js-comms-empty">No phone number on this job</div>';
    return;
  }
  box.innerHTML = '<div class="js-comms-empty">Loading…</div>';
  try {
    const res = await fetch('/.netlify/functions/firestore-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load-thread', phone: job.phone })
    }).then(r => r.json());
    jsRenderCommsThread(res.ok ? res.data : []);
    // Mark read — fire and forget, also nudges the main SMS badge counts
    fetch('/.netlify/functions/firestore-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-read', phone: job.phone })
    }).catch(() => {});
    if (typeof smsInboxRefresh === 'function') smsInboxRefresh();
  } catch (e) {
    box.innerHTML = '<div class="js-comms-empty">Could not load messages</div>';
  }
}

function jsRenderCommsThread(msgs) {
  const box = document.getElementById('jsCommsThread');
  if (!box) return;
  if (!msgs || !msgs.length) {
    box.innerHTML = '<div class="js-comms-empty">No messages yet — send the first one below</div>';
    return;
  }
  box.innerHTML = msgs.map(m => `
    <div class="js-comms-msg js-comms-msg-${m.direction === 'out' ? 'out' : 'in'}">
      ${jsEsc(m.body || '').replace(/\n/g, '<br>')}
      <div class="js-comms-msg-time">${jsFmtCommsTime(m.timestamp)}</div>
    </div>`).join('');
  box.scrollTop = box.scrollHeight;
}

function jsFmtCommsTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + ' ' +
           d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}

function jsCommsKeydown(e) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    jsCommsSend();
  }
}

async function jsCommsSend() {
  const job = jsCurrentJob;
  const ta  = document.getElementById('jsCommsText');
  const btn = document.getElementById('jsCommsSendBtn');
  if (!job || !ta) return;
  const text = ta.value.trim();
  if (!text) return;
  if (!job.phone) { showToast('error', 'No phone number on this job'); return; }

  btn.disabled = true;
  ta.disabled = true;
  try {
    const res = await fetch('/.netlify/functions/sms-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: job.phone, body: text, jobId: job.jobId, customerName: job.name || '' })
    }).then(r => r.json());
    if (res.ok) {
      ta.value = '';
      await jsLoadComms(job);
      showToast('success', '✓ SMS sent');
    } else {
      showToast('error', 'SMS failed: ' + (res.error || 'Unknown error'));
    }
  } catch (e) {
    showToast('error', 'SMS error: ' + e.message);
  } finally {
    btn.disabled = false;
    ta.disabled = false;
    ta.focus();
  }
}

// ── Quick-send SMS templates ─────────────────────────────────
// Same templates, same wording as the kanban detail modal's SMS panel
// (both call the shared buildSmsTemplates() in dashboard.js) — this just
// renders them right in the jobsheet's Communications tab so sending a
// template doesn't mean leaving the jobsheet. Deliberately its own set
// of ids (jsSms*) rather than reusing the detail modal's smsBtn{i} /
// smsSendBtn{i} / window._smsTemplates — the two views can in principle
// both have template cards in the DOM, and getElementById only ever
// finds one of two same-id elements.
function jsRenderSmsTemplates(job) {
  const wrap = document.getElementById('jsSmsTemplatePanel');
  if (!wrap) return;
  if (!job || typeof buildSmsTemplates !== 'function') { wrap.innerHTML = ''; return; }

  const templates = buildSmsTemplates(job);
  window._jsSmsTemplates = templates; // index -> template lookup for jsCopySmsTemplate/jsSendSmsTemplate

  const sendIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send';
  const copyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy';

  wrap.innerHTML = `
    <div class="sms-panel-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      SMS Templates
    </div>
    <div class="sms-grid">
      ${templates.map((t, i) => {
        const sentAt = (job.smsSentTemplates || {})[t.label];
        const sentBadge = sentAt
          ? `<span class="sms-sent-badge" title="Sent ${fmtDateTime(sentAt)}">✓ Sent ${fmtDate(sentAt)}</span>`
          : '';
        return `
        <div class="sms-card" style="--sms-color:${t.color};--sms-bg:${t.bg};">
          <div class="sms-card-top">
            <div class="sms-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14" style="color:${t.color};">${t.icon}</svg>
              ${t.label}
              ${sentBadge}
            </div>
            <div class="sms-card-actions">
              <button class="sms-copy-btn" onclick="jsCopySmsTemplate(${i})" id="jsSmsCopyBtn${i}">${copyIcon}</button>
              <button class="sms-send-btn" onclick="jsSendSmsTemplate(${i})" id="jsSmsSendBtn${i}">${sendIcon}</button>
            </div>
          </div>
          <div class="sms-text">${jsEsc(t.text)}</div>
        </div>`;
      }).join('')}
    </div>`;
}

async function jsCopySmsTemplate(index) {
  const template = (window._jsSmsTemplates || [])[index];
  if (!template) return;
  try {
    await navigator.clipboard.writeText(template.text);
  } catch (err) {
    const el = document.createElement('textarea');
    el.value = template.text;
    el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    try { document.execCommand('copy'); } catch (e2) { /* give up quietly */ }
    document.body.removeChild(el);
  }
  const btn = document.getElementById('jsSmsCopyBtn' + index);
  if (!btn) return;
  const orig = btn.innerHTML;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
  setTimeout(() => { btn.innerHTML = orig; }, 2500);
}

async function jsSendSmsTemplate(index) {
  const job = jsCurrentJob;
  const template = (window._jsSmsTemplates || [])[index];
  if (!job || !template) return;
  if (!job.phone) { showToast('error', 'No phone number on this job'); return; }

  const btn = document.getElementById('jsSmsSendBtn' + index);
  const sendLabel = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send';
  if (btn) { btn.disabled = true; btn.classList.add('sending'); btn.innerHTML = '⏳ Sending…'; }

  try {
    const res = await fetch('/.netlify/functions/sms-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: job.phone, body: template.text, jobId: job.jobId, customerName: job.name || '' }),
    }).then(r => r.json());

    if (res.ok) {
      showToast('success', `✓ ${template.label} sent to ${job.name}`);
      // Update both the canonical jobs-array record (via markSmsTemplateSent,
      // which also persists to Firestore) and the local jsCurrentJob
      // reference directly, in case they're not the same object — either
      // way the panel re-render below picks up the right "Sent" badge.
      if (typeof markSmsTemplateSent === 'function') markSmsTemplateSent(job.jobId, template.label);
      if (!job.smsSentTemplates) job.smsSentTemplates = {};
      job.smsSentTemplates[template.label] = new Date().toISOString();
      if (typeof renderAll === 'function') renderAll();
      await jsLoadComms(job); // reloads the thread + re-renders templates with the fresh Sent badge
    } else {
      showToast('error', 'SMS failed: ' + (res.error || 'Unknown error'));
      if (btn) { btn.disabled = false; btn.classList.remove('sending'); btn.innerHTML = sendLabel; }
    }
  } catch (e) {
    showToast('error', 'SMS error: ' + e.message);
    if (btn) { btn.disabled = false; btn.classList.remove('sending'); btn.innerHTML = sendLabel; }
  }
}

// ============================================================
// QUOTE / INVOICE SENT TRACKING (out-of-warranty jobs)
// Reuses the same smsSentTemplates map/actions built for the SMS
// template dots — "Quote Sent" / "Invoice Sent" are just two more
// named milestones in the same map, not actual SMS messages.
// ============================================================
function jsApplySentToggles(j) {
  const sent = (j && j.smsSentTemplates) || {};
  jsSetSentToggleState('jsQuoteSentToggle', 'Quote', sent['Quote Sent']);
  jsSetSentToggleState('jsInvoiceSentToggle', 'Invoice', sent['Invoice Sent']);
}

function jsSetSentToggleState(id, label, sentAt) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('sent', !!sentAt);
  const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>';
  el.innerHTML = sentAt
    ? `${check} ${label} sent · ${fmtDate(sentAt)}`
    : `${check} ${label} sent`;
}

function jsToggleSent(template, btnId) {
  const j = jsCurrentJob;
  if (!j) return;
  const el = document.getElementById(btnId);
  const alreadySent = el && el.classList.contains('sent');
  const newSentAt = alreadySent ? '' : new Date().toISOString();
  const label = template === 'Quote Sent' ? 'Quote' : 'Invoice';

  if (!j.smsSentTemplates) j.smsSentTemplates = {};
  j.smsSentTemplates[template] = newSentAt;
  jsSetSentToggleState(btnId, label, newSentAt);
  if (typeof renderAll === 'function') renderAll();

  fetch('/.netlify/functions/firestore-jobsheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mark-sms-sent', jobId: j.jobId, template, sentAt: newSentAt })
  }).catch(e => console.warn('mark-sms-sent error:', e));
}

// ── Scan-to-upload QR (Photos card) ─────────────────────────
// Mints (or reuses) a stable per-job token via qr-photo.js and renders it
// as a QR code pointing at photo-upload.html — a public, unauthenticated
// page scoped to just this job's Inspection/Testing/Shipping folders.
// The token itself never touches this page's markup as plain "trust me",
// it's verified server-side every time the phone side calls in.
async function jsShowQrModal() {
  const job = jsCurrentJob;
  const overlay = document.getElementById('jsQrOverlay');
  const box = document.getElementById('jsQrCodeBox');
  if (!job || !job.driveFolder) { showToast('error', 'Open a job with a Drive folder first'); return; }
  if (!overlay || !box) return;

  overlay.classList.add('show');
  box.innerHTML = '<div style="padding:40px 0;color:#94a3b8;font-size:13px;">Generating…</div>';

  try {
    const res = await fetch('/.netlify/functions/qr-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mint', jobId: job.jobId }),
    }).then(r => r.json());

    if (!res.ok) throw new Error(res.error || 'Could not create link');
    if (typeof QRCode === 'undefined') throw new Error('QR library did not load');

    const url = `${location.origin}/photo-upload.html?job=${encodeURIComponent(job.jobId)}&t=${encodeURIComponent(res.token)}`;
    box.innerHTML = '';
    new QRCode(box, { text: url, width: 200, height: 200, colorDark: '#1a1a2e', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  } catch (err) {
    box.innerHTML = `<div style="padding:16px 8px;color:#dc2626;font-size:13px;">${err.message}</div>`;
  }
}

function jsCloseQrModal() {
  const overlay = document.getElementById('jsQrOverlay');
  if (overlay) overlay.classList.remove('show');
}

async function jsRevokeQrToken() {
  const job = jsCurrentJob;
  if (!job) return;
  if (!confirm(`Revoke the upload link for ${job.jobId}? The current QR code will stop working — you can generate a new one anytime by reopening this panel.`)) return;

  try {
    await fetch('/.netlify/functions/qr-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear', jobId: job.jobId }),
    });
    if (typeof showToast === 'function') showToast('success', 'Upload link revoked');
    jsCloseQrModal();
  } catch (err) {
    if (typeof showToast === 'function') showToast('error', 'Could not revoke link: ' + err.message);
  }
}