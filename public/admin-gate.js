// public/admin-gate.js — password overlay for /admin and /panel.
//   window.setupAdminGate({ token, onReady: (adminSession) => { ... } });
// If a session is already cached in sessionStorage, onReady fires immediately.
(function () {
  const STORAGE_KEY = 'bothub.admin_session';

  const style = document.createElement('style');
  style.textContent = `
    #bh-admin-gate {
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(4,5,8,0.96);
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, sans-serif;
      color: #e7e7ea;
      backdrop-filter: blur(8px);
    }
    #bh-admin-gate form {
      width: 100%; max-width: 360px;
      background: rgba(20,22,26,0.96);
      border: 1px solid #262a30; border-radius: 14px;
      padding: 28px;
      box-shadow: 0 30px 80px rgba(0,0,0,0.7);
    }
    #bh-admin-gate h1 { margin: 0 0 6px; font-size: 20px; letter-spacing: -0.01em; }
    #bh-admin-gate h1 .dim { color: #6b6f76; font-weight: 400; }
    #bh-admin-gate p { margin: 0 0 18px; color: #8b8f96; font-size: 13px; }
    #bh-admin-gate input {
      width: 100%; background: #14161a; color: #e7e7ea;
      border: 1px solid #262a30; border-radius: 8px;
      padding: 12px 14px; font: inherit; font-size: 16px;
      outline: none; transition: border-color .15s, box-shadow .15s;
    }
    #bh-admin-gate input:focus {
      border-color: var(--accent, #3b82f6);
      box-shadow: 0 0 0 3px rgba(var(--glow, 59,130,246), 0.18);
    }
    #bh-admin-gate button {
      margin-top: 14px; width: 100%;
      background: var(--accent, #3b82f6); color: white; border: 0;
      border-radius: 8px; padding: 13px;
      font: inherit; font-size: 15px; font-weight: 600; cursor: pointer;
      transition: filter .15s, transform .05s;
    }
    #bh-admin-gate button:hover:not(:disabled) { filter: brightness(1.1); }
    #bh-admin-gate button:active:not(:disabled) { transform: scale(0.99); }
    #bh-admin-gate button:disabled { opacity: 0.6; cursor: wait; }
    #bh-admin-gate .err { color: #f87171; font-size: 13px; margin-top: 10px; min-height: 18px; }
  `;
  document.head.appendChild(style);

  function showOverlay(onSubmit) {
    const overlay = document.createElement('div');
    overlay.id = 'bh-admin-gate';
    overlay.innerHTML = `
      <form id="bh-admin-gate-form" novalidate>
        <h1>bothub <span class="dim">· locked</span></h1>
        <p>Enter the admin password to continue.</p>
        <input id="bh-admin-gate-pass" type="password" placeholder="admin password" autocomplete="current-password" required>
        <button type="submit" id="bh-admin-gate-btn">unlock</button>
        <div class="err" id="bh-admin-gate-err"></div>
      </form>`;
    document.body.appendChild(overlay);

    const form = overlay.querySelector('#bh-admin-gate-form');
    const input = overlay.querySelector('#bh-admin-gate-pass');
    const btn = overlay.querySelector('#bh-admin-gate-btn');
    const err = overlay.querySelector('#bh-admin-gate-err');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      btn.disabled = true;
      try {
        await onSubmit(input.value);
        overlay.remove();
      } catch (e2) {
        err.textContent = e2?.message || 'failed';
        btn.disabled = false;
        input.focus();
      }
    });
    setTimeout(() => input.focus(), 60);
  }

  window.setupAdminGate = function ({ token, onReady }) {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) { onReady(cached); return; }

    const submit = async (password) => {
      const r = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
      sessionStorage.setItem(STORAGE_KEY, d.adminSession);
      onReady(d.adminSession);
    };

    if (document.body) showOverlay(submit);
    else document.addEventListener('DOMContentLoaded', () => showOverlay(submit));
  };
})();
