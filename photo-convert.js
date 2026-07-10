/* ============================================================
   Logic One SA — Photo Conversion Module
   ------------------------------------------------------------
   Normalises any picked/captured image (HEIC, PNG, WEBP, JPEG,
   whatever a phone or the file picker hands over) into a resized
   JPEG File, client-side, BEFORE it reaches Drive.

   This runs at upload time, not just at PDF-report time — so
   every photo sitting in a job's Drive folder is already a
   plain, consistent JPEG: ready to attach to a Technocity claim
   or embed in a report with no separate conversion step.

   Shared by photo-module.js (dashboard Photos tab) and
   intake.html (iPad intake portal) so both paths produce
   identical output. Videos pass through untouched.

   Exposes: window.loConvertToJpeg(file, opts) -> Promise<File>
   ============================================================ */

// Source-of-truth target — bigger than the PDF-report preset
// (report-module.js uses 1200px / 0.60, tuned to keep the PDF small).
// This is meant to still hold up if someone needs to zoom in on a
// serial number or a fault close-up, while staying well under a
// raw iPhone photo's size.
const LO_PHOTO_MAX_PX  = 2000;
const LO_PHOTO_QUALITY = 0.85;

async function loEnsureHeic2any() {
  if (window.heic2any) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function loIsHeic(file) {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return type === 'image/heic' || type === 'image/heif' || /\.(heic|heif)$/.test(name);
}

function loLoadImage(blobOrFile) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blobOrFile);
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image failed to decode')); };
    img.src = url;
  });
}

function loResizeToJpegBlob(img, maxPx, quality) {
  let w = img.naturalWidth  || img.width;
  let h = img.naturalHeight || img.height;
  if (w > maxPx || h > maxPx) {
    if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
    else       { w = Math.round(w * maxPx / h); h = maxPx; }
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

// Convert one picked/captured file into a resized JPEG File.
// Falls back to the original file untouched on any failure — a photo
// in its original format still beats a failed upload.
window.loConvertToJpeg = async function (file, opts) {
  opts = opts || {};
  const maxPx   = opts.maxPx   || LO_PHOTO_MAX_PX;
  const quality = opts.quality || LO_PHOTO_QUALITY;

  if ((file.type || '').startsWith('video/')) return file; // conversion is photos-only

  let objectUrl = null;
  try {
    let sourceBlob = file;

    if (loIsHeic(file)) {
      await loEnsureHeic2any();
      sourceBlob = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 1 });
    }

    const img = await loLoadImage(sourceBlob);
    objectUrl = img.src;
    const jpegBlob = await loResizeToJpegBlob(img, maxPx, quality);
    if (!jpegBlob) throw new Error('Canvas produced an empty blob');

    const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return new File([jpegBlob], baseName + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });

  } catch (err) {
    console.warn('loConvertToJpeg: falling back to original file —', err.message);
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
};
