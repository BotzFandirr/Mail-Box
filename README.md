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
- Update mailbox **real-time** (Socket.IO + auto refresh inbox)
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
WEBHOOK_SECRET=ganti-token-webhook
```

> `MAIL_DOMAINS` dipisah koma. Domain pertama jadi default.
> `WEBHOOK_SECRET` dipakai untuk mengamankan endpoint inbound email real.
> Isi `WEBHOOK_SECRET` cukup token saja (contoh: `12345`), **bukan URL webhook penuh**.

## 3) Cara pakai
1. Buka halaman utama, klik **Generate Random** untuk email sementara baru.
2. Atau isi username sendiri lalu pilih domain, klik **Pakai Email**.
3. Kirim pesan antar alamat pada domain yang Anda kelola.

## 4) Kenapa email dari Gmail belum masuk?

Secara default project ini adalah **internal mailbox simulation**, jadi:
- Pesan yang masuk adalah pesan yang dikirim antar user di aplikasi ini.
- **Belum otomatis menerima email real dari Gmail/Yahoo/outlook**.

Kalau Anda kirim dari Gmail ke alamat temp-mail Anda, agar bisa masuk ke web ini Anda butuh:
1. Domain aktif dengan **MX record** benar.
2. Layanan penerima email real (contoh: Mailgun Inbound, SendGrid Inbound Parse, Postfix, atau IMAP listener).
3. Integrasi webhook/IMAP ke endpoint aplikasi supaya pesan disimpan ke `data/messages.json`.

Tanpa 3 hal di atas, Gmail tidak tahu harus mengirim ke app lokal Anda.

## 5) Setup domain ke server (mudah dikelola)

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

## 6) Jalankan sebagai service
```bash
npm install -g pm2
pm2 start app.js --name temp-mail-box
pm2 save
pm2 startup
```

## 7) Bisa pakai tunnel? (untuk STB HG680P)

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

## 8) Cara dapat real-time + email real beneran

### Real-time di web (sudah ada)
- Aplikasi sekarang sudah memakai **Socket.IO**, jadi inbox akan update otomatis saat ada pesan baru internal.

### Real-time dari Gmail (butuh provider inbound)
Arsitektur yang direkomendasikan:
1. Gmail kirim ke `you@domainanda.com`
2. Domain MX diarahkan ke provider inbound (misalnya Mailgun)
3. Provider kirim webhook ke server Anda (misalnya `POST /webhooks/inbound`)
4. Endpoint webhook simpan pesan ke store
5. Emit event Socket.IO agar inbox user langsung update

Endpoint inbound sudah tersedia di aplikasi: `POST /webhooks/inbound?token=WEBHOOK_SECRET`.
Endpoint ini menerima beberapa format field umum provider:
- `to` atau `recipient`
- `from` atau `sender`
- `text` atau `stripped-text` atau `body-plain` atau `html`

Contoh test webhook inbound manual:
```bash
curl -X POST "http://localhost:4000/webhooks/inbound?token=ganti-token-webhook" \
  -d "from=sender@gmail.com" \
  -d "to=tmp-user@mailnesia.com" \
  -d "subject=Test Real Inbound" \
  -d "text=Halo ini simulasi inbound dari provider."
```

Jika masih muncul:
```json
{"ok":false,"message":"Unauthorized token"}
```
cek hal ini:
1. Nilai `.env` `WEBHOOK_SECRET` sama persis dengan token yang Anda kirim.
   - contoh benar: `WEBHOOK_SECRET=12345`
   - jangan isi URL penuh; kalau terlanjur, app sekarang akan coba ambil nilai `token` dari URL tersebut.
2. Setelah ubah `.env`, restart app (`pm2 restart temp-mail-box` atau restart process).
3. Token bisa dikirim melalui salah satu cara:
   - query: `?token=...`
   - body form: `token=...`
   - header: `x-webhook-token: ...`
   - header: `Authorization: Bearer ...`
4. Pastikan nilai `to`/`recipient` benar-benar alamat mailbox yang sedang Anda buka di web.
   - format seperti `Nama User <user@domain.com>` sekarang didukung dan akan diparsing otomatis.

---

> Catatan: ini mailbox simulation/internal temp mail untuk workflow aplikasi Anda, bukan server SMTP/IMAP production.
