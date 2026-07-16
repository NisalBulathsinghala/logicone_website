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

// Shared thumbnail-retry helper, wired to an <img>'s onerror.
// A file that was JUST uploaded often doesn't have a Drive-generated
// thumbnail yet — the first request can 404 or fail for a few seconds
// after upload, even though the file itself is there. Retries twice with
// backoff (cache-busted, so a failed response doesn't get served again)
// before finally calling onGiveUp so the caller can show its own
// placeholder instead of a permanently broken image icon.
window.loThumbRetry = function (img, fileId, onGiveUp) {
  const retry = parseInt(img.dataset.loRetry || '0', 10);
  if (retry >= 2) {
    img.onerror = null;
    if (typeof onGiveUp === 'function') onGiveUp(img);
    return;
  }
  img.dataset.loRetry = String(retry + 1);
  const delay = retry === 0 ? 2500 : 4500;
  setTimeout(() => {
    img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400&r=${Date.now()}`;
  }, delay);
};

// Shared resumable Drive upload — same flow used by photo-module.js and
// the New Job modal, lifted here so new capture surfaces (like the QR
// upload page) don't need a fourth copy of this logic. Takes an already-
// converted File, a Drive folder id, a short-lived OAuth token, and the
// filename to save it as.
// XHR, not fetch — WebKit (the engine behind every iOS browser, Chrome
// included, since Apple requires it) has a known history of unreliable
// fetch() behaviour when streaming a large Blob/File body, surfacing as
// a generic "Load failed" with no further detail. XHR uses a different,
// more battle-tested code path for exactly this kind of upload.
function xhrSend(method, url, headers, body, onChunkProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    Object.keys(headers || {}).forEach(k => xhr.setRequestHeader(k, headers[k]));
    if (onChunkProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onChunkProgress(e.loaded); };
    }
    xhr.onload  = () => resolve(xhr);
    xhr.onerror = () => reject(new Error('Load failed — check your connection and try again'));
    xhr.ontimeout = () => reject(new Error('Upload timed out — try again'));
    xhr.send(body || null);
  });
}

window.loUploadToFolder = async function (file, folderId, token, name, onProgress) {
  const initXhr = await xhrSend('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    'Authorization': 'Bearer ' + token,
    'Content-Type':  'application/json',
    'X-Upload-Content-Type':   file.type || 'image/jpeg',
    'X-Upload-Content-Length': String(file.size),
  }, JSON.stringify({ name, parents: [folderId] }));

  if (initXhr.status < 200 || initXhr.status >= 300) throw new Error('Session init failed: ' + initXhr.status);
  const uploadUrl = initXhr.getResponseHeader('Location');
  if (!uploadUrl) throw new Error('No upload URL returned');

  // Smaller than before (was 8MB) — less memory pressure per request,
  // which is the other half of the same WebKit large-body issue.
  const CHUNK = 5 * 1024 * 1024;
  let offset = 0;

  while (offset < file.size) {
    const end   = Math.min(offset + CHUNK, file.size);
    const chunk = file.slice(offset, end);

    // Up to 2 retries per chunk (3 attempts total) before giving up —
    // "Load failed" is frequently transient on a shaky mobile connection,
    // and retrying just this one chunk is far cheaper than restarting
    // the whole file.
    let xhr, attempt = 0;
    while (true) {
      try {
        xhr = await xhrSend('PUT', uploadUrl, {
          'Content-Range': `bytes ${offset}-${end - 1}/${file.size}`,
          'Content-Type':  file.type || 'image/jpeg',
        }, chunk, sent => {
          if (typeof onProgress === 'function') onProgress(offset + sent, file.size);
        });
        break;
      } catch (err) {
        attempt++;
        if (attempt > 2) throw err;
        await new Promise(r => setTimeout(r, 800 * attempt));
      }
    }

    if (xhr.status === 308) {
      const rangeHeader = xhr.getResponseHeader('Range');
      offset = rangeHeader ? parseInt(rangeHeader.split('-')[1]) + 1 : end;
      if (typeof onProgress === 'function') onProgress(offset, file.size);
    } else if (xhr.status === 200 || xhr.status === 201) {
      if (typeof onProgress === 'function') onProgress(file.size, file.size);
      return;
    } else {
      throw new Error('Upload chunk failed: ' + xhr.status);
    }
  }
  if (file.size === 0) return;
};
