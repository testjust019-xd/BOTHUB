// public/theme.js — self-contained theme. Add:
//   <script src="/theme.js" data-scope="pairing"></script>
//   <script src="/theme.js" data-scope="dashboard"></script>
//   <script src="/theme.js" data-scope="admin"></script>
// to any page. Theme changes are pure client-side: no reload, no fetch, no
// socket touch — the pairing code and connection are never affected.
(function () {
  const ALL = [
    { file: '01-solo-close.jpg',    accent: '#7c5cff', accent2: '#c4b5fd', glow: '124,92,255', name: 'solo' },
    { file: '02-solo-sword.jpg',    accent: '#38bdf8', accent2: '#0ea5e9', glow: '56,189,248', name: 'sword' },
    { file: '03-meta.png',          accent: '#0866ff', accent2: '#00c6ff', glow: '8,102,255',  name: 'meta' },
    { file: '04-pepe-meditate.jpg', accent: '#86c06c', accent2: '#f4c6d7', glow: '134,192,108', name: 'pepe-calm' },
    { file: '05-pepe-suit.jpg',     accent: '#5c6b8a', accent2: '#d6cbb6', glow: '92,107,138', name: 'pepe-suit' },
    { file: '06-wa-ban-fr.jpg',     accent: '#e11d48', accent2: '#fda4af', glow: '225,29,72',  name: 'ban' },
    { file: '07-wa-restricted.jpg', accent: '#f59e0b', accent2: '#fcd34d', glow: '245,158,11', name: 'restricted' },
    { file: '08-wa-banned.jpg',     accent: '#22c55e', accent2: '#86efac', glow: '34,197,94',  name: 'banned' },
  ];
  const PUBLIC_SET = [0, 1, 2, 3, 4];       // 1-5
  const REACTIVE_SET = [5, 6, 7];           // 6-8 (ban / restricted / banned)
  const KEY = 'bothub.theme_idx';
  const HAS_SESSION_KEY = 'bothub.has_session';
  const ROTATE_MS = 22000;

  const scriptEl = document.currentScript || document.querySelector('script[data-scope]');
  const SCOPE = (scriptEl?.dataset?.scope || 'pairing').toLowerCase();

  // 1-5 everywhere. 6-8 only on dashboard/admin, and only after at least one
  // session has ever existed (flag set by any page that sees a session).
  function allowed() {
    if (SCOPE === 'pairing' || SCOPE === 'public') return PUBLIC_SET.slice();
    if (SCOPE === 'dashboard' || SCOPE === 'admin') {
      const hasSession = localStorage.getItem(HAS_SESSION_KEY) === '1';
      return hasSession ? PUBLIC_SET.concat(REACTIVE_SET) : PUBLIC_SET.slice();
    }
    return PUBLIC_SET.slice();
  }

  // ── inject stylesheet ────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    :root { --accent: #3b82f6; --accent-2: #60a5fa; --glow: 59,130,246; }
    #bh-bg, #bh-bg-next {
      position: fixed; inset: -80px; z-index: -2;
      background-size: cover; background-position: center;
      filter: blur(72px) saturate(1.35);
      transform: scale(1.15);
      transition: opacity 1s ease;
      pointer-events: none; will-change: opacity;
    }
    #bh-bg { opacity: 0.6; }
    #bh-bg-next { opacity: 0; }
    #bh-bg-overlay {
      position: fixed; inset: 0; z-index: -1; pointer-events: none;
      background: radial-gradient(120% 100% at 50% 0%,
        rgba(0,0,0,0.10) 0%, rgba(5,6,8,0.72) 55%, rgba(5,6,8,0.95) 100%);
    }
    #bh-theme-chip {
      position: fixed; right: 14px; bottom: 14px; z-index: 1000;
      font-family: ui-monospace, monospace; font-size: 11px; letter-spacing: 0.08em;
      color: #8b8f96; background: rgba(20,22,26,0.72);
      border: 1px solid #262a30; border-radius: 999px; padding: 5px 12px;
      cursor: pointer; backdrop-filter: blur(8px); user-select: none;
      transition: color .15s, border-color .15s;
    }
    #bh-theme-chip:hover { color: var(--accent); border-color: var(--accent); }
    #bh-theme-chip .dot { color: var(--accent); margin-right: 6px; }
    body { background: #06070a; }
  `;
  document.head.appendChild(style);

  // ── inject background layers + chip ──────────────────────────────────
  const bg = document.createElement('div'); bg.id = 'bh-bg';
  const bgNext = document.createElement('div'); bgNext.id = 'bh-bg-next';
  const overlay = document.createElement('div'); overlay.id = 'bh-bg-overlay';
  const chip = document.createElement('div'); chip.id = 'bh-theme-chip';
  chip.innerHTML = '<span class="dot">●</span><span class="name"></span>';

  function inject() {
    if (!document.body || document.getElementById('bh-bg')) return;
    document.body.insertBefore(overlay, document.body.firstChild);
    document.body.insertBefore(bgNext, overlay);
    document.body.insertBefore(bg, bgNext);
    document.body.appendChild(chip);
  }
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);

  // ── state ────────────────────────────────────────────────────────────
  const root = document.documentElement;
  let idx = parseInt(localStorage.getItem(KEY + ':' + SCOPE) || '0', 10);
  let currentPool = allowed();
  let timer = null;

  function apply(i) {
    const t = ALL[i];
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-2', t.accent2);
    root.style.setProperty('--glow', t.glow);
    const url = `url('/bg/${t.file}')`;
    if (!bg.style.backgroundImage) {
      bg.style.backgroundImage = url;
    } else {
      bgNext.style.backgroundImage = url;
      bgNext.style.opacity = '1';
      setTimeout(() => {
        bg.style.backgroundImage = url;
        bgNext.style.opacity = '0';
      }, 1000);
    }
    const rank = currentPool.indexOf(i);
    chip.querySelector('.name').textContent =
      `${rank + 1}/${currentPool.length} · ${t.name}${SCOPE === 'pairing' ? '' : ' · ' + SCOPE}`;
    localStorage.setItem(KEY + ':' + SCOPE, String(i));
  }

  function advance() {
    // re-read the pool — the has_session flag can flip mid-session
    currentPool = allowed();
    let pos = currentPool.indexOf(idx);
    if (pos === -1) pos = 0;
    pos = (pos + 1) % currentPool.length;
    idx = currentPool[pos];
    apply(idx);
    if (timer) clearTimeout(timer);
    timer = setTimeout(advance, ROTATE_MS);
  }

  chip.addEventListener('click', () => {
    if (timer) clearTimeout(timer);
    advance();
  });

  // boot
  currentPool = allowed();
  if (!currentPool.includes(idx)) idx = currentPool[0];
  apply(idx);
  timer = setTimeout(advance, ROTATE_MS);

  // ── public helper: any page can call window.bothubMarkSession() once it
  // has seen a real session, which unlocks themes 6-8 on next dashboard/admin load.
  window.bothubMarkSession = function () {
    localStorage.setItem(HAS_SESSION_KEY, '1');
  };
})();
