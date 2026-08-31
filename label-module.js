/* ============================================================
   Logic One SA — Label Module
   ------------------------------------------------------------
   Prints 3 stick-on identification labels — Robot / Dock / Dock
   Ramp — sized for a Brother QL-810W on 62mm continuous roll
   stock, so a device's parts never get confused with another
   job's while both are in the workshop. One PDF page per label;
   on continuous stock the driver auto-cuts once per page, so this
   comes off the printer as 3 separate tags, no scissors needed.

   ONE-TIME setup on the machine that prints these: install the
   QL-810W driver, then in its print preferences set the roll/media
   width to 62mm continuous. After that it's just: pick "Brother
   QL-810W" in the print dialog this opens, hit print. A webpage
   can open a print dialog but can't submit it or choose the
   printer for you — that's a browser limit, not something this
   code works around. True zero-click printing (no dialog at all)
   would need a small local helper program instead.

   Reuses receipt-module.js's QR token/renderer (window.loGenerateStatusToken
   / window.loGenerateQRDataUrl) so the QR on a label and the QR on
   the receipt resolve to the exact same job-status link — which now
   also has its own "Upload Photos" tab, so the same QR reaches both.
   receipt-module.js must be loaded first — see dashboard.html.

   Not saved to Drive — a one-off workshop artifact, not a
   customer-facing record like the receipt.

   Public API:
     window.labelGenerateAndPrint(jobObj)
       - Builds the 3-page label PDF and opens the print dialog.
   ============================================================ */

(function () {
  'use strict';

  // Which parts get a label, in print order. Always prints all three
  // regardless of job.brand right now — say the word if Segway jobs
  // (single-unit, no dock) should print just one "SCOOTER" label instead.
  const LABEL_PARTS = ['ROBOT', 'DOCK', 'DOCK RAMP'];

  // QL-810W tops out at 62mm — this MUST match the roll width set in the
  // driver's print preferences, or the printer will scale/clip oddly.
  const LABEL_W = 62;   // mm — fixed, matches the roll
  const LABEL_H = 32;   // mm — length is free on continuous stock; this is
                         // just how much of the roll each label uses
  const PAD     = 3;    // mm, inner padding
  const QR_SIZE = 22;   // mm

  const STATUS_BASE_URL = 'https://logicone.com.au'; // keep in sync with receipt-module.js

  const C = {
    ink:     [15, 23, 42],
    inkSoft: [71, 85, 105],
    accent:  [0, 102, 204],
  };

  // ── Lazy-load jsPDF (idempotent — receipt-module.js may already have it) ──
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

  // QR is a nice-to-have, not load-bearing. If receipt-module.js hasn't
  // loaded (script order issue) or token/QR generation fails for any
  // reason, labels still print fine as text-only — same fallback spirit
  // as the receipt's own logo-load handling.
  async function tryGetQR(jobId) {
    try {
      if (typeof window.loGenerateStatusToken !== 'function' ||
          typeof window.loGenerateQRDataUrl   !== 'function') {
        console.warn('label: receipt-module.js QR helpers not found — printing text-only');
        return null;
      }
      const token = await window.loGenerateStatusToken(jobId);
      const url   = `${STATUS_BASE_URL}/job-status.html?id=${encodeURIComponent(jobId)}&t=${token}`;
      return await window.loGenerateQRDataUrl(url);
    } catch (e) {
      console.warn('label: QR unavailable, printing text-only —', e.message);
      return null;
    }
  }

  // ── Build the 3-page, 62mm-wide label PDF ──────────────────────────────
  // One page per label. On continuous roll stock the driver cuts once per
  // page, so this comes off the QL-810W as 3 separate tags. Width is
  // greater than height (a wide, short strip), so orientation is set
  // explicitly to landscape — leaving it as 'portrait' risks jsPDF
  // silently swapping the two dimensions to keep height >= width.
  async function buildLabelsPdf(job) {
    await ensureJsPDF();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: [LABEL_W, LABEL_H], orientation: 'landscape', compress: true });

    const setText = (rgb, size, weight) => {
      pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
      pdf.setFontSize(size);
      pdf.setFont('helvetica', weight || 'normal');
    };

    const qrDataUrl  = await tryGetQR(job.jobId || '');
    const brandModel = [job.brand, job.model].filter(Boolean).join(' ') || '\u2014';
    const textW = qrDataUrl ? (LABEL_W - QR_SIZE - PAD * 3) : (LABEL_W - PAD * 2);

    LABEL_PARTS.forEach((part, i) => {
      if (i > 0) pdf.addPage([LABEL_W, LABEL_H], 'landscape');

      setText(C.accent, 13, 'bold');
      pdf.text(part, PAD, PAD + 5);

      setText(C.ink, 10.5, 'bold');
      pdf.text(String(job.jobId || '\u2014'), PAD, PAD + 13);

      setText(C.inkSoft, 7.5, 'normal');
      const wrapped = pdf.splitTextToSize(brandModel, textW);
      pdf.text(wrapped.slice(0, 2), PAD, PAD + 19);

      if (qrDataUrl) {
        const qx = LABEL_W - QR_SIZE - PAD;
        const qy = (LABEL_H - QR_SIZE) / 2;
        try { pdf.addImage(qrDataUrl, 'PNG', qx, qy, QR_SIZE, QR_SIZE); }
        catch (e) { console.warn('label: QR image draw failed —', e.message); }
      }
    });

    return pdf;
  }

  // ── Public: build and print ─────────────────────────────────────────────
  window.labelGenerateAndPrint = async function (job) {
    if (!job || !job.jobId) {
      if (typeof showToast === 'function') showToast('error', 'No job data for labels');
      return;
    }

    let pdf;
    try {
      pdf = await buildLabelsPdf(job);
    } catch (e) {
      console.error('label build failed:', e);
      if (typeof showToast === 'function') showToast('error', 'Label build failed: ' + e.message);
      return;
    }

    try {
      pdf.autoPrint();
      const blobUrl = pdf.output('bloburl');
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        if (typeof showToast === 'function') {
          showToast('error', 'Pop-up blocked \u2014 allow pop-ups to print labels');
        }
      }
    } catch (e) {
      console.error('label print open failed:', e);
    }
  };

})();
