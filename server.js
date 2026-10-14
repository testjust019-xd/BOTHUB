<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>bothub · drain · live</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; color: #e7e7ea; font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 18px 120px; position: relative; z-index: 1; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  h1 { font-size: 20px; margin: 0; letter-spacing: -0.01em; }
  h1 .dim { color: #6b6f76; font-weight: 400; }
  .meta { color: #8b8f96; font-size: 12px; font-family: ui-monospace, monospace; margin-bottom: 18px; }
  .meta .warn { color: #fbbf24; }
  .meta .bad { color: #f87171; }
  .meta .ok { color: #34d399; }
  .meta .premium { color: var(--accent); }

  .chat {
    background: rgba(20,22,26,0.85); border: 1px solid #262a30;
    border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;
    backdrop-filter: blur(6px);
  }
  .chat .chat-head { display: flex; align-items: baseline; justify-content: space-between; font-size: 12px; color: #8b8f96; margin-bottom: 6px; font-family: ui-monospace, monospace; gap: 10px; }
  .chat .chat-name { color: #e7e7ea; font-weight: 500; font-size: 13px; }
  .chat .chat-jid { font-size: 11px; color: #6b6f76; margin-left: 8px; }
  .chat .chat-actions { display: flex; gap: 6px; }
  .chat .chat-actions button { background: transparent; color: var(--accent); border: 1px solid var(--accent); border-radius: 4px; padding: 2px 8px; font-size: 10px; letter-spacing: 0.06em; cursor: pointer; font-family: inherit; }
  .chat .chat-actions button:hover { background: rgba(0,0,0,0.2); }

  .msg { padding: 5px 0; border-top: 1px solid #1c1f24; font-size: 13px; }
  .msg:first-of-type { border-top: 0; }
  .msg .msg-head { font-size: 11px; color: #6b6f76; font-family: ui-monospace, monospace; margin-bottom: 3px; }
  .msg .msg-head .sender { color: #8b8f96; }
  .msg .msg-head .ts { float: right; }
  .msg.from-me .msg-body { color: var(--accent); }
  .msg .msg-body { color: #e7e7ea; word-break: break-word; white-space: pre-wrap; }
  .msg .media-blocked {
    display: inline-block; padding: 6px 10px;
    background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.35);
    border-radius: 6px; color: #f87171; font-size: 12px;
  }
  .empty { color: #6b6f76; font-style: italic; padding: 24px 0; text-align: center; }
  .expired { padding: 22px; background: rgba(44,27,27,0.4); border: 1px solid #3a2020; border-radius: 10px; color: #f87171; text-align: center; }

  /* reply bar */
  #reply-bar {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: rgba(14,16,20,0.95); border-top: 1px solid #262a30;
    backdrop-filter: blur(10px); padding: 12px 18px;
    display: none; z-index: 100;
  }
  #reply-bar.show { display: block; }
  #reply-bar .inner { max-width: 760px; margin: 0 auto; display: flex; gap: 10px; align-items: center; }
  #reply-bar .to { flex: 0 0 auto; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, monospace; font-size: 11px; color: #8b8f96; }
  #reply-bar input { flex: 1; background: rgba(20,22,26,0.9); color: #e7e7ea; border: 1px solid #262a30; border-radius: 8px; padding: 10px 12px; font: inherit; font-size: 15px; outline: none; }
  #reply-bar input:focus { border-color: var(--accent); }
  #reply-bar button { background: var(--accent); color: white; border: 0; border-radius: 8px; padding: 10px 16px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  #reply-bar button:disabled { opacity: 0.5; cursor: wait; }
  #reply-bar .cancel { background: transparent; color: #8b8f96; border: 1px solid #262a30; padding: 8px 12px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 400; }

  @media (max-width: 640px) {
    main { padding: 18px 12px 110px; }
    h1 { font-size: 18px; }
    #reply-bar .inner { gap: 6px; flex-wrap: nowrap; }
    #reply-bar .to { display: none; }
  }
</style>
</head>
<body>
<main>
  <div class="head"><h1>bothub <span class="dim">· drain · live</span></h1></div>
  <div class="meta" id="meta">connecting…</div>
  <div id="feed"></div>
</main>

<div id="reply-bar">
  <div class="inner">
    <span class="to" id="replyTo">—</span>
    <input id="replyText" placeholder="reply…">
    <button id="replySend">send</button>
    <button class="cancel" id="replyCancel">cancel</button>
  </div>
</div>

<script>
  const $ = (id) => document.getElementById(id);
  const sessionId = (() => { const p = location.pathname.split('/').filter(Boolean); return (p[0] === 'drain' && p[1]) ? p[1] : null; })();

  // browser-side storage — nothing kept on the server
  const chats = new Map();
  let canSend = false;
  let premium = false;
  let expiresAt = 0;
  let replyChat = null;
  let source = null;

  const escapeHtml = (s) => String(s).replace(/[<>&"]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));

  function render() {
    if (!chats.size) { $('feed').innerHTML = '<div class="empty">no messages yet</div>'; return; }
    const list = [...chats.values()].sort((a, b) => b.lastTs - a.lastTs);
    $('feed').innerHTML = list.map((c) => `
      <div class="chat">
        <div class="chat-head">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            <span class="chat-name">${escapeHtml(c.name || c.jid.split('@')[0])}</span>
            <span class="chat-jid">${escapeHtml(c.jid)}</span>
          </span>
          <span style="display:flex;align-items:center;gap:8px;">
            <span>${c.messages.length} msg</span>
            ${canSend ? `<div class="chat-actions"><button data-reply="${escapeHtml(c.jid)}">reply</button></div>` : ''}
          </span>
        </div>
        ${c.messages.slice(-8).map((m) => {
          const mediaBlock = m.media && !premium
            ? `<span class="media-blocked">Your plan does not allow you to view this content</span>`
            : (m.media ? `<em style="color:#8b8f96">[${escapeHtml(m.media)}]</em>` : '');
          const body = m.text ? escapeHtml(m.text) : '';
          return `
            <div class="msg ${m.fromMe ? 'from-me' : ''}">
              <div class="msg-head">
                <span class="sender">${m.fromMe ? 'you' : escapeHtml(m.name || m.sender.split('@')[0])}</span>
                <span class="ts">${new Date(m.ts).toLocaleTimeString()}</span>
              </div>
              <div class="msg-body">${body}${body && mediaBlock ? '<br>' : ''}${mediaBlock}</div>
            </div>`;
        }).join('')}
      </div>`).join('');
    // wire reply buttons
    document.querySelectorAll('button[data-reply]').forEach((b) => {
      b.addEventListener('click', () => openReply(b.dataset.reply));
    });
  }

  function ingest(m) {
    if (!chats.has(m.chat)) chats.set(m.chat, { jid: m.chat, name: m.name || null, lastTs: 0, messages: [] });
    const c = chats.get(m.chat);
    if (c.messages.some((x) => x.id === m.id)) return;
    c.messages.push(m);
    c.lastTs = Math.max(c.lastTs, m.ts);
    if (m.name) c.name = m.name;
    render();
  }

  function openReply(jid) {
    replyChat = jid;
    $('replyTo').textContent = jid;
    $('reply-bar').classList.add('show');
    $('replyText').focus();
  }

  function closeReply() {
    replyChat = null;
    $('reply-bar').classList.remove('show');
    $('replyText').value = '';
  }

  async function sendReply() {
    if (!replyChat) return;
    const text = $('replyText').value.trim();
    if (!text) return;
    $('replySend').disabled = true;
    try {
      const r = await fetch(`/api/drain/${encodeURIComponent(sessionId)}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: replyChat, text }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || ('HTTP ' + r.status));
      }
      $('replyText').value = '';
      closeReply();
    } catch (err) {
      alert('send failed: ' + err.message);
    } finally {
      $('replySend').disabled = false;
    }
  }

  $('replySend').addEventListener('click', sendReply);
  $('replyCancel').addEventListener('click', closeReply);
  $('replyText').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendReply(); });

  function updateMeta() {
    if (!expiresAt) { $('meta').textContent = 'waiting for the source to connect…'; return; }
    const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
    const mins = Math.floor(left / 60), secs = left % 60;
    const totalMsgs = [...chats.values()].reduce((a, c) => a + c.messages.length, 0);
    const planTag = premium
      ? `<span class="premium">premium</span>${canSend ? ' · send enabled' : ' · read-only'}`
      : 'free plan';
    $('meta').innerHTML = left
      ? `${planTag} · expires in ${mins}m ${secs}s · ${chats.size} chats · ${totalMsgs} messages`
      : `<span class="bad">expired</span>`;
  }

  if (!sessionId) {
    $('meta').innerHTML = '<span class="bad">invalid url</span>';
  } else {
    source = new EventSource(`/api/drain/${encodeURIComponent(sessionId)}/stream`);

    source.addEventListener('hello', (e) => {
      try {
        const d = JSON.parse(e.data);
        canSend = !!d.canSend;
        premium = !!d.premium;
        expiresAt = d.expiresAt || 0;
        updateMeta();
        render();
      } catch {}
    });

    source.addEventListener('message', (e) => {
      try { ingest(JSON.parse(e.data)); updateMeta(); } catch {}
    });

    source.addEventListener('error', () => {
      // SSE auto-reconnects on transient errors; a 410 shows up as a reconnect loop
      if (source.readyState === EventSource.CLOSED) {
        $('meta').innerHTML = '<span class="bad">stream closed</span>';
        $('feed').innerHTML = '<div class="expired">This viewer is no longer available.</div>';
      }
    });

    setInterval(updateMeta, 1000);
  }
</script>
<script src="/theme.js" data-scope="pairing"></script>
</body>
</html>
