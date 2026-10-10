// BOTHUB — pairing site + level runner.
// The pairing code is requested on the 'qr' event: that's the exact moment
// Baileys signals it's ready to receive a login. A fixed timer — or
// waitForSocketOpen — fires too early and yields a code WhatsApp rejects.

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
} from '@whiskeysockets/baileys';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const AUTH_DIR = process.env.AUTH_DIR || './auth';
const BIG = 'x'.repeat(60000);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// phone -> { sock, level, status, code, sends, startedAt, bannedAt }
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
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    version = undefined; // Baileys utilisera sa version par défaut
  }

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

  // The code is resolved once, on the 'qr' event.
  let resolveCode, rejectCode;
  const codePromise = new Promise((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  let pairingRequested = false;

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    // Request the code the exact moment 'qr' fires and we're not yet registered.
    if (qr && !pairingRequested && !sock.authState.creds.registered) {
      pairingRequested = true;
      try {
        const raw = await sock.requestPairingCode(phone);
        const code = raw?.match(/.{1,4}/g)?.join('-') || raw;
        sess.code = code;
        resolveCode(code);
        console.log(`[${phone}] pairing code: ${code}`);
      } catch (err) {
        rejectCode(err);
        console.error(`[${phone}] pairing failed:`, err?.message || err);
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
    // 25-second ceiling so the HTTP request can't hang forever if 'qr'
    // never arrives (unreachable WhatsApp, bad network, etc).
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

app.listen(PORT, () => {
  console.log(`[bothub] http://localhost:${PORT}`);
});
