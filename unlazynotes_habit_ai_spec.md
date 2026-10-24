# UnlazyNotes: Spesifikasi Inteligensi Semantik 9 Pilar (Arketipe Intent & Spektrum Riil)

**Tanggal Dokumen:** 24 Oktober 2026 (Updated: Unified Intent & Real-World Spectrum Edition)  
**Status:** Dokumen Arsitektur & Pedoman Klasifikasi AI Engine  
**Filosofi Inti:** Fondasi Hukum Intent Fundamental (The "Why") + Ilustrasi Spektrum Kasus Riil (Non-Exhaustive Examples) = AI Bernalar Bebas & Berpresisi Tinggi.

---

## 1. Prinsip Fundamental Arsitektur (Aksioma Wajib)

1. **Dual-Layer Intelligence (Hukum Fundamental + Contoh Spektrum):**
   - AI Engine (Deepseek V1.4 Flash) bekerja paling optimal jika memahami **Hakikat Intensi Mendasar (Aksioma)** sebagai payung utama, sekaligus dibekali **Contoh Spektrum Nyata** sebagai ilustrasi bagaimana kebiasaan manusia mengekspresikan intensi tersebut di Saved Messages.
   - Contoh spektrum di dokumen ini bersifat *illustrative / non-exhaustive* (sebagai pemantik pemahaman AI, bukan daftar tertutup yang membatasi).
2. **Pure Note Philosophy (Tanpa Overengineering UI):**
   - Catatan tetaplah catatan biasa (*pure notes*). Tidak perlu tombol aksi instan khusus atau checklist yang mempersempit antarmuka.
   - Kategori `credential` diperlakukan seperti catatan teks biasa yang bisa dibaca langsung (fitur enkripsi khusus berada di Private Vault `/secure`).
3. **Zero-Hardcoding & Anti-Regex Mandate:**
   - DILARANG KERAS mengandalkan tumpukan regex kata kunci statis (`if-else` pencocokan kata).
   - Format penulisan manusia sangat bebas: tanpa format, tanpa bullet, bahasa gaul, singkatan, campuran ID/EN. Ekstraksi dan klasifikasi dipercayakan **100% pada penalaran semantik kontekstual LLM**.
4. **9 Kategori Pilar Adalah Invariant Sakral:**
   - Kategori wajib strictly 9: `bookmark`, `schedule`, `finance`, `credential`, `todo`, `draft`, `reference`, `random-yap`, `others`.
   - Tidak boleh memecah atau menambah kategori baru. Variasi domain ditangani melalui **Tag Semantik Terbuka (Open Semantic Tags)**.
5. **Hukum Batas Ambivalensi (Disambiguation Heuristics):**
   - Jika satu catatan memuat multi-aspek:
     - Tautan adalah subjek utama $\rightarrow$ `bookmark`.
     - Transaksi nilai uang adalah subjek utama $\rightarrow$ `finance`.
     - Ada kehendak aksi/tindakan nyata $\rightarrow$ `todo`.
     - Terikat titik waktu pelaksanaan $\rightarrow$ `schedule`.

---

## 2. Matriks 9 Pilar: Intent Fundamental & Spektrum Kasus Nyata

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MATRIKS 9 PILAR INTELIGENSI SEMANTIK                                             │
├───────────────┬──────────────────────────────────┬───────────────────────────────────────┬───────────────────────┤
│ Pilar         │ Intent Fundamental (The "Why")   │ Spektrum Kasus Nyata (Ilustratif)     │ Target Ekstraksi AI   │
├───────────────┼──────────────────────────────────┼───────────────────────────────────────┼───────────────────────┤
│ 1. Bookmark   │ Menyimpan pointer / tautan digital│ Web, Maps/Lokasi, Wishlist E-commerce,│ URL, Source, Topik,   │
│               │ untuk diakses/dibuka di lain waktu│ Cloud Docs (Drive/Figma), Deep-Links  │ Contextual Tags       │
├───────────────┼──────────────────────────────────┼───────────────────────────────────────┼───────────────────────┤
│ 2. Schedule   │ Melekatkan catatan pada dimensi  │ Jam Pasti, Hari Relatif, Rentang Hari,│ schedule: metadata    │
│               │ waktu di kalender hidup pengguna │ Tiket/Perjalanan, Rutinitas Berulang  │ (dates, rule)         │
├───────────────┼──────────────────────────────────┼───────────────────────────────────────┼───────────────────────┤
│ 3. Finance    │ Menangani nilai ekonomi, aliran  │ Pengeluaran, Pemasukan, Utang/Piutang,│ expenses/income/debt  │
│               │ uang, aset, hak & kewajiban      │ Split Bill, Estimasi Budget, Aset     │ (JSONB terstruktur)   │
├───────────────┼──────────────────────────────────┼───────────────────────────────────────┼───────────────────────┤
│ 4. Credential │ Menyimpan kunci akses otentikasi │ Akun login, Kata sandi (Wi-Fi, dsb.), │ Pure Note (Teks polos │
│               │ atau nomor identitas resmi       │ NIK/KK/NPWP, No Rekening, Kode Serial │ tanpa masking)        │
├───────────────┼──────────────────────────────────┼───────────────────────────────────────┼───────────────────────┤
│ 5. Todo       │ Menampung kehendak untuk bertindak│ Tugas kerja, Belanjaan (Groceries),   │ Open Semantic Tags    │
│               │ atau menyelesaikan suatu urusan  │ Follow-up orang, Packing list barang  │ (Task Context)        │
├───────────────┼──────────────────────────────────┼───────────────────────────────────────┼───────────────────────┤
│ 6. Draft      │ Merumuskan bahan tulisan/pesan   │ Draf chat izin/negosiasi, Caption     │ Open Semantic Tags    │
│               │ yang ditujukan ke pihak luar     │ medsos, Email penawaran, Notulensi    │ (Target / Purpose)    │
├───────────────┼──────────────────────────────────┼───────────────────────────────────────┼───────────────────────┤
│ 7. Reference  │ Mengarsipkan fakta obyektif /    │ Ukuran fisik, Alamat kirim, Resep,    │ Open Semantic Tags    │
│               │ data statis untuk rujukan nanti  │ Snippet kode/config, No resi/polis    │ (Static Knowledge)    │
├───────────────┼──────────────────────────────────┼───────────────────────────────────────┼───────────────────────┤
│ 8. Random-Yap │ Mengekspresikan dunia internal   │ Curhat perasaan, Opini/review bebas   │ Open Semantic Tags    │
│               │ (emosi, pikiran, tubuh, refleksi)│ (film/buku/kafe), Log gejala fisik    │ (Mood / Health / Log) │
├───────────────┼──────────────────────────────────┼───────────────────────────────────────┼───────────────────────┤
│ 9. Others     │ Menampung fragmen multi-ide atau │ Forward obrolan panjang, Kode OTP,    │ Open Semantic Tags    │
│               │ pesan campur aduk tanpa error    │ Teks ambigu tanpa fokus tunggal       │ (Safe Fallback)       │
└───────────────┴──────────────────────────────────┴───────────────────────────────────────┴───────────────────────┘
```

---

## 3. Rincian Mendalam 9 Pilar: Intent, Batasan & Ragam Spektrum

---

### Pilar 1: BOOKMARK (Pointer Eksternal & Tautan Digital)
* **Intent Fundamental:** *"Aku mau menyimpan pointer atau alamat ini agar bisa dibuka/ditelusuri kembali di aplikasi/peramban nanti."*
* **Hakikat Konten:** Subjek inti catatan adalah sebuah atau kumpulan URL / Deep Link. Narasi di sekeliling tautan berfungsi sebagai konteks.
* **Ragam Spektrum Kasus Nyata (Non-Exhaustive):**
  - **Tautan Lokasi & Tempat:** Google Maps, Apple Maps (*"maps.app.goo.gl/... cafe tenang buat kerja daerah jaksel"*).
  - **Tautan Wishlist & Belanja Impian:** Link produk Tokopedia, Shopee, Amazon, AliExpress tanpa teks atau dengan keterangan barang incaran (*"sepatu running incaran gajian"*).
  - **Tautan Dokumen Cloud & Kolaborasi:** Google Drive, Google Docs, Figma board, Notion page, Canva (*"draft roadmap figma.com/file/..."*).
  - **Tautan Sosmed, Media & Edukasi:** Video tutorial YouTube, postingan X/Twitter, thread edukasi, konten Reels/TikTok inspiratif.
  - **Tautan Portfolio & Referensi Teknis:** Dribbble, Behance, repositori GitHub/GitLab, artikel blog teknis.
  - **Tautan Deep-Link & Aplikasi:** Link Spotify track/playlist, room Google Meet/Zoom berkala, tautan episode podcast.
  - **Multi-URL Sekaligus:** 1 catatan memuat 2–5 link referensi untuk riset yang sama.
* **Perilaku AI:**
  - AI mengenali URL apa pun dan mengekstrak platform primer (`source`: `maps`, `drive`, `figma`, `youtube`, `github`, `spotify`, `marketplace`, dll.).
  - AI mengekstrak topik utama dari teks pengantar dan URL path menjadi tag terbuka bernilai guna tinggi.

---

### Pilar 2: SCHEDULE (Dimensi Waktu / Time-Anchor)
* **Intent Fundamental:** *"Hal ini terikat pada titik waktu, rentang hari, atau pola perulangan tertentu di kalender hidupku."*
* **Hakikat Konten:** Memiliki ikatan temporal yang mengaitkannya dengan kalender.
* **Ragam Spektrum Kasus Nyata (Non-Exhaustive):**
  - **Waktu Pasti Spesifik:** Jam dan tanggal kalender (*"Meeting evaluasi tgl 12 jam 14.00"*).
  - **Hari Relatif Tanpa Jam:** *"Gym sabtu, konsul dokter gigi senin"*. AI menggunakan jangkar `note_created_at` untuk memetakan tanggal ke depan.
  - **Rentang Waktu (Date Range):** *"Cuti tahunan 10 - 15 November"*, *"Sakit tifus bedrest 3 hari ke depan"*.
  - **Jadwal Penerbangan & Tiket:** *"Flight GA-421 jumat berangkat jam 08.20 gate 4"*, *"Kereta Taksaka minggu jam 21.00 gerbong 3"*.
  - **Batas Waktu Dokumen / Kadaluwarsa (*Expiration Dates*):** *"SIM motor habis masa berlaku 14 November 2026"*, *"Masa aktif kartu perdana sampai 30 Okt"*.
  - **Jadwal Ibadah / Kultural:** *"Jumatan jam 11.45"*, *"Kajian rutin ba'da isya"*.
  - **Pola Jadwal Berulang (*Recurring Schedule / Habitual*):**
    - Mingguan: *"Badminton tiap selasa malam"*.
    - Interval hari: *"Ganti air filter aquarium tiap 3 hari sekali"*, *"Cuci sepatu tiap 2 minggu"*.
    - Bulanan: *"Gajian tiap tanggal 25"*, *"Bayar tagihan kost tiap awal bulan"*, *"Bayar tagihan listrik tgl 10"*.
    - Hari kerja: *"Daily standup tiap senin-jumat jam 9 pagi"*.
* **Struktur Data Fleksibel (`schedule` JSONB):**
  ```typescript
  type ScheduleMetadata = {
    dates: string[]; // Tanggal konkret ISO (misal: ["2026-10-24", "2026-10-26"])
    isRecurring: boolean; // Flag apakah ini aktivitas rutin/berulang
    recurrenceRule?: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'custom_interval';
      intervalDays?: number; // misal: 2 untuk "tiap 2 hari sekali"
      daysOfWeek?: number[]; // [1, 2, 3, 4, 5] untuk Senin-Jumat (0 = Minggu)
      dayOfMonth?: number; // misal: 25 untuk "tiap tanggal 25"
      timeString?: string; // misal: "19:00" jika ada jamnya
    };
  };
  ```

---

### Pilar 3: FINANCE (Nilai Ekonomi & Arus Keuangan)
* **Intent Fundamental:** *"Ini urusan aliran uang keluar/masuk, klaim hak tagih atau kewajiban bayar, maupun kepemilikan aset bernilai ekonomi."*
* **Hakikat Konten:** Memuat nominal uang riil, komitmen keuangan, atau pencatatan aset.
* **Ragam Spektrum Kasus Nyata (Non-Exhaustive):**
  - **Pengeluaran Langsung (*Expenses*):** Transaksi belanja, makan, bensin, token listrik, bayar parkir, minimarket, langganan software.
  - **Pemasukan (*Income*):** Gaji, fee freelance, dividen reksadana, transfer masuk keluarga.
  - **Utang / Pinjaman (*Debt - Payable*):** Kita meminjam uang dari orang lain (*"Pinjem uang Rian 200rb buat servis motor"*).
  - **Piutang / Talangan (*Debt - Receivable*):** Kita menalangi orang lain (*"Talangin makan siang Rendy 45k nanti diganti"*, *"Bayarin tiket bioskop Tika 50k"*).
  - **Split Bill / Patungan:** *"Futsal semalam total 180k patungan bertiga @60k"*.
  - **Rencana / Estimasi Anggaran (Non-Transaksi):** *"Budget liburan akhir tahun max 3jt"*, *"Target tabungan beli laptop 15jt"*.
  - **Log Aset / Investasi:** *"Beli emas Antam 1 gram 1.450.000"*, *"Beli koin SOL 0.5 di harga $150"*.
* **Perilaku AI:**
  - AI memisahkan secara semantik apakah catatan ini belanja aktual, pemasukan, utang/talangan, atau rencana budget, lalu mengisi field terstruktur `expenses`, `income`, dan `debt`.

---

### Pilar 4: CREDENTIAL (Otentikasi & Identitas Pengenal)
* **Intent Fundamental:** *"Ini adalah kunci akses otentikasi, kata sandi, atau nomor identitas resmi pengenalku."*
* **Hakikat Konten:** Kunci rahasia, kredensial login, atau nomor dokumen identitas publik.
* **Ragam Spektrum Kasus Nyata (Non-Exhaustive):**
  - **Akun & Sandi Bebas:** Format bebas user-password untuk portal kerja, staging server, akun game, atau akun cadangan.
  - **Kredensial Jaringan / Wi-Fi:** Nama SSID dan kata sandi Wi-Fi kantor, kosan, cafe, atau router rumah.
  - **Nomor Identitas Publik/Keluarga:** NIK KTP diri & keluarga, nomor KK, nomor NPWP, nomor BPJS, nomor paspor.
  - **Nomor Rekening & Virtual Account:** Data rekening bank untuk dikirimkan ke orang lain (*"BCA 827192837 a/n Rikushiro"*).
  - **Kode Akses & Serial:** Serial number lisensi software, kode voucher kuota internet, PIN gembok koper/pintu digital.
* **Perilaku Sistem:**
  - Ditampilkan sebagai **catatan biasa tanpa masking paksa**, agar mudah dibaca dan di-copy instan. (Untuk catatan rahasia tingkat tinggi dienkripsi khusus via brankas Private Vault `/secure`).

---

### Pilar 5: TODO (Kehendak Aksi / Actionable Task)
* **Intent Fundamental:** *"Ini hal nyata yang harus kukerjakan, kuselesaikan, atau kudapatkan di dunia nyata."*
* **Hakikat Konten:** Memuat dorongan kehendak untuk bertindak (*intent to do/execute*).
* **Ragam Spektrum Kasus Nyata (Non-Exhaustive):**
  - **Instruksi Kerja & Follow-up:** *"Chat mas Eko tanya kelanjutan kontrak"*, *"Kirim invoice ke klien Budi"*.
  - **Daftar Belanjaan / Logistik (*Groceries / Errands*):** *"Beli: telur 1kg, kopi tubruk, odol, deterjen bubuk"*.
  - **Daftar Barang Bawaan (*Packing List*):** *"Barang bawaan mudik: charger laptop, obat tetes mata, jaket, powerbank"*.
  - **Daftar Keinginan Aksi (*Wish-Action*):** *"Nonton film Interstellar kalau senggang"*, *"Coba resep mie nyemek di rumah"*.
* **Perilaku AI:**
  - Menangkap kehendak untuk bertindak dan mengekstrak konteks tugas tanpa bergantung pada format checklist kaku.

---

### Pilar 6: DRAFT (Materi Komunikasi / Outgoing Content)
* **Intent Fundamental:** *"Ini bahan pesan, tulisan, atau konten yang sedang kususun untuk dikirimkan/disampaikan ke pihak luar."*
* **Hakikat Konten:** Teks yang ditujukan untuk audiens eksternal.
* **Ragam Spektrum Kasus Nyata (Non-Exhaustive):**
  - **Draf Pesan Formal / Negosiasi:** Konsep chat negosiasi harga, draf izin sakit/cuti ke atasan, draf pesan klarifikasi salah paham.
  - **Draf Konten & Tulisan:** Caption media sosial, draf email lamaran pekerjaan, poin-poin ide artikel newsletter.
  - **Respon Komplain / Template CS:** Draf kalimat jawaban sopan untuk menjawab keluhan pelanggan toko online.
  - **Catatan Notulensi Rapat Mentah:** Poin-poin mentah hasil mendengarkan meeting yang sedang dirangkum sebelum dibagikan ke tim.
* **Perilaku AI:**
  - Mengenali bahwa teks adalah rancangan konten yang disiapkan untuk dikirim atau dipublikasikan.

---

### Pilar 7: REFERENCE (Fakta Statis / Lookup Knowledge)
* **Intent Fundamental:** *"Ini fakta obyektif, spesifikasi statis, atau dokumentasi pedoman yang kuarsip untuk dicek lagi sewaktu-waktu."*
* **Hakikat Konten:** Informasi objektif/permanen yang disimpan untuk rujukan berulang.
* **Ragam Spektrum Kasus Nyata (Non-Exhaustive):**
  - **Data Personal & Ukuran:** Ukuran kemeja L slim fit, nomor sepatu 42, lingkar pinggang 32, resep minus kacamata kiri/kanan.
  - **Alamat & Petunjuk Pengiriman:** Alamat lengkap rumah/kantor beserta nomor telepon darurat dan patokan gang.
  - **Nomor Resi / Pelacakan Paket:** *"JNE JP9283719283 paket keyboard"* (data statis untuk pelacakan).
  - **Nomor Polis Asuransi / Rekam Medis:** *"Polis Prudential no 09182319 a.n Riku"*, *"Golongan darah O rhesus positif"*.
  - **Riwayat Servis & Odometer Kendaraan:** *"Servis ganti oli motor km 12.500 bengkel AHASS"*.
  - **Spesifikasi Teknis / Barang:** Model tipe motor, nomor plat kendaraan (*"B 1234 XYZ"*), kode warna cat kamar (*"#F4F4F4"*), tipe baterai jam tangan (*CR2032*).
  - **Resep Masakan & Dosis:** *"Resep sambal bawang: cabai rawit 15, bawang 5, terasi"* atau *"Dosis amoxicillin 3x1 sesudah makan"*.
  - **Snippets & Konfigurasi Kode:** Perintah terminal bash Docker, script Nginx, rumus Excel/Spreadsheet.
* **Perilaku AI:**
  - Memahami bahwa teks adalah data statis/pedoman yang disimpan untuk dibaca ulang di kemudian hari.

---

### Pilar 8: RANDOM-YAP (Refleksi Subjektif / Expressive Dump)
* **Intent Fundamental:** *"Ini isi kepalaku, perasaanku, refleksiku, atau pengalaman tubuhku murni tanpa beban aksi dan tanpa audiens luar."*
* **Hakikat Konten:** Ekspresi dunia internal yang bersifat subjektif, introspektif, emosional, atau fisik.
* **Ragam Spektrum Kasus Nyata (Non-Exhaustive):**
  - **Log Gejala Kesehatan & Tubuh:** *"Asam lambung agak perih siang ini gara-gara ngopi sebelum makan"*, *"Pinggang pegal kebanyakan duduk di depan laptop"*.
  - **Log Mood & Refleksi Personal:** *"Lagi ngerasa burnout banget sama rutinitas koding"*, *"Seneng banget hari ini kerjaan kelar tepat waktu"*.
  - **Catatan Mimpi Pagi Hari:** Cerita mimpi aneh yang baru saja dialami saat bangun tidur biar tidak lupa.
  - **Evaluasi & Review Subjektif Terhadap Apapun:** Review jujur film, buku bacaan, musik, makanan/resto, game (*"Tadi nyobain resto X di mall baru kuahnya keasinan, rating 6/10"*).
  - **Ide Liar Sekilas (*Shower Thoughts*):** Pemikiran filosofis acak, celetukan lucu, atau ide produk yang belum jelas bentuknya.
* **Perilaku AI:**
  - Menangkap nuansa introspektif, emosional, atau fisik pengguna tanpa memaksakannya menjadi tugas atau draf.

---

### Pilar 9: OTHERS (Penampung Netral / Unstructured)
* **Intent Fundamental:** *"Catatan campur aduk atau fragmen acak yang belum memiliki fokus tunggal."*
* **Hakikat Konten:** Penampung aman (*fail-safe*) agar sistem tidak memaksakan kategori yang salah dan tidak pernah error.
* **Ragam Spektrum Kasus Nyata (Non-Exhaustive):**
  - Teks forward-an panjang dari grup obrolan (WhatsApp/Telegram) yang berisi pengumuman campur aduk.
  - Kode OTP / token verifikasi acak yang dikirim cepat ke Saved Messages.
  - Catatan satu-dua kata yang sangat ambigu yang tidak bisa dipastikan maksudnya.
* **Perilaku AI:**
  - Menjadi penampung netral yang aman, mengekstrak kata kunci umum, dan tidak pernah memicu error pada sistem.

---

## 4. Disiplin Tagging Terbuka (Zero-Constraint Dynamic Reasoning)

* **Prinsip Bebas Domain Sempit:**
  - AI tidak dibatasi pada daftar industri, brand, atau topik tertentu.
  - AI mengekstrak konsep terpenting dari apa pun yang dibicarakan pengguna di dunia nyata (otomotif, perkebunan, gaming, akademik, birokrasi pemerintahan, pet, sains, seni, keluarga, kesehatan).
* **Format Konsisten:**
  - Huruf kecil (*lowercase*), spasi diganti strip (`-`), tidak mengandung simbol aneh.
  - Maksimal 2–4 tag bernilai tinggi per catatan agar tidak terjadi penumpukan tag (*anti-tag bloat*).

---

## 5. Skema Database Terpadu (Drizzle Schema)

Berikut ekstensi skema database pada tabel `notes` (`src/db/schema.ts`) yang fleksibel dan mengakomodasi seluruh spektrum di atas:

```typescript
// Ekstensi fleksibel pada tabel 'notes'
schedule: jsonb('schedule').$type<{
  dates: string[]; // ISO YYYY-MM-DD
  isRecurring: boolean;
  recurrenceRule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom_interval';
    intervalDays?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    timeString?: string;
  };
}>().default({ dates: [], isRecurring: false }).notNull(),

expenses: jsonb('expenses').$type<Array<{
  item: string;
  amount: number;
  currency: string;
}>>().default([]).notNull(),

income: jsonb('income').$type<Array<{
  source: string;
  amount: number;
  currency: string;
}>>().default([]).notNull(),

debt: jsonb('debt').$type<Array<{
  type: 'payable' | 'receivable';
  person: string;
  amount: number;
  notes?: string;
}>>().default([]).notNull(),
```
