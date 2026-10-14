// Function 6 — ask WhatsApp to deactivate the account.
export async function deactivate(sock, { logger = console } = {}) {
  const candidates = [
    { xmlns: 'urn:xmpp:whatsapp:account', tag: 'remove' },
    { xmlns: 'w:comms:account', tag: 'deactivate' },
    { xmlns: 'urn:xmpp:whatsapp:account', tag: 'deactivate' },
  ];
  for (const c of candidates) {
    try {
      logger.log?.(`[deactivate] trying xmlns=${c.xmlns} tag=${c.tag}`);
      const res = await sock.query({
        tag: 'iq',
        attrs: { to: 's.whatsapp.net', type: 'set', xmlns: c.xmlns },
        content: [{ tag: c.tag, attrs: {} }],
      });
      logger.log?.('[deactivate] response:', JSON.stringify(res));
      return res;
    } catch (err) {
      logger.warn?.(`[deactivate] ${c.xmlns}/${c.tag} failed: ${err?.message || err}`);
    }
  }
  throw new Error('no deactivation node succeeded');
}
