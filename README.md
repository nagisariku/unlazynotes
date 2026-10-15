# UnlazyNotes ⚡

> **Chat-First, AI-Powered Brain Dump & Note-Taking SaaS.**
> Tangkap ide, tugas, jadwal, pengeluaran, bookmark, dan kredensial secepat kilat langsung dari chat Telegram, dikategorikan dan diberi label otomatis oleh AI dalam hitungan detik.

[![Astro 5](https://img.shields.io/badge/Astro-5.4-BC52EE?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.38-C5F74F?style=flat-square&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![grammY](https://img.shields.io/badge/grammY-Telegram_Bot-2CA5E0?style=flat-square&logo=telegram&logoColor=white)](https://grammy.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)

---

## 📖 Daftar Isi
- [Fitur Utama](#-fitur-utama)
- [Arsitektur & Tech Stack](#-arsitektur--tech-stack)
- [Struktur Direktori](#-struktur-direktori)
- [Panduan Instalasi & Pengembangan Lokal](#-panduan-instalasi--pengembangan-lokal)
- [Integrasi Telegram Bot Dual-Engine](#-integrasi-telegram-bot-dual-engine)
- [Integrasi AI & Auto-Tagging](#-integrasi-ai--auto-tagging)
- [Sistem Monetisasi & Payment Gateway (DOKU)](#-sistem-monetisasi--payment-gateway-doku)
- [Pengujian Otomatis (Automated Tests)](#-pengujian-otomatis-automated-tests)
- [Panduan Deployment Produksi (Docker & Nginx)](#-panduan-deployment-produksi-docker--nginx)
- [Dokumentasi Lengkap](#-dokumentasi-lengkap)

---

## 🚀 Fitur Utama

1. **Ultra-Fast Telegram Capture (<500ms):**
   * Kirim teks, URL, to-do list, atau pemikiran acak langsung ke bot Telegram.
   * HTTP 200 OK kembali secara instan (<25ms di sandbox), sementara pemrosesan AI berjalan secara *non-blocking* di latar belakang.
   * **Silent Note Capture UX**: Menghindari spam balasan di chat; catatan tersimpan hening di background. Notifikasi hanya muncul untuk error, limit kuota, atau perintah eksplisit.
   * **Unsupported Media Guard**: Otomatis mendeteksi kiriman foto/dokumen/video/voice dan memberikan respons informatif yang ramah.
2. **Kategorisasi Otomatis 9 Kategori Wajib:**
   * `random-yap` (Ide spontan, pemikiran acak, uneg-uneg)
   * `draft` (Tulisan panjang, draf artikel, ringkasan meeting)
   * `bookmark` (Tautan URL, artikel, video)
   * `todo` (Daftar tugas, rencana aksi, checklist)
   * `schedule` (Agenda, jadwal rapat, janji temu bertanggal/jam)
   * `finance` (Pengeluaran, pemasukan, tagihan, transaksi belanja)
   * `credential` (Kata sandi WiFi, PIN, catatan akun non-kritis)
   * `reference` (Kutipan, fakta, dokumentasi, snippet)
   * `others` (Catatan umum lainnya)
3. **Multi-Link Recognition & Bilingual Taxonomy:**
   * Ekstraksi platform dan taksonomi domain dwibahasa (ID & EN) tanpa memecah kesatuan catatan (*data integrity first*).
   * Menghindari tag generik redundan (`money`, `task`, `read-later`, `multi`).
4. **Flexible & Fuzzy Search (PostgreSQL `pg_trgm`):**
   * Pencarian cerdas berbasis Trigram Similarity dan pembersih tanda baca/spasi.
   * Menemukan catatan meski ada perbedaan tanda hubung (misal `almuhajirin` menemukan `Al-Muhajirin`) atau sedikit saltik (*typo tolerance*).
5. **AI Pro Q&A (`/ask`):**
   * Pengguna paket Pro dapat bertanya kepada AI tentang catatan mereka dalam 6 bulan terakhir langsung dari chat Telegram (misal: *"/ask Kapan meeting sprint berikutnya?"* atau *"/ask Berapa total pengeluaran kopi minggu ini?"*).
6. **Modern Web Dashboard:**
   * Dibangun dengan Astro 5 Server-Side Rendering (SSR) dan React 19.
   * Filter kategori instan, pencarian berbasis teks (full-text search), dan filter tag interaktif.
   * Modal dialog untuk membaca dan menyalin catatan panjang dengan nyaman.
   * Halaman Bookmark Khusus dengan dukungan **Ekspor Netscape Bookmark HTML** (siap diimpor ke Google Chrome, Mozilla Firefox, Brave, Safari).
7. **SaaS Monetization & Kuota Harian:**
   * Paket **Standard**: Batas kuota 25 catatan/hari.
   * Paket **Pro**: Catatan tanpa batas (Unlimited) + Akses eksklusif AI Pro `/ask`.
   * Integrasi gateway pembayaran DOKU Hosted Checkout (QRIS, Virtual Account, Kartu Kredit) dengan verifikasi signature HMAC-SHA256 yang aman dan idempotent.
8. **Admin Metrics Console (`/admin`):**
   * Dashboard metrik SaaS khusus role admin: MRR, ARR, Total Pendapatan, Distribusi Paket, dan Metrik Aktivitas Catatan.

---

## ⚡ Kapasitas & Skalabilitas Sistem (1.000 – 10.000 Users)

Arsitektur UnlazyNotes didesain sangat hemat sumber daya (*resource-efficient*):
* **Beban Peak 10.000 User**: Diestimasikan ~1.000–2.000 DAU menghasilkan ~3–8 write/detik (QPS) pada jam sibuk, jauh di bawah kapasitas PostgreSQL & Node.js (>500 QPS).
* **Deterministic Router**: Memangkas 70–80% panggilan LLM eksternal. Hanya ~20% catatan unrouted yang memanggil API Cosmoshub.
* **GIN Trigram Index**: Pencarian fuzzy terindeks dan terisolasi per `user_id` (<10ms waktu respon).
* **RAM & Storage**: Node.js (~250 MB), PostgreSQL (~300 MB), storage database ~1–2 GB per 1 juta catatan. Siap scale-up dengan mudah ke VPS produksi.

---

## 🛠️ Arsitektur & Tech Stack

```
+-------------------------------------------------------------------------+
|                              UnlazyNotes                                |
+-------------------------------------------------------------------------+
|                                                                         |
|   +-----------------------+              +--------------------------+   |
|   |    Telegram Client    |              |   Web Browser / Client   |   |
|   +-----------+-----------+              +------------+-------------+   |
|               |                                       |                 |
|               v                                       v                 |
|   +-----------------------+              +--------------------------+   |
|   |  Long Polling Worker  |              |   Astro 5 SSR Server     |   |
|   |   (Sandbox / Dev)     |              |   (Port 4321)            |   |
|   +-----------+-----------+              +------------+-------------+   |
|               |                                       |                 |
|               |    +-----------------------------+    |                 |
|               +--->|  src/lib/telegram-handler   |<---+                 |
|                    +--------------+--------------+                      |
|                                   |                                     |
|               +-------------------+-------------------+                 |
|               v                                       v                 |
|   +-----------------------+              +--------------------------+   |
|   |   PostgreSQL 16 DB    |              |   Cosmoshub AI Gateway   |   |
|   |   (via Drizzle ORM)   |              |  (DeepSeek-v4.1-flash)   |   |
|   +-----------------------+              +--------------------------+   |
|                                                                         |
+-------------------------------------------------------------------------+
```

* **Frontend & Backend Framework:** [Astro 5](https://astro.build) (Hybrid SSR Mode with `@astrojs/node`).
* **UI Components & Styling:** [React 19](https://react.dev), [Tailwind CSS v4](https://tailwindcss.com), [Lucide React](https://lucide.dev).
* **Database & ORM:** [PostgreSQL 16](https://www.postgresql.org/), [Drizzle ORM](https://orm.drizzle.team/), [drizzle-kit](https://orm.drizzle.team/kit-docs/overview).
* **Autentikasi:** [Better Auth](https://www.better-auth.com/) dengan Google OAuth & Drizzle Adapter.
* **Telegram Bot Framework:** [grammY](https://grammy.dev/).
* **AI Engine:** [Vercel AI SDK](https://sdk.vercel.ai/) (`generateObject`) terhubung ke OpenAI-compatible gateway (Cosmoshub / DeepSeek).
* **Payment Gateway:** [DOKU Hosted Checkout](https://doku.com) dengan HMAC-SHA256 signature verification.
* **Containerization:** Docker Multi-stage build (Alpine Linux ~316MB) & Docker Compose.

---

## 📁 Struktur Direktori

```
unlazynotes/
├── .env.example              # Template variabel environment lengkap
├── .env.production.example   # Template environment khusus deployment produksi
├── DEPLOYMENT.md             # Runbook & SOP deployment produksi lengkap
├── USER_MANUAL.md            # Panduan pengguna lengkap (Bot & Web Dashboard)
├── Dockerfile                # Multi-stage production container build
├── docker-compose.yml        # Orchestration PostgreSQL, Web App, & Nginx
├── drizzle.config.ts         # Konfigurasi Drizzle ORM Kit
├── package.json              # Definisi scripts & dependensi
├── docker/
│   └── nginx/
│       └── unlazynotes.conf  # Reverse proxy template dengan SSL & rate-limiting
├── scripts/
│   ├── backup-db.sh          # Skrip backup database PostgreSQL otomatis
│   ├── bot-polling.ts        # Long polling worker untuk development/sandbox
│   ├── seed.ts               # Database fixture seeder
│   ├── test-ai-gateway.ts    # Benchmark latency model AI
│   ├── test-live-ai.ts       # Verifikasi live output model AI
│   ├── test-phase2.ts        # Automated integration test suite Fase 2
│   ├── test-phase3.ts        # Automated integration test suite Fase 3
│   └── test-webhook.ts       # Automated integration test suite Fase 1
└── src/
    ├── db/
    │   ├── index.ts          # Inisialisasi koneksi PostgreSQL Pool
    │   └── schema.ts         # Definisi schema database Drizzle
    ├── lib/
    │   ├── ai.ts             # Orchestrator kategorisasi AI & backward compatibility
    │   ├── ai/               # Modular Categorization & Tagging Engine
    │   │   ├── router.ts     # Fast deterministic intent router
    │   │   ├── sanitizer.ts  # Strict single-word normalizer & anti-bloat filters
    │   │   ├── types.ts      # Schema Zod & TypeScript types
    │   │   ├── modules/      # Modul khusus (finance, bookmark, todo, credential, general)
    │   │   └── taxonomy/     # Kamus taksonomi kanonikal dwibahasa (ID & EN)
    │   ├── ask.ts            # Logika AI Pro Q&A berbasis catatan user
    │   ├── auth.ts           # Konfigurasi Better Auth & Google OAuth
    │   ├── constants.ts      # Definisi enum, kuota, dan teks pesan
    │   ├── doku.ts           # Inisiasi checkout & verifikasi signature DOKU
    │   ├── telegram.ts       # Inisialisasi Bot grammY & helper API Key
    │   └── telegram-handler.ts # Shared core message processor (Webhook & Polling)
    ├── layouts/
    │   └── Layout.astro      # Master layout HTML dengan Tailwind CSS v4
    └── pages/
        ├── index.astro       # Landing page responsif & tabel harga
        ├── login.astro       # Halaman autentikasi Google OAuth & mock login
        ├── admin.astro       # Console metrik SaaS administrator
        ├── dashboard/
        │   ├── index.astro   # Dashboard catatan utama
        │   ├── bookmarks.astro # Dashboard bookmark & ekspor HTML
        │   └── settings.astro# Pengaturan akun, API Key, & upgrade Pro
        └── api/
            ├── auth/         # Better Auth route handlers
            ├── bookmarks/    # Endpoint ekspor Netscape HTML
            ├── checkout/     # Endpoint inisiasi pembayaran DOKU
            ├── notes/        # REST API catatan (list, delete)
            ├── payment/      # Webhook callback notifikasi pembayaran DOKU
            └── telegram/
                └── webhook.ts# Endpoint Webhook resmi Telegram
```

---

## 💻 Panduan Instalasi & Pengembangan Lokal

### 1. Prasyarat Sistem
* [Node.js](https://nodejs.org/) versi 22.x LTS atau lebih baru.
* [PostgreSQL](https://www.postgresql.org/) versi 15 atau 16.
* Akun Telegram dan Bot Token dari [@BotFather](https://t.me/botfather).

### 2. Kloning & Instalasi Dependensi
```bash
git clone https://github.com/nagisariku/unlazynotes.git
cd unlazynotes
npm install
```

### 3. Konfigurasi Environment
Salin template konfigurasi:
```bash
cp .env.example .env
```
Sesuaikan nilai di dalam file `.env`:
* `DATABASE_URL`: URL koneksi PostgreSQL lokal (misal: `postgres://postgres:password@localhost:5432/unlazynotes_dev`).
* `TELEGRAM_BOT_TOKEN`: Token bot Telegram dari @BotFather.
* `AI_PROVIDER_API_KEY`: API Key penyedia AI (OpenAI / Cosmoshub / Groq).

### 4. Setup Database
Jalankan migrasi schema menggunakan Drizzle Kit:
```bash
npm run db:push
```

### 5. Menjalankan Aplikasi
* **Menjalankan Web Server (Astro):**
  ```bash
  npm run dev
  # Aplikasi dapat diakses di http://localhost:4321
  ```
* **Menjalankan Telegram Bot Worker (Long Polling di Sandbox/Dev):**
  Buka tab terminal baru:
  ```bash
  npm run bot:poll
  ```

---

## 🤖 Integrasi Telegram Bot Dual-Engine

UnlazyNotes dirancang dengan fleksibilitas tinggi menggunakan arsitektur **Dual-Engine**:

1. **Development & Sandbox (Direct VPS Long Polling):**
   * Menjalankan `npm run bot:poll` (skrip [`scripts/bot-polling.ts`](file:///home/rikushiro/projects/unlazynotes/scripts/bot-polling.ts)).
   * Terhubung secara *outbound* langsung ke server Telegram.
   * **Kelebihan:** Tidak memerlukan domain publik, tidak memerlukan SSL, tidak memerlukan tunneling (Cloudflare/SSH), dan bebas disconnect.
2. **Production High-Concurrency (Telegram Webhook):**
   * Endpoint [`/api/telegram/webhook`](file:///home/rikushiro/projects/unlazynotes/src/pages/api/telegram/webhook.ts).
   * Menerima payload update langsung dari Telegram melalui Reverse Proxy Nginx ber-SSL.
   * Dilengkapi verifikasi header keamanan `X-Telegram-Bot-Api-Secret-Token`.

Keduanya berbagi business logic yang 100% identik melalui modul [`src/lib/telegram-handler.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/telegram-handler.ts).

---

## 🧠 Arsitektur AI & Modular Auto-Tagging Engine

UnlazyNotes mengimplementasikan sistem kategorisasi dan *tagging* bertingkat (multi-layered modular architecture) untuk menjamin akurasi tinggi, kecepatan kilat, zero-hallucination pada catatan informal, serta kepatuhan ketat terhadap aturan **Strict Single-Word & Anti-Bloat**:

```
+--------------------------------------------------------------------------+
|                       Catatan Masuk (Text / Link)                        |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
|  Layer 1: Deterministic Intent Router (src/lib/ai/router.ts)             |
|  - Deteksi format harga/rupiah (15k, 20rb, 1.5jt, $25, traktir, bayar)    |
|  - Deteksi Action/Todo Intent (harus, kerjakan, tugas, belajar...ujian)  |
|  - Deteksi URL / Link Bookmark murni                                     |
|  - Deteksi Kredensial (wifi, server ssh, token api, pin bank)            |
+--------------------------------------------------------------------------+
                                     |
             +-----------------------+-----------------------+
             |                                               |
  (High Confidence Match)                            (Unrouted / Complex)
             v                                               v
+-----------------------------------------+   +----------------------------+
|  Layer 2: Specialized Domain Handlers   |   |  General AI Module (LLM)   |
|  - finance.ts    (Pengeluaran/Pemasukan)|   |  (src/lib/ai/modules/      |
|  - bookmark.ts   (Domain-Aware Platforms|   |   general.ts)              |
|                   github, dev, design)  |   |  Vercel AI SDK             |
|  - todo.ts       (Study, Exam, Work)    |   |  deepseek-v4.1-flash       |
|  - credential.ts (Wifi, Server, API)    |   |  Strict Single-Word Prompt |
+-----------------------------------------+   +----------------------------+
             |                                               |
             +-----------------------+-----------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
|  Layer 3: Bilingual Canonical Taxonomy (src/lib/ai/taxonomy/)            |
|  - Kamus terstandarisasi ID & EN (expenses, food, transport, study, exam)|
|  - Pencocokan alias O(1) in-memory (seblak/ciken/burger -> food)         |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
|  Layer 4: Strict Single-Word Sanitizer (src/lib/ai/sanitizer.ts)         |
|  - Normalisasi CamelCase & pemangkasan kata majemuk berpenghubung        |
|  - Pemblokiran angka nominal & harga (15k, 60k, 100k, $10)               |
|  - Pemblokiran tag sampah redundan (read-later, money, task, spending)   |
+--------------------------------------------------------------------------+
                                     |
                                     v
                    [ Database PostgreSQL (notes) ]
```

* **Model Default:** `deepseek-v4.1-flash` via Cosmoshub AI Gateway (atau model OpenAI-compatible lainnya seperti `gpt-4o-mini`).
* **Heuristic & Offline Fallback:** Jika koneksi API AI mengalami gangguan, router deterministik dan taksonomi offline memastikan catatan tetap terkategorisasi 100% tanpa pernah gagal simpan.

---

## 💳 Sistem Monetisasi & Payment Gateway (DOKU)

* **Tiering Akun:**
  * **Standard:** Gratis / Starter, kuota harian 25 catatan/hari.
  * **Pro:** Rp 49.000 / bulan ($4.99 USD), catatan tanpa batas (unlimited) + fitur AI Pro `/ask`.
* **Proses Pembayaran:**
  1. Pengguna memilih paket di `/dashboard/settings`.
  2. Aplikasi memanggil API DOKU Hosted Checkout via `POST /api/checkout`.
  3. Pengguna dialihkan ke halaman pembayaran aman DOKU (mendukung QRIS, GoPay, OVO, ShopeePay, Virtual Account BCA/Mandiri/BRI/BNI, dan Kartu Kredit).
  4. Server DOKU mengirimkan notifikasi ke `POST /api/payment/doku-webhook`.
  5. Webhook memverifikasi tanda tangan `Signature: HMAC-SHA256` dengan `Client-Id`, `Request-Id`, dan `Request-Timestamp`.
  6. Akun pengguna otomatis di-upgrade ke Pro secara real-time dan bersifat *idempotent*.

---

## 🧪 Pengujian Otomatis (Automated Tests)

UnlazyNotes dilengkapi dengan rangkaian *integration test suite* komprehensif tanpa dependensi mocking eksternal:

```bash
# 1. Test Suite Modular Tagging Engine & Bilingual Taxonomy (28 Skenario)
npm run test:tagging

# 2. Test Suite Fase 1: Core Bot, Webhook Header Security, Instant Capture & Auto-tagging (10 Tests)
npm run test:webhook

# 3. Test Suite Fase 2: User Session, Auto-provisioning, Dashboard SSR, Bookmark Export (9 Tests)
npm run test:phase2

# 4. Test Suite Fase 3: DOKU Signature Verification, Daily Quota, AI Pro /ask, Admin Access (14 Tests)
npm run test:phase3
```

---

## 🚢 Panduan Deployment Produksi (Docker & Nginx)

Untuk panduan lengkap langkah-demi-langkah deployment ke VPS Ubuntu produksi menggunakan Docker Compose, konfigurasi Nginx Reverse Proxy, pembuatan sertifikat Let's Encrypt SSL, hingga cron job backup otomatis, silakan baca dokumentasi:
👉 **[DEPLOYMENT.md](DEPLOYMENT.md)**

---

## 📚 Dokumentasi Lengkap
* **[USER_MANUAL.md](USER_MANUAL.md)**: Panduan Pengguna Lengkap (perintah bot Telegram, navigasi dashboard web, format catatan, dan panduan admin).
* **[DEPLOYMENT.md](DEPLOYMENT.md)**: Production Runbook & DevOps Deployment Guide.

---

## 📄 Lisensi
Hak Cipta © 2026 UnlazyNotes. Dilisensikan di bawah [MIT License](LICENSE).
