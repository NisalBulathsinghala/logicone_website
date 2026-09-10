/* ============================================================
   Logic One SA — Label Module
   ------------------------------------------------------------
   Prints one stick-on label per physical part handed in with a
   job, sized for a Brother QL-810W on 17mm x 54mm die-cut label
   stock. The receipt tag already carries the job ID, customer
   details, and which part is which, so these carry nothing but:
     - a short NUMBER, shared by every label in the same print
       run, so parts sitting on the shelf can be matched back to
       each other without carrying the full job ID around
   Sized to fill the label — see the width/height measurement in
   buildLabelsPdf below — for legibility from across the workshop,
   not just up close.
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

   How many labels get printed still depends on what was checked
   in the Accessories list on intake (see getLabelParts below) —
   just not what's printed on them anymore:
     - Robot Vacuum + Auto Empty Dock + Charging Cable → 4 labels
     - Robot Vacuum + Charging Dock + Charging Cable    → 3 labels
     - Robot Vacuum only (no dock brought in)            → 1 label
   Scooters are single-unit — always just one label.

   ONE-TIME setup on the machine that prints these:
     1. Install the QL-810W driver, then in its print preferences
        set the label type to die-cut, 17mm x 54mm (Brother's own
        part number for this size is DK-1204 — some resellers list
        it as "DK-11204", same thing). Check the driver shows
        die-cut, not "Continuous Length" — wrong media type makes
        the cutter sync to the wrong points and slice mid-label
        instead of at the gap between labels.
     2. Turn off per-label cutting so a 1-4 label job comes off as
        one strip, cut once at the end, instead of after every
        label. Where that lives depends on the OS:
          - Windows: a persistent printer setting — Printer Setting
            Tool -> Device Settings -> Auto Cut -> "Cut at End",
            written to the printer itself.
          - Mac: the standalone Printer Setting Tool doesn't have
            this — it's a per-print-job option in the system print
            dialog's "Cut Option" panel (uncheck "Cut Every"),
            which needs saving as a default Preset to stick.
          - Neither carries over to iPad/iPhone AirPrint
            automatically — worth testing a real print from those
            before assuming it's set.
   After that it's just: pick "Brother QL-810W" in the print dialog
   this opens, hit print. A webpage can open a print dialog but
   can't submit it or choose the printer for you — that's a browser
   limit, not something this code works around. True zero-click
   printing (no dialog at all) would need a small local helper
   program instead.

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
  // thing. Width is greater than height (a wide, short strip), so
  // orientation is set explicitly to landscape — leaving it as
  // 'portrait' risks jsPDF silently swapping the two dimensions to
  // keep height >= width.
  //
  // IMPORTANT: the PDF page itself is built as LABEL_H x LABEL_W (17x54,
  // portrait), not LABEL_W x LABEL_H — this looks backwards but matches
  // how the printer/CUPS actually sees the roll: physically it's 17mm
  // *across* the roll (fixed) and 54mm *along* the feed per label. The
  // print agent's config.json declares the media the same way
  // (Custom.17x54mm). If the PDF page shape doesn't match that, the
  // printer either clips the content or auto-rotates it unpredictably —
  // which is exactly what happened when this was still built as 54x17.
  // The number itself is drawn rotated 90° so it still reads normally
  // along the label's 54mm length once printed, despite the page now
  // being "tall" rather than "wide".
  async function buildLabelsPdf(job) {
    await ensureJsPDF();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: [LABEL_H, LABEL_W], orientation: 'portrait', compress: true });

    // One number for the whole job — fetched once, reused on every page,
    // so all of a job's labels carry the same matching number. No part
    // name printed anymore; getLabelParts() is still used to know how
    // many physical labels to produce (still driven by accessories),
    // just not to put text on them.
    const number = await fetchLabelNumber(job.jobId);
    const pageCount = getLabelParts(job).length;

    // Size the number to fill the label: measure its width at a large
    // reference size, then scale so it spans the available length (minus
    // a small margin along the 54mm run). Capped so it never grows
    // thicker than the 17mm roll width. Measuring rather than using a
    // fixed pt size means it stays "full size" whether the number is 8
    // characters ("26Q3-002") or grows to 9 later in a busy quarter,
    // instead of looking too small on short numbers or overflowing on
    // long ones. These constraints are about the text itself (how long a
    // run, how tall the strokes) and don't change just because the page
    // got rotated — only where we place/rotate the result does.
    const MM_PER_PT = 0.3528;
    const CAP_RATIO = 0.72;   // cap-height as a fraction of font size — Helvetica approximation
    const H_MARGIN  = 2;      // mm, margin along the 54mm run
    const V_MARGIN  = 1.5;    // mm, margin across the 17mm roll width
    const REF_SIZE  = 100;    // pt — arbitrary reference size for measuring text width

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(REF_SIZE);
    const refWidth = pdf.getTextWidth(number); // mm, at REF_SIZE

    const maxRun         = LABEL_W - H_MARGIN * 2;   // LABEL_W (54) is still the run length
    const widthFitSize   = (maxRun / refWidth) * REF_SIZE;
    const heightCapSize  = (LABEL_H - V_MARGIN * 2) / (MM_PER_PT * CAP_RATIO); // LABEL_H (17) is still the stroke-height limit
    const fontSize       = Math.min(widthFitSize, heightCapSize);

    // Anchor at the page's dead centre. With angle:90 + align:'center',
    // jsPDF centres the text along its run direction automatically (the
    // 54mm page height, post-rotation) — the anchor just needs to sit on
    // the page's centreline. NOTE: if the printed label comes out upside
    // down, change angle to -90 (or 270) below — that's the one thing
    // this can't be verified without an actual test print.
    const cx = LABEL_H / 2;
    const cy = LABEL_W / 2;

    pdf.setFontSize(fontSize);
    pdf.setTextColor(0, 0, 0);

    for (let i = 0; i < pageCount; i++) {
      if (i > 0) pdf.addPage([LABEL_H, LABEL_W], 'portrait');
      pdf.text(number, cx, cy, { align: 'center', angle: 90 });
    }

    return pdf;
  }

  // ── Local print agent (optional, silent) ────────────────────────────────
  // If the Logic One print agent (see /print-agent) is running on this Mac,
  // this sends the PDF straight to it and skips the browser dialog entirely.
  // Only ever succeeds on the machine the agent is installed on — from an
  // iPad/iPhone (or a Mac without it installed) this just times out quickly
  // and falls through to the normal dialog below, same as before the agent
  // existed. PRINT_AGENT_KEY must match "sharedSecret" in the agent's
  // config.json — if you change one, change the other.
  const PRINT_AGENT_URL = 'http://localhost:8787/print/labels';
  const PRINT_AGENT_KEY = 'ae8a08b16cc1544d43761a84b37f66aa36dbe480503104e1';

  async function tryAgentPrint(pdfBlob) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(PRINT_AGENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf', 'X-Print-Key': PRINT_AGENT_KEY },
        body: pdfBlob,
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch (e) {
      return false; // agent not running/reachable — not an error, just fall back
    }
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

    const printedSilently = await tryAgentPrint(pdf.output('blob'));
    if (printedSilently) {
      if (typeof showToast === 'function') showToast('success', 'Labels sent to printer');
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
