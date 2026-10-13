// public/theme.js — theme + settings, self-contained.
//   <script src="/theme.js" data-scope="pairing"></script>
//   <script src="/theme.js" data-scope="dashboard"></script>
//   <script src="/theme.js" data-scope="admin"></script>
// Pure client-side. No reload, no fetch, no socket touch.
(function () {
  const IMG = (f) => `url('/bg/${f}')`;
  const SVG = (s) => `url('data:image/svg+xml;utf8,${encodeURIComponent(s)}')`;

  const NEBULA = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="a" cx="30%" cy="30%" r="70%"><stop offset="0%" stop-color="#7c5cff"/><stop offset="60%" stop-color="#1a1a3a"/><stop offset="100%" stop-color="#05060a"/></radialGradient><radialGradient id="b" cx="70%" cy="70%" r="60%"><stop offset="0%" stop-color="#22d3ee" stop-opacity="0.8"/><stop offset="100%" stop-color="#05060a" stop-opacity="0"/></radialGradient></defs><rect width="600" height="600" fill="url(#a)"/><circle cx="420" cy="420" r="300" fill="url(#b)"/></svg>';
  const GRID = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#05060a"/><g stroke="#1c2a44" stroke-width="1"><path d="M0 60H600 M0 120H600 M0 180H600 M0 240H600 M0 300H600 M0 360H600 M0 420H600 M0 480H600 M0 540H600"/><path d="M60 0V600 M120 0V600 M180 0V600 M240 0V600 M300 0V600 M360 0V600 M420 0V600 M480 0V600 M540 0V600"/></g><g fill="#22d3ee"><circle cx="120" cy="180" r="3"/><circle cx="360" cy="300" r="3"/><circle cx="480" cy="120" r="3"/><circle cx="180" cy="420" r="3"/><circle cx="540" cy="480" r="3"/></g></svg>';
  const WAVES = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#05060a"/><path d="M0 400 Q150 340 300 400 T600 400 V600 H0 Z" fill="#0c4a6e" opacity="0.6"/><path d="M0 460 Q150 400 300 460 T600 460 V600 H0 Z" fill="#0ea5e9" opacity="0.4"/><path d="M0 520 Q150 460 300 520 T600 520 V600 H0 Z" fill="#38bdf8" opacity="0.3"/></svg>';
  const DIGITS = (() => {
    const rows = [
      '7 3 9 1 4 2 8 5 0 6 3 1 9 7 2 4 5 8 0 3',
      '2 8 4 6 0 9 7 3 1 5 6 2 4 8 9 0 1 7 3 5',
      '5 0 6 3 9 7 1 4 8 2 9 0 5 4 6 1 2 8 3 7',
      '1 4 8 2 6 0 5 3 9 7 4 6 8 2 0 1 5 3 9 7',
      '9 6 3 7 1 4 8 2 5 0 7 3 1 9 4 6 8 0 2 5',
      '4 7 1 5 9 3 8 0 6 2 5 7 0 4 8 2 1 9 3 6',
      '3 1 8 4 0 6 5 9 2 7 8 4 3 1 6 0 9 5 2 7',
      '6 9 2 0 5 7 3 8 1 4 2 5 7 3 9 8 4 6 0 1',
      '8 5 0 2 4 6 1 7 3 9 1 8 6 0 2 7 3 4 5 9',
      '0 2 7 9 3 5 4 6 8 1 3 9 5 7 1 4 6 0 8 2',
    ];
    const text = rows.map((r, i) => `<text x="20" y="${40 + i * 40}">${r}</text>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#05060a"/><g font-family="monospace" font-size="16" fill="#34d399" opacity="0.7">${text}</g></svg>`;
  })();

  const ALL = [
    { src: IMG('01.jpeg'), accent: '#7c5cff', accent2: '#c4b5fd', glow: '124,92,255', name: 'solo',        kind: 'img' },
    { src: IMG('02.jpeg'), accent: '#38bdf8', accent2: '#0ea5e9', glow: '56,189,248',  name: 'sword',       kind: 'img' },
    { src: IMG('03.jpeg'), accent: '#0866ff', accent2: '#00c6ff', glow: '8,102,255',   name: 'meta',        kind: 'img' },
    { src: IMG('04.jpeg'), accent: '#86c06c', accent2: '#f4c6d7', glow: '134,192,108', name: 'pepe',        kind: 'img' },
    { src: IMG('05.jpeg'), accent: '#22d3ee', accent2: '#67e8f9', glow: '34,211,238',  name: 'isagi',       kind: 'img' },
    { src: IMG('06.jpeg'), accent: '#e879f9', accent2: '#f0abfc', glow: '232,121,249', name: 'heartbreak',  kind: 'img' },
    { src: IMG('07.jpeg'), accent: '#f59e0b', accent2: '#fcd34d', glow: '245,158,11',  name: 'restricted',  kind: 'img' },
    { src: IMG('08.jpeg'), accent: '#e11d48', accent2: '#fda4af', glow: '225,29,72',   name: 'banned',      kind: 'img' },
    { src: SVG(NEBULA),    accent: '#a78bfa', accent2: '#c4b5fd', glow: '167,139,250', name: 'nebula',      kind: 'svg' },
    { src: SVG(GRID),      accent: '#22d3ee', accent2: '#67e8f9', glow: '34,211,238',  name: 'grid',        kind: 'svg' },
    { src: SVG(WAVES),     accent: '#38bdf8', accent2: '#7dd3fc', glow: '56,189,248',  name: 'waves',       kind: 'svg' },
    { src: SVG(DIGITS),    accent: '#34d399', accent2: '#86efac', glow: '52,211,153',  name: 'digits',      kind: 'svg' },
  ];
  const PUBLIC_SET = [0, 1, 2, 3, 4, 8, 9, 10, 11];   // 1-5 + generated
  const REACTIVE_SET = [5, 6, 7];                      // 6-8 (ban / restricted / heartbreak)
  const ROTATE_MS = 22000;

  const scriptEl = document.currentScript || document.querySelector('script[data-scope]');
  const SCOPE = (scriptEl?.dataset?.scope || 'pairing').toLowerCase();
  const SETTINGS_KEY = 'bothub.theme_settings:' + SCOPE;

  const DEFAULTS = { themeIdx: 0, blur: 48, opacity: 0.9, autoRotate: true, includeGenerated: true };
  const settings = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

  function allowed() {
    const set = (SCOPE === 'pairing' || SCOPE === 'public')
      ? PUBLIC_SET.slice()
      : (localStorage.getItem('bothub.has_session') === '1'
          ? PUBLIC_SET.concat(REACTIVE_SET)
          : PUBLIC_SET.slice());
    return settings.includeGenerated ? set : set.filter(i => ALL[i].kind === 'img');
  }

  // ── stylesheet ──
  const style = document.createElement('style');
  style.textContent = `
    :root { --accent: #3b82f6; --accent-2: #60a5fa; --glow: 59,130,246; }
    #bh-bg, #bh-bg-next {
      position: fixed; inset: -80px; z-index: -2;
      background-size: cover; background-position: center;
      filter: blur(var(--bh-blur, 48px)) saturate(1.35);
      transform: scale(1.15);
      transition: opacity 1s ease, filter .2s ease;
      pointer-events: none; will-change: opacity;
    }
    #bh-bg { opacity: var(--bh-opacity, 0.9); }
    #bh-bg-next { opacity: 0; }
    #bh-bg-overlay {
      position: fixed; inset: 0; z-index: -1; pointer-events: none;
      background: radial-gradient(120% 100% at 50% 0%,
        rgba(0,0,0,0.05) 0%, rgba(5,6,8,0.45) 55%, rgba(5,6,8,0.75) 100%);
    }
    #bh-tools {
      position: fixed; right: 14px; bottom: 14px; z-index: 1000;
      display: flex; gap: 8px; align-items: center;
      font-family: ui-monospace, monospace; font-size: 11px;
    }
    #bh-theme-chip, #bh-settings-btn {
      background: rgba(20,22,26,0.78); color: #8b8f96;
      border: 1px solid #262a30; border-radius: 999px;
      padding: 6px 12px; cursor: pointer; user-select: none;
      backdrop-filter: blur(8px); letter-spacing: 0.08em;
      transition: color .15s, border-color .15s;
      font-family: inherit; font-size: inherit;
    }
    #bh-settings-btn { padding: 6px 10px; font-size: 14px; line-height: 1; }
    #bh-theme-chip:hover, #bh-settings-btn:hover { color: var(--accent); border-color: var(--accent); }
    #bh-theme-chip .dot { color: var(--accent); margin-right: 6px; }
    #bh-settings-btn.on { color: var(--accent); border-color: var(--accent); }

    #bh-panel {
      position: fixed; right: 14px; bottom: 58px; z-index: 1001;
      width: 320px; max-width: calc(100vw - 28px);
      background: rgba(14,16,20,0.94); color: #e7e7ea;
      border: 1px solid #262a30; border-radius: 14px;
      backdrop-filter: blur(14px);
      box-shadow: 0 24px 60px rgba(0,0,0,0.6);
      font: 13px/1.5 ui-sans-serif, system-ui, sans-serif;
      padding: 16px; display: none;
    }
    #bh-panel.open { display: block; }
    #bh-panel h3 { margin: 0 0 14px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #8b8f96; font-weight: 500; }
    #bh-panel .section { margin-bottom: 16px; }
    #bh-panel .label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6f76; margin-bottom: 8px; display: flex; justify-content: space-between; }
    #bh-panel .label .val { color: var(--accent); }
    #bh-panel input[type=range] {
      width: 100%; -webkit-appearance: none; appearance: none;
      height: 4px; background: #1c1f24; border-radius: 3px; outline: none;
    }
    #bh-panel input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
      background: var(--accent); cursor: pointer; box-shadow: 0 0 0 3px rgba(var(--glow), 0.25);
    }
    #bh-panel input[type=range]::-moz-range-thumb {
      width: 14px; height: 14px; border: 0; border-radius: 50%;
      background: var(--accent); cursor: pointer;
    }
    #bh-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
    }
    #bh-grid button {
      aspect-ratio: 16/10; border-radius: 6px; border: 1px solid #262a30;
      background-size: cover; background-position: center; cursor: pointer;
      padding: 0; transition: border-color .15s, transform .05s;
      position: relative;
    }
    #bh-grid button:hover { transform: translateY(-1px); }
    #bh-grid button.active { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(var(--glow), 0.25); }
    #bh-panel .toggles { display: grid; gap: 8px; font-size: 12px; color: #b8bcc4; }
    #bh-panel .toggles label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    #bh-panel .toggles input { accent-color: var(--accent); }
    #bh-panel .row-end { display: flex; justify-content: flex-end; margin-top: 12px; }
    #bh-panel .reset {
      background: transparent; color: #8b8f96; border: 1px solid #262a30;
      border-radius: 6px; padding: 5px 10px; font-size: 11px;
      letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
      font-family: inherit;
    }
    #bh-panel .reset:hover { color: #f87171; border-color: #f87171; }
    body { background: #06070a; }
  `;
  document.head.appendChild(style);

  // ── DOM ──
  const bg = document.createElement('div'); bg.id = 'bh-bg';
  const bgNext = document.createElement('div'); bgNext.id = 'bh-bg-next';
  const overlay = document.createElement('div'); overlay.id = 'bh-bg-overlay';
  const tools = document.createElement('div'); tools.id = 'bh-tools';
  const chip = document.createElement('div'); chip.id = 'bh-theme-chip';
  chip.innerHTML = '<span class="dot">●</span><span class="name"></span>';
  const gear = document.createElement('button'); gear.id = 'bh-settings-btn'; gear.type = 'button';
  gear.textContent = '⚙'; gear.title = 'theme settings';
  tools.appendChild(chip); tools.appendChild(gear);

  const panel = document.createElement('div'); panel.id = 'bh-panel';
  panel.innerHTML = `
    <h3>theme settings</h3>
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
    <div class="row-end"><button class="reset" id="bh-reset">reset</button></div>
  `;

  function inject() {
    if (!document.body || document.getElementById('bh-bg')) return;
    document.body.insertBefore(overlay, document.body.firstChild);
    document.body.insertBefore(bgNext, overlay);
    document.body.insertBefore(bg, bgNext);
    document.body.appendChild(tools);
    document.body.appendChild(panel);
    buildGrid();
    bindPanel();
  }
  if (document.body) inject(); else document.addEventListener('DOMContentLoaded', inject);

  // ── settings UI ──
  function buildGrid() {
    const g = panel.querySelector('#bh-grid');
    g.innerHTML = '';
    ALL.forEach((t, i) => {
      if (!settings.includeGenerated && t.kind !== 'img') return;
      const b = document.createElement('button');
      b.type = 'button';
      b.style.backgroundImage = t.src;
      b.title = t.name;
      if (i === settings.themeIdx) b.classList.add('active');
      b.addEventListener('click', () => {
        settings.themeIdx = i;
        apply(i);
        saveSettings();
        g.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
      g.appendChild(b);
    });
  }

  function bindPanel() {
    const blurEl = panel.querySelector('#bh-blur');
    const opEl = panel.querySelector('#bh-opacity');
    const rotEl = panel.querySelector('#bh-rotate');
    const genEl = panel.querySelector('#bh-gen');

    blurEl.value = settings.blur;
    opEl.value = Math.round(settings.opacity * 100);
    rotEl.checked = settings.autoRotate;
    genEl.checked = settings.includeGenerated;
    panel.querySelector('#bh-blur-val').textContent = settings.blur + 'px';
    panel.querySelector('#bh-opacity-val').textContent = Math.round(settings.opacity * 100) + '%';

    blurEl.addEventListener('input', () => {
      settings.blur = parseInt(blurEl.value, 10);
      document.documentElement.style.setProperty('--bh-blur', settings.blur + 'px');
      panel.querySelector('#bh-blur-val').textContent = settings.blur + 'px';
      saveSettings();
    });
    opEl.addEventListener('input', () => {
      settings.opacity = parseInt(opEl.value, 10) / 100;
      document.documentElement.style.setProperty('--bh-opacity', String(settings.opacity));
      panel.querySelector('#bh-opacity-val').textContent = Math.round(settings.opacity * 100) + '%';
      saveSettings();
    });
    rotEl.addEventListener('change', () => {
      settings.autoRotate = rotEl.checked;
      saveSettings();
      if (settings.autoRotate) scheduleRotate(); else if (timer) { clearTimeout(timer); timer = null; }
    });
    genEl.addEventListener('change', () => {
      settings.includeGenerated = genEl.checked;
      saveSettings();
      buildGrid();
      // if current theme is now excluded, fall back
      if (!allowed().includes(settings.themeIdx)) {
        settings.themeIdx = allowed()[0];
        apply(settings.themeIdx);
      }
    });
    panel.querySelector('#bh-reset').addEventListener('click', () => {
      Object.assign(settings, DEFAULTS);
      saveSettings();
      document.documentElement.style.removeProperty('--bh-blur');
      document.documentElement.style.removeProperty('--bh-opacity');
      blurEl.value = settings.blur; opEl.value = Math.round(settings.opacity * 100);
      rotEl.checked = settings.autoRotate; genEl.checked = settings.includeGenerated;
      panel.querySelector('#bh-blur-val').textContent = settings.blur + 'px';
      panel.querySelector('#bh-opacity-val').textContent = Math.round(settings.opacity * 100) + '%';
      buildGrid();
      apply(settings.themeIdx);
      scheduleRotate();
    });

    gear.addEventListener('click', () => {
      panel.classList.toggle('open');
      gear.classList.toggle('on', panel.classList.contains('open'));
    });
    // close on outside click
    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('open')) return;
      if (panel.contains(e.target) || gear.contains(e.target)) return;
      panel.classList.remove('open');
      gear.classList.remove('on');
    });
  }

  // ── apply ──
  const root = document.documentElement;
  let idx = settings.themeIdx;
  let currentPool = allowed();
  let timer = null;

  function apply(i) {
    const t = ALL[i];
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-2', t.accent2);
    root.style.setProperty('--glow', t.glow);
    root.style.setProperty('--bh-blur', settings.blur + 'px');
    root.style.setProperty('--bh-opacity', String(settings.opacity));
    if (!bg.style.backgroundImage) {
      bg.style.backgroundImage = t.src;
    } else {
      bgNext.style.backgroundImage = t.src;
      bgNext.style.opacity = '1';
      setTimeout(() => {
        bg.style.backgroundImage = t.src;
        bgNext.style.opacity = '0';
      }, 1000);
    }
    const rank = currentPool.indexOf(i);
    chip.querySelector('.name').textContent =
      `${rank + 1}/${currentPool.length} · ${t.name}${SCOPE === 'pairing' ? '' : ' · ' + SCOPE}`;
    settings.themeIdx = i;
    saveSettings();
  }

  function advance() {
    currentPool = allowed();
    let pos = currentPool.indexOf(idx);
    if (pos === -1) pos = 0;
    pos = (pos + 1) % currentPool.length;
    idx = currentPool[pos];
    apply(idx);
    scheduleRotate();
  }

  function scheduleRotate() {
    if (timer) clearTimeout(timer);
    timer = settings.autoRotate ? setTimeout(advance, ROTATE_MS) : null;
  }

  chip.addEventListener('click', () => {
    if (timer) clearTimeout(timer);
    advance();
  });

  // boot
  currentPool = allowed();
  if (!currentPool.includes(idx)) idx = currentPool[0];
  apply(idx);
  scheduleRotate();

  window.bothubMarkSession = function () {
    localStorage.setItem('bothub.has_session', '1');
  };
})();
