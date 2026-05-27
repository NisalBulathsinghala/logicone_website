/* ============================================================
   Logic One SA — Receipt Module
   ------------------------------------------------------------
   Generates an A5 portrait intake receipt as a vector PDF using
   jsPDF (loaded on-demand from CDN, same as report-module).

   Saves to the job's Drive folder via the existing Apps Script
   'saveReport' action — no Apps Script changes needed.

   Public API:
     window.receiptGenerateAndPrint(jobObj)
       - Builds PDF, opens print dialog, saves to Drive in parallel.
       - Used by submitNewJob() and the "Print Receipt" button.

     window.receiptDownload(jobObj)
       - Builds PDF and downloads it locally (no Drive save).
   ============================================================ */

(function () {
  'use strict';

  // ── QR Code configuration ──────────────────────────────────────────────────
  // BASE_URL: the public URL of your deployed site (no trailing slash).
  // TOKEN_SECRET: MUST match the value in job-status.html exactly.
  // The QR code encodes: BASE_URL/job-status.html?id=JOBID&t=TOKEN
  const QR_BASE_URL    = 'https://logicone.com.au';          // ← update if different
  const QR_TOKEN_SECRET = 'lo-status-2026';                  // ← change both files together

  // ── Generate a short token for a job ID ────────────────────────────────────
  async function generateStatusToken(jobId) {
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(QR_TOKEN_SECRET + ':' + jobId)
    );
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 16);
  }

  // ── Lazy-load QR code library (idempotent) ─────────────────────────────────
  let qrLoaded = false;
  async function ensureQRLib() {
    if (qrLoaded || typeof window.QRCode !== 'undefined') { qrLoaded = true; return; }
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
    qrLoaded = true;
  }

  // ── Render QR code to canvas, return as PNG data URL ──────────────────────
  async function generateQRDataUrl(url) {
    await ensureQRLib();
    return new Promise((resolve, reject) => {
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
      document.body.appendChild(container);
      try {
        const qr = new window.QRCode(container, {
          text: url,
          width: 160,
          height: 160,
          colorDark: '#0a1628',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M,
        });
        // QRCode.js renders synchronously into a canvas
        const canvas = container.querySelector('canvas');
        if (!canvas) { reject(new Error('QR canvas not found')); return; }
        resolve(canvas.toDataURL('image/png'));
      } catch(e) {
        reject(e);
      } finally {
        setTimeout(() => { try { document.body.removeChild(container); } catch(_) {} }, 100);
      }
    });
  }

  // ── Lazy-load jsPDF (idempotent — report-module may have already loaded it) ──
  let jsPDFLoaded = false;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }
  async function ensureJsPDF() {
    if (jsPDFLoaded) return;
    if (typeof window.jspdf === 'undefined') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    jsPDFLoaded = true;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = () => reject(new Error('blob read failed'));
      r.readAsDataURL(blob);
    });
  }

  // ── Logo cache ─────────────────────────────────────────────────────────────
  // Loads images/logo_text.png once and keeps it as a data URL plus its
  // intrinsic dimensions (so we can preserve aspect ratio in the PDF).
  let logoCache = null;
  async function loadLogo() {
    if (logoCache !== null) return logoCache; // cached (object or false)
    try {
      const res = await fetch('images/logo_text.png', { cache: 'force-cache' });
      if (!res.ok) throw new Error('logo fetch ' + res.status);
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('logo read failed'));
        r.readAsDataURL(blob);
      });
      // Read intrinsic dimensions
      const dims = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error('logo decode failed'));
        img.src = dataUrl;
      });
      logoCache = { dataUrl, w: dims.w, h: dims.h };
    } catch (e) {
      console.warn('receipt: logo unavailable, falling back to text wordmark:', e.message);
      logoCache = false;
    }
    return logoCache;
  }

  function fmtDateTime(d) {
    d = d || new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dd = d.getDate();
    const mm = months[d.getMonth()];
    const yy = d.getFullYear();
    let h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${dd} ${mm} ${yy}, ${h}:${min} ${ampm}`;
  }

  // ── Build the A5 vector PDF ────────────────────────────────────────────────
  async function buildReceiptPdf(job, statusUrl) {
    await ensureJsPDF();
    const { jsPDF } = window.jspdf;

    // A5 portrait: 148 x 210 mm
    const pdf = new jsPDF({
      unit: 'mm', format: 'a5', orientation: 'portrait', compress: true,
    });

    const PAGE_W = 148, PAGE_H = 210;
    const MARGIN = 10;
    const CONTENT_W = PAGE_W - MARGIN * 2; // 128mm

    // Colour palette — matches dashboard
    const C = {
      ink:        [15, 23, 42],
      inkSoft:    [71, 85, 105],
      inkMute:    [148, 163, 184],
      rule:       [226, 232, 240],
      ruleStrong: [203, 213, 225],
      accent:     [0, 102, 204],
      accentDeep: [10, 22, 40],
      bg:         [247, 248, 250],
      faultBg:    [247, 248, 250],
      termsBg:    [250, 251, 252],
    };

    // ── Drawing helpers ──────────────────────────────────────────────────────
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

    const wrap = (text, maxW, size) => {
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(String(text || ''), maxW);
      const lineH = size * 0.352778 * 1.3;
      return { lines, height: lines.length * lineH, lineH };
    };

    let y = MARGIN;

    // ── HEADER ───────────────────────────────────────────────────────────────
    // Left side: try to render logo_text.png; fall back to text wordmark.
    const LOGO_MAX_H = 11;   // mm — keep proportional, never exceed this height
    const LOGO_MAX_W = 60;   // mm — cap width so it doesn't crowd the right side

    const logo = await loadLogo();
    if (logo) {
      // Fit within max box, preserve aspect
      const aspect = logo.w / logo.h;
      let drawW = LOGO_MAX_H * aspect;
      let drawH = LOGO_MAX_H;
      if (drawW > LOGO_MAX_W) {
        drawW = LOGO_MAX_W;
        drawH = LOGO_MAX_W / aspect;
      }
      try {
        pdf.addImage(logo.dataUrl, 'PNG', MARGIN, y + 1, drawW, drawH, undefined, 'FAST');
      } catch (e) {
        console.warn('addImage failed, falling back to text:', e.message);
        setText(C.accentDeep, 16, 'bold');
        pdf.text('LOGIC ONE SA', MARGIN, y + 6);
      }
    } else {
      setText(C.accentDeep, 16, 'bold');
      pdf.text('LOGIC ONE SA', MARGIN, y + 6);
    }

    // Subline + contact details (sit below the logo)
    setText(C.inkSoft, 6.5, 'normal');
    pdf.text('ELECTRONICS ENGINEERING  ·  AUTHORISED REPAIRS', MARGIN, y + 16);

    setText(C.inkSoft, 7, 'normal');
    pdf.text('Adelaide, South Australia', MARGIN, y + 20.5);
    pdf.text('info@logicone.com.au  ·  logicone.com.au', MARGIN, y + 24);

    // ── Right column: REPAIR INTAKE label, Job ID, date, warranty badge ────────
    const warrantyStr = String(job.warranty || '').toLowerCase().trim();
    const isInWarranty = warrantyStr === 'in warranty' || warrantyStr === 'in-warranty';

    // Pre-generate QR so we know if it's available before laying out the header
    let qrDataUrl = null;
    if (statusUrl) {
      try { qrDataUrl = await generateQRDataUrl(statusUrl); } catch(e) {
        console.warn('receipt: QR generation failed in header:', e.message);
      }
    }

    // QR size — sits right-aligned in header, same column as job ID/date
    const QR_SIZE_MM = 18;
    const QR_PAD     = 1.5;
    // QR x position: flush with right margin
    const qrX = PAGE_W - MARGIN - QR_SIZE_MM;
    const qrY = y + 1; // top of header

    // Text column: everything right-aligned, left of QR if QR present
    const rightEdge = qrDataUrl ? qrX - 3 : PAGE_W - MARGIN;

    setText(C.inkMute, 6.5, 'normal');
    const labelTxt = 'REPAIR INTAKE';
    const labelW = pdf.getTextWidth(labelTxt);
    pdf.text(labelTxt, rightEdge - labelW, y + 5);

    setText(C.accentDeep, 13, 'bold');
    const jobIdTxt = String(job.jobId || '—');
    const jobIdW = pdf.getTextWidth(jobIdTxt);
    pdf.text(jobIdTxt, rightEdge - jobIdW, y + 11);

    setText(C.inkSoft, 7, 'normal');
    const dateTxt = fmtDateTime(new Date());
    const dateW = pdf.getTextWidth(dateTxt);
    pdf.text(dateTxt, rightEdge - dateW, y + 16);

    // Warranty badge — right-aligned under date
    {
      const badgeText = isInWarranty ? 'IN WARRANTY' : 'OUT OF WARRANTY';
      const badgeFill = isInWarranty ? [209, 250, 229] : [254, 243, 199];
      const badgeInk  = isInWarranty ? [4, 120, 87]    : [180, 83, 9];

      pdf.setFontSize(6.5);
      pdf.setFont('helvetica', 'bold');
      const padX = 2.5, padY = 1.4;
      const textW = pdf.getTextWidth(badgeText);
      const badgeW = textW + padX * 2;
      const badgeH = 4.4;
      const badgeX = rightEdge - badgeW;
      const badgeY = y + 19;

      setFill(badgeFill);
      pdf.roundedRect(badgeX, badgeY, badgeW, badgeH, 0.8, 0.8, 'F');
      pdf.setTextColor(badgeInk[0], badgeInk[1], badgeInk[2]);
      pdf.text(badgeText, badgeX + padX, badgeY + badgeH - padY);
    }

    // ── QR code in header (right side, top-aligned) ──────────────────────────
    if (qrDataUrl) {
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, QR_SIZE_MM, QR_SIZE_MM, undefined, 'FAST');
      // Tiny "scan to track" label under QR
      setText(C.inkMute, 5, 'normal');
      const scanTxt = 'Scan to track';
      const scanW = pdf.getTextWidth(scanTxt);
      pdf.text(scanTxt, qrX + (QR_SIZE_MM - scanW) / 2, qrY + QR_SIZE_MM + 2.5);
    }

    // Header height: taller when QR is present (needs room for 18mm QR + label)
    y += qrDataUrl ? Math.max(28, QR_SIZE_MM + 6) : 28;

    // Header rule
    setDraw(C.accentDeep, 0.5);
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;

    // ── Section title helper ─────────────────────────────────────────────────
    const drawSectionTitle = (label) => {
      setText(C.accent, 7, 'bold');
      pdf.text(label.toUpperCase(), MARGIN, y);
      setDraw(C.rule, 0.2);
      pdf.line(MARGIN, y + 1.4, PAGE_W - MARGIN, y + 1.4);
      y += 5.5;
    };

    // ── Two-column field grid helper ─────────────────────────────────────────
    // Lays out [label, value] pairs in 2 columns, returns final y
    const drawFieldGrid = (pairs) => {
      const colW = (CONTENT_W - 6) / 2;
      const colX = [MARGIN, MARGIN + colW + 6];
      const ROW_H = 9;
      let col = 0;
      let rowY = y;

      pairs.forEach(([label, value]) => {
        const x = colX[col];

        setText(C.inkMute, 5.5, 'normal');
        pdf.text(String(label).toUpperCase(), x, rowY);

        setText(C.ink, 8.5, 'normal');
        const v = String(value == null || value === '' ? '—' : value);
        // Truncate if too long for column
        const maxChars = pdf.splitTextToSize(v, colW);
        pdf.text(maxChars[0] || '—', x, rowY + 4.2);

        col++;
        if (col >= 2) { col = 0; rowY += ROW_H; }
      });
      // Account for half-row at end
      if (col === 1) rowY += ROW_H;
      y = rowY + 2;
    };

    // ── CUSTOMER ─────────────────────────────────────────────────────────────
    drawSectionTitle('Customer');
    drawFieldGrid([
      ['Name',  job.name],
      ['Phone', job.phone],
      ['Email', job.email],
      ['Address', job.address || '—'],
    ]);
    y += 2;

    // ── DEVICE ───────────────────────────────────────────────────────────────
    drawSectionTitle('Device');
    drawFieldGrid([
      ['Brand / Model', `${job.brand || ''} ${job.model || ''}`.trim()],
      ['Device Type',   job.deviceType],
      ['Serial Number', job.serial],
      ['Case Number',   job.caseNo],
      ['Warranty',        job.warranty],
      ['Receive Method',  job.receiveMethod || 'Local Drop-off'],
      ['Repaired Before', job.repairedBefore],
    ]);
    y += 2;

    // ── REPORTED FAULT ───────────────────────────────────────────────────────
    drawSectionTitle('Reported Fault');
    {
      const faultText = job.issue || '—';
      const wrapped = wrap(faultText, CONTENT_W - 8, 8.5);
      const boxH = Math.max(16, wrapped.height + 6);

      setFill(C.faultBg);
      pdf.rect(MARGIN, y, CONTENT_W, boxH, 'F');
      // Left accent bar
      setFill(C.accent);
      pdf.rect(MARGIN, y, 1.2, boxH, 'F');

      setText(C.ink, 8.5, 'normal');
      pdf.text(wrapped.lines, MARGIN + 4, y + 5);
      y += boxH + 3;
    }

    // ── ACCESSORIES ──────────────────────────────────────────────────────────
    drawSectionTitle('Accessories Received');
    {
      const accText = job.accessories && String(job.accessories).trim() ? job.accessories : 'None';
      const wrapped = wrap(accText, CONTENT_W - 6, 8);
      const boxH = Math.max(10, wrapped.height + 5);

      setDraw(C.ruleStrong, 0.2);
      pdf.setLineDashPattern([0.8, 0.8], 0);
      pdf.rect(MARGIN, y, CONTENT_W, boxH);
      pdf.setLineDashPattern([], 0);

      setText(C.ink, 8, 'normal');
      pdf.text(wrapped.lines, MARGIN + 3, y + 4.5);
      y += boxH + 4;
    }

    // ── TERMS & CONDITIONS ───────────────────────────────────────────────────
    {
      const brand = String(job.brand || '').trim();
      // Phrase the manufacturer reference using the actual brand if known,
      // otherwise fall back to a neutral phrase.
      const mfg = brand && /roborock|segway/i.test(brand)
        ? brand
        : 'the manufacturer';

      let terms;
      let termsTitle;

      if (isInWarranty) {
        termsTitle = 'WARRANTY TERMS';
        terms = [
          `Repair carried out under ${mfg}'s authorised warranty programme using genuine parts, at no charge to the customer subject to warranty assessment.`,
          `If inspection reveals the fault is outside warranty cover (e.g. accidental, liquid or impact damage, unauthorised modification), we will contact you to discuss options before any chargeable work proceeds.`,
          'Estimated turnaround is provided in good faith and may vary with parts availability.',
          'Logic One SA is not liable for pre-existing data or damage not noted at intake. Customer is responsible for backups.',
          'Acceptance of these terms is confirmed by handing the device over for repair.',
        ];
      } else {
        termsTitle = 'TERMS & CONDITIONS';
        terms = [
          'An inspection fee applies to all out-of-warranty assessments. Waived if you proceed with the quoted repair.',
          `All repairs use genuine ${mfg} parts under ${mfg}'s authorised repair process.`,
          'Estimated turnaround is provided in good faith and may vary with parts availability.',
          'Goods not collected within 90 days of completion or quote rejection may be disposed of to recover costs.',
          'Logic One SA is not liable for pre-existing data or damage not noted at intake. Customer is responsible for backups.',
          'Acceptance of these terms is confirmed by handing the device over for repair.',
        ];
      }

      // Pre-calculate box height with generous padding + line spacing
      let totalH = 7;
      const wrappedTerms = terms.map(t => {
        const w = wrap('• ' + t, CONTENT_W - 8, 6.5);
        totalH += w.height + 0.6;
        return w;
      });
      totalH += 2;

      setFill(C.termsBg);
      setDraw(C.rule, 0.2);
      pdf.rect(MARGIN, y, CONTENT_W, totalH, 'FD');

      setText(C.accentDeep, 6.5, 'bold');
      pdf.text(termsTitle, MARGIN + 4, y + 4.5);

      let ty = y + 9;
      setText(C.inkSoft, 6.5, 'normal');
      wrappedTerms.forEach(w => {
        pdf.text(w.lines, MARGIN + 4, ty);
        ty += w.height + 0.6;
      });
      y += totalH + 4;
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    setText(C.inkMute, 5.5, 'normal');
    const footer = `Job ${job.jobId || '—'}  ·  ${fmtDateTime(new Date())}  ·  logicone.com.au`;
    const footerW = pdf.getTextWidth(footer);
    pdf.text(footer, (PAGE_W - footerW) / 2, PAGE_H - 4);

    return pdf;
  }

  // ── Public: build, print, and save in parallel ─────────────────────────────
  window.receiptGenerateAndPrint = async function (job, customerCopy) {
    if (!job || !job.jobId) {
      if (typeof showToast === 'function') showToast('error', 'No job data for receipt');
      return;
    }

    // Generate status URL with token — skipped for customer copies
    let statusUrl = null;
    if (!customerCopy) {
      try {
        const token = await generateStatusToken(job.jobId);
        statusUrl = `${QR_BASE_URL}/job-status.html?id=${encodeURIComponent(job.jobId)}&t=${token}`;
      } catch(e) {
        console.warn('receipt: token generation failed, QR will be skipped:', e.message);
      }
    }

    let pdf;
    try {
      pdf = await buildReceiptPdf(job, statusUrl);
    } catch (e) {
      console.error('receipt build failed:', e);
      if (typeof showToast === 'function') showToast('error', 'Receipt build failed: ' + e.message);
      return;
    }

    // ── Open print dialog immediately ─────────────────────────────────────
    // jsPDF's autoPrint() injects the print intent into the PDF; opening the
    // blob in a new tab triggers the browser's PDF viewer, which honours it.
    try {
      pdf.autoPrint();
      const blobUrl = pdf.output('bloburl');
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        if (typeof showToast === 'function') {
          showToast('error', 'Pop-up blocked — allow pop-ups to print receipts');
        }
      }
    } catch (e) {
      console.error('print open failed:', e);
    }

    // ── Save to Drive in parallel (don't block the print) ─────────────────
    if (job.driveFolder && typeof callScript === 'function' &&
        typeof cfg !== 'undefined' && cfg && cfg.appsScriptUrl) {
      try {
        const blob = pdf.output('blob');
        const base64 = await blobToBase64(blob);
        const filename = `Intake-Receipt-${job.jobId}.pdf`;

        const result = await callScript({
          action: 'saveReport',
          jobId: job.jobId,
          driveFolder: job.driveFolder,
          filename,
          pdfBase64: base64,
        });

        if (result && result.ok) {
          if (typeof showToast === 'function') showToast('success', '✓ Receipt saved to Drive');
        } else {
          const err = (result && result.error) || 'Unknown error';
          if (typeof showToast === 'function') showToast('error', 'Drive save failed: ' + err);
        }
      } catch (e) {
        console.error('receipt drive save failed:', e);
        if (typeof showToast === 'function') showToast('error', 'Drive save failed: ' + e.message);
      }
    } else if (!job.driveFolder) {
      // Drive folder not yet available (rare — Apps Script creates it on submit).
      // Silent — receipt still prints; user can re-print later from detail modal.
      console.warn('receipt: no driveFolder, skipping Drive save');
    }
  };

  // ── Public: download only (no print, no Drive) ─────────────────────────────
  window.receiptDownload = async function (job, customerCopy) {
    if (!job || !job.jobId) return;
    try {
      let statusUrl = null;
      if (!customerCopy) {
        try {
          const token = await generateStatusToken(job.jobId);
          statusUrl = `${QR_BASE_URL}/job-status.html?id=${encodeURIComponent(job.jobId)}&t=${token}`;
        } catch(e) {
          console.warn('receipt: token generation failed, QR skipped:', e.message);
        }
      }
      const pdf = await buildReceiptPdf(job, statusUrl);
      const suffix = customerCopy ? '-Customer' : '-Workshop';
      pdf.save(`Intake-Receipt-${job.jobId}${suffix}.pdf`);
    } catch (e) {
      console.error(e);
      if (typeof showToast === 'function') showToast('error', 'Download failed: ' + e.message);
    }
  };

})();
