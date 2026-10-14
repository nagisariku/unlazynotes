import { db } from '../src/db';
import { users, subscriptions, apiKeys, notes, paymentLogs } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateDokuSignature } from '../src/lib/doku';
import { hashApiKey } from '../src/lib/telegram';
import { answerNoteQuestion } from '../src/lib/ask';
import * as dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

const BASE_URL = process.env.BETTER_AUTH_URL || 'http://127.0.0.1:4321';

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('🚀 UNLAZYNOTES FASE 3 REGRESSION & VERIFICATION SUITE');
  console.log('====================================================\n');

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

  const testTimestamp = Date.now();
  const testStandardUserId = `usr_p3_std_${testTimestamp}`;
  const testProUserId = `usr_p3_pro_${testTimestamp}`;
  const testAdminUserId = `usr_p3_adm_${testTimestamp}`;

  try {
    // 0. Setup Test Users & Initial Resources
    console.log('--- 0. Setting up test fixtures in PostgreSQL ---');
    await db.insert(users).values([
      {
        id: testStandardUserId,
        name: 'Standard User Tester',
        email: `std_${testTimestamp}@unlazynotes.local`,
        role: 'user',
        preferredLocale: 'id',
      },
      {
        id: testProUserId,
        name: 'Pro User Tester',
        email: `pro_${testTimestamp}@unlazynotes.local`,
        role: 'user',
        preferredLocale: 'id',
      },
      {
        id: testAdminUserId,
        name: 'Admin User Tester',
        email: `admin_${testTimestamp}@unlazynotes.local`,
        role: 'admin',
        preferredLocale: 'id',
      },
    ]);

    const stdRawKey = `unz_std_${crypto.randomBytes(12).toString('hex')}`;
    const proRawKey = `unz_pro_${crypto.randomBytes(12).toString('hex')}`;
    const stdChatId = `chat_std_${testTimestamp}`;
    const proChatId = `chat_pro_${testTimestamp}`;

    await db.insert(apiKeys).values([
      {
        id: `key_${testStandardUserId}`,
        userId: testStandardUserId,
        keyHash: hashApiKey(stdRawKey),
        telegramChatId: stdChatId,
        isActive: true,
      },
      {
        id: `key_${testProUserId}`,
        userId: testProUserId,
        keyHash: hashApiKey(proRawKey),
        telegramChatId: proChatId,
        isActive: true,
      },
    ]);

    await db.insert(subscriptions).values([
      {
        id: `sub_${testStandardUserId}`,
        userId: testStandardUserId,
        plan: 'standard',
        currency: 'IDR',
        status: 'active',
        notesTodayCount: 25, // Di-set langsung di kuota maksimal 25
        lastNoteDate: new Date().toISOString().substring(0, 10),
      },
      {
        id: `sub_${testProUserId}`,
        userId: testProUserId,
        plan: 'pro',
        currency: 'IDR',
        status: 'active',
        notesTodayCount: 50, // Pro kuota tanpa batas
        lastNoteDate: new Date().toISOString().substring(0, 10),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    ]);

    console.log('Fixture setup completed.\n');

    // ----------------------------------------------------
    // TEST 1: Inisiasi Checkout Pembayaran (POST /api/payment/checkout)
    // ----------------------------------------------------
    console.log('--- 1. Testing DOKU Checkout Initiation API ---');
    const checkoutRes = await fetch(`${BASE_URL}/api/payment/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-User-Id': testStandardUserId,
      },
      body: JSON.stringify({
        plan: 'pro',
        period: 'monthly',
        currency: 'IDR',
      }),
    });

    const checkoutData = await checkoutRes.json();
    assert(
      checkoutRes.status === 200 &&
        checkoutData.success === true &&
        Boolean(checkoutData.orderId) &&
        Boolean(checkoutData.paymentUrl),
      'Inisiasi checkout berhasil mengembalikan orderId dan paymentUrl',
      JSON.stringify(checkoutData)
    );

    const [savedPaymentLog] = await db
      .select()
      .from(paymentLogs)
      .where(eq(paymentLogs.orderId, checkoutData.orderId))
      .limit(1);

    assert(
      Boolean(savedPaymentLog) &&
        savedPaymentLog.status === 'pending' &&
        savedPaymentLog.amount === 49000,
      'Log pembayaran pending tercatat akurat di tabel payment_logs'
    );

    // ----------------------------------------------------
    // TEST 2: Verifikasi Signature Webhook DOKU (Invalid vs Valid)
    // ----------------------------------------------------
    console.log('\n--- 2. Testing DOKU Webhook & Signature Verification ---');

    // 2a. Invalid Signature
    const invalidWebhookRes = await fetch(`${BASE_URL}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': 'MCH-TEST-123',
        'Request-Id': crypto.randomUUID(),
        'Request-Timestamp': new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        Signature: 'HMACSHA256=invalid_signature_hash_xyz',
      },
      body: JSON.stringify({
        order: { invoice_number: checkoutData.orderId },
        transaction: { status: 'SUCCESS' },
      }),
    });

    assert(
      invalidWebhookRes.status === 401,
      'Webhook menolak request dengan signature HMAC-SHA256 yang tidak valid (HTTP 401)'
    );

    // 2b. Valid Signature
    const clientId = 'MCH-TEST-123';
    const sharedKey = process.env.DOKU_SHARED_KEY || 'default_shared_key_123';
    const requestId = crypto.randomUUID();
    const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const validPayload = JSON.stringify({
      order: { invoice_number: checkoutData.orderId },
      transaction: { status: 'SUCCESS' },
    });

    const validSignature = generateDokuSignature({
      clientId,
      requestId,
      requestTimestamp,
      requestTarget: '/api/payment/webhook',
      rawBody: validPayload,
      sharedKey,
    });

    const validWebhookRes = await fetch(`${BASE_URL}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Request-Id': requestId,
        'Request-Timestamp': requestTimestamp,
        Signature: validSignature,
      },
      body: validPayload,
    });

    const webhookData = await validWebhookRes.json();
    assert(
      validWebhookRes.status === 200 && webhookData.ok === true,
      'Webhook berhasil menerima dan memverifikasi signature resmi DOKU (HTTP 200)'
    );

    // Verifikasi perubahan di database
    const [updatedSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, testStandardUserId))
      .limit(1);

    const [updatedLog] = await db
      .select()
      .from(paymentLogs)
      .where(eq(paymentLogs.orderId, checkoutData.orderId))
      .limit(1);

    assert(
      updatedSub.plan === 'pro' &&
        updatedSub.status === 'active' &&
        Boolean(updatedSub.expiresAt) &&
        updatedLog.status === 'paid',
      'Akun pengguna berhasil otomatis di-upgrade ke paket Pro dengan masa aktif baru'
    );

    // 2c. Idempotency Test (Panggilan kedua dengan orderId yang sama)
    const secondRequestId = crypto.randomUUID();
    const secondTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const secondSignature = generateDokuSignature({
      clientId,
      requestId: secondRequestId,
      requestTimestamp: secondTimestamp,
      requestTarget: '/api/payment/webhook',
      rawBody: validPayload,
      sharedKey,
    });

    const secondWebhookRes = await fetch(`${BASE_URL}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Request-Id': secondRequestId,
        'Request-Timestamp': secondTimestamp,
        Signature: secondSignature,
      },
      body: validPayload,
    });
    const secondData = await secondWebhookRes.json();
    assert(
      secondWebhookRes.status === 200 &&
        secondData.message?.includes('idempotent'),
      'Webhook bersifat idempotent (tidak terjadi duplikasi upgrade saat retry notifikasi)'
    );

    // ----------------------------------------------------
    // TEST 3: Kuota Catatan Harian (Standard 25/hari vs Pro Unlimited)
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Daily Note Quota Enforcement ---');

    // 3a. Buat user Standard baru dengan kuota 25/25
    const testQuotaUserId = `usr_p3_quota_${testTimestamp}`;
    const quotaChatId = `chat_quota_${testTimestamp}`;
    const quotaRawKey = `unz_quota_${crypto.randomBytes(8).toString('hex')}`;

    await db.insert(users).values({
      id: testQuotaUserId,
      email: `quota_${testTimestamp}@unlazynotes.local`,
      role: 'user',
    });
    await db.insert(apiKeys).values({
      id: `key_${testQuotaUserId}`,
      userId: testQuotaUserId,
      keyHash: hashApiKey(quotaRawKey),
      telegramChatId: quotaChatId,
      isActive: true,
    });
    await db.insert(subscriptions).values({
      id: `sub_${testQuotaUserId}`,
      userId: testQuotaUserId,
      plan: 'standard',
      currency: 'IDR',
      status: 'active',
      notesTodayCount: 25, // Batas maksimal
      lastNoteDate: new Date().toISOString().substring(0, 10),
    });

    const quotaRes = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        update_id: 991,
        message: {
          message_id: 991,
          from: { id: 8881, is_bot: false, first_name: 'QuotaTester' },
          chat: { id: quotaChatId, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: 'Catatan ke-26 yang harus diblokir oleh sistem kuota',
        },
      }),
    });
    const quotaData = await quotaRes.json();
    assert(
      quotaData.error === 'daily_quota_exceeded' || quotaData.ok === false,
      'Pengguna Standard diblokir saat mengirim catatan ke-26 (Daily Quota Exceeded)'
    );

    // 3b. Pengguna Pro mengirim catatan bebas (tidak diblokir)
    const proNoteRes = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        update_id: 992,
        message: {
          message_id: 992,
          from: { id: 8882, is_bot: false, first_name: 'ProTester' },
          chat: { id: proChatId, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: 'Catatan pengguna Pro ke-51 tanpa batasan kuota',
        },
      }),
    });
    const proNoteData = await proNoteRes.json();
    assert(
      proNoteData.ok === true && Boolean(proNoteData.noteId),
      'Pengguna Pro dapat mengirim catatan tanpa batasan kuota harian (Unlimited)'
    );

    // ----------------------------------------------------
    // TEST 4: Fitur AI Pro Smart Q&A (/ask <pertanyaan>)
    // ----------------------------------------------------
    console.log('\n--- 4. Testing AI Pro /ask Command & Access Control ---');

    // 4a. Pengguna Standard memanggil /ask -> Ditolak (Requires Pro)
    const stdAskRes = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        update_id: 993,
        message: {
          message_id: 993,
          from: { id: 8883, is_bot: false, first_name: 'StdTester' },
          chat: { id: quotaChatId, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/ask Kapan jadwal review proyek selanjutnya?',
        },
      }),
    });
    const stdAskData = await stdAskRes.json();
    assert(
      stdAskData.action === 'ask_requires_pro',
      'Command /ask ditolak jika akun pengguna bukan paket Pro (Exclusive Pro Feature)'
    );

    // 4b. Pengguna Pro memanggil /ask -> Diterima dan diproses
    const proAskRes = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        update_id: 994,
        message: {
          message_id: 994,
          from: { id: 8884, is_bot: false, first_name: 'ProTester' },
          chat: { id: proChatId, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/ask Di mana saya menyimpan catatan meeting?',
        },
      }),
    });
    const proAskData = await proAskRes.json();
    assert(
      proAskData.action === 'ask_processing' && proAskData.ok === true,
      'Command /ask diterima untuk pengguna Pro dan diproses secara cerdas'
    );

    // 4c. Uji unit Q&A Engine langsung berdasarkan catatan < 6 bulan
    await db.insert(notes).values({
      id: `note_qa_${testTimestamp}`,
      userId: testProUserId,
      content: 'Jadwal deploy production UnlazyNotes adalah hari Jumat jam 20:00 WIB bersama Kak Riku.',
      category: 'schedule',
      specificTags: ['deployment', 'production'],
      createdAt: new Date(),
    });

    const aiAnswer = await answerNoteQuestion(
      testProUserId,
      'Kapan jadwal deploy production UnlazyNotes?'
    );
    assert(
      Boolean(aiAnswer) &&
        (aiAnswer.toLowerCase().includes('jumat') ||
          aiAnswer.toLowerCase().includes('20:00') ||
          aiAnswer.toLowerCase().includes('deploy')),
      'AI /ask menjawab pertanyaan berdasarkan catatan < 6 bulan dengan akurat'
    );

    // ----------------------------------------------------
    // TEST 5: Proteksi Route & Metrik Admin Dashboard (/admin)
    // ----------------------------------------------------
    console.log('\n--- 5. Testing Admin Dashboard Access Control & Metrik ---');

    // 5a. Akses tanpa login -> Redirect /login (302)
    const anonAdminRes = await fetch(`${BASE_URL}/admin`, {
      redirect: 'manual',
    });
    assert(
      anonAdminRes.status === 302,
      'Akses /admin tanpa login dialihkan ke halaman login (HTTP 302)'
    );

    // 5b. User biasa (non-admin) -> Ditolak HTTP 403 Forbidden
    const userAdminRes = await fetch(`${BASE_URL}/admin`, {
      headers: { 'X-Dev-User-Id': testStandardUserId },
      redirect: 'manual',
    });
    assert(
      userAdminRes.status === 403,
      'Pengguna non-admin dilarang mengakses /admin (HTTP 403 Forbidden)'
    );

    // 5c. Admin resmi (role = 'admin') -> Sukses HTTP 200 OK
    const adminRes = await fetch(`${BASE_URL}/admin`, {
      headers: { 'X-Dev-User-Id': testAdminUserId },
    });
    const adminHtml = await adminRes.text();
    assert(
      adminRes.status === 200 &&
        adminHtml.includes('Administrator &amp; SaaS Metrics') ||
        adminHtml.includes('Admin Console'),
      'Admin resmi berhasil mengakses /admin dengan tampilan konsol metrik lengkap (HTTP 200)'
    );
  } catch (error) {
    console.error('Fatal test error:', error);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`🏁 HASIL TEST FASE 3: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests();
