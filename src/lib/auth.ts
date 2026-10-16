import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { subscriptions, apiKeys } from '@/db/schema';
import { generateApiKey } from '@/lib/telegram';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

/**
 * Ensures that whenever a new user is created in the system,
 * an active Standard subscription and a unique Telegram API Key are generated.
 */
export async function ensureUserInitialResources(userId: string, preferredLocale = 'id') {
  // 1. Cek / Buat Subscription
  const [existingSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!existingSub) {
    const subId = `sub_${crypto.randomUUID()}`;
    const currency = preferredLocale === 'en' ? 'USD' : 'IDR';
    await db.insert(subscriptions).values({
      id: subId,
      userId,
      plan: 'standard',
      currency,
      status: 'active',
      notesTodayCount: 0,
      lastNoteDate: null,
      createdAt: new Date(),
    });
  }

  // 2. Cek / Buat Telegram API Key
  const [existingKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .limit(1);

  let userRawKey: string | null = null;
  if (!existingKey) {
    const keyId = `key_${crypto.randomUUID()}`;
    const { rawKey, keyHash } = generateApiKey();
    userRawKey = rawKey;

    await db.insert(apiKeys).values({
      id: keyId,
      userId,
      keyHash,
      rawKey,
      telegramChatId: null,
      isActive: true,
      createdAt: new Date(),
    });
  } else if (!existingKey.rawKey) {
    const { rawKey, keyHash } = generateApiKey();
    userRawKey = rawKey;
    await db
      .update(apiKeys)
      .set({ rawKey, keyHash })
      .where(eq(apiKeys.id, existingKey.id));
  } else {
    userRawKey = existingKey.rawKey;
  }

  return { userRawKey };
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
      },
      preferredLocale: {
        type: 'string',
        defaultValue: 'id',
      },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || 'mock-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock-google-client-secret',
      enabled: Boolean(
        process.env.GOOGLE_CLIENT_ID &&
          !process.env.GOOGLE_CLIENT_ID.startsWith('mock-')
      ),
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await ensureUserInitialResources(user.id, (user as any).preferredLocale || 'id');
          } catch (err) {
            console.error('[BetterAuth Hook] Error initializing user resources:', err);
          }
        },
      },
    },
  },
});
