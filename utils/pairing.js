// utils/pairing.js — one session per call. Ported from index.js.
// Keeps: qr-trigger for the pairing code, 4× retry with backoff, serialized
// creds writes, single-reconnect guard, explicit close-code handling.
// Drops: CLI-only concerns (process.exit, prompt, global state, console code).

import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import * as B from '@whiskeysockets/baileys';

const pick = (k) => B[k] ?? B.default?.[k];
const makeWASocket =
  typeof B.default === 'function' ? B.default : (B.default?.default ?? B.makeWASocket);
const useMultiFileAuthState = pick('useMultiFileAuthState');
const fetchLatestBaileysVersion = pick('fetchLatestBaileysVersion');
const DisconnectReason = pick('DisconnectReason');
const Browsers = pick('Browsers');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function purgeSessionDir(sessionDir) {
  try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
}

export async function fetchVersion(timeoutMs = 8000) {
  try {
    const r = await Promise.race([
      fetchLatestBaileysVersion(),
      sleep(timeoutMs).then(() => null),
    ]);
    return r?.version;
  } catch { return undefined; }
}

/**
 * @param {object} opts
 * @param {string} opts.phone          international, no +, no leading 0
 * @param {string} opts.sessionDir     directory for creds.json etc.
 * @param {object} [opts.logger]       console-like logger (default: console)
 * @param {function} [opts.onOpen]     (sock, id) => void
 * @param {function} [opts.onClose]    ({ code, reason, banned, replaced }) => void
 * @param {function} [opts.onMessage]  (type, messages, sock) => void
 * @param {boolean} [opts.autoReconnect] true → reconnect on transient closes
 * @param {number} [opts.codeTimeoutMs] pairing code wait, default 30s
 * @param {number} [opts.codeRetries]   default 4
 *
 * @returns {{ code: Promise<string|null>, sock: () => object|null, end: () => void }}
 */
export function createSession({
  phone,
  sessionDir,
  logger = console,
  onOpen = () => {},
  onClose = () => {},
  onMessage = () => {},
  autoReconnect = true,
  codeTimeoutMs = 30000,
  codeRetries = 4,
} = {}) {
  let sock = null;
  let backoff = 0;
  let restartTimer = null;
  let saving = Promise.resolve();
  let codeResolved = false;
  let resolveCode, rejectCode;
  const codePromise = new Promise((res, rej) => { resolveCode = res; rejectCode = rej; });

  const log = (icon, msg) => {
    const line = `${new Date().toISOString().slice(11, 19)} ${icon} ${msg}`;
    if (typeof logger.log === 'function') logger.log(line);
    else if (typeof logger.info === 'function') logger.info(line);
    else console.log(line);
  };

  async function requestCode(s) {
    for (let i = 1; i <= codeRetries; i++) {
      try {
        await sleep(1500);
        const raw = await s.requestPairingCode(phone);
        const code = String(raw).match(/.{1,4}/g).join('-');
        log('🔑', `pairing code for +${phone}: ${code}`);
        return code;
      } catch (e) {
        log('⚠️', `code request ${i}/${codeRetries} failed: ${e.message}`);
        await sleep(2000 * i);
      }
    }
    return null;
  }

  function scheduleRestart(delay) {
    if (restartTimer) return;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      start().catch((e) => {
        log('💥', `restart failed: ${e.message}`);
        backoff = Math.min(30000, backoff ? backoff * 2 : 2000);
        scheduleRestart(backoff);
      });
    }, delay);
  }

  async function start() {
    await saving;
    fs.mkdirSync(sessionDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const needsPairing = !state.creds?.registered;

    // Already registered: no code to wait for — resolve immediately with null.
    if (!needsPairing && !codeResolved) { codeResolved = true; resolveCode(null); }

    const version = await fetchVersion();
    log('🔌', needsPairing
      ? `connecting (pairing mode) +${phone}`
      : `connecting with existing session +${phone}`);

    const s = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.macOS('Chrome'),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      keepAliveIntervalMs: 25000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 500,
    });

    sock = s;

    s.ev.on('creds.update', () => {
      saving = saving.then(() => saveCreds()).catch((e) => log('⚠️', `creds save: ${e.message}`));
    });

    let codeRequested = false;
    let closedThisSocket = false;

    s.ev.on('connection.update', async (u) => {
      const { connection, lastDisconnect, qr } = u;

      if (needsPairing && qr && !codeRequested) {
        codeRequested = true;
        const code = await requestCode(s);
        if (code && !codeResolved) { codeResolved = true; resolveCode(code); }
        if (!code) {
          log('❌', 'could not obtain a pairing code — restarting socket');
          try { s.end(new Error('code request failed')); } catch {}
        }
      }

      if (connection === 'open') {
        backoff = 0;
        const id = s.user?.id?.split(':')[0]?.split('@')[0] ?? '?';
        log('✅', `connected as +${id}`);
        onOpen(s, id);
      }

      if (connection === 'close') {
        if (closedThisSocket) return;
        closedThisSocket = true;
        try { s.ev.removeAllListeners('connection.update'); } catch {}

        const code = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'unknown';
        log('🔴', `disconnected (code ${code ?? 'n/a'} — ${reason})`);

        // Terminal: forbidden (403) — never reconnect
        if (code === DisconnectReason.forbidden) {
          if (!codeResolved) { codeResolved = true; rejectCode(new Error('forbidden')); }
          onClose({ code, reason, banned: true });
          return;
        }

        // Post-pairing restart — reconnect immediately
        if (code === DisconnectReason.restartRequired) {
          onClose({ code, reason, banned: false });
          if (autoReconnect) scheduleRestart(300);
          return;
        }

        // Session replaced elsewhere — stop, do not loop
        if (code === DisconnectReason.connectionReplaced) {
          if (!codeResolved) { codeResolved = true; rejectCode(new Error('connection replaced')); }
          onClose({ code, reason, banned: false, replaced: true });
          return;
        }

        // Logged out / bad session — creds are dead
        if (code === DisconnectReason.loggedOut || code === DisconnectReason.badSession) {
          if (!codeResolved) { codeResolved = true; rejectCode(new Error('logged out')); }
          onClose({ code, reason, banned: code === DisconnectReason.loggedOut });
          return;
        }

        // Anything else: reject the code promise if it hasn't settled, and
        // optionally reconnect with exponential backoff.
        if (!codeResolved) { codeResolved = true; rejectCode(new Error(`closed: ${code ?? reason}`)); }
        onClose({ code, reason, banned: false });
        if (autoReconnect) {
          backoff = Math.min(30000, backoff ? backoff * 2 : 2000);
          scheduleRestart(backoff);
        }
      }
    });

    s.ev.on('messages.upsert', ({ type, messages }) => onMessage(type, messages, s));

    return s;
  }

  const timeout = setTimeout(() => {
    if (!codeResolved) { codeResolved = true; rejectCode(new Error('pairing code timeout')); }
  }, codeTimeoutMs);
  codePromise.finally(() => clearTimeout(timeout)).catch(() => {});

  start().catch((e) => {
    if (!codeResolved) { codeResolved = true; rejectCode(e); }
    onClose({ code: null, reason: e?.message || String(e), banned: false });
  });

  return {
    code: codePromise,
    sock: () => sock,
    end: () => {
      if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
      if (sock) {
        try { sock.ev.removeAllListeners(); } catch {}
        try { sock.end(undefined); } catch {}
      }
    },
  };
}
