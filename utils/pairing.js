// Demande fiable du code de pairing.
//
// `requestPairingCode` de Baileys envoie un nœud sur le websocket. Si celui-ci
// n'est pas ouvert, `sendNode` lève « Connection Closed ».
//
// Le socket d'une session NON appairée se ferme et se recrée en boucle : le
// moment où la demande est armée tombe donc régulièrement sur un websocket déjà
// refermé (mesuré : `ws{closing=true, closed=true}`). Une seule tentative ne
// suffit pas — on attend l'ouverture du socket courant, et si elle échoue on
// retente jusqu'à tomber sur un socket réellement ouvert.

const sleep = ms => new Promise(r => setTimeout(r, ms));

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const describe = s => {
  try {
    const w = s?.ws;
    return `ws{open=${w?.isOpen} closing=${w?.isClosing} closed=${w?.isClosed}}`;
  } catch { return 'ws{?}'; }
};

export async function requestPairingCode(getSock, number, {
  openTimeoutMs = 8_000,
  attempts = 6,
  retryDelayMs = 2_500,
} = {}) {
  const get = () => (typeof getSock === 'function' ? getSock() : getSock);
  if (!get()) throw new Error('session sans socket');
  if (!number) throw new Error('numéro de pairing manquant');

  let lastErr = new Error('pairing impossible');
  for (let i = 0; i < attempts; i++) {
    const s = get();
    if (s) {
      try {
        if (typeof s.waitForSocketOpen === 'function') {
          await withTimeout(s.waitForSocketOpen(), openTimeoutMs, 'socket pas ouvert (délai dépassé)');
        }
        return await (get() || s).requestPairingCode(number);
      } catch (err) {
        lastErr = new Error(`${err.message} [tentative ${i + 1} ${describe(s)}]`);
      }
    }
    if (i < attempts - 1) await sleep(retryDelayMs);
  }
  throw lastErr;
}
