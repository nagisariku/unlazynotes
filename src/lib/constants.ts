export const CATEGORIES = [
  'random-yap',
  'draft',
  'bookmark',
  'todo',
  'schedule',
  'finance',
  'credential',
  'reference',
  'others',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const VALID_SOURCES = [
  'youtube',
  'instagram',
  'twitter',
  'tiktok',
  'github',
  'article',
] as const;

export type Source = (typeof VALID_SOURCES)[number];

export const SECURITY_DISCLAIMER =
  '🔒 *Keamanan & Private Vault:*\nUntuk data rahasia/kredensial, selalu gunakan perintah `/secure <kunci> <isi>` agar dienkripsi AES-256-GCM secara terisolasi dari AI.';

export const HELP_MESSAGE = `🤖 *UnlazyNotes Bot* – Tangkap ide kilat langsung dari chat!

*Daftar Perintah:*
• \`/start\` atau \`/help\` - Tampilkan bantuan ini
• \`/login <api_key>\` - Tautkan akun Telegram secara manual
• \`/logout\` - Putus tautan akun Telegram ini
• \`/tags\` - Tampilkan seluruh tag aktif Anda
• \`/tags <nama_tag>\` - Cari catatan berdasarkan tag tertentu
• \`/search <kata_kunci>\` - Cari catatan umum berdasarkan kata kunci
• \`/ask <pertanyaan>\` - [Paket Pro] Tanya jawab pintar AI berbasis catatan Anda (<6 bulan)
• \`/secure <kunci> <isi>\` - Simpan rahasia terenkripsi AES-256-GCM ke Private Vault (Bypass AI)
• \`/vault [kunci]\` - Buka rahasia atau lihat daftar kunci Private Vault Anda

*Cara Penggunaan:*
Kirimkan pesan teks atau tautan apa saja secara langsung ke bot ini. AI kami akan otomatis mengkategorikan dan memberi label catatan Anda dalam sekejap!

${SECURITY_DISCLAIMER}`;

export const STANDARD_DAILY_QUOTA = 25;
