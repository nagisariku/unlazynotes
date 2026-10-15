# Panduan Pengguna Lengkap (User Manual) – UnlazyNotes 📘

Selamat datang di **UnlazyNotes**! Panduan ini dirancang untuk membantu Anda memaksimalkan seluruh fitur UnlazyNotes, baik melalui bot Telegram maupun Web Dashboard.

---

## 📑 Daftar Isi
1. [Langkah Awal: Menghubungkan Akun Telegram](#1-langkah-awal-menghubungkan-akun-telegram)
2. [Panduan Bot Telegram](#2-panduan-bot-telegram)
   - [Cara Mencatat Cepat (Quick Capture)](#cara-mencatat-cepat-quick-capture)
   - [Daftar Perintah (Commands) Bot](#daftar-perintah-commands-bot)
   - [Fitur Eksklusif Pro: AI Q&A (`/ask`)](#fitur-eksklusif-pro-ai-qa-ask)
3. [Panduan Web Dashboard](#3-panduan-web-dashboard)
   - [Navigasi & Tampilan Catatan](#navigasi--tampilan-catatan)
   - [Filter Kategori & Pencarian Real-Time](#filter-kategori--pencarian-real-time)
   - [Membaca & Menyalin Catatan Panjang](#membaca--menyalin-catatan-panjang)
   - [Menghapus Catatan](#menghapus-catatan)
4. [Manajemen Bookmark & Ekspor Browser](#4-manajemen-bookmark--ekspor-browser)
   - [Melihat Bookmark Tersimpan](#melihat-bookmark-tersimpan)
   - [Ekspor Netscape HTML Bookmark](#ekspor-netscape-html-bookmark)
5. [Pengaturan Akun & Langganan (Settings)](#5-pengaturan-akun--langganan-settings)
   - [Manajemen API Key](#manajemen-api-key)
   - [Monitoring Kuota Harian](#monitoring-kuota-harian)
   - [Upgrade ke Paket Pro via DOKU](#upgrade-ke-paket-pro-via-doku)
6. [Panduan Administrator (Admin Console)](#6-panduan-administrator-admin-console)
7. [Tanya Jawab & Troubleshooting (FAQ)](#7-tanya-jawab--troubleshooting-faq)

---

## 1. Langkah Awal: Menghubungkan Akun Telegram

Agar catatan yang Anda kirimkan ke Telegram tersimpan di akun Anda, Anda perlu menghubungkan bot Telegram sekali saja di awal:

1. Buka Web Dashboard UnlazyNotes di browser Anda (misal: `http://localhost:4321` atau domain resmi Anda).
2. Masuk menggunakan akun Anda via Google OAuth (atau akun dev).
3. Buka menu **Settings** (`/dashboard/settings`).
4. Pada bagian **Telegram API Key**, klik tombol **Copy Key** (format key: `unz_xxxxxxxxxxxxxxxx`).
5. Buka aplikasi Telegram, lalu cari bot resmi Anda (misal: `@unlazynotes_bot`).
6. Kirimkan perintah berikut ke bot:
   ```text
   /login unz_xxxxxxxxxxxxxxxx
   ```
7. Bot akan membalas dengan pesan konfirmasi: `✅ Akun Berhasil Terhubung!`. Sekarang bot siap digunakan kapan saja!

---

## 2. Panduan Bot Telegram

### Cara Mencatat Cepat (Quick Capture)
Cukup ketik atau *forward* pesan apa saja langsung ke chat bot. AI kami akan otomatis mendeteksi jenis catatan, mengelompokkannya ke kategori yang tepat, serta memberikan label (tag) spesifik dalam hitungan detik.

#### Contoh-Contoh Catatan & Hasil Kategorisasi Otomatis:
* **Ide Spontan (random-yap):**
  > *ide bikin bot telegram otomatis kirim rekap mingguan*
  * Bot membalas: `Saved "ide bikin bot telegram…" • tags: random-yap, idea, bot`
* **Daftar Tugas & Pembelajaran (todo):**
  > *belajar rekursif, ujian minggu depan*
  * Bot membalas: `Saved "belajar rekursif, ujian…" • tags: todo, study, exam`
* **Jadwal & Agenda (schedule):**
  > *meeting sprint planning tim backend besok jam 14.00*
  * Bot membalas: `Saved "meeting sprint planning…" • tags: schedule, meeting, planning`
* **Keuangan & Belanja (finance):**
  > *seblak prasmanan 20k* atau *coffee $5 uber $25*
  * Bot membalas: `Saved "seblak prasmanan 20k" • tags: finance, expenses, food`
* **Tautan / Web Bookmark (bookmark):**
  > *https://github.com/dietrichgebert/ponytail* atau *https://www.payermax.com/*
  * Bot otomatis mengekstrak platform/domain bersih: `Saved "https://github.com/…" • tags: bookmark, github` atau `Saved "https://www.payermax.com/" • tags: bookmark, fintech` *(Bebas dari slug URL acak dan tag sampah 'read-later')*.
* **Kredensial Non-Kritis (credential):**
  > *password wifi kantor: KopiSenja2026!*
  * Bot membalas: `Saved "password wifi kantor…" • tags: credential, wifi`. *(Catatan Keamanan: Jangan gunakan untuk menyimpan password perbankan atau kredensial kritis!)*
* **Draf & Tulisan Panjang (draft):**
  > Kirimkan catatan diskusi meeting atau draf tulisan di atas 200 karakter.
  * Bot menyimpannya sebagai kategori `draft` dengan tag `writing`.

---

### Daftar Perintah (Commands) Bot

| Perintah | Deskripsi |
| :--- | :--- |
| `/start` atau `/help` | Menampilkan panduan bantuan bot, disclaimer keamanan, dan daftar perintah. |
| `/login <api_key>` | Menghubungkan akun Telegram dengan akun web UnlazyNotes Anda. |
| `/logout` | Memutuskan tautan akun Telegram saat ini dari UnlazyNotes. |
| `/tags` | Menampilkan daftar seluruh kategori dan tag aktif yang pernah Anda gunakan. |
| `/tags <nama_tag>` | Mencari dan menampilkan 10 catatan terakhir yang memiliki tag tersebut. |
| `/tags draft` | Khusus tag draft, bot akan menampilkan ringkasan jumlah draf dan tautan langsung untuk membaca di web dashboard. |
| `/search <kata_kunci>` | Mencari catatan berdasarkan kata kunci teks (menampilkan hingga 5 hasil terbaru). |
| `/ask <pertanyaan>` | **[Eksklusif Pro]** Mengajukan pertanyaan cerdas ke AI mengenai catatan pribadi Anda. |

---

### Fitur Eksklusif Pro: AI Q&A (`/ask`)

Jika Anda berlangganan **Paket Pro**, Anda memiliki asisten AI pribadi yang memahami seluruh catatan Anda selama 6 bulan terakhir.

#### Contoh Penggunaan `/ask`:
* `/ask Kapan jadwal meeting saya dengan klien minggu ini?`
  > 🤖 **Jawaban AI:** Berdasarkan catatan Anda pada 12 Oktober, Anda memiliki jadwal *meeting evaluasi sprint bersama tim engineering* pada hari Kamis pukul 14:00.
* `/ask Berapa total pengeluaran kopi saya baru-baru ini?`
  > 🤖 **Jawaban AI:** Ditemukan catatan pengeluaran kopi: *beli kopi kenangan 25rb sama rina*.
* `/ask Apa password wifi di kantor lt 2?`
  > 🤖 **Jawaban AI:** Password WiFi kantor lt 2 yang tersimpan adalah *senjasore123* dengan SSID *KopiSenja*.

---

## 3. Panduan Web Dashboard

Web Dashboard dapat diakses melalui browser di desktop maupun smartphone Anda di `/dashboard`.

### Navigasi & Tampilan Catatan
* **Koleksi Catatan (Feed):** Setiap catatan ditampilkan dalam bentuk kartu modern yang dilengkapi informasi waktu pencatatan, badge kategori berwarna, tag spesifik, serta indikator sumber (jika berupa bookmark tautan).
* **Sidebar / Menu Navigasi:**
  * **All Notes:** Menampilkan seluruh catatan Anda secara kronologis.
  * **Bookmarks:** Tampilan khusus tautan web tersimpan lengkap dengan tombol ekspor.
  * **Settings:** Konfigurasi akun, API Key Telegram, dan opsi paket langganan.
  * **Admin Console:** Khusus administrator untuk memantau metrik bisnis SaaS.

### Filter Kategori & Pencarian Real-Time
1. **Category Tabs:** Klik tab kategori di bagian atas (`All`, `Random Yap`, `Draft`, `Bookmark`, `Todo`, `Schedule`, `Finance`, `Credential`, `Reference`, `Others`) untuk memfilter catatan secara instan.
2. **Search Bar:** Ketik kata kunci pada kotak pencarian untuk menyaring catatan secara real-time.
3. **Filter Tag:** Klik salah satu badge tag pada kartu catatan untuk langsung menampilkan semua catatan dengan tag serupa.

### Membaca & Menyalin Catatan Panjang
Untuk catatan berformat panjang (seperti `draft` atau ringkasan rapat):
* Klik kartu catatan untuk membuka **Modal Tampilan Penuh**.
* Klik tombol **Copy Text** untuk menyalin seluruh isi catatan ke clipboard.

### Menghapus Catatan
* Pada kartu catatan, klik ikon **Trash (Hapus)** di pojok kanan bawah kartu.
* Konfirmasi penghapusan, dan catatan akan langsung dihapus permanen dari database.

---

## 4. Manajemen Bookmark & Ekspor Browser

Halaman khusus Bookmarks dapat diakses di `/dashboard/bookmarks`.

### Melihat Bookmark Tersimpan
Seluruh tautan yang Anda kirimkan ke bot Telegram akan secara otomatis diekstrak judul, URL, serta platform asalnya (YouTube, Instagram, Twitter/X, GitHub, TikTok, atau Artikel Web umum).

### Ekspor Netscape HTML Bookmark
UnlazyNotes mendukung standar industri **Netscape-Bookmark-file-1**:
1. Buka menu **Bookmarks** di dashboard.
2. Klik tombol **Export Bookmarks (HTML)** di sudut kanan atas.
3. Browser akan mengunduh file `unlazynotes-bookmarks.html`.
4. **Cara Impor ke Browser Anda:**
   * **Google Chrome / Brave:** Buka menu `Settings` -> `Bookmarks` -> `Import bookmarks and settings` -> Pilih file HTML yang diunduh.
   * **Mozilla Firefox:** Tekan `Ctrl + Shift + O` (Library) -> `Import and Backup` -> `Import Bookmarks from HTML`.
   * **Safari:** Buka menu `File` -> `Import From` -> `Bookmarks HTML File`.

---

## 5. Pengaturan Akun & Langganan (Settings)

Halaman Settings dapat diakses di `/dashboard/settings`.

### Manajemen API Key
* **Menyalin Key:** Gunakan tombol **Copy** untuk menyalin API Key yang akan digunakan pada perintah `/login` di Telegram.
* **Regenerasi Key (Ganti Kunci):** Jika Anda merasa kunci bocor atau ingin memutus semua sesi Telegram aktif, klik **Regenerate Key**. Kunci lama akan langsung tidak berlaku dan sesi Telegram otomatis terputus demi keamanan.

### Monitoring Kuota Harian
* Pada pengguna paket **Standard**, sistem menyediakan indikator kuota catatan harian:
  * Batas: **25 catatan per hari**.
  * Penghitung (counter) kuota otomatis ter-reset setiap tengah malam (00:00).
* Pada pengguna paket **Pro**, indikator akan menampilkan status **Unlimited** (tanpa batasan harian).

### Upgrade ke Paket Pro via DOKU
Untuk meningkatkan akun Anda ke paket Pro:
1. Masuk ke halaman **Settings**.
2. Pada kartu **Paket Pro**, klik tombol **Upgrade Sekarang**.
3. Anda akan diarahkan ke halaman pembayaran resmi **DOKU Hosted Checkout**.
4. Pilih metode pembayaran yang diinginkan:
   * **QRIS:** Pindai kode QR menggunakan GoPay, OVO, Dana, ShopeePay, BCA Mobile, atau aplikasi m-Banking apa pun.
   * **Virtual Account:** BCA, Mandiri, BRI, BNI, Permata, dll.
   * **Kartu Kredit / Debit Online.**
5. Setelah pembayaran berhasil, akun Anda akan otomatis dan instan ter-upgrade ke **Paket Pro**.

---

## 6. Panduan Administrator (Admin Console)

> **Catatan:** Halaman ini hanya dapat diakses oleh akun dengan peran (role) `admin` di `/admin`.

Fitur pada Admin Console mencakup:
* **Metrik Finansial:**
  * **MRR (Monthly Recurring Revenue):** Pendapatan berulang bulanan dari pelanggan Pro aktif.
  * **ARR (Annual Run Rate):** Proyeksi pendapatan tahunan.
  * **Total Revenue:** Akumulasi total transaksi yang berhasil diproses.
* **Distribusi Pengguna:**
  * Perbandingan jumlah pengguna paket Standard vs Pro.
  * Rasio konversi gratis ke berbayar (Conversion Rate %).
* **Statistik Aktivitas Catatan:**
  * Total catatan yang tersimpan di seluruh platform.
  * Distribusi catatan per kategori (misal: persentase Todo, Finance, Bookmark).
* **Tabel Log Pembayaran Real-Time:**
  * Menampilkan ID Pesanan, Nama User, Metode Pembayaran, Jumlah Nominal, Waktu Transaksi, dan Status (`SUCCESS` / `PENDING`).

---

## 7. Tanya Jawab & Troubleshooting (FAQ)

### Q: Mengapa bot Telegram membalas "Akun belum terhubung"?
**A:** Anda belum menautkan akun Telegram dengan akun web UnlazyNotes. Silakan salin API Key Anda dari halaman `/dashboard/settings`, lalu kirim `/login <api_key>` ke bot Telegram.

### Q: Mengapa bot Telegram membalas "Kuota harian Anda telah tercapai"?
**A:** Akun Anda berada pada paket Standard dengan batas kuota 25 catatan per hari. Anda dapat menunggu hingga kuota ter-reset besok pukul 00:00 atau melakukan upgrade ke paket Pro di `/dashboard/settings`.

### Q: Apakah bot tetap merespons saat saya mengirim teks di luar negeri atau offline?
**A:** Bot Telegram terhubung ke server cloud 24/7. Anda hanya membutuhkan koneksi internet pada aplikasi Telegram Anda. Catatan yang terkirim akan langsung diolah dan dapat dilihat di web dashboard dari perangkat mana saja.

### Q: Bagaimana jika saya salah mengkategorikan catatan?
**A:** Anda dapat membuka web dashboard, melihat catatan tersebut, dan menyalin atau menghapusnya jika sudah tidak dibutuhkan. Kami juga terus memperbarui kemampuan AI untuk memastikan tingkat akurasi di atas 95%.

---
*UnlazyNotes – Dump your thoughts, let AI do the organizing.*
