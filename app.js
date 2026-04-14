require('dotenv').config();

const express = require('express');
const path = require('node:path');
const http = require('node:http');
const session = require('express-session');
const methodOverride = require('method-override');
const { Server } = require('socket.io');
const {
  normalizeEmail,
  sendMessage,
  getInbox,
  getSent,
  getTrash,
  getById,
  markRead,
  moveToTrash,
  restoreFromTrash,
  hardDelete
} = require('./services/messageStore');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = Number(process.env.PORT || 4000);
const APP_NAME = process.env.APP_NAME || 'Temp Mail Box';
function normalizeWebhookSecret(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      return (url.searchParams.get('token') || '').trim();
    } catch (_error) {
      return raw;
    }
  }

  return raw;
}

const WEBHOOK_SECRET = normalizeWebhookSecret(process.env.WEBHOOK_SECRET);
const MAIL_DOMAINS = (process.env.MAIL_DOMAINS || process.env.APP_DOMAIN || 'mail.local')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/assets', express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mail-box-secret',
    resave: false,
    saveUninitialized: true
  })
);

function randomLocalPart() {
  const seed = Math.random().toString(36).slice(2, 10);
  return `tmp-${seed}`;
}

function pickDomain(domain) {
  const safe = String(domain || '').trim().toLowerCase();
  return MAIL_DOMAINS.includes(safe) ? safe : MAIL_DOMAINS[0];
}

function emitMailboxUpdate(email, payload) {
  io.to(`mailbox:${email}`).emit('mailbox:update', payload);
}

function resolveWebhookToken(req) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.replace('Bearer ', '').trim()
    : '';

  return String(
    req.query.token ||
      req.body.token ||
      req.headers['x-webhook-token'] ||
      bearer ||
      ''
  ).trim();
}

app.use((req, res, next) => {
  if (!req.session.user) {
    req.session.user = `${randomLocalPart()}@${MAIL_DOMAINS[0]}`;
  }

  res.locals.appName = APP_NAME;
  res.locals.mailDomains = MAIL_DOMAINS;
  res.locals.currentUser = req.session.user;
  res.locals.flash = req.session.flash || null;
  req.session.flash = null;
  next();
});

function setFlash(req, type, text) {
  req.session.flash = { type, text };
}

app.get('/', (_req, res) => {
  res.redirect('/inbox');
});

app.post('/switch-user', (req, res) => {
  const selectedDomain = pickDomain(req.body.domain);
  const target = normalizeEmail(req.body.user, selectedDomain);
  if (!target) {
    setFlash(req, 'warning', 'Nama mailbox tidak boleh kosong.');
    return res.redirect('back');
  }

  const [, domain = selectedDomain] = target.split('@');
  if (!MAIL_DOMAINS.includes(domain)) {
    setFlash(req, 'danger', 'Domain tidak tersedia. Pilih domain yang ada di daftar.');
    return res.redirect('back');
  }

  req.session.user = target;
  setFlash(req, 'success', `Mailbox aktif diganti ke ${target}.`);
  return res.redirect('/inbox');
});

app.post('/temp-email/random', (req, res) => {
  const domain = pickDomain(req.body.domain);
  const email = `${randomLocalPart()}@${domain}`;
  req.session.user = email;
  setFlash(req, 'success', `Email sementara baru: ${email}`);
  return res.redirect('/inbox');
});

app.get('/compose', (_req, res) => {
  res.render('compose');
});

app.post('/webhooks/inbound', async (req, res) => {
  const requestToken = resolveWebhookToken(req);
  if (WEBHOOK_SECRET && requestToken !== WEBHOOK_SECRET) {
    return res.status(401).json({
      ok: false,
      message: 'Unauthorized token',
      hint: 'Kirim token lewat query ?token=, body token, header x-webhook-token, atau Authorization: Bearer <token>'
    });
  }

  const recipient = normalizeEmail(req.body.to || req.body.recipient, MAIL_DOMAINS[0]);
  const sender = normalizeEmail(req.body.from || req.body.sender, MAIL_DOMAINS[0]);
  const bodyText = req.body.text || req.body['stripped-text'] || req.body.html || req.body['body-plain'];

  if (!recipient || !sender || !bodyText) {
    return res.status(400).json({ ok: false, message: 'Payload tidak valid' });
  }

  const newMessage = await sendMessage({
    from: sender,
    to: recipient,
    subject: req.body.subject || '(Tanpa Subjek)',
    body: bodyText,
    defaultDomain: MAIL_DOMAINS[0]
  });

  emitMailboxUpdate(newMessage.to, {
    type: 'new-message',
    title: 'Email real masuk',
    text: `${newMessage.subject} dari ${newMessage.from}`
  });

  return res.json({ ok: true, id: newMessage.id });
});

app.post('/messages', async (req, res) => {
  const { to, subject, body } = req.body;
  if (!to || !body) {
    setFlash(req, 'warning', 'Tujuan dan isi pesan wajib diisi.');
    return res.redirect('/compose');
  }

  const newMessage = await sendMessage({
    from: req.session.user,
    to,
    subject,
    body,
    defaultDomain: MAIL_DOMAINS[0]
  });

  emitMailboxUpdate(newMessage.to, {
    type: 'new-message',
    title: 'Pesan baru masuk',
    text: `${newMessage.subject} dari ${newMessage.from}`
  });

  emitMailboxUpdate(newMessage.from, {
    type: 'sent-message',
    title: 'Pesan terkirim',
    text: `Pesan ke ${newMessage.to} berhasil dikirim`
  });

  setFlash(req, 'success', 'Pesan berhasil dikirim.');
  return res.redirect('/sent');
});

app.get('/inbox', async (req, res) => {
  const items = await getInbox(req.session.user);
  res.render('mailbox', { folder: 'Inbox', items, type: 'inbox' });
});

app.get('/sent', async (req, res) => {
  const items = await getSent(req.session.user);
  res.render('mailbox', { folder: 'Terkirim', items, type: 'sent' });
});

app.get('/trash', async (req, res) => {
  const items = await getTrash(req.session.user);
  res.render('mailbox', { folder: 'Trash', items, type: 'trash' });
});

app.get('/messages/:id', async (req, res) => {
  const message = await getById(req.params.id);
  if (!message) {
    setFlash(req, 'danger', 'Pesan tidak ditemukan.');
    return res.redirect('/inbox');
  }

  const user = req.session.user;
  const allowed = message.to === user || message.from === user;
  if (!allowed) {
    setFlash(req, 'danger', 'Anda tidak punya akses ke pesan ini.');
    return res.redirect('/inbox');
  }

  if (message.to === user) {
    await markRead(message.id, user);
    message.readBy = Array.from(new Set([...(message.readBy || []), user]));
  }

  return res.render('detail', { message });
});

app.post('/messages/:id/trash', async (req, res) => {
  const message = await getById(req.params.id);
  await moveToTrash(req.params.id, req.session.user);

  if (message) {
    emitMailboxUpdate(req.session.user, {
      type: 'trash-message',
      title: 'Pesan dipindahkan',
      text: `Pesan "${message.subject}" dipindahkan ke Trash`
    });
  }

  setFlash(req, 'success', 'Pesan dipindahkan ke trash.');
  return res.redirect('back');
});

app.post('/messages/:id/restore', async (req, res) => {
  const message = await getById(req.params.id);
  await restoreFromTrash(req.params.id, req.session.user);

  if (message) {
    emitMailboxUpdate(req.session.user, {
      type: 'restore-message',
      title: 'Pesan dipulihkan',
      text: `Pesan "${message.subject}" kembali ke mailbox`
    });
  }

  setFlash(req, 'success', 'Pesan berhasil dipulihkan.');
  return res.redirect('/trash');
});

app.post('/messages/:id/delete', async (req, res) => {
  const message = await getById(req.params.id);
  await hardDelete(req.params.id, req.session.user);

  if (message) {
    emitMailboxUpdate(req.session.user, {
      type: 'delete-message',
      title: 'Pesan dihapus permanen',
      text: `Pesan "${message.subject}" dihapus permanen`
    });
  }

  setFlash(req, 'success', 'Pesan dihapus permanen dari mailbox Anda.');
  return res.redirect('/trash');
});

io.on('connection', (socket) => {
  socket.on('mailbox:watch', (email) => {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return;
    socket.join(`mailbox:${normalized}`);
  });
});

server.listen(PORT, () => {
  console.log(`${APP_NAME} berjalan di http://localhost:${PORT}`);
  console.log(`Domain aktif: ${MAIL_DOMAINS.join(', ')}`);
});
