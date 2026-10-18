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

  // 1. Verify Category Classifier for 'tuweeb 2, tanggal 16'
  console.log('--- 1. Testing Schedule Classifier ---');
  const catResult = heuristicTagNote('tuweeb 2, tanggal 16');
  console.log('Input: "tuweeb 2, tanggal 16" -> Category:', catResult.category);
  if (catResult.category !== 'schedule') {
    console.error('❌ FAILED: Expected schedule, got', catResult.category);
    process.exit(1);
  }
  console.log('✅ PASS: Categorized as schedule!');

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

  console.log('Executing answerNoteQuestion...');
  const response = await answerNoteQuestion(testUserId, 'list tugas yg paling dekat minggu ini apa');
  console.log('\n--- AI RESPONSE ---');
  console.log(response);
  console.log('-------------------\n');

  // Validations:
  // 1. No large headers (# or ##)
  const hasBigHeaders = /^(#{1,3})\s+/m.test(response);
  if (hasBigHeaders) {
    console.error('❌ FAILED: Response contains markdown headers (# or ##)');
    process.exit(1);
  }
  console.log('✅ PASS: No large markdown headers found.');

  // 2. No conversational closing questions
  const hasConversationalClose = /(mau aku bantu|ada yang ingin|bisa saya bantu|butuh bantuan)/i.test(response);
  if (hasConversationalClose) {
    console.error('❌ FAILED: Response contains conversational closing remarks');
    process.exit(1);
  }
  console.log('✅ PASS: No conversational closing questions.');

  // 3. Compact line count (under 20 lines)
  const lines = response.split('\n').filter(l => l.trim().length > 0);
  console.log(`Response line count: ${lines.length}`);
  if (lines.length > 20) {
    console.error('❌ FAILED: Response too long (> 20 lines)');
    process.exit(1);
  }
  console.log('✅ PASS: Response is compact and mobile-friendly.');

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
