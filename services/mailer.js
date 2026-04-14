const nodemailer = require('nodemailer');

function readSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const fromName = process.env.SMTP_FROM_NAME || process.env.APP_NAME || 'Temp Mail Box';
  const fromAddress = process.env.SMTP_FROM_EMAIL || user;

  if (!host || !user || !pass || !fromAddress) {
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    fromName,
    fromAddress
  };
}

async function sendExternalMail({ to, subject, text, replyTo }) {
  const config = readSmtpConfig();
  if (!config) {
    return { delivered: false, skipped: true, reason: 'SMTP belum dikonfigurasi' };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth
  });

  const info = await transporter.sendMail({
    from: `${config.fromName} <${config.fromAddress}>`,
    to,
    subject,
    text,
    replyTo: replyTo || config.fromAddress
  });

  return {
    delivered: true,
    messageId: info.messageId
  };
}

module.exports = {
  sendExternalMail
};
