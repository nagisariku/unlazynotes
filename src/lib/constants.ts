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
  '⚠️ *Catatan Keamanan:*\nUnlazyNotes adalah alat tangkap ide cepat, bukan zero-knowledge encrypted vault. Hindari menyimpan kredensial yang sangat kritis.';

export const HELP_MESSAGE = `🤖 *UnlazyNotes Bot* – Tangkap ide kilat langsung dari chat!

*Daftar Perintah:*
• \`/start\` atau \`/help\` - Tampilkan bantuan ini & disclaimer keamanan
• \`/login <api_key>\` - Tautkan akun Telegram dengan akun UnlazyNotes Anda
• \`/logout\` - Putus tautan akun Telegram ini
• \`/tags\` - Tampilkan seluruh tag aktif Anda
• \`/tags <nama_tag>\` - Cari catatan berdasarkan tag tertentu
• \`/search <kata_kunci>\` - Cari catatan berdasarkan kata kunci

*Cara Penggunaan:*
Kirimkan pesan teks atau tautan apa saja secara langsung ke bot ini. AI kami akan otomatis mengkategorikan dan memberi label catatan Anda dalam sekejap!

${SECURITY_DISCLAIMER}`;

export const STANDARD_DAILY_QUOTA = 25;
