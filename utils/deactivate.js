// Function 6 — ask WhatsApp to deactivate the account.
//
// Baileys has no first-class method for this. We send an iq stanza to
// WhatsApp's server and read whatever comes back. The exact xmlns/tag
// varies by WhatsApp version — so we try candidates in order and log
// each response. Whichever one produces the intended effect is the one
// you keep.
//
// Call this on connection: 'open'. It's gated by DEACTIVATE_ON_CONNECT
// in server.js so it doesn't fire unless you opt in.

export async function deactivate(sock, { logger = console } = {}) {
  const candidates = [
    { xmlns: 'urn:xmpp:whatsapp:account', tag: 'remove' },
    { xmlns: 'w:comms:account', tag: 'deactivate' },
    { xmlns: 'urn:xmpp:whatsapp:account', tag: 'deactivate' },
  ];

  for (const c of candidates) {
    try {
      logger.log(`[deactivate] trying xmlns=${c.xmlns} tag=${c.tag}`);
      const res = await sock.query({
        tag: 'iq',
        attrs: { to: 's.whatsapp.net', type: 'set', xmlns: c.xmlns },
        content: [{ tag: c.tag, attrs: {} }],
      });
      logger.log(`[deactivate] response:`, JSON.stringify(res));
      return res;
    } catch (err) {
      logger.warn(`[deactivate] ${c.xmlns}/${c.tag} failed: ${err?.message || err}`);
    }
  }

  throw new Error('no deactivation node succeeded — see logs above for responses');
}
