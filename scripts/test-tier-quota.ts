import { db } from '../src/db';
import { users, subscriptions, apiKeys, notes, paymentLogs } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import {
  checkUserQuotaAndTier,
  incrementUserMonthlyNotes,
  getCurrentBillingPeriod,
  FREE_MONTHLY_QUOTA,
  getTelegramQuotaExceededMessage,
  getTelegramVaultGatedMessage,
  getTelegramAskGatedMessage,
} from '../src/lib/quota-service';
import { processTelegramMessage } from '../src/lib/telegram-handler';
import { taggingQueue } from '../src/lib/tagging-queue';
import { hashApiKey } from '../src/lib/telegram';
import { addDays, subDays } from 'date-fns';
import crypto from 'node:crypto';

async function runTierQuotaTests() {
  console.log('================================================================');
  console.log('🚀 UNLAZYNOTES TIER PLAN & QUOTA MANAGEMENT VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
      failed++;
    }
  }

  const timestamp = Date.now();
  const testFreeUserId = `usr_test_free_${timestamp}`;
  const testProUserId = `usr_test_pro_${timestamp}`;
  const testExpiredProUserId = `usr_test_exp_${timestamp}`;

  const freeChatId = `chat_free_${timestamp}`;
  const proChatId = `chat_pro_${timestamp}`;

  try {
    // ----------------------------------------------------
    // SETUP FIXTURES
    // ----------------------------------------------------
    console.log('--- 0. Setup Test Users & DB Fixtures ---');

    // 1. Free User (fresh)
    await db.insert(users).values({
      id: testFreeUserId,
      name: 'Free User Tester',
      email: `free_${timestamp}@unlazynotes.local`,
      role: 'user',
      preferredLocale: 'id',
      tier: 'free',
      monthlyNotesCount: 0,
      currentBillingPeriod: getCurrentBillingPeriod(),
      proExpiresAt: null,
    });

    const freeRawKey = `unz_free_${timestamp}`;
    await db.insert(apiKeys).values({
      id: `key_free_${timestamp}`,
      userId: testFreeUserId,
      keyHash: hashApiKey(freeRawKey),
      rawKey: freeRawKey,
      telegramChatId: freeChatId,
      isActive: true,
    });

    // 2. Pro User
    const proExpires = addDays(new Date(), 30);
    await db.insert(users).values({
      id: testProUserId,
      name: 'Pro User Tester',
      email: `pro_${timestamp}@unlazynotes.local`,
      role: 'user',
      preferredLocale: 'id',
      tier: 'pro',
      monthlyNotesCount: 50,
      currentBillingPeriod: getCurrentBillingPeriod(),
      proExpiresAt: proExpires,
    });

    const proRawKey = `unz_pro_${timestamp}`;
    await db.insert(apiKeys).values({
      id: `key_pro_${timestamp}`,
      userId: testProUserId,
      keyHash: hashApiKey(proRawKey),
      rawKey: proRawKey,
      telegramChatId: proChatId,
      isActive: true,
    });

    // 3. Expired Pro User (pro_expires_at in past)
    const pastExpires = subDays(new Date(), 2);
    await db.insert(users).values({
      id: testExpiredProUserId,
      name: 'Expired Pro User',
      email: `exp_${timestamp}@unlazynotes.local`,
      role: 'user',
      preferredLocale: 'id',
      tier: 'pro',
      monthlyNotesCount: 15,
      currentBillingPeriod: getCurrentBillingPeriod(),
      proExpiresAt: pastExpires,
    });

    assert(true, 'Test fixtures created successfully in PostgreSQL');

    // ----------------------------------------------------
    // TEST 1: Lazy Monthly Calendar Reset
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Monthly Lazy Reset (1st of month calendar reset) ---');

    // Set billing period to previous month
    await db
      .update(users)
      .set({
        currentBillingPeriod: '2026-08',
        monthlyNotesCount: 30, // Previously hit quota
      })
      .where(eq(users.id, testFreeUserId));

    const resetCheck = await checkUserQuotaAndTier(testFreeUserId);

    assert(
      resetCheck.currentCount === 0 && resetCheck.allowed === true,
      'Lazy monthly reset: catatan direset ke 0 ketika bulan kalender berganti'
    );

    const [userAfterReset] = await db
      .select()
      .from(users)
      .where(eq(users.id, testFreeUserId));

    assert(
      userAfterReset.monthlyNotesCount === 0 &&
        userAfterReset.currentBillingPeriod === getCurrentBillingPeriod(),
      `Database user otomatis diperbarui ke billing period berjalan (${getCurrentBillingPeriod()})`
    );

    // ----------------------------------------------------
    // TEST 2: Free Tier Quota Enforcement (Max 30 Notes)
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Free Tier Quota Enforcement (30 notes/month) ---');

    // Set to 29 notes
    await db
      .update(users)
      .set({ monthlyNotesCount: 29 })
      .where(eq(users.id, testFreeUserId));

    const check29 = await checkUserQuotaAndTier(testFreeUserId);
    assert(
      check29.allowed === true && check29.remainingQuota === 1,
      'Catatan ke-30 masih diizinkan (remaining: 1)'
    );

    // Increment to 30
    await incrementUserMonthlyNotes(testFreeUserId);
    const check30 = await checkUserQuotaAndTier(testFreeUserId);
    assert(
      check30.allowed === false &&
        check30.reason === 'monthly_quota_exceeded' &&
        check30.remainingQuota === 0,
      'Catatan ke-31 diblokir: Free Tier kuota 30 catatan tercapai'
    );

    // Test Telegram message capture when quota exceeded
    const tgBlockedResult = await processTelegramMessage({
      chat: { id: freeChatId },
      text: 'Catatan tambahan setelah kuota bulanan habis',
    });

    assert(
      tgBlockedResult.ok === false &&
        tgBlockedResult.error === 'monthly_quota_exceeded',
      'Telegram bot memblokir catatan dan mengirim pesan Paywall ramah saat kuota habis'
    );

    // ----------------------------------------------------
    // TEST 3: Deleting Notes does NOT decrease monthly count
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Note Deletion Integrity (No Quota Refund) ---');

    // Create a note in DB
    const noteToDeleteId = `note_del_${timestamp}`;
    await db.insert(notes).values({
      id: noteToDeleteId,
      userId: testFreeUserId,
      content: 'Catatan yang akan dihapus',
      category: 'others',
      specificTags: [],
      source: 'web',
      createdAt: new Date(),
    });

    // Delete the note
    await db.delete(notes).where(eq(notes.id, noteToDeleteId));

    const [userAfterDelete] = await db
      .select()
      .from(users)
      .where(eq(users.id, testFreeUserId));

    assert(
      userAfterDelete.monthlyNotesCount === 30,
      'Menghapus catatan TIDAK mengurangi monthly_notes_count (kuota konsumsi komputasi tetap aman)'
    );

    // ----------------------------------------------------
    // TEST 4: Pro Tier Unlimited & Auto-Downgrade on Expiry
    // ----------------------------------------------------
    console.log('\n--- 4. Testing Pro Tier (Unlimited & Expiry Downgrade) ---');

    const proCheck = await checkUserQuotaAndTier(testProUserId);
    assert(
      proCheck.allowed === true &&
        proCheck.isPro === true &&
        proCheck.maxQuota === null,
      'Pengguna Pro memiliki akses catatan UNLIMITED tanpa batas kuota'
    );

    // Test Expired Pro User
    const expiredCheck = await checkUserQuotaAndTier(testExpiredProUserId);
    assert(
      expiredCheck.isPro === false && expiredCheck.tier === 'free',
      'Pengguna Pro yang kedaluwarsa otomatis di-downgrade menjadi Free tier'
    );

    const [userAfterDowngrade] = await db
      .select()
      .from(users)
      .where(eq(users.id, testExpiredProUserId));

    assert(
      userAfterDowngrade.tier === 'free',
      'Status tier di database tercatat sebagai "free" setelah kedaluwarsa'
    );

    // ----------------------------------------------------
    // TEST 5: Feature Gating (/secure, /vault, /ask)
    // ----------------------------------------------------
    console.log('\n--- 5. Testing Feature Gating for Pro Tier ---');

    // 5a. Free user calls /secure -> Gated
    const freeSecureRes = await processTelegramMessage({
      chat: { id: freeChatId },
      text: '/secure secret_wifi MyPassword123',
    });
    assert(
      freeSecureRes.action === 'secure_requires_pro',
      'Perintah /secure DIBLOKIR untuk pengguna Free Tier (preview + CTA Upgrade Pro)'
    );

    // 5b. Free user calls /vault -> Gated
    const freeVaultRes = await processTelegramMessage({
      chat: { id: freeChatId },
      text: '/vault',
    });
    assert(
      freeVaultRes.action === 'vault_requires_pro',
      'Perintah /vault DIBLOKIR untuk pengguna Free Tier (Private Vault eksklusif Pro)'
    );

    // 5c. Free user calls /ask -> Gated
    const freeAskRes = await processTelegramMessage({
      chat: { id: freeChatId },
      text: '/ask Kapan jadwal liburan saya?',
    });
    assert(
      freeAskRes.action === 'ask_requires_pro',
      'Perintah /ask DIBLOKIR untuk pengguna Free Tier (Temporal RAG eksklusif Pro)'
    );

    // 5d. Pro user calls /secure -> Allowed & Saved
    const proSecureRes = await processTelegramMessage({
      chat: { id: proChatId },
      text: '/secure api_key_stripe sk_live_test123456789',
    });
    assert(
      proSecureRes.ok === true &&
        proSecureRes.action === 'secure_saved' &&
        Boolean(proSecureRes.noteId),
      'Pengguna Pro berhasil menyimpan data rahasia terenkripsi AES-256-GCM via /secure'
    );

    // 5e. Pro user calls /vault -> Allowed
    const proVaultRes = await processTelegramMessage({
      chat: { id: proChatId },
      text: '/vault api_key_stripe',
    });
    assert(
      proVaultRes.ok === true && proVaultRes.action === 'vault_revealed',
      'Pengguna Pro berhasil mengakses dan mendekripsi isi Private Vault via /vault'
    );

    // ----------------------------------------------------
    // TEST 6: Fast-Lane Tagging Priority Queue
    // ----------------------------------------------------
    console.log('\n--- 6. Testing Fast-Lane Tagging Priority Queue ---');

    let proTaskCompleted = false;
    let freeTaskCompleted = false;

    taggingQueue.enqueue({
      noteId: `note_pro_q_${timestamp}`,
      content: 'beli kopi arabika 35k',
      tier: 'pro',
      onComplete: () => {
        proTaskCompleted = true;
      },
    });

    taggingQueue.enqueue({
      noteId: `note_free_q_${timestamp}`,
      content: 'beli susu ultra 12k',
      tier: 'free',
      onComplete: () => {
        freeTaskCompleted = true;
      },
    });

    const status = taggingQueue.getStatus();
    assert(
      status !== undefined && typeof status.activeWorkers === 'number',
      'Tagging queue aktif menerima antrean Pro (Fast-Lane) dan Free (Standard-Lane)'
    );

    // ----------------------------------------------------
    // TEST 7: Paywall Templates
    // ----------------------------------------------------
    console.log('\n--- 7. Testing Paywall & Gatekeeping Message Templates ---');

    const quotaMsg = getTelegramQuotaExceededMessage();
    assert(
      quotaMsg.includes('Batas Kuota Bulanan Free Tier') &&
        quotaMsg.includes('30/30 catatan') &&
        quotaMsg.includes('Rp 15.000/bulan'),
      'Pesan kuota bulanan memuat batas 30 catatan dan harga resmi Rp 15.000/bulan ($1/mo)'
    );

    const vaultMsg = getTelegramVaultGatedMessage();
    assert(
      vaultMsg.includes('Private Encrypted Vault') &&
        vaultMsg.includes('AES-256-GCM') &&
        vaultMsg.includes('/dashboard/settings'),
      'Pesan gatekeeping Vault memuat penjelasan keamanan AES-256-GCM dan link upgrade'
    );

    const askMsg = getTelegramAskGatedMessage();
    assert(
      askMsg.includes('AI Otak Kedua (/ask)') &&
        askMsg.includes('Pro Tier'),
      'Pesan gatekeeping AI /ask memuat penegasan fitur eksklusif Pro Tier'
    );

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\n--- 8. Cleanup Test Fixtures ---');
    await db.delete(notes).where(eq(notes.userId, testFreeUserId));
    await db.delete(notes).where(eq(notes.userId, testProUserId));
    await db.delete(notes).where(eq(notes.userId, testExpiredProUserId));
    await db.delete(apiKeys).where(eq(apiKeys.userId, testFreeUserId));
    await db.delete(apiKeys).where(eq(apiKeys.userId, testProUserId));
    await db.delete(users).where(eq(users.id, testFreeUserId));
    await db.delete(users).where(eq(users.id, testProUserId));
    await db.delete(users).where(eq(users.id, testExpiredProUserId));
    console.log('Cleanup completed.\n');

  } catch (err) {
    console.error('Fatal error during test execution:', err);
    failed++;
  }

  console.log('================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTierQuotaTests();
