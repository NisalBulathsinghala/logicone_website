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
   Also worth turning off per-label cutting so a 1-4 label job comes
   off as one strip, cut once at the end, instead of after every
   label. Where that lives depends on the OS: on Windows it's a
   persistent printer setting (Printer Setting Tool -> Device Settings
   -> Auto Cut -> "Cut at End", written to the printer itself). On Mac
   the standalone Printer Setting Tool doesn't have this — it's a
   per-print-job option in the system print dialog's "Cut Option"
   panel (uncheck "Cut Every"), which needs saving as a default Preset
   to stick. Neither carries over to iPad/iPhone AirPrint automatically
   — worth testing a real print from those before assuming it's set. After that it's just: pick
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
  // One page per label. Whether these come off the QL-810W as one cut
  // strip (all 1-4 labels) or a cut after every single one depends on
  // the printer's own Auto Cut setting — see the header note above;
  // this code has no control over that, it's purely a printer-setting
  // thing. Width is
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

    // Vertical layout: centre the two-line block (part name + number) in
    // the label as a unit. jsPDF positions text by baseline, so simply
    // splitting LABEL_H in half (what this had before) doesn't centre
    // anything — it left far more space above the part name than below
    // the number. This computes where the baselines actually need to
    // land for the visible text to sit centred with even top/bottom
    // margins. MM_PER_PT/CAP_RATIO are Helvetica approximations; if a
    // real printed label looks off by a consistent amount, nudge those
    // two constants rather than the baseline formulas below.
    const FONT_PART  = 12;
    const FONT_NUM   = 15;
    const MM_PER_PT  = 0.3528;
    const CAP_RATIO  = 0.72;  // cap-height as a fraction of font size
    const LINE_GAP   = 2;     // mm, gap between the two lines' visual blocks
    const capPart = FONT_PART * MM_PER_PT * CAP_RATIO;
    const capNum  = FONT_NUM  * MM_PER_PT * CAP_RATIO;
    const topMargin = (LABEL_H - (capPart + LINE_GAP + capNum)) / 2;
    const basePart  = topMargin + capPart;
    const baseNum   = basePart + LINE_GAP + capNum;

    parts.forEach((part, i) => {
      if (i > 0) pdf.addPage([LABEL_W, LABEL_H], 'landscape');

      setText(C.accent, FONT_PART, 'bold');
      pdf.text(part, cx, basePart, { align: 'center' });

      setText(C.ink, FONT_NUM, 'bold');
      pdf.text(number, cx, baseNum, { align: 'center' });
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
