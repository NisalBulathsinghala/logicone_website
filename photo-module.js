/* ============================================================
   Logic One SA — Photo / Video Upload Module
   ------------------------------------------------------------
   Handles upload of photos and videos directly to Google Drive
   via the Drive API resumable upload endpoint, bypassing the
   Apps Script 6MB payload limit entirely.

   Flow:
     1. jsPhotoInit()    — called from jsOpenJob, gets OAuth
                           token + subfolder IDs from Apps Script
     2. User picks files or drops them on the drop zone
     3. Each file is uploaded via Drive resumable upload API
        with a real progress bar
     4. On completion, thumbnail refreshes in the media grid

   Depends on: callScript(), jsCurrentJob, cfg
   ============================================================ */

// ── State ────────────────────────────────────────────────────
let _photoToken       = null;  // OAuth token from Apps Script
let _photoStageMap    = {};    // stage name → subfolder name
let _photoFolderIds   = {};    // subfolder name → Drive folder ID
let _photoCurrentTab  = '01_Receiving Photos';
let _photoMedia       = {};    // subfolder name → [{id,name,mimeType,thumbUrl}]
let _photoLoading     = false;

// ── Style injection ──────────────────────────────────────────
(function injectPhotoStyles() {
  if (document.getElementById('lo-photo-styles')) return;
  const s = document.createElement('style');
  s.id = 'lo-photo-styles';
  s.textContent = `
/* ── Photo tabs ───────────────────────────────────────────── */
.js-photo-tabs {
  display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap;
}
.js-photo-tab {
  padding: 6px 14px; border-radius: 20px; border: 1.5px solid var(--border);
  background: none; font-size: 12px; font-weight: 600; cursor: pointer;
  color: var(--text-secondary); font-family: 'Inter', sans-serif;
  transition: all 0.15s;
}
.js-photo-tab:hover { border-color: var(--accent); color: var(--accent); }
.js-photo-tab.active {
  background: var(--accent); border-color: var(--accent);
  color: #fff;
}
.js-photo-tab .js-photo-tab-count {
  display: inline-block; margin-left: 5px;
  background: rgba(255,255,255,0.25); border-radius: 10px;
  padding: 0 5px; font-size: 10px; min-width: 16px; text-align: center;
}
.js-photo-tab:not(.active) .js-photo-tab-count {
  background: var(--bg-hover, #f1f5f9); color: var(--text-secondary);
}

/* ── Drop zone ────────────────────────────────────────────── */
.js-photo-dropzone {
  border: 2px dashed var(--border); border-radius: 10px;
  padding: 22px 16px; text-align: center; margin-bottom: 14px;
  cursor: pointer; transition: border-color 0.15s, background 0.15s;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  color: var(--text-secondary);
}
.js-photo-dropzone:hover, .js-photo-dropzone.dragover {
  border-color: var(--accent); background: rgba(0,180,216,0.04);
}
.js-photo-dropzone svg { opacity: 0.45; }
.js-photo-dz-label { font-size: 13px; }
.js-photo-dz-btn {
  background: none; border: none; color: var(--accent); font-weight: 600;
  cursor: pointer; font-size: 13px; padding: 0; text-decoration: underline;
  font-family: 'Inter', sans-serif;
}
.js-photo-dz-hint { font-size: 11px; opacity: 0.6; }

/* ── Upload queue ─────────────────────────────────────────── */
.js-photo-queue { margin-bottom: 14px; display: flex; flex-direction: column; gap: 8px; }
.js-upload-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; background: var(--bg-surface, #f8fafc);
  border: 1px solid var(--border); border-radius: 8px; font-size: 12px;
}
.js-upload-item-name {
  flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--text-primary); font-weight: 500;
}
.js-upload-item-size { color: var(--text-secondary); flex-shrink: 0; font-size: 11px; }
.js-upload-bar-wrap {
  flex: 1.5; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;
}
.js-upload-bar {
  height: 100%; background: var(--accent); border-radius: 2px;
  transition: width 0.2s; width: 0%;
}
.js-upload-status { flex-shrink: 0; font-size: 11px; font-weight: 600; white-space: nowrap; }
.js-upload-status.done  { color: #059669; }
.js-upload-status.error { color: #dc2626; }
.js-upload-status.prog  { color: var(--accent); }

/* ── Media grid ───────────────────────────────────────────── */
.js-photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
}
.js-photo-empty {
  grid-column: 1/-1; text-align: center; padding: 24px 0;
  font-size: 12px; color: var(--text-secondary); font-style: italic;
}
.js-photo-thumb {
  position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden;
  background: var(--bg-hover, #f1f5f9); cursor: pointer;
  border: 1px solid var(--border); group: true;
}
.js-photo-thumb img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  transition: transform 0.2s;
}
.js-photo-thumb:hover img { transform: scale(1.05); }
.js-photo-thumb-label {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.65));
  padding: 14px 6px 5px; font-size: 10px; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.js-photo-vid-badge {
  position: absolute; top: 5px; right: 5px;
  background: rgba(0,0,0,0.6); border-radius: 4px; padding: 2px 5px;
  font-size: 9px; font-weight: 700; color: #fff; letter-spacing: 0.04em;
}
.js-photo-grid-loading {
  grid-column: 1/-1; display: flex; align-items: center; gap: 8px;
  padding: 16px 0; color: var(--text-secondary); font-size: 12px;
}
.js-photo-grid-spinner {
  width: 14px; height: 14px; flex-shrink: 0;
  border: 2px solid var(--border); border-top-color: var(--accent);
  border-radius: 50%; animation: lo-spin .7s linear infinite;
}

/* ── Lightbox ─────────────────────────────────────────────── */
.js-photo-lightbox {
  display: none; position: fixed; inset: 0; z-index: 9500;
  background: rgba(0,0,0,0.92); align-items: center; justify-content: center;
}
.js-photo-lightbox.show { display: flex; }
.js-photo-lightbox img, .js-photo-lightbox video {
  max-width: 92vw; max-height: 88vh; border-radius: 6px; object-fit: contain;
}
.js-photo-lb-close {
  position: absolute; top: 18px; right: 22px;
  background: rgba(255,255,255,0.12); border: none; color: #fff;
  width: 38px; height: 38px; border-radius: 50%; cursor: pointer;
  font-size: 20px; display: flex; align-items: center; justify-content: center;
}
.js-photo-lb-name {
  position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.5); color: #fff; font-size: 12px;
  padding: 4px 12px; border-radius: 12px; white-space: nowrap;
}
`;
  document.head.appendChild(s);

  // Lightbox DOM
  const lb = document.createElement('div');
  lb.id = 'jsPhotoLightbox';
  lb.className = 'js-photo-lightbox';
  lb.innerHTML = `
    <button class="js-photo-lb-close" onclick="jsPhotoLightboxClose()">✕</button>
    <div id="jsPhotoLbContent"></div>
    <div class="js-photo-lb-name" id="jsPhotoLbName"></div>`;
  lb.addEventListener('click', e => { if (e.target === lb) jsPhotoLightboxClose(); });
  document.body.appendChild(lb);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') jsPhotoLightboxClose();
  });
})();

// ── Init — called from jsOpenJob ─────────────────────────────
window.jsPhotoInit = async function(job) {
  _photoToken      = null;
  _photoStageMap   = {};
  _photoFolderIds  = {};
  _photoMedia      = {};
  _photoCurrentTab = '01_Receiving Photos';

  const card = document.getElementById('jsPhotosCard');
  if (!card) return;

  // Clear upload queue DOM from previous job
  const queue = document.getElementById('jsPhotoQueue');
  if (queue) { queue.innerHTML = ''; queue.style.display = 'none'; }

  // Reset tabs to first tab
  document.querySelectorAll('.js-photo-tab').forEach((t, i) => {
    t.classList.toggle('active', i === 0);
    const badge = t.querySelector('.js-photo-tab-count');
    if (badge) badge.style.display = 'none';
  });

  // Clear media grid
  const grid = document.getElementById('jsPhotoGrid');
  if (grid) {
    grid.querySelectorAll('.js-photo-thumb, .js-photo-grid-loading').forEach(el => el.remove());
    const empty = document.getElementById('jsPhotoEmpty');
    if (empty) empty.style.display = '';
  }

  if (!job || !job.driveFolder || String(job.driveFolder).startsWith('ERROR')) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';

  // Wire up tab clicks
  document.querySelectorAll('.js-photo-tab').forEach(tab => {
    tab.onclick = () => jsPhotoSwitchTab(tab.dataset.folder);
  });

  // Wire up drop zone — clone to strip accumulated listeners from previous job opens.
  // jsPhotoInit is called on every job open; without cloning, each open adds another
  // listener layer causing files to upload N times (once per job opened).
  let dz = document.getElementById('jsPhotoDropzone');
  if (dz) {
    const freshDz = dz.cloneNode(true);
    dz.parentNode.replaceChild(freshDz, dz);
    dz = freshDz;
  }
  // Re-query input after clone (it's inside the drop zone)
  let inp = document.getElementById('jsPhotoInput');
  if (inp) {
    const freshInp = inp.cloneNode(true);
    inp.parentNode.replaceChild(freshInp, inp);
    inp = freshInp;
  }

  if (dz && inp) {
    let _dzClickLock = false;
    const openPicker = () => {
      if (_dzClickLock) return;
      _dzClickLock = true;
      inp.click();
      setTimeout(() => { _dzClickLock = false; }, 1000);
    };

    dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('dragover');
      jsPhotoHandleFiles([...e.dataTransfer.files]);
    });
    dz.addEventListener('click', e => {
      if (e.target.classList.contains('js-photo-dz-btn')) return;
      openPicker();
    });
    const browseBtn = dz.querySelector('.js-photo-dz-btn');
    if (browseBtn) browseBtn.onclick = e => { e.stopPropagation(); openPicker(); };
    inp.addEventListener('change', () => jsPhotoHandleFiles([...inp.files]));
  }

  // Get upload token + folder IDs
  jsPhotoShowGridLoading();
  try {
    const res = await callScript({ action: 'getUploadToken', driveFolder: job.driveFolder });
    if (res.ok && res.data) {
      _photoToken     = res.data.token;
      _photoStageMap  = res.data.stageMap  || {};
      _photoFolderIds = res.data.stageFolderIds || {};
    }
  } catch (e) { /* non-fatal — uploads will be disabled */ }

  // Load all four tabs in parallel so counts populate immediately on open.
  // The active tab renders its grid; others just populate _photoMedia for counts.
  const allFolders = [
    '01_Receiving Photos',
    '02_Inspection Photos',
    '03_Testing Photos',
    '04_Shipping Photos',
  ];
  await Promise.all(allFolders.map(folder => jsPhotoLoadTab(folder)));
};

// ── Tab switching ────────────────────────────────────────────
window.jsPhotoSwitchTab = async function(folderName) {
  _photoCurrentTab = folderName;
  document.querySelectorAll('.js-photo-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.folder === folderName);
  });
  await jsPhotoLoadTab(folderName);
};

// ── Load media for a subfolder ───────────────────────────────
async function jsPhotoLoadTab(folderName) {
  const job = jsCurrentJob;
  if (!job || !job.driveFolder) return;

  // Use cached if available
  if (_photoMedia[folderName]) {
    jsPhotoRenderGrid(folderName);
    return;
  }

  jsPhotoShowGridLoading();

  try {
    const folderId = _photoFolderIds[folderName];
    if (!folderId || !_photoToken) {
      // Fallback: use listPhotos Apps Script action
      const res = await callScript({ action: 'listPhotos', driveFolder: job.driveFolder });
      if (res.ok && res.data) {
        // Group by subfolder
        _photoMedia = {};
        res.data.forEach(f => {
          if (!_photoMedia[f.subfolder]) _photoMedia[f.subfolder] = [];
          _photoMedia[f.subfolder].push(f);
        });
      }
    } else {
      // Query Drive API directly using the OAuth token (10s timeout)
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 10000);
      try {
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          `'${folderId}' in parents and trashed=false`
        )}&fields=files(id,name,mimeType,thumbnailLink,webViewLink)&orderBy=createdTime`;
        const r = await fetch(url, {
          headers: { Authorization: 'Bearer ' + _photoToken },
          signal: controller.signal,
        });
        clearTimeout(fetchTimer);
        if (r.ok) {
          const data = await r.json();
          _photoMedia[folderName] = (data.files || []).map(f => {
            const isVid = (f.mimeType || '').startsWith('video/');
            return {
              id:       f.id,
              name:     f.name,
              mimeType: f.mimeType || '',
              // Videos often don't have thumbnailLink immediately — use generic icon fallback
              thumbUrl: isVid
                ? (f.thumbnailLink ? f.thumbnailLink.replace('=s220', '=s400') : null)
                : (f.thumbnailLink
                    ? f.thumbnailLink.replace('=s220', '=s400')
                    : `https://drive.google.com/thumbnail?id=${f.id}&sz=w400`),
              viewUrl: f.webViewLink,
            };
          });
        }
      } catch (fetchErr) {
        clearTimeout(fetchTimer);
        if (fetchErr.name === 'AbortError') {
          console.warn('Drive API timeout for', folderName, '— falling back to Apps Script');
        } else {
          throw fetchErr;
        }
      }
    }
  } catch (e) { console.warn('jsPhotoLoadTab error:', e); }

  // Only render the grid for the currently active tab
  if (folderName === _photoCurrentTab) jsPhotoRenderGrid(folderName);
  jsPhotoUpdateTabCounts();
}

// ── Render media grid ────────────────────────────────────────
function jsPhotoRenderGrid(folderName) {
  const grid  = document.getElementById('jsPhotoGrid');
  const empty = document.getElementById('jsPhotoEmpty');
  if (!grid) return;

  const items = _photoMedia[folderName] || [];

  // Remove old thumbs and loading spinner
  grid.querySelectorAll('.js-photo-thumb, .js-photo-grid-loading').forEach(el => el.remove());
  if (empty) empty.style.display = items.length ? 'none' : '';

  items.forEach(item => {
    const isVideo = (item.mimeType || '').startsWith('video/');
    const div = document.createElement('div');
    div.className = 'js-photo-thumb';
    div.title = item.name;
    const noThumb = isVideo && !item.thumbUrl;
    div.innerHTML = noThumb
      ? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-hover,#f1f5f9);">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32" style="opacity:0.35"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
         </div>
         <div class="js-photo-vid-badge">VIDEO</div>
         <div class="js-photo-thumb-label">${item.name}</div>`
      : `<img src="${item.thumbUrl}" alt="${item.name}" loading="lazy"
              onerror="this.src='https://drive.google.com/thumbnail?id=${item.id}&sz=w400'">
         ${isVideo ? '<div class="js-photo-vid-badge">VIDEO</div>' : ''}
         <div class="js-photo-thumb-label">${item.name}</div>`;
    div.onclick = () => jsPhotoLightboxOpen(item);
    grid.appendChild(div);
  });
}

function jsPhotoShowGridLoading() {
  const grid = document.getElementById('jsPhotoGrid');
  if (!grid) return;
  grid.querySelectorAll('.js-photo-thumb').forEach(el => el.remove());
  const empty = document.getElementById('jsPhotoEmpty');
  if (empty) empty.style.display = 'none';
  if (!grid.querySelector('.js-photo-grid-loading')) {
    const l = document.createElement('div');
    l.className = 'js-photo-grid-loading';
    l.innerHTML = '<div class="js-photo-grid-spinner"></div><span>Loading media…</span>';
    grid.appendChild(l);
  }
}

function jsPhotoUpdateTabCounts() {
  document.querySelectorAll('.js-photo-tab').forEach(tab => {
    const fn    = tab.dataset.folder;
    const count = (_photoMedia[fn] || []).length;
    let badge = tab.querySelector('.js-photo-tab-count');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'js-photo-tab-count';
      tab.appendChild(badge);
    }
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? '' : 'none';
  });
}

// ── File handling ────────────────────────────────────────────
async function jsPhotoHandleFiles(files) {
  if (!files.length) return;
  if (!_photoToken) {
    if (typeof showToast === 'function') showToast('error', 'Upload not ready — try reopening the job');
    return;
  }

  const folderId = _photoFolderIds[_photoCurrentTab];
  if (!folderId) {
    if (typeof showToast === 'function') showToast('error', 'Could not find target Drive folder');
    return;
  }

  // Show queue
  const queue = document.getElementById('jsPhotoQueue');
  if (queue) queue.style.display = 'flex';

  // Reset file input so same file can be re-selected
  const inp = document.getElementById('jsPhotoInput');
  if (inp) inp.value = '';

  // Upload each file
  for (const file of files) {
    await jsPhotoUploadFile(file, folderId);
  }

  // Refresh grid
  delete _photoMedia[_photoCurrentTab];
  await jsPhotoLoadTab(_photoCurrentTab);
}

// ── Resumable Drive upload ───────────────────────────────────
async function jsPhotoUploadFile(file, folderId) {
  const queue = document.getElementById('jsPhotoQueue');

  // Create queue item UI
  const item = document.createElement('div');
  item.className = 'js-upload-item';
  item.innerHTML = `
    <span class="js-upload-item-name" title="${file.name}">${file.name}</span>
    <span class="js-upload-item-size">${formatBytes(file.size)}</span>
    <div class="js-upload-bar-wrap"><div class="js-upload-bar" id="bar-${file.name.replace(/\W/g,'_')}"></div></div>
    <span class="js-upload-status prog" id="status-${file.name.replace(/\W/g,'_')}">0%</span>`;
  if (queue) queue.appendChild(item);

  const barId    = `bar-${file.name.replace(/\W/g,'_')}`;
  const statusId = `status-${file.name.replace(/\W/g,'_')}`;

  const setProgress = (pct, label, cls) => {
    const bar    = document.getElementById(barId);
    const status = document.getElementById(statusId);
    if (bar)    bar.style.width = pct + '%';
    if (status) { status.textContent = label; status.className = 'js-upload-status ' + cls; }
  };

  try {
    // 1. Initiate resumable upload session
    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + _photoToken,
          'Content-Type':  'application/json',
          'X-Upload-Content-Type': file.type || 'application/octet-stream',
          'X-Upload-Content-Length': file.size,
        },
        body: JSON.stringify({
          name:    file.name,
          parents: [folderId],
        }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error('Session init failed: ' + initRes.status + ' ' + err.substring(0, 80));
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) throw new Error('No upload URL returned');

    // 2. Upload in chunks (8MB each) with progress
    const CHUNK = 8 * 1024 * 1024; // 8MB
    let offset = 0;

    while (offset < file.size) {
      const end   = Math.min(offset + CHUNK, file.size);
      const chunk = file.slice(offset, end);

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes ${offset}-${end - 1}/${file.size}`,
          'Content-Type':  file.type || 'application/octet-stream',
        },
        body: chunk,
      });

      // 308 = Resume Incomplete (more chunks needed), 200/201 = done
      if (uploadRes.status === 308) {
        const rangeHeader = uploadRes.headers.get('Range');
        offset = rangeHeader ? parseInt(rangeHeader.split('-')[1]) + 1 : end;
        const pct = Math.round((offset / file.size) * 100);
        setProgress(pct, pct + '%', 'prog');
      } else if (uploadRes.status === 200 || uploadRes.status === 201) {
        setProgress(100, 'Done', 'done');
        break;
      } else {
        throw new Error('Upload chunk failed: ' + uploadRes.status);
      }
    }

    if (file.size === 0) setProgress(100, 'Done', 'done');

  } catch (err) {
    console.error('Upload error:', err);
    setProgress(0, 'Failed', 'error');
    if (typeof showToast === 'function') showToast('error', `${file.name}: ${err.message}`);
  }
}

// ── Lightbox ─────────────────────────────────────────────────
window.jsPhotoLightboxOpen = function(item) {
  const lb      = document.getElementById('jsPhotoLightbox');
  const content = document.getElementById('jsPhotoLbContent');
  const name    = document.getElementById('jsPhotoLbName');
  if (!lb || !content) return;

  const isVideo = item.mimeType && item.mimeType.startsWith('video/');
  const viewUrl = item.viewUrl || `https://drive.google.com/file/d/${item.id}/view`;

  if (isVideo) {
    // Videos open in Drive (can't embed cross-origin)
    window.open(viewUrl, '_blank');
    return;
  }

  // Photos: show in lightbox
  const fullUrl = `https://drive.google.com/thumbnail?id=${item.id}&sz=w1600`;
  content.innerHTML = `<img src="${fullUrl}" alt="${item.name}">`;
  if (name) name.textContent = item.name;
  lb.classList.add('show');
};

window.jsPhotoLightboxClose = function() {
  const lb = document.getElementById('jsPhotoLightbox');
  if (lb) {
    lb.classList.remove('show');
    const content = document.getElementById('jsPhotoLbContent');
    if (content) content.innerHTML = '';
  }
};

// ── Helpers ──────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
