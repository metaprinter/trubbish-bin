/* Trubbish Bin — drive-auth.js
   Shared Google Drive auth + sync module (GIS token client, no gapi).
   Used by: tracker.js, op-leader-tracker.html, op-carddass-research.html

   Usage:
     const sync = createDriveSync({
       clientId:  '...apps.googleusercontent.com',
       folderId:  '...',                  // Drive folder to store the file in
       fileName:  'my-data.json',         // JSON file managed by this page
       scopes:    '...',                  // optional, defaults to drive.file
       rememberKey: 'slk_drive_signed_in',// optional localStorage flag enabling
                                          // silent auto sign-in on future loads
       onSessionExpired: (retry) => {},   // optional UI hook; call retry() to
                                          // re-prompt the user interactively
     });

     await sync.init();          // resolves true if silent sign-in succeeded
     await sync.signIn();        // interactive (optionally signIn('select_account'))
     sync.signOut();             // revoke + clear state
     sync.isSignedIn();
     const obj = await sync.load();   // parsed JSON, or null if no file yet
     await sync.save(obj);            // creates or updates the file
     const r = await sync.request(url, opts); // raw authed fetch w/ auto-refresh
*/

function createDriveSync(cfg) {
  const DRIVE = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const SCOPES = cfg.scopes || 'https://www.googleapis.com/auth/drive.file';
  const REFRESH_BEFORE = 600 * 1000;      // refresh when <10 min of life left
  const TIMER_INTERVAL = 5 * 60 * 1000;   // background check every 5 min

  const state = {
    tokenClient: null,
    token: null,
    expiry: 0,       // unix ms when the token expires
    fileId: null,
    timer: null,
    pending: null,   // {resolve, reject} for an in-flight token request
  };

  // ── GSI bootstrap ──

  function waitForGsi() {
    return new Promise((resolve) => {
      if (window.google && google.accounts) return resolve();
      const t = setInterval(() => {
        if (window.google && google.accounts) { clearInterval(t); resolve(); }
      }, 100);
    });
  }

  async function init() {
    await waitForGsi();
    state.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cfg.clientId,
      scope: SCOPES,
      callback: onToken,
    });
    // Silent auto sign-in only if this browser has signed in before —
    // otherwise a first-time visitor would get a surprise consent popup.
    if (cfg.rememberKey && localStorage.getItem(cfg.rememberKey)) {
      return trySilent();
    }
    return false;
  }

  // ── Token plumbing ──

  function onToken(resp) {
    const p = state.pending;
    state.pending = null;
    if (resp.error) {
      if (p) p.reject(new Error(resp.error));
      return;
    }
    state.token = resp.access_token;
    state.expiry = Date.now() + (resp.expires_in || 3500) * 1000;
    if (cfg.rememberKey) localStorage.setItem(cfg.rememberKey, '1');
    startTimer();
    if (p) p.resolve();
  }

  function requestToken(prompt) {
    return new Promise((resolve, reject) => {
      if (!state.tokenClient) return reject(new Error('Auth not initialized'));
      if (state.pending) return reject(new Error('Token request already in flight'));
      state.pending = { resolve, reject };
      try {
        state.tokenClient.requestAccessToken(
          prompt !== undefined ? { prompt: prompt } : {}
        );
      } catch (e) {
        state.pending = null;
        reject(e);
      }
    });
  }

  async function trySilent() {
    try { await requestToken(''); return true; }
    catch (e) { console.warn('Silent sign-in failed:', e.message); return false; }
  }

  function signIn(prompt) {
    return requestToken(prompt);
  }

  function signOut() {
    if (state.token) google.accounts.oauth2.revoke(state.token, () => {});
    state.token = null;
    state.expiry = 0;
    state.fileId = null;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (cfg.rememberKey) localStorage.removeItem(cfg.rememberKey);
  }

  function isSignedIn() { return !!state.token; }

  function isStale() {
    return !state.token || Date.now() > state.expiry - REFRESH_BEFORE;
  }

  async function ensureFresh() {
    if (isStale()) await trySilent();
  }

  function startTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => { if (isStale()) trySilent(); }, TIMER_INTERVAL);
  }

  // ── Authed fetch with refresh + retry ──

  async function request(url, opts = {}) {
    await ensureFresh();
    const makeHeaders = () => ({ ...(opts.headers || {}), Authorization: 'Bearer ' + state.token });
    let r = await fetch(url, { ...opts, headers: makeHeaders() });
    if (r.status === 401 || r.status === 403) {
      console.warn('Drive auth failed (' + r.status + '), attempting refresh…');
      const ok = await trySilent();
      if (ok) r = await fetch(url, { ...opts, headers: makeHeaders() });
      if (r.status === 401 || r.status === 403) {
        if (cfg.onSessionExpired) cfg.onSessionExpired(() => requestToken());
        throw new Error('Drive auth ' + r.status + ' — session expired');
      }
    }
    if (!r.ok) throw new Error('Drive ' + r.status);
    return r;
  }

  // ── File operations ──

  async function findFile() {
    const q = encodeURIComponent(
      `name='${cfg.fileName}' and '${cfg.folderId}' in parents and trashed=false`
    );
    const r = await request(
      `${DRIVE}/files?q=${q}&spaces=drive&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`
    );
    const d = await r.json();
    const files = d.files || [];
    if (!files.length) return null;
    // Best-effort cleanup of duplicate files (keep newest)
    for (let i = 1; i < files.length; i++) {
      try { await request(DRIVE + '/files/' + files[i].id, { method: 'DELETE' }); }
      catch (e) { /* non-fatal */ }
    }
    state.fileId = files[0].id;
    return state.fileId;
  }

  async function load() {
    state.fileId = await findFile();
    if (!state.fileId) return null;
    const r = await request(`${DRIVE}/files/${state.fileId}?alt=media`);
    const text = (await r.text()).trim();
    if (!text || text === '{}') return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      // Legacy: file may be base64-encoded from an old broken upload.
      // Decode it and immediately re-save as clean JSON (self-healing).
      const parsed = JSON.parse(atob(text));  // throws if truly unparseable
      await save(parsed);
      return parsed;
    }
  }

  async function save(obj) {
    const body = JSON.stringify(obj);
    if (state.fileId) {
      await request(`${UPLOAD}/files/${state.fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: body,
      });
    } else {
      const meta = { name: cfg.fileName, parents: [cfg.folderId], mimeType: 'application/json' };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
      form.append('file', new Blob([body], { type: 'application/json' }));
      const r = await request(`${UPLOAD}/files?uploadType=multipart`, { method: 'POST', body: form });
      const d = await r.json();
      state.fileId = d.id;
    }
  }

  return {
    init, signIn, signOut, isSignedIn, request, load, save,
    get fileId() { return state.fileId; },
  };
}
