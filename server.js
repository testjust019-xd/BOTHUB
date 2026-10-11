<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>bothub · drain</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    background: #0b0c0f; color: #e7e7ea;
    font: 15px/1.5 ui-sans-serif, system-ui, sans-serif;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  main { width: 100%; max-width: 480px; }
  h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: -0.01em; }
  h1 .dim { color: #6b6f76; font-weight: 400; }
  p.sub { color: #8b8f96; font-size: 13px; margin: 0 0 28px; }
  form { display: grid; gap: 14px; margin-bottom: 22px; }
  label { display: grid; gap: 6px; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #8b8f96; }
  input {
    background: #14161a; color: #e7e7ea;
    border: 1px solid #262a30; border-radius: 8px;
    padding: 12px 14px; font-size: 15px; font-family: inherit;
    outline: none; transition: border-color .15s;
  }
  input:focus { border-color: #3b82f6; }
  button {
    background: #3b82f6; color: white; border: 0; border-radius: 8px;
    padding: 14px; font-size: 15px; font-weight: 600; cursor: pointer;
    transition: background .15s, transform .05s;
  }
  button:hover:not(:disabled) { background: #2f6fd4; }
  button:active:not(:disabled) { transform: scale(0.99); }
  button:disabled { opacity: .6; cursor: wait; }
  .code-block { background: #14161a; border: 1px solid #262a30; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .code-block .label { font-size: 11px; letter-spacing: 0.22em; color: #6b6f76; margin-bottom: 10px; }
  .code-wrap { display: flex; align-items: center; gap: 12px; }
  .code { font-family: ui-monospace, monospace; font-size: 30px; letter-spacing: 0.14em; cursor: pointer; user-select: all; flex: 1; padding: 4px 6px; margin: -4px -6px; border-radius: 6px; }
  .code:hover { background: #1d2126; }
  .copy-btn { background: transparent; color: #8b8f96; border: 1px solid #262a30; border-radius: 8px; padding: 8px 12px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
  .copy-btn:hover { color: #e7e7ea; border-color: #3b82f6; }
  .copy-btn.copied { color: #34d399; border-color: #34d399; }
  .link-box { background: #14161a; border: 1px solid #262a30; border-radius: 8px; padding: 14px; font-family: ui-monospace, monospace; font-size: 13px; word-break: break-all; margin-bottom: 16px; }
  .status { font-family: ui-monospace, monospace; font-size: 12px; color: #8b8f96; white-space: pre-wrap; }
  .status .ok { color: #34d399; }
  .status .warn { color: #fbbf24; }
  .status .bad { color: #f87171; }
</style>
</head>
<body>
<main>
  <h1>bothub <span class="dim">· drain</span></h1>
  <p class="sub">Migrate group admin rights from one of your numbers to another.</p>

  <!-- State 1: enter A (destination) -->
  <div id="state1">
    <form id="formA">
      <label>destination number (A) — the one that keeps admin
        <input id="dest" placeholder="225..." autocomplete="off" required>
      </label>
      <button id="btnA" type="submit">generate link</button>
    </form>
    <div id="linkBox" hidden>
      <div class="label" style="font-size: 11px; letter-spacing: 0.22em; color: #6b6f76; margin-bottom: 10px;">open this link on your second device</div>
      <div class="link-box" id="linkText">—</div>
      <button type="button" class="copy-btn" id="copyLink">copy link</button>
    </div>
    <div class="status" id="statusA"></div>
  </div>

  <!-- State 2: enter B (source) -->
  <div id="state2" hidden>
    <form id="formB">
      <label>source number (B) — the one being retired
        <input id="source" placeholder="225..." autocomplete="off" required>
      </label>
      <button id="btnB" type="submit">get pairing code</button>
    </form>
    <div class="code-block" id="codeBlock" hidden>
      <div class="label">pairing code for B</div>
      <div class="code-wrap">
        <div class="code" id="code" title="click to copy">————</div>
        <button type="button" class="copy-btn" id="copyCode">copy</button>
      </div>
      <p style="color:#8b8f96;font-size:13px;margin:12px 0 0;">WhatsApp → Linked Devices → Link with phone number</p>
    </div>
    <div class="status" id="statusB"></div>
  </div>
</main>

<script>
  const $ = (id) => document.getElementById(id);
  const sessionId = new URLSearchParams(location.search).get('session')
    || location.pathname.split('/').filter(Boolean).pop();

  // If we're on /drain/:id, sessionId comes from the path.
  const pathId = (() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'drain' && parts[1]) return parts[1];
    return null;
  })();

  let poll = null;

  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
      return ok;
    }
  }

  function showCopied(btn) {
    btn.textContent = 'copied ✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('copied'); }, 1600);
  }

  $('copyLink').addEventListener('click', async () => {
    const url = $('linkText').textContent;
    if (await copyToClipboard(url)) showCopied($('copyLink'));
  });

  $('code').addEventListener('click', async () => {
    const text = $('code').textContent.trim();
    if (!text || text.includes('—')) return;
    if (await copyToClipboard(text)) showCopied($('copyCode'));
  });
  $('copyCode').addEventListener('click', async () => {
    const text = $('code').textContent.trim();
    if (!text || text.includes('—')) return;
    if (await copyToClipboard(text)) showCopied($('copyCode'));
  });

  // ── State 1: enter A ──
  $('formA').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dest = $('dest').value.replace(/\D/g, '');
    if (!dest) return;
    $('btnA').disabled = true;
    $('statusA').textContent = 'creating session...';
    try {
      const r = await fetch('/api/drain/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dest }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'failed');
      const url = location.origin + d.link;
      $('linkBox').hidden = false;
      $('linkText').textContent = url;
      $('statusA').innerHTML = '<span class="ok">link ready — open it on your second device</span>';
    } catch (err) {
      $('statusA').innerHTML = `<span class="bad">${err.message}</span>`;
      $('btnA').disabled = false;
    }
  });

  // ── State 2: enter B ──
  if (pathId) {
    $('state1').hidden = true;
    $('state2').hidden = false;

    $('formB').addEventListener('submit', async (e) => {
      e.preventDefault();
      const source = $('source').value.replace(/\D/g, '');
      if (!source) return;
      $('btnB').disabled = true;
      $('statusB').textContent = 'requesting code...';
      try {
        const r = await fetch('/api/drain/source', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: pathId, source }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'failed');
        if (d.code) {
          $('codeBlock').hidden = false;
          $('code').textContent = d.code;
        } else {
          $('statusB').innerHTML = '<span class="ok">source already registered — starting migration</span>';
        }
        pollStatus();
      } catch (err) {
        $('statusB').innerHTML = `<span class="bad">${err.message}</span>`;
        $('btnB').disabled = false;
      }
    });
  }

  function pollStatus() {
    if (poll) clearInterval(poll);
    poll = setInterval(async () => {
      try {
        const r = await fetch('/api/drain/status?sessionId=' + encodeURIComponent(pathId));
        const s = await r.json();
        if (s.status === 'awaiting_source') {
          $('statusB').textContent = 'waiting for pairing...';
        } else if (s.status === 'running') {
          $('statusB').innerHTML = `<span class="ok">migrating... ${s.done}/${s.total}</span>`;
        } else if (s.status === 'done') {
          $('statusB').innerHTML =
            `<span class="ok">done — ${s.done}/${s.total} groups processed` +
            (s.errors.length ? ` (${s.errors.length} errors)` : '') + '</span>';
          clearInterval(poll);
          $('btnB').disabled = false;
        } else if (s.status === 'error') {
          $('statusB').innerHTML = `<span class="bad">error: ${s.errors.join('; ')}</span>`;
          clearInterval(poll);
          $('btnB').disabled = false;
        }
      } catch {}
    }, 2500);
  }
</script>
</body>
</html>
