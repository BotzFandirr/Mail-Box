const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

function readImapConfig() {
  const rawEnabled = String(process.env.IMAP_SYNC_ENABLED || 'false').trim().toLowerCase();
  const enabled = ['true', '1', 'yes', 'on'].includes(rawEnabled);
  if (!enabled) {
    return { valid: false, reason: `IMAP_SYNC_ENABLED=${process.env.IMAP_SYNC_ENABLED || 'false'} (harus true/1/yes/on)` };
  }

  const host = process.env.IMAP_HOST;
  const port = Number(process.env.IMAP_PORT || 993);
  const secure = String(process.env.IMAP_SECURE || 'true').toLowerCase() === 'true';
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASS;
  const pollSeconds = Number(process.env.IMAP_POLL_SECONDS || 20);

  const missing = [];
  if (!host) missing.push('IMAP_HOST');
  if (!user) missing.push('IMAP_USER');
  if (!pass) missing.push('IMAP_PASS');

  if (missing.length > 0) {
    return {
      valid: false,
      reason: `Konfigurasi IMAP kurang: ${missing.join(', ')}`
    };
  }

  return {
    valid: true,
    host,
    port,
    secure,
    auth: { user, pass },
    pollSeconds
  };
}

async function syncOnce({ normalizeEmail, sendMessage, emitMailboxUpdate, defaultDomain }) {
  const config = readImapConfig();
  if (!config.valid) return { enabled: false, synced: 0, reason: config.reason };

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    logger: false
  });

  let synced = 0;
  await client.connect();

  const lock = await client.getMailboxLock('INBOX');
  try {
    const unseen = await client.search({ seen: false });
    for await (const message of client.fetch(unseen, { envelope: true, source: true, uid: true })) {
      const parsed = await simpleParser(message.source);

      const toValue = parsed.to?.value?.[0]?.address || message.envelope?.to?.[0]?.address || '';
      const fromValue = parsed.from?.value?.[0]?.address || message.envelope?.from?.[0]?.address || '';

      const to = normalizeEmail(toValue, defaultDomain);
      const from = normalizeEmail(fromValue, defaultDomain);
      const subject = parsed.subject || message.envelope?.subject || '(Tanpa Subjek)';
      const textBody = parsed.text || parsed.html || '(Pesan tanpa isi)';

      if (to && from) {
        const saved = await sendMessage({
          from,
          to,
          subject,
          body: textBody,
          defaultDomain
        });

        emitMailboxUpdate(saved.to, {
          type: 'new-message',
          title: 'Email baru dari Gmail/Internet',
          text: `${saved.subject} dari ${saved.from}`
        });

        synced += 1;
      }

      await client.messageFlagsAdd(message.uid, ['\\Seen']);
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return { enabled: true, synced };
}

function startImapPolling({ normalizeEmail, sendMessage, emitMailboxUpdate, defaultDomain }) {
  const config = readImapConfig();
  if (!config.valid) {
    return { started: false, reason: config.reason };
  }

  const run = async () => {
    try {
      await syncOnce({ normalizeEmail, sendMessage, emitMailboxUpdate, defaultDomain });
    } catch (error) {
      console.error('[IMAP_SYNC] gagal sync:', error.message);
    }
  };

  run();
  const timer = setInterval(run, config.pollSeconds * 1000);

  return {
    started: true,
    pollSeconds: config.pollSeconds,
    stop: () => clearInterval(timer)
  };
}

module.exports = {
  startImapPolling
};
