// public/theme.js — themes + music + settings, self-contained.
//   <script src="/theme.js" data-scope="pairing"></script>
//   <script src="/theme.js" data-scope="dashboard"></script>
//   <script src="/theme.js" data-scope="admin"></script>
// Pure client-side. No reload, no fetch on the pairing flow, no socket touch.
// User-imported mp3s live in IndexedDB — they never leave the browser.
(function () {
  const IMG = (f) => `url('/bg/${f}')`;
  const SVG = (s) => `url('data:image/svg+xml;utf8,${encodeURIComponent(s)}')`;

  const NEBULA = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="a" cx="30%" cy="30%" r="70%"><stop offset="0%" stop-color="#7c5cff"/><stop offset="60%" stop-color="#1a1a3a"/><stop offset="100%" stop-color="#05060a"/></radialGradient><radialGradient id="b" cx="70%" cy="70%" r="60%"><stop offset="0%" stop-color="#22d3ee" stop-opacity="0.8"/><stop offset="100%" stop-color="#05060a" stop-opacity="0"/></radialGradient></defs><rect width="600" height="600" fill="url(#a)"/><circle cx="420" cy="420" r="300" fill="url(#b)"/></svg>';
  const GRID = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#05060a"/><g stroke="#1c2a44" stroke-width="1"><path d="M0 60H600 M0 120H600 M0 180H600 M0 240H600 M0 300H600 M0 360H600 M0 420H600 M0 480H600 M0 540H600"/><path d="M60 0V600 M120 0V600 M180 0V600 M240 0V600 M300 0V600 M360 0V600 M420 0V600 M480 0V600 M540 0V600"/></g><g fill="#22d3ee"><circle cx="120" cy="180" r="3"/><circle cx="360" cy="300" r="3"/><circle cx="480" cy="120" r="3"/><circle cx="180" cy="420" r="3"/><circle cx="540" cy="480" r="3"/></g></svg>';
  const WAVES = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#05060a"/><path d="M0 400 Q150 340 300 400 T600 400 V600 H0 Z" fill="#0c4a6e" opacity="0.6"/><path d="M0 460 Q150 400 300 460 T600 460 V600 H0 Z" fill="#0ea5e9" opacity="0.4"/><path d="M0 520 Q150 460 300 520 T600 520 V600 H0 Z" fill="#38bdf8" opacity="0.3"/></svg>';
  const DIGITS = (() => {
    const rows = ['7 3 9 1 4 2 8 5 0 6 3 1 9 7 2 4 5 8 0 3','2 8 4 6 0 9 7 3 1 5 6 2 4 8 9 0 1 7 3 5','5 0 6 3 9 7 1 4 8 2 9 0 5 4 6 1 2 8 3 7','1 4 8 2 6 0 5 3 9 7 4 6 8 2 0 1 5 3 9 7','9 6 3 7 1 4 8 2 5 0 7 3 1 9 4 6 8 0 2 5','4 7 1 5 9 3 8 0 6 2 5 7 0 4 8 2 1 9 3 6','3 1 8 4 0 6 5 9 2 7 8 4 3 1 6 0 9 5 2 7','6 9 2 0 5 7 3 8 1 4 2 5 7 3 9 8 4 6 0 1','8 5 0 2 4 6 1 7 3 9 1 8 6 0 2 7 3 4 5 9','0 2 7 9 3 5 4 6 8 1 3 9 5 7 1 4 6 0 8 2'];
    const text = rows.map((r, i) => `<text x="20" y="${40 + i * 40}">${r}</text>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#05060a"/><g font-family="monospace" font-size="16" fill="#34d399" opacity="0.7">${text}</g></svg>`;
  })();

  // ── animation engines ──
  function matrixEngine(canvas, ctx, accent) {
    const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789'.split('');
    const FS = 16; let cols, drops, raf, w, h;
    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; cols = Math.floor(w / FS); drops = Array(cols).fill(1); }
    resize(); window.addEventListener('resize', resize);
    function frame() {
      ctx.fillStyle = 'rgba(5,6,8,0.08)'; ctx.fillRect(0, 0, w, h);
      ctx.font = FS + 'px ui-monospace, monospace';
      for (let i = 0; i < cols; i++) {
        ctx.fillStyle = Math.random() > 0.97 ? '#e7e7ea' : accent;
        ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * FS, drops[i] * FS);
        if (drops[i] * FS > h && Math.random() > 0.975) drops[i] = 0; drops[i]++;
      }
      raf = requestAnimationFrame(frame);
    }
    frame(); return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }
  function particlesEngine(canvas, ctx, accent) {
    let parts = [], w, h, raf;
    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; parts = Array.from({ length: 120 }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: Math.random() * 1.6 + 0.3 })); }
    resize(); window.addEventListener('resize', resize);
    function frame() {
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = accent;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame(); return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }
  function starfieldEngine(canvas, ctx, accent) {
    let stars = [], w, h, raf;
    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; stars = Array.from({ length: 260 }, () => ({ x: Math.random() * w - w / 2, y: Math.random() * h - h / 2, z: Math.random() * w })); }
    resize(); window.addEventListener('resize', resize);
    function frame() {
      ctx.fillStyle = 'rgba(5,6,8,0.35)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = accent;
      for (const s of stars) {
        s.z -= 4; if (s.z <= 0) { s.x = Math.random() * w - w / 2; s.y = Math.random() * h - h / 2; s.z = w; }
        const k = 128 / s.z; const px = s.x * k + w / 2, py = s.y * k + h / 2; const r = Math.max(0.3, (1 - s.z / w) * 2);
        ctx.fillRect(px, py, r, r);
      }
      raf = requestAnimationFrame(frame);
    }
    frame(); return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }
  const ENGINES = { matrix: matrixEngine, particles: particlesEngine, starfield: starfieldEngine };

  // ── built-in themes ──
  const BUILTINS = [
    { kind: 'img',  name: 'solo',       src: IMG('01.jpeg'), accent: '#7c5cff', glow: '124,92,255' },
    { kind: 'img',  name: 'sword',      src: IMG('02.jpeg'), accent: '#38bdf8', glow: '56,189,248' },
    { kind: 'img',  name: 'meta',       src: IMG('03.jpeg'), accent: '#0866ff', glow: '8,102,255'  },
    { kind: 'img',  name: 'pepe',       src: IMG('04.jpeg'), accent: '#86c06c', glow: '134,192,108' },
    { kind: 'img',  name: 'isagi',      src: IMG('05.jpeg'), accent: '#22d3ee', glow: '34,211,238' },
    { kind: 'img',  name: 'heartbreak', src: IMG('06.jpeg'), accent: '#e879f9', glow: '232,121,249' },
    { kind: 'img',  name: 'restricted', src: IMG('07.jpeg'), accent: '#f59e0b', glow: '245,158,11' },
    { kind: 'img',  name: 'banned',     src: IMG('08.jpeg'), accent: '#e11d48', glow: '225,29,72'  },
    { kind: 'svg',  name: 'nebula',     src: SVG(NEBULA), accent: '#a78bfa', glow: '167,139,250' },
    { kind: 'svg',  name: 'grid',       src: SVG(GRID),   accent: '#22d3ee', glow: '34,211,238'  },
    { kind: 'svg',  name: 'waves',      src: SVG(WAVES),  accent: '#38bdf8', glow: '56,189,248'  },
    { kind: 'svg',  name: 'digits',     src: SVG(DIGITS), accent: '#34d399', glow: '52,211,153'  },
    { kind: 'anim', name: 'matrix',     engine: 'matrix',    accent: '#34d399', glow: '52,211,153'  },
    { kind: 'anim', name: 'particles',  engine: 'particles', accent: '#60a5fa', glow: '96,165,250'  },
    { kind: 'anim', name: 'starfield',  engine: 'starfield', accent: '#e7e7ea', glow: '231,231,234' },
  ];
  const PUBLIC_SET_NAMES  = ['solo','sword','meta','pepe','isagi','nebula','grid','waves','digits','matrix','particles','starfield'];
  const REACTIVE_SET_NAMES = ['heartbreak','restricted','banned'];
  const ROTATE_MS = 22000;
  const SERVER_TRACKS = ['track1.mp3','track2.mp3','track3.mp3','track4.mp3'];

  const scriptEl = document.currentScript || document.querySelector('script[data-scope]');
  const SCOPE = (scriptEl?.dataset?.scope || 'pairing').toLowerCase();
  const SETTINGS_KEY = 'bothub.theme_settings:' + SCOPE;

  const DEFAULTS = {
    themeKey: 'solo', blur: 48, opacity: 0.9,
    autoRotate: true, includeGenerated: true,
    musicOn: false, musicVol: 0.35, musicTrack: '',
  };
  const settings = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

  let CUSTOM = [];
  let DISABLED = new Set();

  function mergedThemes() {
    const builtins = BUILTINS.filter((t) => !DISABLED.has(t.name));
    const custom = CUSTOM.map((c) => ({ kind: c.kind || 'img', name: c.name, src: c.src, accent: c.accent || '#7c5cff', glow: c.glow || '124,92,255', customId: c.id }));
    return [...builtins, ...custom];
  }
  function allowedNames(themes) {
    const baseSet = (SCOPE === 'pairing' || SCOPE === 'public')
      ? new Set(PUBLIC_SET_NAMES)
      : (localStorage.getItem('bothub.has_session') === '1'
          ? new Set([...PUBLIC_SET_NAMES, ...REACTIVE_SET_NAMES])
          : new Set(PUBLIC_SET_NAMES));
    return themes.filter((t) => baseSet.has(t.name) || t.customId)
                 .filter((t) => settings.includeGenerated ? true : t.kind === 'img')
                 .map((t) => t.name);
  }

  // ── IndexedDB for user mp3s ──
  function openMusicDB() {
    return new Promise((res, rej) => {
      const req = indexedDB.open('bothub-music', 1);
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' }); };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  async function listUserTracks() {
    const db = await openMusicDB();
    return new Promise((res, rej) => {
      const r = db.transaction('tracks', 'readonly').objectStore('tracks').getAll();
      r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
    });
  }
  async function putUserTrack(file) {
    const db = await openMusicDB();
    const id = 'user:' + crypto.randomUUID();
    return new Promise((res, rej) => {
      const r = db.transaction('tracks', 'readwrite').objectStore('tracks').put({ id, name: file.name, blob: file, addedAt: Date.now() });
      r.onsuccess = () => res({ id, name: file.name }); r.onerror = () => rej(r.error);
    });
  }
  async function deleteUserTrack(id) {
    const db = await openMusicDB();
    return new Promise((res, rej) => {
      const r = db.transaction('tracks', 'readwrite').objectStore('tracks').delete(id);
      r.onsuccess = () => res(); r.onerror = () => rej(r.error);
    });
  }

  // ── stylesheet ──
  const style = document.createElement('style');
  style.textContent = `
    :root { --accent: #3b82f6; --glow: 59,130,246; }
    #bh-bg, #bh-bg-next { position: fixed; inset: -80px; z-index: -2; background-size: cover; background-position: center; filter: blur(var(--bh-blur, 48px)) saturate(1.35); transform: scale(1.15); transition: opacity 1s ease, filter .2s ease; pointer-events: none; will-change: opacity; }
    #bh-bg { opacity: var(--bh-opacity, 0.9); }
    #bh-bg-next { opacity: 0; }
    #bh-canvas { position: fixed; inset: 0; z-index: -2; display: none; pointer-events: none; opacity: var(--bh-opacity, 0.9); }
    #bh-bg-overlay { position: fixed; inset: 0; z-index: -1; pointer-events: none; background: radial-gradient(120% 100% at 50% 0%, rgba(0,0,0,0.05) 0%, rgba(5,6,8,0.45) 55%, rgba(5,6,8,0.75) 100%); }
    #bh-tools { position: fixed; right: 14px; bottom: 14px; z-index: 1000; display: flex; gap: 8px; align-items: center; font-family: ui-monospace, monospace; font-size: 11px; }
    #bh-theme-chip, #bh-music-btn, #bh-settings-btn { background: rgba(20,22,26,0.78); color: #8b8f96; border: 1px solid #262a30; border-radius: 999px; padding: 6px 12px; cursor: pointer; user-select: none; backdrop-filter: blur(8px); letter-spacing: 0.08em; transition: color .15s, border-color .15s; font-family: inherit; font-size: inherit; }
    #bh-music-btn, #bh-settings-btn { padding: 6px 10px; font-size: 14px; line-height: 1; display: inline-flex; align-items: center; gap: 6px; }
    #bh-theme-chip:hover, #bh-music-btn:hover, #bh-settings-btn:hover { color: var(--accent); border-color: var(--accent); }
    #bh-theme-chip .dot { color: var(--accent); margin-right: 6px; }
    #bh-music-btn.on, #bh-settings-btn.on { color: var(--accent); border-color: var(--accent); }
    #bh-music-btn .disc { display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at center, var(--accent) 0 2.5px, #101010 2.5px 5px, #2a2a2a 5px 6px, #101010 6px 100%); border: 1px solid #333; animation: bh-spin 1.8s linear infinite; animation-play-state: paused; }
    #bh-music-btn.on .disc { animation-play-state: running; }
    @keyframes bh-spin { to { transform: rotate(360deg); } }
    #bh-panel { position: fixed; right: 14px; bottom: 58px; z-index: 1001; width: 360px; max-width: calc(100vw - 28px); max-height: calc(100vh - 90px); overflow-y: auto; background: rgba(14,16,20,0.94); color: #e7e7ea; border: 1px solid #262a30; border-radius: 14px; backdrop-filter: blur(14px); box-shadow: 0 24px 60px rgba(0,0,0,0.6); font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; padding: 16px; display: none; }
    #bh-panel.open { display: block; }
    #bh-panel h3 { margin: 0 0 14px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #8b8f96; font-weight: 500; }
    #bh-panel .section { margin-bottom: 16px; }
    #bh-panel .divider { height: 1px; background: #1c1f24; margin: 16px 0; }
    #bh-panel .label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6f76; margin-bottom: 8px; display: flex; justify-content: space-between; }
    #bh-panel .label .val { color: var(--accent); }
    #bh-panel input[type=range] { width: 100%; -webkit-appearance: none; appearance: none; height: 4px; background: #1c1f24; border-radius: 3px; outline: none; }
    #bh-panel input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); cursor: pointer; box-shadow: 0 0 0 3px rgba(var(--glow), 0.25); }
    #bh-panel input[type=range]::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 50%; background: var(--accent); cursor: pointer; }
    #bh-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    #bh-grid button { aspect-ratio: 16/10; border-radius: 6px; border: 1px solid #262a30; background-size: cover; background-position: center; cursor: pointer; padding: 0; position: relative; overflow: hidden; }
    #bh-grid button:hover { transform: translateY(-1px); }
    #bh-grid button.active { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(var(--glow), 0.25); }
    #bh-grid button[data-kind="anim"]::after { content: '▶'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--accent); font-size: 14px; background: rgba(5,6,8,0.55); }
    #bh-panel .toggles { display: grid; gap: 8px; font-size: 12px; color: #b8bcc4; }
    #bh-panel .toggles label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    #bh-panel .toggles input { accent-color: var(--accent); }
    #bh-panel select, #bh-panel input[type=file] { width: 100%; background: #14161a; color: #e7e7ea; border: 1px solid #262a30; border-radius: 6px; padding: 8px 10px; font: inherit; font-size: 12px; outline: none; }
    #bh-panel select:focus { border-color: var(--accent); }
    #bh-panel .row { display: flex; gap: 6px; margin-top: 8px; }
    #bh-panel .row button { flex: 1; background: transparent; color: #8b8f96; border: 1px solid #262a30; border-radius: 6px; padding: 6px 10px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
    #bh-panel .row button:hover { color: var(--accent); border-color: var(--accent); }
    #bh-panel .row button.danger:hover { color: #f87171; border-color: #f87171; }
    #bh-panel .hint { color: #6b6f76; font-size: 11px; margin-top: 6px; }
    #bh-panel .row-end { display: flex; justify-content: flex-end; margin-top: 12px; }
    #bh-panel .reset { background: transparent; color: #8b8f96; border: 1px solid #262a30; border-radius: 6px; padding: 5px 10px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
    #bh-panel .reset:hover { color: #f87171; border-color: #f87171; }
    body { background: #06070a; }
  `;
  document.head.appendChild(style);

  // ── DOM ──
  const bg = document.createElement('div'); bg.id = 'bh-bg';
  const bgNext = document.createElement('div'); bgNext.id = 'bh-bg-next';
  const canvas = document.createElement('canvas'); canvas.id = 'bh-canvas';
  const overlay = document.createElement('div'); overlay.id = 'bh-bg-overlay';
  const tools = document.createElement('div'); tools.id = 'bh-tools';
  const chip = document.createElement('div'); chip.id = 'bh-theme-chip'; chip.innerHTML = '<span class="dot">●</span><span class="name"></span>';
  const musicBtn = document.createElement('button'); musicBtn.id = 'bh-music-btn'; musicBtn.type = 'button'; musicBtn.title = 'music';
  musicBtn.innerHTML = '<span class="disc"></span>';
  const gear = document.createElement('button'); gear.id = 'bh-settings-btn'; gear.type = 'button'; gear.textContent = '⚙'; gear.title = 'settings';
  tools.appendChild(chip); tools.appendChild(musicBtn); tools.appendChild(gear);

  const panel = document.createElement('div'); panel.id = 'bh-panel';
  panel.innerHTML = `
    <h3>settings</h3>
    <div class="section">
      <div class="label">theme</div>
      <div id="bh-grid"></div>
    </div>
    <div class="section">
      <div class="label">blur <span class="val" id="bh-blur-val"></span></div>
      <input type="range" id="bh-blur" min="0" max="100" step="1">
    </div>
    <div class="section">
      <div class="label">brightness <span class="val" id="bh-opacity-val"></span></div>
      <input type="range" id="bh-opacity" min="20" max="100" step="1">
    </div>
    <div class="section">
      <div class="toggles">
        <label><input type="checkbox" id="bh-rotate"> auto-rotate (22s)</label>
        <label><input type="checkbox" id="bh-gen"> include generated themes</label>
      </div>
    </div>
    <div class="divider"></div>
    <div class="section">
      <div class="label">music</div>
      <select id="bh-music-track"></select>
      <div class="hint" id="bh-music-hint"></div>
      <div class="row">
        <button type="button" id="bh-music-import">import mp3</button>
        <button type="button" id="bh-music-delete" class="danger">delete</button>
      </div>
      <input type="file" id="bh-music-file" accept="audio/*" style="display:none">
      <div style="margin-top:10px;">
        <div class="label">volume <span class="val" id="bh-vol-val"></span></div>
        <input type="range" id="bh-vol" min="0" max="100" step="1">
      </div>
      <div class="toggles" style="margin-top:10px;">
        <label><input type="checkbox" id="bh-music-on"> play on visit</label>
      </div>
    </div>
    <div class="row-end"><button class="reset" id="bh-reset">reset</button></div>
  `;

  const audio = new Audio(); audio.loop = true; audio.preload = 'none';
  let serverTracks = []; let userTracks = []; let musicStarted = false;
  let objectUrl = null;

  function trackOptions() {
    const opts = [];
    for (const s of serverTracks) opts.push({ id: s, label: s, src: '/music/' + s });
    for (const u of userTracks) opts.push({ id: u.id, label: '⭐ ' + u.name, blobId: u.id });
    return opts;
  }

  async function detectServerTracks() {
    const out = [];
    for (const name of SERVER_TRACKS) {
      try { const r = await fetch('/music/' + name, { method: 'HEAD' }); if (r.ok) out.push(name); } catch {}
    }
    return out;
  }

  function refreshTrackSelect() {
    const sel = panel.querySelector('#bh-music-track');
    const opts = trackOptions();
    sel.innerHTML = '';
    if (!opts.length) {
      const o = document.createElement('option'); o.value = ''; o.textContent = '(no tracks — import one)';
      sel.appendChild(o); sel.disabled = true;
      panel.querySelector('#bh-music-hint').textContent = 'server tracks or import your own (stored locally in this browser)';
      return;
    }
    sel.disabled = false;
    for (const o of opts) { const opt = document.createElement('option'); opt.value = o.id; opt.textContent = o.label; sel.appendChild(opt); }
    if (!opts.some((o) => o.id === settings.musicTrack)) settings.musicTrack = opts[0].id;
    sel.value = settings.musicTrack;
    applyTrackSrc();
    panel.querySelector('#bh-music-hint').textContent = 'imported tracks stay in this browser only';
  }

  async function applyTrackSrc() {
    const id = settings.musicTrack;
    if (!id) return;
    if (id.startsWith('user:')) {
      const u = userTracks.find((x) => x.id === id);
      if (!u) return;
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      objectUrl = URL.createObjectURL(u.blob);
      audio.src = objectUrl;
    } else {
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      audio.src = '/music/' + id;
    }
    audio.volume = settings.musicVol;
  }

  function inject() {
    if (!document.body || document.getElementById('bh-bg')) return;
    document.body.insertBefore(overlay, document.body.firstChild);
    document.body.insertBefore(canvas, overlay);
    document.body.insertBefore(bgNext, canvas);
    document.body.insertBefore(bg, bgNext);
    document.body.appendChild(tools);
    document.body.appendChild(panel);
    buildGrid();
    bindPanel();
    loadAll();
  }
  if (document.body) inject(); else document.addEventListener('DOMContentLoaded', inject);

  // ── grid ──
  function buildGrid() {
    const themes = mergedThemes();
    const allowedSet = new Set(allowedNames(themes));
    const g = panel.querySelector('#bh-grid');
    g.innerHTML = '';
    themes.forEach((t) => {
      if (!allowedSet.has(t.name)) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.kind = t.kind;
      b.dataset.name = t.name;
      if (t.kind !== 'anim') b.style.backgroundImage = t.src;
      b.title = t.name;
      if (t.name === settings.themeKey) b.classList.add('active');
      b.addEventListener('click', () => {
        settings.themeKey = t.name;
        applyByName(t.name);
        saveSettings();
        g.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      });
      g.appendChild(b);
    });
  }

  // ── panel bindings ──
  function bindPanel() {
    const blurEl = panel.querySelector('#bh-blur');
    const opEl = panel.querySelector('#bh-opacity');
    const rotEl = panel.querySelector('#bh-rotate');
    const genEl = panel.querySelector('#bh-gen');
    const musicOnEl = panel.querySelector('#bh-music-on');
    const volEl = panel.querySelector('#bh-vol');
    const fileEl = panel.querySelector('#bh-music-file');

    blurEl.value = settings.blur; opEl.value = Math.round(settings.opacity * 100);
    rotEl.checked = settings.autoRotate; genEl.checked = settings.includeGenerated;
    musicOnEl.checked = settings.musicOn; volEl.value = Math.round(settings.musicVol * 100);
    panel.querySelector('#bh-blur-val').textContent = settings.blur + 'px';
    panel.querySelector('#bh-opacity-val').textContent = Math.round(settings.opacity * 100) + '%';
    panel.querySelector('#bh-vol-val').textContent = Math.round(settings.musicVol * 100) + '%';

    blurEl.addEventListener('input', () => { settings.blur = parseInt(blurEl.value, 10); document.documentElement.style.setProperty('--bh-blur', settings.blur + 'px'); panel.querySelector('#bh-blur-val').textContent = settings.blur + 'px'; saveSettings(); });
    opEl.addEventListener('input', () => { settings.opacity = parseInt(opEl.value, 10) / 100; document.documentElement.style.setProperty('--bh-opacity', String(settings.opacity)); panel.querySelector('#bh-opacity-val').textContent = Math.round(settings.opacity * 100) + '%'; saveSettings(); });
    rotEl.addEventListener('change', () => { settings.autoRotate = rotEl.checked; saveSettings(); if (settings.autoRotate) scheduleRotate(); else if (timer) { clearTimeout(timer); timer = null; } });
    genEl.addEventListener('change', () => { settings.includeGenerated = genEl.checked; saveSettings(); buildGrid(); });

    volEl.addEventListener('input', () => { settings.musicVol = parseInt(volEl.value, 10) / 100; audio.volume = settings.musicVol; panel.querySelector('#bh-vol-val').textContent = Math.round(settings.musicVol * 100) + '%'; saveSettings(); });
    musicOnEl.addEventListener('change', () => { settings.musicOn = musicOnEl.checked; saveSettings(); if (settings.musicOn) tryStartMusic(); else { audio.pause(); musicStarted = false; } });
    panel.querySelector('#bh-music-track').addEventListener('change', async (e) => {
      settings.musicTrack = e.target.value; saveSettings();
      const wasPlaying = !audio.paused; await applyTrackSrc();
      if (wasPlaying) audio.play().catch(() => {});
    });
    panel.querySelector('#bh-music-import').addEventListener('click', () => fileEl.click());
    fileEl.addEventListener('change', async () => {
      const f = fileEl.files?.[0]; if (!f) return;
      const entry = await putUserTrack(f);
      userTracks.push({ id: entry.id, name: entry.name, blob: f });
      settings.musicTrack = entry.id; saveSettings();
      refreshTrackSelect();
      fileEl.value = '';
    });
    panel.querySelector('#bh-music-delete').addEventListener('click', async () => {
      const id = settings.musicTrack;
      if (!id.startsWith('user:')) return;
      if (!confirm('Delete this imported track?')) return;
      await deleteUserTrack(id);
      userTracks = userTracks.filter((x) => x.id !== id);
      settings.musicTrack = ''; saveSettings();
      refreshTrackSelect();
    });

    panel.querySelector('#bh-reset').addEventListener('click', () => {
      Object.assign(settings, DEFAULTS); saveSettings();
      document.documentElement.style.removeProperty('--bh-blur');
      document.documentElement.style.removeProperty('--bh-opacity');
      blurEl.value = settings.blur; opEl.value = Math.round(settings.opacity * 100);
      rotEl.checked = settings.autoRotate; genEl.checked = settings.includeGenerated;
      musicOnEl.checked = settings.musicOn; volEl.value = Math.round(settings.musicVol * 100);
      panel.querySelector('#bh-blur-val').textContent = settings.blur + 'px';
      panel.querySelector('#bh-opacity-val').textContent = Math.round(settings.opacity * 100) + '%';
      panel.querySelector('#bh-vol-val').textContent = Math.round(settings.musicVol * 100) + '%';
      audio.pause(); musicStarted = false; musicBtn.classList.remove('on');
      buildGrid(); applyByName(settings.themeKey); scheduleRotate();
    });

    gear.addEventListener('click', () => { panel.classList.toggle('open'); gear.classList.toggle('on', panel.classList.contains('open')); });
    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('open')) return;
      if (panel.contains(e.target) || gear.contains(e.target)) return;
      panel.classList.remove('open'); gear.classList.remove('on');
    });
  }

  // ── music ──
  async function loadAll() {
    // custom themes
    try { const r = await fetch('/api/themes'); if (r.ok) { const d = await r.json(); CUSTOM = d.custom || []; DISABLED = new Set(d.disabled || []); } } catch {}
    buildGrid();
    // music
    serverTracks = await detectServerTracks();
    try { userTracks = await listUserTracks(); } catch { userTracks = []; }
    refreshTrackSelect();
    audio.addEventListener('play', () => musicBtn.classList.add('on'));
    audio.addEventListener('pause', () => musicBtn.classList.remove('on'));
    tryStartMusic();
  }

  function tryStartMusic() {
    if (musicStarted || !settings.musicOn || !settings.musicTrack) return;
    audio.play().then(() => { musicStarted = true; }).catch(() => {});
  }

  musicBtn.addEventListener('click', () => {
    if (!settings.musicTrack) return;
    if (audio.paused) {
      settings.musicOn = true; saveSettings();
      panel.querySelector('#bh-music-on').checked = true;
      audio.play().then(() => { musicStarted = true; }).catch(() => {});
    } else {
      settings.musicOn = false; saveSettings();
      panel.querySelector('#bh-music-on').checked = false;
      audio.pause(); musicStarted = false;
    }
  });

  const unlock = () => { if (settings.musicOn) tryStartMusic(); };
  document.addEventListener('click', unlock);
  document.addEventListener('keydown', unlock);
  document.addEventListener('touchstart', unlock, { passive: true });

  // ── apply ──
  const root = document.documentElement;
  let timer = null; let stopEngine = null;

  function applyByName(name) {
    const themes = mergedThemes();
    const allowedSet = new Set(allowedNames(themes));
    let t = themes.find((x) => x.name === name && allowedSet.has(x.name));
    if (!t) t = themes.find((x) => allowedSet.has(x.name)) || themes[0];
    settings.themeKey = t.name;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--glow', t.glow);
    root.style.setProperty('--bh-blur', settings.blur + 'px');
    root.style.setProperty('--bh-opacity', String(settings.opacity));
    if (stopEngine) { stopEngine(); stopEngine = null; }
    if (t.kind === 'anim') {
      bg.style.display = 'none'; bgNext.style.display = 'none'; canvas.style.display = 'block';
      stopEngine = ENGINES[t.engine](canvas, canvas.getContext('2d'), t.accent);
    } else {
      canvas.style.display = 'none'; bg.style.display = ''; bgNext.style.display = '';
      if (!bg.style.backgroundImage) bg.style.backgroundImage = t.src;
      else { bgNext.style.backgroundImage = t.src; bgNext.style.opacity = '1'; setTimeout(() => { bg.style.backgroundImage = t.src; bgNext.style.opacity = '0'; }, 1000); }
    }
    const idx = allowedNames(themes).indexOf(t.name);
    chip.querySelector('.name').textContent = `${idx + 1}/${allowedNames(themes).length} · ${t.name}${SCOPE === 'pairing' ? '' : ' · ' + SCOPE}`;
    saveSettings();
  }

  function advance() {
    const names = allowedNames(mergedThemes());
    const i = names.indexOf(settings.themeKey);
    const next = names[(i === -1 ? 0 : i + 1) % names.length];
    applyByName(next);
    scheduleRotate();
  }
  function scheduleRotate() {
    if (timer) clearTimeout(timer);
    timer = settings.autoRotate ? setTimeout(advance, ROTATE_MS) : null;
  }
  chip.addEventListener('click', () => { if (timer) clearTimeout(timer); advance(); });

  applyByName(settings.themeKey);
  scheduleRotate();

  window.bothubMarkSession = function () { localStorage.setItem('bothub.has_session', '1'); };
})();
