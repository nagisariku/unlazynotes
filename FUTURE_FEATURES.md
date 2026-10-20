# UnlazyNotes – Ide & Backlog Fitur Mendatang (Future Features) 💡

Dokumen ini berfungsi sebagai repositori ide fitur, arsitektur eksperimental, dan *backlog roadmap* UnlazyNotes yang telah dianalisis namun statusnya ditahan (*on hold*) untuk diimplementasikan pada waktu yang tepat.

---

## 1. Multi-Bubble & Long-Note Continuation Buffer (Double Comma `,,`)

- **Status**: 🟡 *HELD / BACKLOG* (Konsep & analisis selesai, siap diimplementasikan saat dibutuhkan)
- **Komponen Terdampak**: `src/lib/telegram-handler.ts` (Debounce & Message Processing)
- **Tanggal Diusulkan**: 20 Oktober 2026

### A. Latar Belakang & Masalah
1. **Multi-Bubble Fragmented Notes**:
   - Pengguna sering kali memiliki kebiasaan menulis satu catatan dalam beberapa balon chat (*multiple bubbles*) berurutan.
   - Mekanisme debounce saat ini (`DEBOUNCE_DELAY_MS = 3000` / 3 detik) hanya mengantisipasi jeda pengetikan instan. Jika pengguna menjeda pengetikan >3 detik (misal: berpikir, menyusun kalimat berikutnya, atau meng-copy bagian lanjutan), buffer terlanjur di-flush dan catatan terpecah menjadi beberapa ID catatan terpisah.
2. **Limitasi Pesan Telegram (4.096 Karakter)**:
   - Salinan draft dokumen panjang, transkrip meeting, atau spesifikasi teknis sering kali terpotong menjadi beberapa pesan terpisah karena limitasi native Telegram.

---

### B. Solusi: Sistem Penanda Double Koma (`,,`)
Pengguna cukup menambahkan tanda baca double koma `,,` di ujung paling akhir pesan teks untuk memberi sinyal ke bot bahwa tulisan belum selesai dan akan dilanjutkan pada balon chat berikutnya.

#### Diagram Alur Kerja:
```
[Pesan Masuk] 
      │
      ▼
Teks berakhiran ',,'? ───(YA)───► Potong ',,' di akhir ──► Simpan ke Staging Buffer
      │                                                        │
    (TIDAK)                                                    ▼
      │                                             Tahan Auto-Flush (Tunggu Lanjutan)
      ▼                                                        │
Ada draft di Staging Buffer? ──(YA)──► Gabungkan Buffer + Teks Baru (Newline '\n')
      │                                                        │
    (TIDAK)                                                    ▼
      ▼                                             Bersihkan Staging Buffer
Alur Normal (Simpan / Debounce Biasa)                          │
                                                               ▼
                                                    Simpan ke DB & Trigger AI
```

---

### C. Spesifikasi Teknis & Logika Implementasi

1. **Deteksi Penanda**:
   - Cek teks setelah membersihkan spasi/baris di ujung:
     ```typescript
     const isContinued = text.trimEnd().endsWith(',,');
     ```
2. **Sanitasi Konten**:
   - Potong karakter `,,` agar catatan yang disimpan ke database tetap bersih:
     ```typescript
     const cleanContent = text.trimEnd().slice(0, -2).trimEnd();
     ```
3. **Pemisah Penggabungan (*Delimiter*)**:
   - Gunakan pemisah baris baru (`\n` atau `\n\n`) saat menggabungkan antar-bubble agar tata letak paragraf/list pengguna tetap rapi.
4. **Safety Timeout / Expiration (TTL)**:
   - Pasang batas waktu aman (misal **10 – 15 menit**).
   - Jika pengguna mengirim bubble berakhiran `,,` lalu lupa/meninggalkan Telegram, timer safety akan otomatis meng-flush dan menyimpan isi buffer ke database sebagai catatan mandiri (menjamin *Zero Data Loss*).
5. **Interupsi Menu & Command**:
   - Jika pengguna mengirim command pembatalan (`/cancel`, `/batal`): Hapus staging buffer.
   - Jika pengguna menekan tombol dock (`📖 Read`, `🔄 Sync`, `🏷 Tags`) atau mengirim command lain: Auto-flush buffer ke database terlebih dahulu sebelum menjalankan aksi menu.
6. **Opsi UX Feedback**:
   - **Opsi A (Murni Silent)**: Bot tetap hening tanpa respons teks sesuai filosofi *Silent Capture*.
   - **Opsi B (Emoji Reaction)**: Bot memberikan reaksi hening di bubble bersangkutan (`✍️` atau `⏳` via `setMessageReaction`) tanpa membuat bubble chat baru.

---

## 2. Arsip Backlog Lainnya (To be added)
*(Bagian ini dapat digunakan untuk mencatat ide-ide fitur lainnya sebelum masuk tahap implementasi).*
