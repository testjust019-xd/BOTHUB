// public/theme.js — themes + music + cursor + settings. Generated backgrounds only.
//   <script src="/theme.js" data-scope="pairing"></script>
//   <script src="/theme.js" data-scope="dashboard"></script>
//   <script src="/theme.js" data-scope="admin"></script>
// Pure client-side. No reload, no fetch on the pairing flow, no socket touch.
(function () {
  const SVG = (s) => `url('data:image/svg+xml;utf8,${encodeURIComponent(s)}')`;

  // ── SVG backgrounds ──
  const NEBULA = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="a" cx="30%" cy="30%" r="70%"><stop offset="0%" stop-color="#7c5cff"/><stop offset="60%" stop-color="#1a1a3a"/><stop offset="100%" stop-color="#05060a"/></radialGradient><radialGradient id="b" cx="70%" cy="70%" r="60%"><stop offset="0%" stop-color="#22d3ee" stop-opacity="0.8"/><stop offset="100%" stop-color="#05060a" stop-opacity="0"/></radialGradient></defs><rect width="600" height="600" fill="url(#a)"/><circle cx="420" cy="420" r="300" fill="url(#b)"/></svg>';
  const GRID = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#05060a"/><g stroke="#1c2a44" stroke-width="1"><path d="M0 60H600 M0 120H600 M0 180H600 M0 240H600 M0 300H600 M0 360H600 M0 420H600 M0 480H600 M0 540H600"/><path d="M60 0V600 M120 0V600 M180 0V600 M240 0V600 M300 0V600 M360 0V600 M420 0V600 M480 0V600 M540 0V600"/></g><g fill="#22d3ee"><circle cx="120" cy="180" r="3"/><circle cx="360" cy="300" r="3"/><circle cx="480" cy="120" r="3"/><circle cx="180" cy="420" r="3"/><circle cx="540" cy="480" r="3"/></g></svg>';
  const WAVES = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#05060a"/><path d="M0 400 Q150 340 300 400 T600 400 V600 H0 Z" fill="#0c4a6e" opacity="0.6"/><path d="M0 460 Q150 400 300 460 T600 460 V600 H0 Z" fill="#0ea5e9" opacity="0.4"/><path d="M0 520 Q150 460 300 520 T600 520 V600 H0 Z" fill="#38bdf8" opacity="0.3"/></svg>';
  const DIGITS = (() => {
    const rows = ['7 3 9 1 4 2 8 5 0 6 3 1 9 7 2 4 5 8 0 3','2 8 4 6 0 9 7 3 1 5 6 2 4 8 9 0 1 7 3 5','5 0 6 3 9 7 1 4 8 2 9 0 5 4 6 1 2 8 3 7','1 4 8 2 6 0 5 3 9 7 4 6 8 2 0 1 5 3 9 7','9 6 3 7 1 4 8 2 5 0 7 3 1 9 4 6 8 0 2 5','4 7 1 5 9 3 8 0 6 2 5 7 0 4 8 2 1 9 3 6','3 1 8 4 0 6 5 9 2 7 8 4 3 1 6 0 9 5 2 7','6 9 2 0 5 7 3 8 1 4 2 5 7 3 9 8 4 6 0 1','8 5 0 2 4 6 1 7 3 9 1 8 6 0 2 7 3 4 5 9','0 2 7 9 3 5 4 6 8 1 3 9 5 7 1 4 6 0 8 2'];
    const text = rows.map((r, i) => `<text x="20" y="${40 + i * 40}">${r}</text>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#05060a"/><g font-family="monospace" font-size="16" fill="#34d399" opacity="0.7">${text}</g></svg>`;
  })();
  const AURORA = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="aa" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0a0a1f"/><stop offset="100%" stop-color="#05060a"/></linearGradient><linearGradient id="ab" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#7c5cff" stop-opacity="0"/><stop offset="50%" stop-color="#7c5cff" stop-opacity="0.6"/><stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/></linearGradient><linearGradient id="ac" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#22d3ee" stop-opacity="0"/><stop offset="50%" stop-color="#34d399" stop-opacity="0.5"/><stop offset="100%" stop-color="#a78bfa" stop-opacity="0"/></linearGradient></defs><rect width="600" height="600" fill="url(#aa)"/><ellipse cx="300" cy="180" rx="520" ry="80" fill="url(#ab)" opacity="0.7"/><ellipse cx="300" cy="280" rx="480" ry="60" fill="url(#ac)" opacity="0.55"/><ellipse cx="300" cy="380" rx="500" ry="70" fill="url(#ab)" opacity="0.45"/><ellipse cx="300" cy="470" rx="450" ry="50" fill="url(#ac)" opacity="0.35"/></svg>';
  const MESH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#05060a"/><g stroke="#7c5cff" stroke-width="1" fill="none" opacity="0.45"><path d="M0 0 L150 80 L300 20 L450 100 L600 40"/><path d="M0 200 L150 280 L300 220 L450 300 L600 240"/><path d="M0 400 L150 480 L300 420 L450 500 L600 440"/><path d="M0 0 L0 600 M150 80 L150 280 L150 480 M300 20 L300 220 L300 420 M450 100 L450 300 L450 500 M600 40 L600 440"/></g><g fill="#22d3ee" opacity="0.7"><circle cx="150" cy="80" r="4"/><circle cx="300" cy="20" r="4"/><circle cx="450" cy="100" r="4"/><circle cx="150" cy="280" r="4"/><circle cx="300" cy="220" r="4"/><circle cx="450" cy="300" r="4"/><circle cx="150" cy="480" r="4"/><circle cx="300" cy="420" r="4"/><circle cx="450" cy="500" r="4"/></g></svg>';
  const CIRCUIT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#05060a"/><g stroke="#34d399" stroke-width="1.5" fill="none" opacity="0.55"><path d="M60 60 H180 V120 H300 V60 H420 V180"/><path d="M60 240 H240 V360 H360 V240 H540"/><path d="M60 480 H180 V540 H420 V480 H540"/><path d="M120 60 V240 M240 120 V360 M360 60 V300 M480 180 V480"/></g><g fill="#34d399" opacity="0.85"><circle cx="60" cy="60" r="5"/><circle cx="420" cy="180" r="5"/><circle cx="240" cy="360" r="5"/><circle cx="540" cy="240" r="5"/><circle cx="420" cy="480" r="5"/><circle cx="480" cy="480" r="5"/></g></svg>';
  const HEXGRID = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><pattern id="hg" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse"><path d="M15 1 L45 1 L60 26 L45 51 L15 51 L0 26 Z" fill="none" stroke="#22d3ee" stroke-width="1" opacity="0.32"/></pattern></defs><rect width="600" height="600" fill="#05060a"/><rect width="600" height="600" fill="url(#hg)"/></svg>';

  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HAS_FINE_POINTER = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ── canvas animation engines ──
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
      if (!REDUCED) raf = requestAnimationFrame(frame);
    }
    frame();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
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
      if (!REDUCED) raf = requestAnimationFrame(frame);
    }
    frame();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }
  function starfieldEngine(canvas, ctx, accent) {
    let stars = [], w, h, raf;
    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; stars = Array.from({ length: 260 }, () => ({ x: Math.random() * w - w / 2, y: Math.random() * h - h / 2, z: Math.random() * w })); }
    resize(); window.addEventListener('resize', resize);
    function frame() {
      ctx.fillStyle = 'rgba(5,6,8,0.35)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = accent;
      for (const s of stars) {
        s.z -= 4; if (s.z <= 0) { s.x = Math.random() * w - w / 2; s.y = Math.random() * h - h / 2; s.z = w; }
        const k = 128 / s.z; const px = s.x * k + w / 2, py = s.y * k + h / 2;
        const r = Math.max(0.3, (1 - s.z / w) * 2);
        ctx.fillRect(px, py, r, r);
      }
      if (!REDUCED) raf = requestAnimationFrame(frame);
    }
    frame();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }
  function networkEngine(canvas, ctx, accent) {
    let nodes = [], w, h, raf;
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      nodes = Array.from({ length: 60 }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      }));
    }
    resize(); window.addEventListener('resize', resize);
    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      ctx.strokeStyle = accent; ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 140 * 140) {
            ctx.globalAlpha = 1 - d2 / (140 * 140);
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1; ctx.fillStyle = accent;
      for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
      if (!REDUCED) raf = requestAnimationFrame(frame);
    }
    frame();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }
  function rainEngine(canvas, ctx, accent) {
    let drops = [], w, h, raf;
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      drops = Array.from({ length: 140 }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        len: Math.random() * 20 + 10, v: Math.random() * 3 + 3,
      }));
    }
    resize(); window.addEventListener('resize', resize);
    function frame() {
      ctx.fillStyle = 'rgba(5,6,8,0.15)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = accent; ctx.lineWidth = 1;
      for (const d of drops) {
        ctx.globalAlpha = 0.35 + Math.random() * 0.4;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, d.y + d.len);
        ctx.stroke();
        d.y += d.v;
        if (d.y > h) { d.y = -d.len; d.x = Math.random() * w; }
      }
      ctx.globalAlpha = 1;
      if (!REDUCED) raf = requestAnimationFrame(frame);
    }
    frame();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }
  function pulseEngine(canvas, ctx, accent) {
    let pulses = [], w, h, raf, lastSpawn = 0;
    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    function frame(t) {
      ctx.fillStyle = 'rgba(5,6,8,0.12)';
      ctx.fillRect(0, 0, w, h);
      if (t - lastSpawn > 500) { pulses.push({ x: Math.random() * w, y: Math.random() * h, r: 0 }); lastSpawn = t; }
      const maxR = Math.max(w, h);
      pulses = pulses.filter((p) => p.r < maxR);
      ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
      for (const p of pulses) {
        ctx.globalAlpha = 1 - p.r / maxR;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        p.r += 1.5;
      }
      ctx.globalAlpha = 1;
      if (!REDUCED) raf = requestAnimationFrame(frame);
    }
    frame(performance.now());
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }

  const ENGINES = {
    matrix: matrixEngine, particles: particlesEngine, starfield: starfieldEngine,
    network: networkEngine, rain: rainEngine, pulse: pulseEngine,
  };

  const BUILTINS = [
    { kind: 'svg',  name: 'nebula',    src: SVG(NEBULA),  accent: '#a78bfa', glow: '167,139,250' },
    { kind: 'svg',  name: 'grid',      src: SVG(GRID),    accent: '#22d3ee', glow: '34,211,238'  },
    { kind: 'svg',  name: 'waves',     src: SVG(WAVES),   accent: '#38bdf8', glow: '56,189,248'  },
    { kind: 'svg',  name: 'digits',    src: SVG(DIGITS),  accent: '#34d399', glow: '52,211,153'  },
    { kind: 'svg',  name: 'aurora',    src: SVG(AURORA),  accent: '#a78bfa', glow: '167,139,250' },
    { kind: 'svg',  name: 'mesh',      src: SVG(MESH),    accent: '#7c5cff', glow: '124,92,255'  },
    { kind: 'svg',  name: 'circuit',   src: SVG(CIRCUIT), accent: '#34d399', glow: '52,211,153'  },
    { kind: 'svg',  name: 'hexgrid',   src: SVG(HEXGRID), accent: '#22d3ee', glow: '34,211,238'  },
    { kind: 'anim', name: 'matrix',    engine: 'matrix',    accent: '#34d399', glow: '52,211,153'  },
    { kind: 'anim', name: 'particles', engine: 'particles', accent: '#60a5fa', glow: '96,165,250'  },
    { kind: 'anim', name: 'starfield', engine: 'starfield', accent: '#e7e7ea', glow: '231,231,234' },
    { kind: 'anim', name: 'network',   engine: 'network',   accent: '#60a5fa', glow: '96,165,250'  },
    { kind: 'anim', name: 'rain',      engine: 'rain',      accent: '#7dd3fc', glow: '125,211,252' },
    { kind: 'anim', name: 'pulse',     engine: 'pulse',     accent: '#e879f9', glow: '232,121,249' },
  ];
  const ALL_NAMES = BUILTINS.map((t) => t.name);
  const ROTATE_MS = 22000;
  const SERVER_TRACKS = ['track1.mp3','track2.mp3','track3.mp3','track4.mp3','track5.mp3'];

  const scriptEl = document.currentScript || document.querySelector('script[data-scope]');
  const SCOPE = (scriptEl?.dataset?.scope || 'pairing').toLowerCase();
  const SETTINGS_KEY = 'bothub.theme_settings:' + SCOPE;

  const DEFAULTS = {
    themeKey: 'nebula', blur: 48, opacity: 0.9,
    autoRotate: !REDUCED, enableAnim: true,
    musicOn: false, musicVol: 0.35, musicTrack: '',
    cursor: 'auto',
  };
  const settings = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

  try {
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp && !vp.content.includes('viewport-fit')) vp.content = vp.content + ', viewport-fit=cover';
  } catch {}

  let CUSTOM = [];
  let DISABLED = new Set();

  function mergedThemes() {
    const builtins = BUILTINS.filter((t) => !DISABLED.has(t.name));
    const custom = CUSTOM.map((c) => ({
      kind: c.kind || 'img', name: c.name, src: c.src,
      accent: c.accent || '#7c5cff', glow: c.glow || '124,92,255', customId: c.id,
    }));
    return [...builtins, ...custom];
  }
  function allowedNames(themes) {
    return themes
      .filter((t) => settings.enableAnim ? true : t.kind !== 'anim')
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
    * { -webkit-tap-highlight-color: transparent; }
    html, body { overflow-x: hidden; }
    a, button, [role="button"], input[type=submit], select, label { cursor: pointer; }
    body[data-cursor="crosshair"], body[data-cursor="crosshair"] a, body[data-cursor="crosshair"] button,
    body[data-cursor="crosshair"] input, body[data-cursor="crosshair"] select, body[data-cursor="crosshair"] label { cursor: crosshair; }
    body[data-cursor="cell"], body[data-cursor="cell"] a, body[data-cursor="cell"] button,
    body[data-cursor="cell"] input, body[data-cursor="cell"] select, body[data-cursor="cell"] label { cursor: cell; }
    body[data-cursor="pointer"], body[data-cursor="pointer"] * { cursor: pointer; }
    body[data-cursor="none"], body[data-cursor="none"] * { cursor: none !important; }

    #bh-dot {
      position: fixed; top: 0; left: 0;
      width: 14px; height: 14px; border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 20px 4px rgba(var(--glow), 0.55);
      margin-left: -7px; margin-top: -7px;
      pointer-events: none; z-index: 999999;
      transform: translate3d(-200px, -200px, 0);
      transition: width .12s ease, height .12s ease, margin .12s ease, background .12s ease, border-color .12s ease, opacity .2s ease;
      display: none; will-change: transform;
    }
    body[data-cursor="none"] #bh-dot { display: block; }
    #bh-dot.hover { width: 34px; height: 34px; margin-left: -17px; margin-top: -17px; background: transparent; border: 1.5px solid var(--accent); box-shadow: 0 0 24px 6px rgba(var(--glow), 0.45); }
    #bh-dot.down { width: 10px; height: 10px; margin-left: -5px; margin-top: -5px; }

    #bh-bg { position: fixed; inset: -80px; z-index: -2; background-size: cover; background-position: center; filter: blur(var(--bh-blur, 48px)) saturate(1.35); transform: scale(1.15); transition: opacity 1s ease, filter .2s ease; pointer-events: none; opacity: var(--bh-opacity, 0.9); }
    #bh-canvas { position: fixed; inset: 0; z-index: -2; display: none; pointer-events: none; opacity: var(--bh-opacity, 0.9); }
    #bh-bg-overlay { position: fixed; inset: 0; z-index: -1; pointer-events: none; background: radial-gradient(120% 100% at 50% 0%, rgba(0,0,0,0.05) 0%, rgba(5,6,8,0.45) 55%, rgba(5,6,8,0.75) 100%); }

    #bh-tools { position: fixed; right: max(14px, env(safe-area-inset-right)); bottom: max(14px, env(safe-area-inset-bottom)); z-index: 1000; display: flex; gap: 8px; align-items: center; font-family: ui-monospace, monospace; font-size: 11px; }
    #bh-theme-chip, #bh-music-btn, #bh-settings-btn { background: rgba(20,22,26,0.78); color: #8b8f96; border: 1px solid #262a30; border-radius: 999px; padding: 6px 12px; cursor: pointer; user-select: none; backdrop-filter: blur(8px); letter-spacing: 0.08em; transition: color .15s, border-color .15s, transform .05s; font-family: inherit; font-size: inherit; }
    #bh-music-btn, #bh-settings-btn { padding: 6px 10px; font-size: 14px; line-height: 1; display: inline-flex; align-items: center; gap: 6px; }
    #bh-theme-chip:hover, #bh-music-btn:hover, #bh-settings-btn:hover { color: var(--accent); border-color: var(--accent); }
    #bh-music-btn:active, #bh-settings-btn:active { transform: scale(0.94); }
    #bh-theme-chip .dot { color: var(--accent); margin-right: 6px; }
    #bh-music-btn.on, #bh-settings-btn.on { color: var(--accent); border-color: var(--accent); }
    #bh-music-btn .disc { display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at center, var(--accent) 0 2.5px, #101010 2.5px 5px, #2a2a2a 5px 6px, #101010 6px 100%); border: 1px solid #333; animation: bh-spin 1.8s linear infinite; animation-play-state: paused; }
    #bh-music-btn.on .disc { animation-play-state: running; }
    @keyframes bh-spin { to { transform: rotate(360deg); } }

    #bh-panel { position: fixed; right: max(14px, env(safe-area-inset-right)); bottom: max(58px, calc(env(safe-area-inset-bottom) + 58px)); z-index: 1001; width: 360px; max-width: calc(100vw - 28px); max-height: calc(100vh - 90px); overflow-y: auto; background: rgba(14,16,20,0.94); color: #e7e7ea; border: 1px solid #262a30; border-radius: 14px; backdrop-filter: blur(14px); box-shadow: 0 24px 60px rgba(0,0,0,0.6); font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; padding: 16px; display: none; }
    #bh-panel.open { display: block; }
    #bh-panel h3 { margin: 0 0 14px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #8b8f96; font-weight: 500; }
    #bh-panel .section { margin-bottom: 16px; }
    #bh-panel .divider { height: 1px; background: #1c1f24; margin: 16px 0; }
    #bh-panel .label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6f76; margin-bottom: 8px; display: flex; justify-content: space-between; }
    #bh-panel .label .val { color: var(--accent); }
    #bh-panel input[type=range] { width: 100%; -webkit-appearance: none; appearance: none; height: 6px; background: #1c1f24; border-radius: 3px; outline: none; }
    #bh-panel input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: var(--accent); cursor: pointer; box-shadow: 0 0 0 3px rgba(var(--glow), 0.25); }
    #bh-panel input[type=range]::-moz-range-thumb { width: 20px; height: 20px; border: 0; border-radius: 50%; background: var(--accent); cursor: pointer; }
    #bh-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    #bh-grid button { aspect-ratio: 16/10; border-radius: 6px; border: 1px solid #262a30; background-size: cover; background-position: center; cursor: pointer; padding: 0; position: relative; overflow: hidden; }
    #bh-grid button:hover { transform: translateY(-1px); }
    #bh-grid button.active { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(var(--glow), 0.25); }
    #bh-grid button[data-kind="anim"]::after { content: '▶'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--accent); font-size: 14px; background: rgba(5,6,8,0.55); }
    #bh-panel .toggles { display: grid; gap: 8px; font-size: 12px; color: #b8bcc4; }
    #bh-panel .toggles label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    #bh-panel .toggles input { accent-color: var(--accent); width: 16px; height: 16px; }
    #bh-panel select, #bh-panel input[type=file] { width: 100%; background: #14161a; color: #e7e7ea; border: 1px solid #262a30; border-radius: 6px; padding: 10px; font: inherit; font-size: 14px; outline: none; cursor: pointer; }
    #bh-panel select:focus { border-color: var(--accent); }
    #bh-panel .row { display: flex; gap: 6px; margin-top: 8px; }
    #bh-panel .row button { flex: 1; background: transparent; color: #8b8f96; border: 1px solid #262a30; border-radius: 6px; padding: 10px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
    #bh-panel .row button:hover { color: var(--accent); border-color: var(--accent); }
    #bh-panel .row button.danger:hover { color: #f87171; border-color: #f87171; }
    #bh-panel .hint { color: #6b6f76; font-size: 11px; margin-top: 6px; }
    #bh-panel .row-end { display: flex; justify-content: flex-end; margin-top: 12px; }
    #bh-panel .reset { background: transparent; color: #8b8f96; border: 1px solid #262a30; border-radius: 6px; padding: 8px 12px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
    #bh-panel .reset:hover { color: #f87171; border-color: #f87171; }
    body { background: #06070a; }

    @media (max-width: 900px) { th, td { padding: 7px 9px; } #bh-panel { width: 340px; } }
    @media (max-width: 640px) {
      body { padding: 16px; }
      main { padding: 16px !important; max-width: 100% !important; }
      h1 { font-size: 20px; } h1 .dim { font-size: 16px; }
      header, .head, .top { flex-wrap: wrap; gap: 8px; }
      header button, .head a.cta, .top button { font-size: 11px; padding: 4px 10px; }
      table { display: block; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; border-radius: 8px; }
      th, td { padding: 6px 8px; font-size: 11px; }
      .tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; }
      .tabs button { padding: 8px 12px; font-size: 12px; flex: 0 0 auto; }
      input, select, textarea, #bh-panel select, #bh-panel input[type=file] { font-size: 16px !important; }
      .row, .grid-2 { flex-direction: column; align-items: stretch; grid-template-columns: 1fr; }
      .row > div, .grid-2 > div { min-width: 0; }
      button:not(#bh-music-btn):not(#bh-settings-btn) { min-height: 40px; }
      #bh-tools { right: 8px; bottom: max(8px, env(safe-area-inset-bottom)); gap: 6px; }
      #bh-theme-chip { padding: 5px 9px; font-size: 10px; }
      #bh-music-btn, #bh-settings-btn { padding: 5px 8px; font-size: 13px; }
      #bh-panel { right: 8px; left: 8px; width: auto; bottom: max(48px, calc(env(safe-area-inset-bottom) + 48px)); max-height: calc(100vh - 80px); padding: 12px; }
      #bh-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (min-width: 1440px) { #bh-panel { width: 400px; } }
    @media (prefers-reduced-motion: reduce) {
      #bh-music-btn .disc { animation: none; }
      #bh-bg { transition: none; }
      #bh-panel, #bh-theme-chip, #bh-music-btn, #bh-settings-btn, #bh-dot { transition: none; }
    }
  `;
  document.head.appendChild(style);

  // ── DOM ──
  const bg = document.createElement('div'); bg.id = 'bh-bg';
  const canvas = document.createElement('canvas'); canvas.id = 'bh-canvas';
  const overlay = document.createElement('div'); overlay.id = 'bh-bg-overlay';
  const dot = document.createElement('div'); dot.id = 'bh-dot';
  const tools = document.createElement('div'); tools.id = 'bh-tools';
  const chip = document.createElement('div'); chip.id = 'bh-theme-chip'; chip.innerHTML = '<span class="dot">●</span><span class="name"></span>';
  const musicBtn = document.createElement('button'); musicBtn.id = 'bh-music-btn'; musicBtn.type = 'button'; musicBtn.title = 'music'; musicBtn.innerHTML = '<span class="disc"></span>';
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
      <div class="label">cursor</div>
      <select id="bh-cursor">
        <option value="auto">default</option>
        <option value="pointer">hand (over everything)</option>
        <option value="crosshair">crosshair</option>
        <option value="cell">terminal cell</option>
        <option value="none">glowing dot (desktop only)</option>
      </select>
    </div>
    <div class="section">
      <div class="toggles">
        <label><input type="checkbox" id="bh-rotate"> auto-rotate (22s)</label>
        <label><input type="checkbox" id="bh-anim"> enable animated themes</label>
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
  let serverTracks = []; let userTracks = []; let musicStarted = false; let objectUrl = null;

  function trackOptions() {
    const opts = [];
    for (const s of serverTracks) opts.push({ id: s, label: s });
    for (const u of userTracks) opts.push({ id: u.id, label: '⭐ ' + u.name });
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

  function bindCursorDot() {
    if (!HAS_FINE_POINTER) return;
    let lastX = -200, lastY = -200, pending = false;
    document.addEventListener('mousemove', (e) => {
      lastX = e.clientX; lastY = e.clientY;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { dot.style.transform = `translate3d(${lastX}px, ${lastY}px, 0)`; pending = false; });
    }, { passive: true });
    document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { dot.style.opacity = '1'; });
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('a, button, [role="button"], input, select, textarea, label')) dot.classList.add('hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest('a, button, [role="button"], input, select, textarea, label')) dot.classList.remove('hover');
    });
    document.addEventListener('mousedown', () => dot.classList.add('down'));
    document.addEventListener('mouseup', () => dot.classList.remove('down'));
  }
  function applyCursor() {
    document.body.dataset.cursor = HAS_FINE_POINTER ? (settings.cursor || 'auto') : 'auto';
  }

  function inject() {
    if (!document.body || document.getElementById('bh-bg')) return;
    document.body.insertBefore(overlay, document.body.firstChild);
    document.body.insertBefore(canvas, overlay);
    document.body.insertBefore(bg, canvas);
    document.body.appendChild(tools);
    document.body.appendChild(panel);
    document.body.appendChild(dot);
    buildGrid();
    bindPanel();
    bindCursorDot();
    applyCursor();
    loadAll();
  }
  if (document.body) inject(); else document.addEventListener('DOMContentLoaded', inject);

  function buildGrid() {
    const themes = mergedThemes();
    const allowedSet = new Set(allowedNames(themes));
    const g = panel.querySelector('#bh-grid');
    g.innerHTML = '';
    themes.forEach((t) => {
      if (!allowedSet.has(t.name)) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.kind = t.kind; b.dataset.name = t.name;
      if (t.kind !== 'anim') b.style.backgroundImage = t.src;
      b.title = t.name;
      if (t.name === settings.themeKey) b.classList.add('active');
      b.addEventListener('click', () => {
        settings.themeKey = t.name; applyByName(t.name); saveSettings();
        g.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      });
      g.appendChild(b);
    });
  }

  function bindPanel() {
    const blurEl = panel.querySelector('#bh-blur');
    const opEl = panel.querySelector('#bh-opacity');
    const rotEl = panel.querySelector('#bh-rotate');
    const animEl = panel.querySelector('#bh-anim');
    const cursorEl = panel.querySelector('#bh-cursor');
    const musicOnEl = panel.querySelector('#bh-music-on');
    const volEl = panel.querySelector('#bh-vol');
    const fileEl = panel.querySelector('#bh-music-file');

    blurEl.value = settings.blur; opEl.value = Math.round(settings.opacity * 100);
    rotEl.checked = settings.autoRotate; animEl.checked = settings.enableAnim;
    cursorEl.value = settings.cursor || 'auto';
    musicOnEl.checked = settings.musicOn; volEl.value = Math.round(settings.musicVol * 100);
    panel.querySelector('#bh-blur-val').textContent = settings.blur + 'px';
    panel.querySelector('#bh-opacity-val').textContent = Math.round(settings.opacity * 100) + '%';
    panel.querySelector('#bh-vol-val').textContent = Math.round(settings.musicVol * 100) + '%';

    blurEl.addEventListener('input', () => { settings.blur = parseInt(blurEl.value, 10); document.documentElement.style.setProperty('--bh-blur', settings.blur + 'px'); panel.querySelector('#bh-blur-val').textContent = settings.blur + 'px'; saveSettings(); });
    opEl.addEventListener('input', () => { settings.opacity = parseInt(opEl.value, 10) / 100; document.documentElement.style.setProperty('--bh-opacity', String(settings.opacity)); panel.querySelector('#bh-opacity-val').textContent = Math.round(settings.opacity * 100) + '%'; saveSettings(); });
    rotEl.addEventListener('change', () => { settings.autoRotate = rotEl.checked; saveSettings(); if (settings.autoRotate) scheduleRotate(); else if (timer) { clearTimeout(timer); timer = null; } });
    animEl.addEventListener('change', () => {
      settings.enableAnim = animEl.checked; saveSettings();
      buildGrid();
      if (!allowedNames(mergedThemes()).includes(settings.themeKey)) {
        settings.themeKey = allowedNames(mergedThemes())[0];
        applyByName(settings.themeKey);
      }
    });
    cursorEl.addEventListener('change', () => { settings.cursor = cursorEl.value; saveSettings(); applyCursor(); });
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
      rotEl.checked = settings.autoRotate; animEl.checked = settings.enableAnim;
      cursorEl.value = settings.cursor;
      musicOnEl.checked = settings.musicOn; volEl.value = Math.round(settings.musicVol * 100);
      panel.querySelector('#bh-blur-val').textContent = settings.blur + 'px';
      panel.querySelector('#bh-opacity-val').textContent = Math.round(settings.opacity * 100) + '%';
      panel.querySelector('#bh-vol-val').textContent = Math.round(settings.musicVol * 100) + '%';
      audio.pause(); musicStarted = false; musicBtn.classList.remove('on');
      buildGrid(); applyByName(settings.themeKey); applyCursor(); scheduleRotate();
    });

    gear.addEventListener('click', () => { panel.classList.toggle('open'); gear.classList.toggle('on', panel.classList.contains('open')); });
    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('open')) return;
      if (panel.contains(e.target) || gear.contains(e.target)) return;
      panel.classList.remove('open'); gear.classList.remove('on');
    });
  }

  async function loadAll() {
    try {
      const r = await fetch('/api/themes');
      if (r.ok) { const d = await r.json(); CUSTOM = d.custom || []; DISABLED = new Set(d.disabled || []); }
    } catch {}
    buildGrid();
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

  const root = document.documentElement;
  let timer = null; let stopEngine = null;

  function applyByName(name) {
    const themes = mergedThemes();
    const allowed = allowedNames(themes);
    let t = themes.find((x) => x.name === name && allowed.includes(x.name));
    if (!t) t = themes.find((x) => allowed.includes(x.name)) || themes[0];
    settings.themeKey = t.name;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--glow', t.glow);
    root.style.setProperty('--bh-blur', settings.blur + 'px');
    root.style.setProperty('--bh-opacity', String(settings.opacity));
    if (stopEngine) { stopEngine(); stopEngine = null; }
    if (t.kind === 'anim') {
      bg.style.display = 'none'; canvas.style.display = 'block';
      stopEngine = ENGINES[t.engine](canvas, canvas.getContext('2d'), t.accent);
    } else {
      canvas.style.display = 'none'; bg.style.display = 'block';
      bg.style.backgroundImage = t.src;
    }
    const idx = allowed.indexOf(t.name);
    chip.querySelector('.name').textContent = `${idx + 1}/${allowed.length} · ${t.name}${SCOPE === 'pairing' ? '' : ' · ' + SCOPE}`;
    saveSettings();
  }

  function advance() {
    const names = allowedNames(mergedThemes());
    const i = names.indexOf(settings.themeKey);
    const next = names[(i === -1 ? 0 : i + 1) % names.length];
    applyByName(next); scheduleRotate();
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
