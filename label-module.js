/* ============================================================
   Logic One SA — Label Module
   ------------------------------------------------------------
   Prints one stick-on label per physical part handed in with a
   job, sized for a Brother QL-810W on 17mm x 54mm die-cut label
   stock. The receipt tag already carries the job ID and customer
   details, so these carry no info of their own beyond:
     - the PART NAME (ROBOT / DOCK / DOCK RAMP / CABLE / SCOOTER)
     - a short NUMBER, shared by every label in the same print
       run, so parts sitting on the shelf can be matched back to
       each other without carrying the full job ID around
   The number comes from netlify/functions/next-label-number.js —
   a shared counter that cycles back to 001 every calendar quarter
   (see that file for why, and how to switch it to your BAS/FY
   quarters instead). Re-printing labels for the same job always
   returns that job's original number, so a misprint or a second
   part found later never gets a mismatched tag.

   One PDF page per label; die-cut stock is pre-gapped, so the
   printer advances to the next label on its own between pages
   — no auto-cut setting to worry about (that only mattered on
   the old continuous-roll stock).

   Which labels get printed depends on what was checked in the
   Accessories list on intake (see getLabelParts below):
     - Robot Vacuum + Auto Empty Dock + Charging Cable → 4 labels:
       ROBOT, DOCK, DOCK RAMP, CABLE
     - Robot Vacuum + Charging Dock + Charging Cable    → 3 labels:
       ROBOT, DOCK, CABLE
     - Robot Vacuum only (no dock brought in)            → 1 label:
       ROBOT
   Scooters are single-unit — always just one SCOOTER label.

   ONE-TIME setup on the machine that prints these: install the
   QL-810W driver, then in its print preferences set the label
   type to die-cut, 17mm x 54mm (Brother's own part number for
   this size is DK-1204 — some resellers list it as "DK-11204",
   same thing). Check the driver shows die-cut, not "Continuous
   Length" — wrong media type makes the cutter sync to the wrong
   points and slice mid-label instead of at the gap between labels.
   Also worth turning on "Auto Cut" / "Cut Every Label" in the
   driver so a multi-label job pops out as separate ready-to-peel
   tags instead of one connected strip. After that it's just: pick
   "Brother QL-810W" in the print dialog this opens, hit print. A
   webpage can open a print dialog but can't submit it or choose
   the printer for you — that's a browser limit, not something
   this code works around. True zero-click printing (no dialog at
   all) would need a small local helper program instead.

   Not saved to Drive — a one-off workshop artifact, not a
   customer-facing record like the receipt.

   Public API:
     window.labelGenerateAndPrint(jobObj)
       - Fetches this job's shared number, builds the label PDF
         (1-4 pages, depending on accessories), and opens the
         print dialog. If the number can't be fetched, nothing
         prints — a label with the wrong (or a made-up) number is
         worse than no label, since the whole point is not mixing
         parts up between jobs.
   ============================================================ */

(function () {
  'use strict';

  // Works out which parts get a label, in print order, from what was
  // checked under Accessories on intake (see ACCESSORIES_BY_TYPE in
  // dashboard.js). Scooters are single-unit, so they always get just
  // one label regardless of accessories.
  function getLabelParts(job) {
    const deviceType = String(job.deviceType || job.brand || '').toLowerCase();
    if (deviceType.includes('scooter')) return ['SCOOTER'];

    const acc = String(job.accessories || '').toLowerCase();
    const hasAutoEmptyDock = acc.includes('auto empty dock');
    const hasChargingDock  = acc.includes('charging dock');
    const hasCable         = acc.includes('charging cable') || acc.includes('cable');

    const parts = ['ROBOT'];
    if (hasAutoEmptyDock) parts.push('DOCK', 'DOCK RAMP');
    else if (hasChargingDock) parts.push('DOCK');
    if (hasCable) parts.push('CABLE');
    return parts;
  }

  // Brother DK-1204 die-cut stock (also sold as "DK-11204" by some
  // resellers) — this MUST match the label type set in the driver's
  // print preferences, or the printer will scale/clip oddly, or cut
  // mid-label instead of at the gap between labels.
  const LABEL_W = 54;   // mm — fixed, matches the die-cut label
  const LABEL_H = 17;   // mm — fixed, matches the die-cut label
  const PAD     = 2;    // mm, inner padding

  const C = {
    ink:    [15, 23, 42],
    accent: [0, 102, 204],
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

  // Gets this job's shared label number. Same job → same number every
  // time (server-side idempotent on jobId), so reprints never drift.
  // Throws on any failure — deliberately not caught here, so a bad
  // fetch stops printing rather than falling back to a made-up number.
  async function fetchLabelNumber(jobId) {
    const res = await fetch('/.netlify/functions/next-label-number', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || !json.ok || !json.data || !json.data.number) {
      throw new Error((json && json.error) || `Number service returned ${res.status}`);
    }
    return json.data.number;
  }

  // ── Build the label PDF (1-4 pages, one per part) ──────────────────────
  // One page per label. Whether these come off the QL-810W as separate
  // peel-and-stick tags or one connected strip depends on the driver's
  // "Auto Cut" setting — see the header note above; this code has no
  // control over that, it's purely a printer-preferences thing. Width is
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

    // One number for the whole job — fetched once, reused on every page,
    // so all of a job's labels carry the same matching number.
    const number = await fetchLabelNumber(job.jobId);
    const parts  = getLabelParts(job);
    const cx     = LABEL_W / 2;

    parts.forEach((part, i) => {
      if (i > 0) pdf.addPage([LABEL_W, LABEL_H], 'landscape');

      setText(C.accent, 12, 'bold');
      pdf.text(part, cx, PAD + 6, { align: 'center' });

      setText(C.ink, 15, 'bold');
      pdf.text(number, cx, PAD + 13.5, { align: 'center' });
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
