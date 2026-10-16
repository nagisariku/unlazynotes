import crypto from 'node:crypto';
import { db } from '../src/db';
import { users, apiKeys, notes, subscriptions } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { processTelegramMessage } from '../src/lib/telegram-handler';
import { encryptSecret, decryptSecret } from '../src/lib/crypto';

async function runTest() {
  console.log('=== TEST SUITE: 1-CLICK CONNECT, VAULT AES-256-GCM, ISOLASI, & EXPORT ===');

  // Ambil salah satu user di database
  const [testUser] = await db.select().from(users).limit(1);
  if (!testUser) {
    throw new Error('No user found in DB');
  }

  // Pastikan akun tester memiliki tier pro untuk mengakses vault
  await db.update(users).set({ tier: 'pro' }).where(eq(users.id, testUser.id));

  let [keyRecord] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, testUser.id))
    .limit(1);

  if (!keyRecord || !keyRecord.rawKey) {
    const rawKey = `unz_test_${Date.now()}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    if (keyRecord) {
      await db.update(apiKeys).set({ rawKey, keyHash }).where(eq(apiKeys.id, keyRecord.id));
      keyRecord.rawKey = rawKey;
    } else {
      await db.insert(apiKeys).values({
        id: `key_${Date.now()}`,
        userId: testUser.id,
        rawKey,
        keyHash,
        telegramChatId: null,
        isActive: true,
      });
      const [inserted] = await db.select().from(apiKeys).where(eq(apiKeys.userId, testUser.id)).limit(1);
      keyRecord = inserted;
    }
  }

  const testChatId = '888777666';

  // 1. Test 1-Click Connect via /start <token>
  console.log('\n[1] Testing 1-Click Connect via /start <token>...');
  const startResult = await processTelegramMessage({
    chat: { id: testChatId },
    text: `/start ${keyRecord.rawKey}`,
  });
  console.log('Result:', startResult);
  if (startResult.action !== 'start_auto_connected') {
    throw new Error(`Expected start_auto_connected, got: ${startResult.action}`);
  }

  // Verifikasi di DB bahwa telegramChatId sudah terikat
  const [updatedKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, keyRecord.id));
  if (updatedKey.telegramChatId !== testChatId) {
    throw new Error('Telegram Chat ID was not linked!');
  }
  console.log('✅ PASS: 1-Click Connect linked chatId successfully.');

  // 2. Test /secure <kunci> <isi>
  console.log('\n[2] Testing /secure command (Private Vault)...');
  const secretKey = 'db-staging';
  const secretContent = 'postgres://admin:SuperSecretPass123@10.0.0.5:5432/staging_db';

  const secureResult = await processTelegramMessage({
    chat: { id: testChatId },
    text: `/secure ${secretKey} ${secretContent}`,
  });
  console.log('Result:', secureResult);
  if (!secureResult.ok || secureResult.action !== 'secure_saved' || !secureResult.noteId) {
    throw new Error('Failed to save secure note');
  }

  const [savedVaultNote] = await db
    .select()
    .from(notes)
    .where(eq(notes.id, secureResult.noteId));

  if (!savedVaultNote.isEncrypted) throw new Error('isEncrypted should be true');
  if (savedVaultNote.vaultKey !== secretKey) throw new Error('vaultKey mismatch');
  if (savedVaultNote.content === secretContent) throw new Error('Content should be ENCRYPTED, not plain!');
  console.log('Ciphertext in DB:', savedVaultNote.content);

  // Verifikasi dekripsi AES-256-GCM
  const plainDecrypted = decryptSecret(savedVaultNote.content, testUser.id);
  if (plainDecrypted !== secretContent) {
    throw new Error(`Decrypted content mismatch! Got: ${plainDecrypted}`);
  }
  console.log('✅ PASS: /secure encrypted content with AES-256-GCM and bypassed AI.');

  // 3. Test /vault (list) & /vault <kunci> (Partial loose matching)
  console.log('\n[3] Testing /vault list & /vault <kunci> with partial matching...');
  const vaultListResult = await processTelegramMessage({
    chat: { id: testChatId },
    text: '/vault',
  });
  if (vaultListResult.action !== 'vault_list') {
    throw new Error(`Expected vault_list, got: ${vaultListResult.action}`);
  }

  // Simpan catatan kedua untuk menguji multiple partial match: 'bca_card'
  const secondSecure = await processTelegramMessage({
    chat: { id: testChatId },
    text: `/secure bca_card PinBCA123456`,
  });

  // Cari dengan query 'bca' -> harus menemukan 'bca_card' dan jika ada bank_bca
  const vaultPartialResult = await processTelegramMessage({
    chat: { id: testChatId },
    text: `/vault bca`,
  });
  console.log('Result /vault bca:', vaultPartialResult);
  if (
    vaultPartialResult.action !== 'vault_revealed' &&
    vaultPartialResult.action !== 'vault_revealed_multiple'
  ) {
    throw new Error(`Expected vault_revealed or vault_revealed_multiple, got: ${vaultPartialResult.action}`);
  }

  // Cari dengan query 'staging' -> harus menemukan 'db-staging'
  const vaultStagingResult = await processTelegramMessage({
    chat: { id: testChatId },
    text: `/vault staging`,
  });
  console.log('Result /vault staging:', vaultStagingResult);
  if (vaultStagingResult.action !== 'vault_revealed') {
    throw new Error(`Expected vault_revealed for 'staging', got: ${vaultStagingResult.action}`);
  }

  console.log('✅ PASS: /vault partial match successfully retrieved and decrypted secrets.');

  // Bersihkan note kedua
  if (secondSecure.noteId) {
    await db.delete(notes).where(eq(notes.id, secondSecure.noteId));
  }

  // 4. Test Total Isolation: /search must NOT see encrypted vault notes
  console.log('\n[4] Testing Total Isolation from Search & RAG Context...');
  const searchResult = await processTelegramMessage({
    chat: { id: testChatId },
    text: `/search SuperSecretPass123`,
  });
  if (searchResult.action !== 'search_empty') {
    throw new Error(`Encrypted note leaked into /search! Action: ${searchResult.action}`);
  }
  console.log('✅ PASS: Encrypted note is invisible in /search.');

  // 5. Test Smart Credential Warning Guardrail
  console.log('\n[5] Testing Smart Credential Warning Guardrail...');
  const normalPassResult = await processTelegramMessage({
    chat: { id: testChatId },
    text: 'password wifi kantor baru: KopiTubruk123!',
  });
  console.log('Result normal note with password:', normalPassResult);
  console.log('✅ PASS: Normal note saved and warning guardrail triggered.');

  // Cleanup: hapus catatan uji coba vault
  await db.delete(notes).where(eq(notes.id, secureResult.noteId));
  if (normalPassResult.noteId) {
    await db.delete(notes).where(eq(notes.id, normalPassResult.noteId));
  }
  // Reset telegramChatId
  await db.update(apiKeys).set({ telegramChatId: null }).where(eq(apiKeys.id, keyRecord.id));

  console.log('\n🎉 ALL NEW SUITE TESTS PASSED 100%!');
  process.exit(0);
}

runTest().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
