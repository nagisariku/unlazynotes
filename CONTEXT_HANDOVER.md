# UnlazyNotes – Context Handover & Engineering State 🚀

Dokumen ini berfungsi sebagai memori persisten lintas sesi (*session handover*) agar pengembangan dapat langsung dilanjutkan tanpa kehilangan konteks teknis maupun *roadmap*.

---

## 1. Status Lingkungan & Layanan Saat Ini (Sandbox VPS)

- **Repositori Git**: `/home/rikushiro/projects/unlazynotes`
- **Branch**: `main` (Bersih, sinkron dengan `origin/main` commit `d3f136b`)
- **Layanan Aktif (Systemd)**:
  - `unlazynotes.service`: Server Astro 5 SSR (Port `4321` / `localhost:4321`)
  - `unlazynotes-bot.service`: Polling daemon Telegram `@unlazynotes_bot` (Long Polling)
- **Database**: PostgreSQL 16 lokal port `5432` (`unlazynotes_dev`) via Drizzle ORM
- **AI Gateway**: Cosmoshub API (`deepseek-v4.1-flash`)
- **Payment & Auth**: DOKU Hosted Checkout Simulator & Better Auth (Google OAuth & Dev Session)

---

## 2. Arsitektur AI & Tagging Engine yang Telah Selesai

Sistem telah dirombak dari classifier monolitik menjadi **4-Layer Modular Architecture**:

1. **Deterministic Intent Router (`src/lib/ai/router.ts`)**:
   - Memotong latensi & biaya token dengan mengklasifikasikan catatan tanpa memanggil LLM jika pola sudah jelas.
   - Prioritas *Action Intent* (todo/study) sebelum URL.
   - Penjagaan *False-Positive* nominal angka (kodepos/tahun/nomor HP tidak salah masuk ke finance).
2. **Specialized Domain Modules (`src/lib/ai/modules/`)**:
   - `finance.ts`: Pengeluaran/pemasukan dengan tag kanonikal (`expenses`, `income`, `bill`, `food`, `transport`, `laundry`, `hangout`). Anti-guessing: jika konteks tidak spesifik, fallback aman ke `['expenses']`.
   - `bookmark.ts`: Platform tags (`github`, `youtube`, `twitter`, `instagram`, `tiktok`) dan *Domain-Aware Recognition* (`dev` untuk dev.to/gitlab, `design` untuk figma/dribbble, `fintech` untuk payermax/stripe, `news`, `ai`, `career`).
   - `todo.ts`: Kluster aksi (`study`, `exam`, `work`, `dev`, `health`).
   - `credential.ts`: Kluster keamanan (`wifi`, `server`, `account`, `database`, `api`, `bank`).
   - `general.ts`: LLM fallback untuk catatan unrouted (`schedule`, `draft`, `reference`, `random-yap`) dengan *Strict Single-Word Prompt*.
3. **Bilingual Canonical Taxonomy (`src/lib/ai/taxonomy/`)**:
   - Kamus terstandarisasi dwibahasa (ID & EN) dengan indeks in-memory $O(1)$ alias mapping (misal: `seblak`, `ciken`, `lunch` $\rightarrow$ `food`).
4. **Strict Single-Word Sanitizer (`src/lib/ai/sanitizer.ts`)**:
   - Pemecah CamelCase (`foodExpense` $\rightarrow$ `food`).
   - Pemangkas kata majemuk & suffix (`-price`, `-spending`).
   - Pemblokiran angka nominal (`15k`, `60k`, `100k`, `$25`).
   - Pemblokiran tag sampah (`read-later`, `money`, `task`).
5. **Bot Feedback UX (`src/lib/telegram.ts`)**:
   - Konfirmasi bot kini menyertakan cuplikan teks catatan: `Saved "<snippet>" • tags: ...`.
6. **Validasi Test Suite**:
   - `npm run test:tagging`: 28 skenario pengujian komprehensif (100% PASS).

---

## 3. Roadmap Fitur Berikutnya (The 5 Pillars Blueprint)

Rencana pengembangan lanjutan yang telah disepakati:

### Fase 1: Core AI & Entity Extraction
- **Pilar 1 (URL OpenGraph / Metadata Scraper)**:
  - Background fetcher 15 KB pertama untuk membaca `<title>` dan `<meta description>` URL umum non-sosmed agar tagging bookmark otomatis kontekstual.
- **Pilar 4 (Structured Entity Extractor)**:
  - Menambahkan kolom `metadata: jsonb('metadata')` pada tabel `notes`.
  - Ekstraksi nominal angka & currency (`kopi 12k bensin 20k` $\rightarrow$ `amount: 32000 IDR`).
  - Ekstraksi waktu jadwal (`besok jam 14.00` $\rightarrow$ ISO 8601 UTC timestamp).

### Fase 2: Telegram UX & Personalisasi
- **Pilar 3 (Interactive Telegram Feedback Loop)**:
  - Inline keyboard buttons pada notifikasi simpan: `[ ➕ Tambah Tag ]`, `[ ✏️ Ubah Kategori ]`, `[ ❌ Hapus Tag ]`.
- **Pilar 2 (User Tag Memory)**:
  - Mengingat frekuensi tag yang sering dipakai user dari database dan memprioritaskannya dibanding sinonim baru.

### Fase 3: Web Dashboard Enhancements
- **Pilar 5 (Tag Manager & 1-Click Merge Tool)**:
  - Halaman manajemen tag di web dashboard untuk audit tag dan menggabungkan tag secara massal (misal merge `makan` ke `food`).
- **Peningkatan UI/UX**:
  - Peningkatan styling timeline, visual card, dan mobile responsiveness.

---

## 4. Konteks Migrasi ke VPS Production (Singapore)

- Server Tencent saat ini adalah **Sandbox / Dev VPS**.
- Semua credential real (Google OAuth Production & Akun DOKU Merchant Production) akan diintegrasikan saat persiapan pindah ke VPS Singapore.
- Prosedur migrasi:
  1. `git clone` dari GitHub `origin main`.
  2. Restore database dump (`pg_dump` $\rightarrow$ `psql`).
  3. Konfigurasi file `.env.production` (koneksi DB, bot token, API keys, DOKU production).
  4. Jalankan via Docker Compose atau Systemd + Nginx SSL Reverse Proxy sesuai panduan di [`DEPLOYMENT.md`](file:///home/rikushiro/projects/unlazynotes/DEPLOYMENT.md).
