# Mail Box (Node.js + EJS + Bootstrap 5)

Web **Mail Box full-stack** sederhana menggunakan:
- Node.js + Express
- EJS template engine
- Bootstrap 5 UI
- SweetAlert2 + Bootstrap Toast untuk alert yang modern (tanpa `alert()` kaku)

Aplikasi berjalan default di **port `4000`** dan siap diatur agar mudah dikelola dengan domain Anda.

---

## 1) Setup Cepat

## Prasyarat
- Node.js 18+
- npm

### Install & Jalankan
```bash
npm install
cp .env.example .env
npm run start
```

Buka: `http://localhost:4000`

Untuk mode development:
```bash
npm run dev
```

---

## 2) Konfigurasi Environment

Edit file `.env`:

```env
PORT=4000
APP_NAME=Mail Box
APP_DOMAIN=mail.domainanda.com
SESSION_SECRET=ganti-dengan-secret-kuat
```

Keterangan:
- `PORT`: port aplikasi (default 4000)
- `APP_DOMAIN`: domain email lokal yang dipakai saat tulis/ganti mailbox
  - Contoh: ketik `support` otomatis jadi `support@mail.domainanda.com`
- `SESSION_SECRET`: secret session Express

---

## 3) Fitur Utama

- Ganti mailbox aktif (simulasi multi-user) langsung dari UI.
- Compose, Inbox, Sent, Trash.
- Soft delete (pindah trash), restore, dan delete permanen per mailbox.
- Status pesan baru (unread badge).
- Alert UI modern:
  - Toast notifikasi sukses/gagal
  - Konfirmasi aksi dengan SweetAlert2

---

## 4) Setup Domain (Mudah Dikelola)

Berikut alur paling mudah (contoh dengan Nginx sebagai reverse proxy).

### A. Atur DNS Domain
Di provider domain Anda, buat record:
- Type: `A`
- Name: `mail` (atau subdomain lain)
- Value: `IP_SERVER_ANDA`

Contoh hasil: `mail.domainanda.com`

### B. Jalankan App dengan Process Manager (PM2)
```bash
npm install -g pm2
pm2 start app.js --name mail-box
pm2 save
pm2 startup
```

### C. Konfigurasi Nginx
File: `/etc/nginx/sites-available/mail-box`

```nginx
server {
    listen 80;
    server_name mail.domainanda.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan site:
```bash
sudo ln -s /etc/nginx/sites-available/mail-box /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### D. SSL (HTTPS) dengan Let's Encrypt
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d mail.domainanda.com
```

Selesai — domain Anda akan langsung mengarah ke aplikasi port 4000.

---

## 5) Struktur Singkat Project

```bash
.
├── app.js
├── services/messageStore.js
├── data/messages.json
├── views/
├── public/
└── README.md
```

---

## 6) Catatan

Project ini adalah **mailbox simulation/internal messaging**, bukan SMTP/IMAP mail server.
Jika Anda ingin, tahap berikutnya bisa ditambahkan:
- autentikasi login real (database user)
- attachment upload
- integrasi SMTP (misalnya Nodemailer)
- deploy Docker
