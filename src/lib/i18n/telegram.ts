export type SupportedLocale = 'id' | 'en';

export type TelegramMessageKey =
  | 'help'
  | 'security_disclaimer'
  | 'welcome_connected'
  | 'welcome_connected_brief'
  | 'security_tip'
  | 'unauthenticated'
  | 'inactive_sub'
  | 'login_missing_key'
  | 'login_invalid_key'
  | 'logout_success'
  | 'unsupported_media'
  | 'quota_warning_footer'
  | 'quota_exceeded'
  | 'upgrade_button_pro'
  | 'pro_gated'
  | 'pro_gated_button'
  | 'tags_empty'
  | 'tags_header'
  | 'tags_cluster_detail'
  | 'tags_cluster_empty'
  | 'tags_filter_missing'
  | 'tags_draft_redirect'
  | 'tags_none_found'
  | 'tags_snippet_header'
  | 'quota_status_pro'
  | 'quota_status_free'
  | 'search_missing_keyword'
  | 'search_empty'
  | 'search_header'
  | 'snippet_page_info'
  | 'default_note_title'
  | 'ask_missing_question'
  | 'ask_analyzing'
  | 'ask_answer_header'
  | 'secure_missing_params'
  | 'secure_saved'
  | 'vault_empty'
  | 'vault_list'
  | 'vault_not_found'
  | 'vault_revealed'
  | 'vault_decryption_failed'
  | 'vault_revealed_multiple_header'
  | 'callback_unauthenticated';

export const TELEGRAM_MESSAGES: Record<TelegramMessageKey, Record<SupportedLocale, string>> = {
  security_disclaimer: {
    id: `🔒 *Keamanan & Private Vault:*\nUntuk data rahasia/kredensial, selalu gunakan perintah \`/secure <kunci> <isi>\` agar dienkripsi AES-256-GCM secara terisolasi dari AI.`,
    en: `🔒 *Security & Private Vault:*\nFor confidential data or credentials, always use \`/secure <key> <content>\` to encrypt with AES-256-GCM completely isolated from AI.`,
  },

  help: {
    id: `🤖 *UnlazyNotes Bot* – Tangkap ide kilat langsung dari chat!

*Daftar Perintah:*
• \`/start\` atau \`/help\` - Tampilkan bantuan ini
• \`/login <api_key>\` - Tautkan akun Telegram secara manual
• \`/logout\` - Putus tautan akun Telegram ini
• \`/tags\` - Tampilkan menu tag & 9 kategori utama
• \`/tags <nama_tag>\` - Filter catatan berdasarkan tag atau kategori
• \`/search <kata_kunci>\` - Cari catatan umum berdasarkan kata kunci
• \`/ask <pertanyaan>\` - ⭐️ [Pro Tier] Tanya jawab pintar AI berbasis catatan Anda
• \`/secure <kunci> <isi>\` - ⭐️ [Pro Tier] Simpan rahasia terenkripsi AES-256-GCM ke Private Vault
• \`/vault [kunci]\` - ⭐️ [Pro Tier] Buka rahasia atau lihat daftar kunci Private Vault Anda

*Cara Penggunaan:*
Kirimkan pesan teks atau tautan apa saja secara langsung ke bot ini. AI kami akan otomatis mengkategorikan dan memberi label catatan Anda dalam sekejap!

{securityDisclaimer}`,
    en: `🤖 *UnlazyNotes Bot* – Capture lightning-fast notes directly from chat!

*Command List:*
• \`/start\` or \`/help\` - Show this guide
• \`/login <api_key>\` - Link your Telegram account manually
• \`/logout\` - Disconnect this Telegram account
• \`/tags\` - Display tag overview & 9 main categories
• \`/tags <tag_name>\` - Filter notes by tag or category
• \`/search <keyword>\` - Search notes by keyword
• \`/ask <question>\` - ⭐️ [Pro Tier] Ask AI intelligent questions from your notes
• \`/secure <key> <content>\` - ⭐️ [Pro Tier] Save AES-256-GCM encrypted secrets to Private Vault
• \`/vault [key]\` - ⭐️ [Pro Tier] Reveal secrets or view your Private Vault keys

*How to Use:*
Simply send any text message or link directly to this bot. Our AI will automatically categorize and tag your notes in seconds!

{securityDisclaimer}`,
  },

  welcome_connected: {
    id: `🎉 *Halo {userName}!* Akun Telegram Anda berhasil terhubung dengan UnlazyNotes. Anda kini bisa langsung mengirim catatan apa saja ke sini.\n\n{securityDisclaimer}`,
    en: `🎉 *Hello {userName}!* Your Telegram account has been successfully linked to UnlazyNotes. You can now send any note directly here.\n\n{securityDisclaimer}`,
  },

  welcome_connected_brief: {
    id: `🎉 *Halo {userName}!* Akun Telegram Anda berhasil terhubung dengan UnlazyNotes. Anda kini bisa langsung mengirim catatan apa saja ke sini.`,
    en: `🎉 *Hello {userName}!* Your Telegram account has been successfully linked to UnlazyNotes. You can now send any note directly here.`,
  },

  security_tip: {
    id: `💡 *Tips Keamanan:*\nTerdeteksi informasi sensitif. Untuk data rahasia seperti password, token, atau PIN, Anda disarankan menggunakan perintah:\n\`/secure <kunci> <isi>\`\nagar otomatis dienkripsi dengan standar AES-256-GCM dan diisolasi sepenuhnya dari AI.`,
    en: `💡 *Security Tip:*\nSensitive information detected. For secret data like passwords, tokens, or PINs, we recommend using:\n\`/secure <key> <content>\`\nto automatically encrypt it with AES-256-GCM and isolate it 100% from AI processing.`,
  },

  unauthenticated: {
    id: `🔒 Akun Telegram Anda belum terhubung ke UnlazyNotes.\n\nSilakan buka dashboard UnlazyNotes -> Settings -> Salin API Key Anda, lalu kirim ke sini:\n\`/login <api_key>\``,
    en: `🔒 Your Telegram account is not connected to UnlazyNotes yet.\n\nPlease open your UnlazyNotes dashboard -> Settings -> Copy your API Key, then send it here:\n\`/login <api_key>\``,
  },

  inactive_sub: {
    id: `⚠️ Paket langganan Anda saat ini tidak aktif atau telah kedaluwarsa. Silakan perpanjang langganan Anda di web dashboard untuk terus menikmati fitur premium.`,
    en: `⚠️ Your subscription plan is currently inactive or has expired. Please renew your subscription on the web dashboard to keep enjoying premium features.`,
  },

  login_missing_key: {
    id: `Format salah. Silakan gunakan format:\n\`/login <api_key>\`\n\nContoh:\n\`/login unz_1234567890abcdef\``,
    en: `Invalid format. Please use:\n\`/login <api_key>\`\n\nExample:\n\`/login unz_1234567890abcdef\``,
  },

  login_invalid_key: {
    id: `❌ API Key tidak valid atau dinonaktifkan. Pastikan Anda menyalin API Key yang benar dari halaman Settings di web dashboard.`,
    en: `❌ Invalid or inactive API Key. Please make sure to copy your valid API Key from the Settings page on the web dashboard.`,
  },

  logout_success: {
    id: `🔌 Akun Telegram Anda telah berhasil diputus dari UnlazyNotes. Untuk menyambungkannya kembali, gunakan \`/login <api_key>\`.`,
    en: `🔌 Your Telegram account has been successfully disconnected from UnlazyNotes. To reconnect, use \`/login <api_key>\`.`,
  },

  unsupported_media: {
    id: `UnlazyNotes belum mendukung format catatan ini, file/gambar anda tetap tersimpan aman disini.`,
    en: `UnlazyNotes does not support this note format yet. Your file/image remains safely preserved here.`,
  },

  quota_warning_footer: {
    id: `*(Sisa kuota Free bulan ini: {remaining}/30)*`,
    en: `*(Remaining Free quota this month: {remaining}/30)*`,
  },

  quota_exceeded: {
    id: `Yah, jatah 30 catatan Free kamu bulan ini sudah terpakai semua! 🥺 Kuota catatan barumu akan direset otomatis tanggal 1 bulan depan (catatan lamamu tetap aman tersimpan).\n\nMau bebas catat tanpa batas & buka fitur rahasia (/secure & /ask)?\n✨ Upgrade ke Pro cuma $1 (~Rp 15rb)/bulan!\n👉 {upgradeUrl}`,
    en: `You've reached your 30 Free notes limit for this month! 🥺 Your new notes quota will automatically reset on the 1st of next month (all your previous notes remain safe).\n\nWant unlimited notes & access to exclusive features (/secure & /ask)?\n✨ Upgrade to Pro for only $1 (~Rp 15k)/month!\n👉 {upgradeUrl}`,
  },

  upgrade_button_pro: {
    id: `✨ Upgrade ke Pro ($1 / Rp 15rb)`,
    en: `✨ Upgrade to Pro ($1 / ~Rp 15k)`,
  },

  pro_gated: {
    id: `Fitur ini khusus untuk pengguna UnlazyNotes Pro ✨\nBuka akses Private Encrypted Vault, AI Q&A cerdas, dan unlimited notes cuma $1/bulan.\n\n👉 {upgradeUrl}`,
    en: `This feature is exclusive to UnlazyNotes Pro users ✨\nUnlock Private Encrypted Vault, smart AI Q&A, and unlimited notes for just $1/month.\n\n👉 {upgradeUrl}`,
  },

  pro_gated_button: {
    id: `⚡️ Upgrade ke Pro ($1/bulan)`,
    en: `⚡️ Upgrade to Pro ($1/month)`,
  },

  tags_empty: {
    id: `Belum ada catatan atau tag yang tersimpan.`,
    en: `No saved notes or tags found.`,
  },

  tags_header: {
    id: `🏷 *Tags Anda*\n\n🔥 *Teraktif:* {activeTagsText}\n🕒 *Terakhir:* {recentTagsText}\n🔍 *Sering Dicari:* {searchedTagsText}\n\n_Pilih kategori di bawah untuk membuka catatan, atau ketik \`/tags <nama_tag>\`._`,
    en: `🏷 *Your Tags*\n\n🔥 *Most Active:* {activeTagsText}\n🕒 *Recent:* {recentTagsText}\n🔍 *Most Searched:* {searchedTagsText}\n\n_Select a category below to browse notes, or type \`/tags <tag_name>\`._`,
  },

  tags_cluster_detail: {
    id: `{icon} *Klaster {clusterTitle} ({tagCountLabel}):*\n{formattedTags}\n\n💡 _Tips: Ketik \`/tags <nama_tag>\` (misal: \`/tags {exampleTag}\`) untuk memfilter catatan._`,
    en: `{icon} *{clusterTitle} Cluster ({tagCountLabel}):*\n{formattedTags}\n\n💡 _Tip: Type \`/tags <tag_name>\` (e.g. \`/tags {exampleTag}\`) to filter notes._`,
  },

  tags_cluster_empty: {
    id: `{icon} Belum ada tag yang tercatat dalam klaster *{clusterTitle}* (30 hari terakhir).`,
    en: `{icon} No tags recorded in the *{clusterTitle}* cluster (last 30 days).`,
  },

  tags_filter_missing: {
    id: `Gunakan format: \`/tags <nama_tag>\``,
    en: `Please use format: \`/tags <tag_name>\``,
  },

  tags_draft_redirect: {
    id: `📝 Ditemukan {totalDrafts} catatan berlabel *draft*.\n\nUntuk draf atau teks panjang, lihat selengkapnya di web dashboard demi kenyamanan membaca:\n/dashboard?tag=draft`,
    en: `📝 Found {totalDrafts} note(s) labeled as *draft*.\n\nFor long-form drafts or writing, view them on the web dashboard for optimal reading:\n/dashboard?tag=draft`,
  },

  tags_none_found: {
    id: `Tidak ditemukan catatan dengan label \`{tag}\`.`,
    en: `No notes found with tag \`{tag}\`.`,
  },

  tags_snippet_header: {
    id: `🏷️ *Catatan dengan label [{tag}]*`,
    en: `🏷️ *Notes labeled [{tag}]*`,
  },

  quota_status_pro: {
    id: `⭐️ *Paket:* Pro Tier (Catatan Unlimited & Fast-Lane AI)`,
    en: `⭐️ *Plan:* Pro Tier (Unlimited Notes & Fast-Lane AI)`,
  },

  quota_status_free: {
    id: `📊 *Status Kuota Bulan Ini:* {currentCount}/{maxQuota} catatan (Reset tiap tgl 1)`,
    en: `📊 *Monthly Quota Status:* {currentCount}/{maxQuota} notes (Resets on the 1st)`,
  },

  search_missing_keyword: {
    id: `Gunakan format: \`/search <kata_kunci>\``,
    en: `Please use format: \`/search <keyword>\``,
  },

  search_empty: {
    id: `🔍 Tidak ditemukan catatan dengan kata kunci "*{keyword}*".`,
    en: `🔍 No notes found matching keyword "*{keyword}*".`,
  },

  search_header: {
    id: `🔍 *Hasil Pencarian untuk:* "{keyword}"`,
    en: `🔍 *Search Results for:* "{keyword}"`,
  },

  snippet_page_info: {
    id: `(Hal. {page}/{totalPages} • Total: {totalCount})`,
    en: `(Page {page}/{totalPages} • Total: {totalCount})`,
  },

  default_note_title: {
    id: `Catatan`,
    en: `Note`,
  },

  ask_missing_question: {
    id: `Gunakan format: \`/ask <pertanyaan Anda>\`\n\nContoh:\n\`/ask Kapan meeting sprint selanjutnya?\``,
    en: `Please use format: \`/ask <your question>\`\n\nExample:\n\`/ask When is the next sprint meeting?\``,
  },

  ask_analyzing: {
    id: `🤖 Sedang menganalisis catatan Anda...`,
    en: `🤖 Analyzing your notes...`,
  },

  ask_answer_header: {
    id: `💡 *Jawaban AI:*\n\n{answer}`,
    en: `💡 *AI Answer:*\n\n{answer}`,
  },

  secure_missing_params: {
    id: `Format salah. Silakan gunakan format:\n\`/secure <kunci> <isi_rahasia>\`\n\nContoh:\n\`/secure wifi-rumah MySecretPassword123\`\n\`/secure token-prod secret_api_key_xyz\``,
    en: `Invalid format. Please use:\n\`/secure <key> <secret_content>\`\n\nExample:\n\`/secure home-wifi MySecretPassword123\`\n\`/secure prod-token secret_api_key_xyz\``,
  },

  secure_saved: {
    id: `🔒 *Tersimpan Aman di Private Vault!*\n\nKunci: \`{vaultKey}\`\n\n_Data dienkripsi AES-256-GCM dan dibypass 100% dari pemrosesan AI._`,
    en: `🔒 *Safely Saved in Private Vault!*\n\nKey: \`{vaultKey}\`\n\n_Data is AES-256-GCM encrypted and 100% bypassed from AI processing._`,
  },

  vault_empty: {
    id: `📭 Private Vault Anda masih kosong.\n\nGunakan perintah \`/secure <kunci> <isi>\` untuk menyimpan rahasia pertama Anda.`,
    en: `📭 Your Private Vault is empty.\n\nUse \`/secure <key> <secret>\` to store your first secret.`,
  },

  vault_list: {
    id: `🔒 *Daftar Kunci Private Vault Anda:* ({totalCount} rahasia)\n\n{keysList}\n\n_Ketik \`/vault <kunci>\` untuk membuka isi rahasia._`,
    en: `🔒 *Your Private Vault Keys:* ({totalCount} secret(s))\n\n{keysList}\n\n_Type \`/vault <key>\` to reveal its contents._`,
  },

  vault_not_found: {
    id: `❌ Tidak ditemukan rahasia di Private Vault dengan kata kunci \`{keyword}\`.\n\nKetik \`/vault\` untuk melihat daftar seluruh kunci yang tersimpan.`,
    en: `❌ No secret found in Private Vault matching key \`{keyword}\`.\n\nType \`/vault\` to view all stored keys.`,
  },

  vault_revealed: {
    id: `🔓 *Private Vault: [{vaultKey}]*\n📅 _Disimpan: {dateStr}_\n\n\`\`\`\n{decrypted}\n\`\`\``,
    en: `🔓 *Private Vault: [{vaultKey}]*\n📅 _Saved: {dateStr}_\n\n\`\`\`\n{decrypted}\n\`\`\``,
  },

  vault_decryption_failed: {
    id: `❌ Gagal mendekripsi data vault. Terjadi kendala kunci atau format data korup.`,
    en: `❌ Failed to decrypt vault data. Key mismatch or corrupted data format.`,
  },

  vault_revealed_multiple_header: {
    id: `🔓 *Ditemukan {totalCount} Catatan Private Vault untuk "*{keyword}*":*\n\n`,
    en: `🔓 *Found {totalCount} Private Vault Note(s) for "*{keyword}*":*\n\n`,
  },

  callback_unauthenticated: {
    id: `Sesi akun Telegram belum terhubung.`,
    en: `Telegram account session is not connected.`,
  },
};

/**
 * Retrieves localized string for Telegram with optional parameter interpolation.
 */
export function getTelegramMsg(
  key: TelegramMessageKey,
  lang: SupportedLocale | string = 'en',
  params?: Record<string, string | number>
): string {
  const activeLang: SupportedLocale = lang === 'id' ? 'id' : 'en';
  const entry = TELEGRAM_MESSAGES[key];
  if (!entry) return key;

  let text = entry[activeLang] || entry.en || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/**
 * Detects active language locale for Telegram interactions:
 * - If user is authenticated, uses user's preferredLocale (id or en).
 * - If unauthenticated or initial request, detects from Telegram sender's language_code.
 */
export function detectTelegramLocale(message: any, userLocale?: string | null): SupportedLocale {
  if (userLocale) {
    const clean = userLocale.toLowerCase().trim();
    if (clean === 'id' || clean === 'en') return clean as SupportedLocale;
  }
  const senderCode = message?.from?.language_code || message?.chat?.language_code;
  if (typeof senderCode === 'string' && senderCode.toLowerCase().startsWith('id')) {
    return 'id';
  }
  return 'en';
}
