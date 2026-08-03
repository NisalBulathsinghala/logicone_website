/* ============================================================
   Logic One SA — SMS & Call Module
   ------------------------------------------------------------
   Replaces the copy-only SMS template panel in the detail modal
   with live Send buttons (via Twilio) and a Call button.

   Public API:
     window.smsModuleInit(job)   — call from showDetail() to wire up panel
     window.smsSend(index, job)  — send a single template SMS
     window.callInitiate(job)    — initiate bridged call to customer

   Depends on: showToast() (dashboard.js global)
   ============================================================ */

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────
  // Set to false to hide Send buttons and fall back to copy-only.
  // Flip to true once Twilio env vars are configured in Netlify.
  const TWILIO_ENABLED = true;

  // ── Styles ────────────────────────────────────────────────────
  (function injectStyles() {
    if (document.getElementById('lo-sms-styles')) return;
    const s = document.createElement('style');
    s.id = 'lo-sms-styles';
    s.textContent = `
.sms-card-actions {
  display: flex; gap: 6px; margin-top: 0;
}
.sms-send-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer; transition: all 0.15s;
  font-family: 'Inter', sans-serif;
}
.sms-send-btn:hover:not(:disabled) {
  background: rgba(16,185,129,0.1);
  color: #059669;
  border-color: rgba(16,185,129,0.35);
}
.sms-send-btn:disabled {
  opacity: 0.55; cursor: not-allowed;
}
.sms-send-btn.sending {
  opacity: 0.7; cursor: wait;
}
.sms-send-btn.sent {
  background: rgba(16,185,129,0.1);
  color: #059669;
  border-color: rgba(16,185,129,0.3);
}
.sms-send-btn.error {
  background: rgba(239,68,68,0.08);
  color: #dc2626;
  border-color: rgba(239,68,68,0.25);
}

/* Call button in action bar */
.d-btn-call {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px;
  background: rgba(16,185,129,0.08);
  border: 1px solid rgba(16,185,129,0.25);
  border-radius: var(--radius-sm);
  font-size: 12.5px; font-weight: 600;
  color: #059669;
  cursor: pointer; transition: all 0.15s;
  font-family: 'Inter', sans-serif;
  text-decoration: none;
}
.d-btn-call:hover:not(:disabled) {
  background: rgba(16,185,129,0.16);
  border-color: rgba(16,185,129,0.45);
}
.d-btn-call:disabled {
  opacity: 0.55; cursor: not-allowed;
}
.d-btn-call.calling {
  opacity: 0.7; cursor: wait;
}

/* Inbound SMS log panel */
.sms-inbox-panel {
  margin-top: 16px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  max-height: 280px;
  display: flex;
  flex-direction: column;
}
.sms-inbox-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 14px;
  background: var(--bg-surface-hover);
  border-bottom: 1px solid var(--border-light);
  font-size: 11.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.6px; color: var(--text-secondary);
}
.sms-inbox-empty {
  padding: 14px; font-size: 12px; color: var(--text-secondary);
  font-style: italic; text-align: center;
}
.sms-inbox-msg {
  display: flex; flex-direction: column; gap: 3px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
  font-size: 12.5px;
}
.sms-inbox-msg:last-child { border-bottom: none; }
.sms-inbox-meta {
  font-size: 11px; color: var(--text-secondary);
  display: flex; gap: 10px;
}
.sms-inbox-body {
  color: var(--text-primary); line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
  word-break: break-word;
}
.sms-inbox-direction-in  { border-left: 2px solid #6366f1; }
.sms-inbox-direction-out { border-left: 2px solid #10b981; }
`;
    document.head.appendChild(s);
  })();

  // ── Public: init panel for a job ─────────────────────────────
  window.smsModuleInit = function (job) {
    if (!TWILIO_ENABLED) return; // copy-only mode — existing dashboard behaviour unchanged

    // Upgrade each sms-card's Copy button to Copy + Send
    const cards = document.querySelectorAll('.sms-card');
    cards.forEach((card, i) => {
      const top = card.querySelector('.sms-card-top');
      if (!top) return;

      // Remove any previously injected send button (stale job re-open)
      const prev = card.querySelector('.sms-send-btn');
      if (prev) prev.remove();

      const sendBtn = document.createElement('button');
      sendBtn.className = 'sms-send-btn';
      sendBtn.id = `smsSendBtn${i}`;
      sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send`;
      sendBtn.onclick = (e) => { e.stopPropagation(); smsSend(i, job); };
      top.appendChild(sendBtn);
    });

    // Inject Call button into action bar if not already there
    injectCallButton(job);

    // Load inbound SMS log for this job
    loadInboxPanel(job);
  };

  // ── Send SMS ─────────────────────────────────────────────────
  window.smsSend = async function (index, job) {
    const template = window._smsTemplates && window._smsTemplates[index];
    if (!template) return;

    if (!job || !job.phone) {
      showToast('error', 'No phone number on this job');
      return;
    }

    const btn = document.getElementById(`smsSendBtn${index}`);
    const copyBtn = document.getElementById(`smsBtn${index}`);

    setBtnState(btn, 'sending', '⏳ Sending…');
    if (copyBtn) copyBtn.disabled = true;

    try {
      const res = await fetch('/.netlify/functions/sms-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:           job.phone,
          body:         template.text,
          jobId:        job.jobId,
          customerName: job.name || '',
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setBtnState(btn, 'sent', '✓ Sent');
        showToast('success', `✓ SMS sent to ${job.name}`);
        // Log the outbound in the inbox panel optimistically
        appendOutboundToInbox(template.label, template.text);
        // Track that this template has now been sent for this job —
        // updates the kanban card dots and the modal's own "Sent" badge
        if (job.jobId && typeof markSmsTemplateSent === 'function') {
          markSmsTemplateSent(job.jobId, template.label);
        }
        // Revert after a delay so user can send again if needed
        setTimeout(() => {
          setBtnState(btn, '', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send`);
          if (copyBtn) copyBtn.disabled = false;
        }, 4000);
      } else {
        setBtnState(btn, 'error', '✗ Failed');
        showToast('error', 'SMS failed: ' + (data.error || 'Unknown error'));
        setTimeout(() => {
          setBtnState(btn, '', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send`);
          if (copyBtn) copyBtn.disabled = false;
        }, 3000);
      }
    } catch (err) {
      setBtnState(btn, 'error', '✗ Failed');
      showToast('error', 'SMS error: ' + err.message);
      setTimeout(() => {
        setBtnState(btn, '', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send`);
        if (copyBtn) copyBtn.disabled = false;
      }, 3000);
    }
  };

  // ── Initiate call ─────────────────────────────────────────────
  window.callInitiate = async function (job) {
    if (!job || !job.phone) {
      showToast('error', 'No phone number on this job');
      return;
    }

    const btn = document.getElementById('dCallBtn');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('calling');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .91h3a2 2 0 012 1.72c.13 1 .38 1.97.74 2.9a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.93.36 1.9.61 2.9.74A2 2 0 0122 16.92z"/></svg> Calling…`;
    }

    try {
      const res = await fetch('/.netlify/functions/call-initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:           job.phone,
          jobId:        job.jobId,
          customerName: (job.name || '').split(' ')[0],
        }),
      });

      const data = await res.json();

      if (data.ok) {
        showToast('success', `✓ Calling — your mobile will ring shortly`);
        if (btn) {
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .91h3a2 2 0 012 1.72c.13 1 .38 1.97.74 2.9a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.93.36 1.9.61 2.9.74A2 2 0 0122 16.92z"/></svg> ✓ Call started`;
          setTimeout(() => {
            btn.disabled = false;
            btn.classList.remove('calling');
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .91h3a2 2 0 012 1.72c.13 1 .38 1.97.74 2.9a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.93.36 1.9.61 2.9.74A2 2 0 0122 16.92z"/></svg> Call`;
          }, 6000);
        }
      } else {
        showToast('error', 'Call failed: ' + (data.error || 'Unknown error'));
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('calling');
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .91h3a2 2 0 012 1.72c.13 1 .38 1.97.74 2.9a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.93.36 1.9.61 2.9.74A2 2 0 0122 16.92z"/></svg> Call`;
        }
      }
    } catch (err) {
      showToast('error', 'Call error: ' + err.message);
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('calling');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .91h3a2 2 0 012 1.72c.13 1 .38 1.97.74 2.9a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.93.36 1.9.61 2.9.74A2 2 0 0122 16.92z"/></svg> Call`;
      }
    }
  };

  // ── Inject Call button into detail modal action bar ───────────
  function injectCallButton(job) {
    const bar = document.querySelector('.d-action-bar');
    if (!bar) return;
    if (document.getElementById('dCallBtn')) return; // already there

    const callBtn = document.createElement('button');
    callBtn.className = 'd-btn-call';
    callBtn.id = 'dCallBtn';
    callBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .91h3a2 2 0 012 1.72c.13 1 .38 1.97.74 2.9a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.93.36 1.9.61 2.9.74A2 2 0 0122 16.92z"/></svg> Call`;
    callBtn.onclick = () => callInitiate(job);

    // Insert after the Receipt button (before status selector)
    const statusDiv = bar.querySelector('.d-action-status');
    if (statusDiv) bar.insertBefore(callBtn, statusDiv);
    else bar.appendChild(callBtn);
  }

  // ── Load inbound SMS log panel ───────────────────────────────
  async function loadInboxPanel(job) {
    const smsPanel = document.querySelector('.sms-panel');
    if (!smsPanel) return;

    // Remove any existing inbox panel from a previous job open
    const existing = document.getElementById('smsInboxPanel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.className = 'sms-inbox-panel';
    panel.id = 'smsInboxPanel';
    panel.innerHTML = `
      <div class="sms-inbox-header">
        <span>Replies received</span>
        <span id="smsInboxCount" style="font-size:11px;color:var(--text-secondary)">Loading…</span>
      </div>
      <div id="smsInboxList" style="overflow-y:auto;flex:1;"><div class="sms-inbox-empty">Loading…</div></div>`;
    smsPanel.appendChild(panel);

    // Fetch from Apps Script
    try {
      if (typeof callScript !== 'function') {
        document.getElementById('smsInboxList').innerHTML = '<div class="sms-inbox-empty">—</div>';
        document.getElementById('smsInboxCount').textContent = '';
        return;
      }
      const res = await callScript({ action: 'loadInboundSms', phone: job.phone, jobId: job.jobId });
      const messages = (res.ok && Array.isArray(res.data)) ? res.data : [];
      renderInbox(messages);
    } catch {
      document.getElementById('smsInboxList').innerHTML = '<div class="sms-inbox-empty">—</div>';
      document.getElementById('smsInboxCount').textContent = '';
    }
  }

  function renderInbox(messages) {
    const list  = document.getElementById('smsInboxList');
    const count = document.getElementById('smsInboxCount');
    if (!list) return;
    if (!messages.length) {
      list.innerHTML = '<div class="sms-inbox-empty">No replies yet</div>';
      if (count) count.textContent = '0 messages';
      return;
    }
    if (count) count.textContent = messages.length + ' message' + (messages.length !== 1 ? 's' : '');
    list.innerHTML = messages.map(m => `
      <div class="sms-inbox-msg sms-inbox-direction-${m.direction || 'in'}">
        <div class="sms-inbox-meta">
          <span>${m.direction === 'out' ? '↑ Sent' : '↓ Received'}</span>
          <span>${fmtMsgTime(m.timestamp)}</span>
        </div>
        <div class="sms-inbox-body">${escHtml(m.body || '')}</div>
      </div>`).join('');
  }

  function appendOutboundToInbox(label, text) {
    const list = document.getElementById('smsInboxList');
    if (!list) return;
    const empty = list.querySelector('.sms-inbox-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = 'sms-inbox-msg sms-inbox-direction-out';
    div.innerHTML = `
      <div class="sms-inbox-meta">
        <span>↑ Sent · ${label}</span>
        <span>${fmtMsgTime(new Date().toISOString())}</span>
      </div>
      <div class="sms-inbox-body">${escHtml(text)}</div>`;
    list.appendChild(div);
    const count = document.getElementById('smsInboxCount');
    if (count) {
      const n = list.querySelectorAll('.sms-inbox-msg').length;
      count.textContent = n + ' message' + (n !== 1 ? 's' : '');
    }
  }

  // ── Helpers ──────────────────────────────────────────────────
  function setBtnState(btn, cls, html) {
    if (!btn) return;
    btn.className = 'sms-send-btn' + (cls ? ' ' + cls : '');
    btn.disabled  = cls === 'sending';
    btn.innerHTML = html;
  }

  function fmtMsgTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + ' ' +
             d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

})();
