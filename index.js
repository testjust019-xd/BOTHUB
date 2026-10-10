// Mini bot WhatsApp — connexion par pairing code
// Commandes : .ping .menu
//
// Le code de pairing est demandé sur l'évènement 'qr' : c'est le moment exact
// où Baileys termine la poignée de main et accepte un login. Fixer un délai
// ou attendre simplement l'ouverture du socket ne suffit pas — seul 'qr'
// garantit que le code sera bien enregistré côté serveur WhatsApp.

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys')
const pino = require('pino')
const readline = require('readline')
const fs = require('fs')

const PREFIX = '.'
const SESSION_DIR = process.env.SESSION_DIR || './session'
const NUMBER = (process.env.NUMBER || process.argv[2] || '').replace(/[^0-9]/g, '')
const startedAt = Date.now()

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  )
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${d}j ${h}h ${m}m ${sec}s`
}

function getText(msg) {
  const m = msg.message
  if (!m) return ''
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.ephemeralMessage?.message?.conversation ||
    m.ephemeralMessage?.message?.extendedTextMessage?.text ||
    ''
  )
}

const commands = {
  async ping(sock, msg, jid) {
    const ts = Number(msg.messageTimestamp) * 1000
    const latency = Math.max(0, Date.now() - ts)
    await sock.sendMessage(
      jid,
      { text: `🏓 Pong !\n⚡ Latence : ${latency} ms\n⏱️ Uptime : ${formatUptime(Date.now() - startedAt)}` },
      { quoted: msg }
    )
  },

  async menu(sock, msg, jid) {
    const text =
      `╭─── 🤖 *MINI BOT* ───\n` +
      `│ Préfixe : ${PREFIX}\n` +
      `│ Uptime : ${formatUptime(Date.now() - startedAt)}\n` +
      `├────────────────\n` +
      `│ ➤ ${PREFIX}ping  : tester la vitesse\n` +
      `│ ➤ ${PREFIX}menu  : afficher ce menu\n` +
      `╰────────────────`
    await sock.sendMessage(jid, { text }, { quoted: msg })
  },
}

let pairingAsked = false

// Résout le numéro une seule fois : env > argv > prompt.
// En environnement sans terminal (Render, CI), refuse d'attendre une saisie
// qui ne viendra jamais — lève une erreur claire à la place.
async function resolveNumber() {
  if (NUMBER.length >= 8) return NUMBER
  if (!process.stdin.isTTY) {
    throw new Error(
      'Aucun numéro fourni. Définis la variable d\'environnement NUMBER ' +
      '(ex : NUMBER=225XXXXXXXXXX) avant de lancer le bot.'
    )
  }
  let n = ''
  while (n.length < 8) {
    n = (await ask('📱 Ton numéro avec indicatif pays, sans + (ex: 225XXXXXXXXXX) : '))
      .replace(/[^0-9]/g, '')
  }
  return n
}

function describeClose(code) {
  switch (code) {
    case DisconnectReason.loggedOut: return 'loggedOut (session déboutée ou bannie)'
    case DisconnectReason.restartRequired: return 'restartRequired'
    case DisconnectReason.connectionClosed: return 'connectionClosed'
    case DisconnectReason.connectionLost: return 'connectionLost'
    case DisconnectReason.connectionReplaced: return 'connectionReplaced'
    case DisconnectReason.timedOut: return 'timedOut'
    case DisconnectReason.badSession: return 'badSession'
    case DisconnectReason.multideviceMismatch: return 'multideviceMismatch'
    default: return `code ${code}`
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)

  let version
  try {
    ;({ version } = await fetchLatestBaileysVersion())
  } catch {
    version = undefined
  }

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
  })

  sock.ev.on('creds.update', saveCreds)

  const requestCode = async () => {
    if (pairingAsked || sock.authState.creds.registered) return
    pairingAsked = true
    try {
      const number = await resolveNumber()
      const raw = await sock.requestPairingCode(number)
      const code = raw?.match(/.{1,4}/g)?.join('-') || raw
      console.log(`\n🔑 CODE DE PAIRING : ${code}\n`)
      console.log('WhatsApp > Appareils connectés > Connecter un appareil > Connecter avec le numéro de téléphone\n')
    } catch (err) {
      pairingAsked = false
      console.error('❌ Erreur pairing :', err?.message || err)
    }
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    // 'qr' est émis quand le socket est prêt et non enregistré : bon moment
    // pour demander le code de pairing.
    if (qr) await requestCode()

    if (connection === 'open') {
      pairingAsked = false
      console.log('✅ Bot connecté !')
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      console.log(`⚠️ Connexion fermée — ${describeClose(code)}`)

      if (code === DisconnectReason.loggedOut) {
        console.log('🚪 Session déconnectée — suppression et nouveau pairing au prochain démarrage.')
        try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }) } catch {}
        pairingAsked = false
      }
      setTimeout(startBot, 3000)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      try {
        if (!msg.message) continue
        const jid = msg.key.remoteJid
        if (!jid || jid === 'status@broadcast') continue

        const text = getText(msg).trim()
        if (!text.startsWith(PREFIX)) continue

        const name = text.slice(PREFIX.length).trim().split(/\s+/)[0].toLowerCase()
        if (commands[name]) await commands[name](sock, msg, jid)
      } catch (err) {
        console.error('Erreur commande :', err?.message || err)
      }
    }
  })
}

process.on('uncaughtException', (e) => console.error('uncaughtException:', e?.message || e))
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e?.message || e))

startBot().catch((err) => {
  console.error('❌ Démarrage impossible :', err?.message || err)
  process.exit(1)
})
