# Temp Mail Box (Node.js + EJS + Bootstrap 5)

Web **email sementara** (temporary email) full-stack menggunakan:
- Node.js + Express
- EJS
- Bootstrap 5
- SweetAlert2 + Bootstrap Toast (alert UI modern, bukan alert kaku)

Default berjalan di **port 4000**.

## Fitur
- Generate email random (contoh: `tmp-ab12cd34@mailnesia.com`)
- Dukungan **banyak domain** sekaligus
- Ganti email aktif manual (custom username + pilih domain)
- Inbox, Sent, Trash, restore, delete permanen
- UI modern dan responsif

## 1) Install
```bash
npm install
cp .env.example .env
npm run start
```

Buka: `http://localhost:4000`

## 2) Konfigurasi banyak domain
Edit `.env`:

```env
PORT=4000
APP_NAME=Temp Mail Box
MAIL_DOMAINS=mailnesia.com,mailboxku.id,tmpinbox.net
SESSION_SECRET=ganti-secret-anda
```

> `MAIL_DOMAINS` dipisah koma. Domain pertama jadi default.

## 3) Cara pakai
1. Buka halaman utama, klik **Generate Random** untuk email sementara baru.
2. Atau isi username sendiri lalu pilih domain, klik **Pakai Email**.
3. Kirim pesan antar alamat pada domain yang Anda kelola.

## 4) Setup domain ke server (mudah dikelola)

### DNS
Buat beberapa `A record` (contoh):
- `mailnesia.com -> IP_SERVER`
- `mailboxku.id -> IP_SERVER`
- `tmpinbox.net -> IP_SERVER`

### Reverse proxy Nginx (satu config multi-domain)
`/etc/nginx/sites-available/temp-mail-box`

```nginx
server {
    listen 80;
    server_name mailnesia.com mailboxku.id tmpinbox.net;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan:
```bash
sudo ln -s /etc/nginx/sites-available/temp-mail-box /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### HTTPS (Let's Encrypt)
```bash
sudo certbot --nginx -d mailnesia.com -d mailboxku.id -d tmpinbox.net
```

## 5) Jalankan sebagai service
```bash
npm install -g pm2
pm2 start app.js --name temp-mail-box
pm2 save
pm2 startup
```

## 6) Bisa pakai tunnel? (untuk STB HG680P)

Bisa. Selama STB Anda bisa menjalankan Node.js dan aplikasi jalan di port `4000`, Anda dapat expose ke internet memakai tunnel.

### Opsi A: Cloudflare Tunnel (paling stabil untuk domain sendiri)
1. Jalankan aplikasi:
   ```bash
   npm run start
   ```
2. Download `cloudflared` sesuai arsitektur STB (umumnya ARM).
3. Login Cloudflare:
   ```bash
   cloudflared tunnel login
   ```
4. Buat tunnel:
   ```bash
   cloudflared tunnel create temp-mail-box
   ```
5. Route domain Anda ke tunnel:
   ```bash
   cloudflared tunnel route dns temp-mail-box mail.domainanda.com
   ```
6. Jalankan tunnel ke app lokal port 4000:
   ```bash
   cloudflared tunnel run --url http://localhost:4000 temp-mail-box
   ```

### Opsi B: Quick tunnel (tanpa domain, cepat untuk testing)
```bash
cloudflared tunnel --url http://localhost:4000
```
Nanti Anda dapat URL publik acak (`*.trycloudflare.com`).

### Opsi C: LocalTunnel (paling simpel)
```bash
npx localtunnel --port 4000
```
Jika berhasil, Anda dapat URL publik seperti `https://xxxx.loca.lt`.

### Tips khusus HG680P
- Pastikan RAM cukup (jalankan hanya service penting).
- Gunakan PM2 agar app auto-restart.
- Jika binary tunnel tidak bisa jalan, cek arsitektur:
  ```bash
  uname -m
  ```
- Untuk akses stabil, lebih disarankan Cloudflare Tunnel dibanding quick tunnel gratis.

---

> Catatan: ini mailbox simulation/internal temp mail untuk workflow aplikasi Anda, bukan server SMTP/IMAP production.
