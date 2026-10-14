# Panduan Deployment Produksi VPS (UnlazyNotes SaaS)

Dokumen ini adalah panduan operasional teknis (*Production Runbook*) untuk mendeploy UnlazyNotes ke server VPS produksi utama (misal: VPS Singapore Ubuntu 24.04 LTS / 2 vCPU / 2GB RAM).

---

## 1. Persiapan Awal Server VPS

Jalankan perintah-perintah berikut melalui terminal SSH di server VPS produksi:

### A. Update Sistem & Instalasi Docker
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### B. Konfigurasi Swap File 4GB (Wajib untuk VPS 2GB RAM)
Mencegah *Out-Of-Memory* (OOM) killer mematikan proses PostgreSQL saat lonjakan trafik atau kompilasi:
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### C. Pengamanan Firewall (UFW)
Hanya buka port SSH, HTTP, dan HTTPS. Port PostgreSQL 5432 sengaja tidak dibuka ke publik:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Let's Encrypt / ACME)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## 2. Setup Repositori & Environment

### A. Clone Repositori
```bash
git clone git@github.com:<username>/unlazynotes.git /opt/unlazynotes
cd /opt/unlazynotes
```

### B. Salin & Isi Berkas `.env`
Salin template produksi yang telah disediakan:
```bash
cp .env.production.example .env
nano .env
```

Pastikan mengisi parameter-parameter krusial berikut:
1. `BETTER_AUTH_SECRET`: Buat token acak 32 karakter via `openssl rand -hex 32`.
2. `BETTER_AUTH_URL`: Domain resmi produksi, misal `https://unlazynotes.com`.
3. `POSTGRES_PASSWORD`: Kata sandi database yang kuat.
4. `DATABASE_URL`: `postgres://postgres:<PASSWORD_DI_ATAS>@postgres:5432/unlazynotes`
5. `TELEGRAM_BOT_TOKEN`: Token bot Telegram resmi dari `@BotFather`.
6. `TELEGRAM_WEBHOOK_SECRET`: Token acak untuk memvalidasi request Telegram.
7. `AI_PROVIDER_API_KEY`: API Key model AI Cosmoshub (`sk-cos-...`).
8. `DOKU_CLIENT_ID` & `DOKU_SHARED_KEY`: Kredensial production merchant dari portal DOKU.

---

## 3. Menjalankan Layanan Docker Compose

Eksekusi orkestrasi Docker multi-container:
```bash
# 1. Jalankan container database PostgreSQL terlebih dahulu
sudo docker compose up -d postgres

# 2. Tunggu healthcheck database siap (STATUS: healthy)
sudo docker compose ps

# 3. Jalankan migrasi skema tabel ke database
sudo docker compose run --rm app npx drizzle-kit push

# 4. Bangun dan jalankan seluruh layanan (app + database)
sudo docker compose up --build -d
```

Verifikasi bahwa kedua container berjalan sehat:
```bash
sudo docker compose ps
```
Hasil yang diharapkan:
- `unlazynotes-db`: `Up (healthy)`
- `unlazynotes-app`: `Up (healthy)` di port `127.0.0.1:4321`

---

## 4. Konfigurasi Nginx & Sertifikat SSL Gratis (Certbot)

### A. Pasang Nginx & Certbot
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### B. Pasang Konfigurasi Reverse Proxy
Salin file konfigurasi yang sudah disiapkan:
```bash
sudo cp docker/nginx/unlazynotes.conf /etc/nginx/sites-available/unlazynotes.com
sudo ln -s /etc/nginx/sites-available/unlazynotes.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### C. Terbitkan Sertifikat SSL Otomatis
```bash
sudo certbot --nginx -d unlazynotes.com -d www.unlazynotes.com --non-interactive --agree-tos -m admin@unlazynotes.com
```

---

## 5. Mendaftarkan Webhook Telegram Produksi

Setelah domain HTTPS aktif, daftarkan URL webhook ke Telegram Bot API:

```bash
curl -F "url=https://unlazynotes.com/api/telegram/webhook" \
     -F "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
     https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
```

Untuk memverifikasi status pendaftaran webhook:
```bash
curl https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo
```
Pastikan respons `ok: true`, `"has_custom_certificate": false`, dan `"pending_update_count": 0`.

---

## 6. Otomatisasi Backup Database Harian

Skrip backup otomatis telah tersedia di [`scripts/backup-db.sh`](file:///home/rikushiro/projects/unlazynotes/scripts/backup-db.sh).
Daftarkan ke cron job sistem agar berjalan otomatis setiap hari pukul 02:00 pagi:

```bash
sudo chmod +x /opt/unlazynotes/scripts/backup-db.sh
(sudo crontab -l 2>/dev/null; echo "0 2 * * * /opt/unlazynotes/scripts/backup-db.sh >> /var/log/unlazynotes-backup.log 2>&1") | sudo crontab -
```

Untuk menguji backup secara manual kapan saja:
```bash
sudo /opt/unlazynotes/scripts/backup-db.sh
```
File backup terkompresi `.sql.gz` akan tersimpan di `$HOME/backups/unlazynotes/` dan otomatis dihapus jika sudah berumur lebih dari 7 hari.

---

## 7. Pemeliharaan & Monitoring (Cheat Sheet)

```bash
# Cek penggunaan RAM dan CPU container
sudo docker stats --no-stream

# Cek log aplikasi secara live
sudo docker compose logs -f app

# Restart aplikasi setelah update kode
git pull origin main
sudo docker compose up --build -d app
```
