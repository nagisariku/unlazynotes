import { db } from '../src/db';
import { users, subscriptions, apiKeys } from '../src/db/schema';
import { hashApiKey } from '../src/lib/telegram';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Seeding test data...');

  const testUserId = 'usr_test_riku_01';
  const testEmail = 'riku.test@unlazynotes.local';
  const testApiKeyRaw = 'unz_test_1234567890abcdef';
  const testKeyHash = hashApiKey(testApiKeyRaw);

  // Upsert user
  const [existingUser] = await db.select().from(users).where(eq(users.id, testUserId));
  if (!existingUser) {
    await db.insert(users).values({
      id: testUserId,
      name: 'Riku Shiro',
      email: testEmail,
      role: 'user',
      preferredLocale: 'id',
      createdAt: new Date(),
    });
    console.log('Created test user:', testUserId);
  }

  // Upsert subscription (Standard Plan)
  const [existingSub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, testUserId));
  if (!existingSub) {
    await db.insert(subscriptions).values({
      id: 'sub_test_standard_01',
      userId: testUserId,
      plan: 'standard',
      currency: 'IDR',
      status: 'active',
      notesTodayCount: 0,
      lastNoteDate: null,
      createdAt: new Date(),
    });
    console.log('Created test subscription (standard)');
  }

  // Upsert API key
  const [existingKey] = await db.select().from(apiKeys).where(eq(apiKeys.userId, testUserId));
  if (!existingKey) {
    await db.insert(apiKeys).values({
      id: 'key_test_01',
      userId: testUserId,
      keyHash: testKeyHash,
      telegramChatId: null, // belum login
      isActive: true,
      createdAt: new Date(),
    });
    console.log('Created test API key:', testApiKeyRaw);
  }

  console.log('Seed completed successfully!');
  console.log('Test User ID:', testUserId);
  console.log('Test API Key for bot /login:', testApiKeyRaw);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
