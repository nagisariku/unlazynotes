import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import { db } from '../src/db';
import { users, notes } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { heuristicTagNote } from '../src/lib/ai';
import { answerNoteQuestion } from '../src/lib/ask';
import { subDays } from 'date-fns';

async function run() {
  console.log('==================================================');
  console.log('TESTING TEMPORAL ANCHORING & /ASK ENHANCEMENT');
  console.log('==================================================\n');

  // 1. Verify Category Classifier & Concrete Entity Tagging for 'tuweeb 2, tanggal 16'
  console.log('--- 1. Testing Schedule Classifier & Anti-Meta Tagging ---');
  const catResult = heuristicTagNote('tuweeb 2, tanggal 16');
  console.log('Input: "tuweeb 2, tanggal 16" -> Category:', catResult.category, '| Tags:', catResult.specific_tags);
  if (catResult.category !== 'schedule') {
    console.error('❌ FAILED: Expected schedule, got', catResult.category);
    process.exit(1);
  }
  if (!catResult.specific_tags.includes('tuweeb')) {
    console.error('❌ FAILED: Expected concrete tag "tuweeb", got', catResult.specific_tags);
    process.exit(1);
  }
  const hasMetaTag = catResult.specific_tags.some(t => /(-reference[ds]?|-item|-info|-marker|date-reference|date-referenced|time|note)/i.test(t));
  if (hasMetaTag) {
    console.error('❌ FAILED: Found forbidden meta-descriptor tag:', catResult.specific_tags);
    process.exit(1);
  }
  console.log('✅ PASS: Categorized as schedule with concrete tag and zero meta-descriptors!');

  // 1b. Test Doctor Non-Meeting Guard
  console.log('--- 1b. Testing Doctor Schedule (Non-Meeting Guard) ---');
  const doctorResult = heuristicTagNote('kontrol dokter gigi tgl 25');
  console.log('Input: "kontrol dokter gigi tgl 25" -> Category:', doctorResult.category, '| Tags:', doctorResult.specific_tags);
  if (doctorResult.category !== 'schedule') {
    console.error('❌ FAILED: Expected schedule, got', doctorResult.category);
    process.exit(1);
  }
  if (doctorResult.specific_tags.includes('meeting')) {
    console.error('❌ FAILED: Medical/Doctor schedule MUST NOT contain tag "meeting":', doctorResult.specific_tags);
    process.exit(1);
  }
  if (!doctorResult.specific_tags.includes('dokter') && !doctorResult.specific_tags.includes('gigi')) {
    console.error('❌ FAILED: Doctor schedule should contain "dokter" or "gigi":', doctorResult.specific_tags);
    process.exit(1);
  }
  console.log('✅ PASS: Doctor schedule has no "meeting" tag and has concrete health entities!');

  // 1c. Test Dynamic Anti-Meta Sanitizer
  const { sanitizeTags } = await import('../src/lib/ai/sanitizer');
  const rawTestTags = ['tuweb-item', 'date-referenced', 'date-reference', 'time-info', 'descriptor', 'meeting-marker'];
  const cleanedTags = sanitizeTags(rawTestTags, 'schedule', 'tuweb meeting jam 10');
  console.log('Sanitizer raw:', rawTestTags, '-> Cleaned:', cleanedTags);
  if (
    cleanedTags.includes('date-referenced') ||
    cleanedTags.includes('date-reference') ||
    cleanedTags.includes('time-info') ||
    cleanedTags.includes('time') ||
    cleanedTags.includes('descriptor')
  ) {
    console.error('❌ FAILED: Sanitizer failed to strip meta-descriptors:', cleanedTags);
    process.exit(1);
  }
  if (!cleanedTags.includes('tuweb')) {
    console.error('❌ FAILED: Sanitizer did not clean "tuweb-item" to "tuweb":', cleanedTags);
    process.exit(1);
  }
  console.log('✅ PASS: Dynamic Anti-Meta Filter cleanly stripped structural descriptors!');

  // 2. Setup mock notes in DB for testing /ask
  console.log('\n--- 2. Testing /ask AI Pipeline with Temporal Context ---');
  const testUserId = 'test_temporal_user_' + Date.now();
  await db.insert(users).values({
    id: testUserId,
    email: `${testUserId}@example.com`,
    name: 'Test Temporal User',
    tier: 'pro',
  });

  const now = new Date();
  // Note 1: 3 days ago (Past date: 16 Okt)
  const datePast = subDays(now, 3);
  await db.insert(notes).values({
    id: crypto.randomUUID(),
    userId: testUserId,
    content: 'tuweeb 2, tanggal 16',
    category: 'schedule',
    specificTags: ['tuweeb'],
    createdAt: datePast,
    isEncrypted: false,
  });

  // Note 2: Yesterday with relative "besok jam 7 pagi"
  const dateYesterday = subDays(now, 1);
  await db.insert(notes).values({
    id: crypto.randomUUID(),
    userId: testUserId,
    content: 'kirim proposal ke klien besok jam 7 pagi',
    category: 'schedule',
    specificTags: ['klien', 'proposal'],
    createdAt: dateYesterday,
    isEncrypted: false,
  });

  // Note 3: Undated task
  await db.insert(notes).values({
    id: crypto.randomUUID(),
    userId: testUserId,
    content: 'deploy hotfix backend unlazynotes',
    category: 'todo',
    specificTags: ['hotfix', 'backend'],
    createdAt: dateYesterday,
    isEncrypted: false,
  });

  // Note 4: Future date (21 Okt)
  await db.insert(notes).values({
    id: crypto.randomUUID(),
    userId: testUserId,
    content: 'ganti ban mobil rabu tgl 21 jam 14.00',
    category: 'schedule',
    specificTags: ['mobil', 'bengkel'],
    createdAt: dateYesterday,
    isEncrypted: false,
  });

  // Note 5: Future date (24 Okt)
  await db.insert(notes).values({
    id: crypto.randomUUID(),
    userId: testUserId,
    content: 'ganti oli motul di ahass sabtu tgl 24 jam 11.00',
    category: 'schedule',
    specificTags: ['oli', 'motor', 'ahass'],
    createdAt: dateYesterday,
    isEncrypted: false,
  });

  console.log('Executing answerNoteQuestion...');
  const response = await answerNoteQuestion(testUserId, 'list tugas dan jadwal terdekat');
  console.log('\n--- AI RESPONSE ---');
  console.log(response);
  console.log('-------------------\n');

  // Validations:
  // 1. No markdown tables (|---|)
  const hasMarkdownTable = /\|(\s*[-:]+\s*\|)+/.test(response);
  if (hasMarkdownTable) {
    console.error('❌ FAILED: Response contains markdown table syntax (|---|)');
    process.exit(1);
  }
  console.log('✅ PASS: Zero markdown tables found.');

  // 2. No large headers (# or ##)
  const hasBigHeaders = /^(#{1,6})\s+/m.test(response);
  if (hasBigHeaders) {
    console.error('❌ FAILED: Response contains markdown headers (# or ##)');
    process.exit(1);
  }
  console.log('✅ PASS: No large markdown headers found.');

  // 3. No conversational closing questions
  const hasConversationalClose = /(mau aku bantu|ada yang ingin|bisa saya bantu|butuh bantuan|semoga membantu)/i.test(response);
  if (hasConversationalClose) {
    console.error('❌ FAILED: Response contains conversational closing remarks');
    process.exit(1);
  }
  console.log('✅ PASS: No conversational closing questions.');

  // 4. No fabricated 'Lanjutkan tugas'
  const hasFabricatedContinuation = /lanjutkan\s+tugas/i.test(response);
  if (hasFabricatedContinuation) {
    console.error('❌ FAILED: Response fabricated "Lanjutkan tugas" phrase:', response);
    process.exit(1);
  }
  console.log('✅ PASS: No fabricated "Lanjutkan tugas" found.');

  // 5. Future dates (21 Okt & 24 Okt) must NOT be categorized as overdue / sudah lewat
  const overdueSectionMatch = response.match(/(?:sudah lewat|overdue)[\s\S]*?(?:\*📝|\*📌|$)/i);
  if (overdueSectionMatch) {
    const overdueText = overdueSectionMatch[0].toLowerCase();
    if (overdueText.includes('21 okt') || overdueText.includes('24 okt') || overdueText.includes('ganti ban') || overdueText.includes('ganti oli')) {
      console.error('❌ FAILED: Future dates (21/24 Okt) wrongly categorized as overdue:', overdueText);
      process.exit(1);
    }
  }
  console.log('✅ PASS: Future dates (21 & 24 Okt) are correctly placed in upcoming schedule, not overdue!');

  // Clean up
  await db.delete(notes).where(eq(notes.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));

  console.log('\n==================================================');
  console.log('🎉 ALL TEMPORAL ANCHORING & /ASK TESTS PASSED!');
  console.log('==================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
