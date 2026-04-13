const fs = require('node:fs/promises');
const path = require('node:path');
const { nanoid } = require('nanoid');

const DB_PATH = path.join(__dirname, '..', 'data', 'messages.json');

async function readAll() {
  const raw = await fs.readFile(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

async function writeAll(messages) {
  await fs.writeFile(DB_PATH, JSON.stringify(messages, null, 2));
}

function normalizeEmail(value, domain) {
  const input = String(value || '').trim().toLowerCase();
  if (!input) return '';
  if (input.includes('@')) return input;
  return `${input}@${domain}`;
}

async function sendMessage({ from, to, subject, body, domain }) {
  const messages = await readAll();
  const message = {
    id: nanoid(10),
    from: normalizeEmail(from, domain),
    to: normalizeEmail(to, domain),
    subject: subject?.trim() || '(Tanpa Subjek)',
    body: body?.trim() || '-',
    createdAt: new Date().toISOString(),
    readBy: [],
    trashedBy: []
  };
  messages.push(message);
  await writeAll(messages);
  return message;
}

async function getInbox(userEmail) {
  const messages = await readAll();
  return messages
    .filter((message) => message.to === userEmail && !message.trashedBy.includes(userEmail))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getSent(userEmail) {
  const messages = await readAll();
  return messages
    .filter((message) => message.from === userEmail && !message.trashedBy.includes(userEmail))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getTrash(userEmail) {
  const messages = await readAll();
  return messages
    .filter((message) => (message.from === userEmail || message.to === userEmail) && message.trashedBy.includes(userEmail))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getById(id) {
  const messages = await readAll();
  return messages.find((message) => message.id === id);
}

async function markRead(id, userEmail) {
  const messages = await readAll();
  const idx = messages.findIndex((message) => message.id === id);
  if (idx === -1) return false;
  if (!messages[idx].readBy.includes(userEmail)) {
    messages[idx].readBy.push(userEmail);
    await writeAll(messages);
  }
  return true;
}

async function moveToTrash(id, userEmail) {
  const messages = await readAll();
  const idx = messages.findIndex((message) => message.id === id);
  if (idx === -1) return false;
  if (!messages[idx].trashedBy.includes(userEmail)) {
    messages[idx].trashedBy.push(userEmail);
    await writeAll(messages);
  }
  return true;
}

async function restoreFromTrash(id, userEmail) {
  const messages = await readAll();
  const idx = messages.findIndex((message) => message.id === id);
  if (idx === -1) return false;
  messages[idx].trashedBy = messages[idx].trashedBy.filter((entry) => entry !== userEmail);
  await writeAll(messages);
  return true;
}

async function hardDelete(id, userEmail) {
  const messages = await readAll();
  const idx = messages.findIndex((message) => message.id === id);
  if (idx === -1) return false;

  const message = messages[idx];
  message.trashedBy = Array.from(new Set([...message.trashedBy, userEmail]));

  const allParticipants = [message.from, message.to];
  const deletable = allParticipants.every((participant) => message.trashedBy.includes(participant));

  if (deletable) {
    messages.splice(idx, 1);
  }

  await writeAll(messages);
  return true;
}

module.exports = {
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
};
