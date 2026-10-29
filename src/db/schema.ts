import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';

// 9 Kategori Wajib
export const categoryEnum = pgEnum('note_category', [
  'random-yap',
  'draft',
  'bookmark',
  'todo',
  'schedule',
  'finance',
  'credential',
  'reference',
  'others'
]);

export type NoteCategory = (typeof categoryEnum.enumValues)[number];

// Better Auth User Schema
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  preferredLocale: varchar('preferred_locale', { length: 10 }).default('id').notNull(),
  timezone: varchar('timezone', { length: 64 }).default('Asia/Jakarta').notNull(),
  tier: varchar('tier', { length: 20 }).default('free').notNull(), // 'free' | 'pro'
  monthlyNotesCount: integer('monthly_notes_count').default(0).notNull(),
  currentBillingPeriod: varchar('current_billing_period', { length: 20 }), // e.g. '2026-10'
  proExpiresAt: timestamp('pro_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Better Auth Session Schema
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
});

// Better Auth Account Schema (OAuth Google, Credentials, etc.)
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Better Auth Verification Schema
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  plan: varchar('plan', { length: 50 }).notNull(), // 'standard' | 'pro'
  currency: varchar('currency', { length: 10 }).notNull(), // 'IDR' | 'USD'
  status: varchar('status', { length: 50 }).default('active').notNull(), // 'active' | 'expired'
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  notesTodayCount: integer('notes_today_count').default(0).notNull(),
  lastNoteDate: varchar('last_note_date', { length: 10 }), // Format 'YYYY-MM-DD'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  keyHash: text('key_hash').notNull().unique(),
  rawKey: text('raw_key'),
  telegramChatId: text('telegram_chat_id').unique(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notes = pgTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  category: categoryEnum('category').default('others').notNull(),
  specificTags: jsonb('specific_tags').$type<string[]>().default([]).notNull(),
  source: varchar('source', { length: 100 }), // youtube, instagram, twitter, etc.
  isEncrypted: boolean('is_encrypted').default(false).notNull(),
  vaultKey: varchar('vault_key', { length: 100 }),
  isPinned: boolean('is_pinned').default(false).notNull(),
  isProcessed: boolean('is_processed').default(false).notNull(),
  attachments: jsonb('attachments').$type<Array<{
    fileId: string;
    type: 'image' | 'file';
    mimeType?: string;
    fileName?: string;
    sizeBytes?: number;
    localPath?: string;
  }>>().default([]).notNull(),
  targetDate: timestamp('target_date', { withTimezone: true }),
  scheduleDates: jsonb('schedule_dates').$type<string[]>().default([]).notNull(),
  schedule: jsonb('schedule').$type<{
    dates: string[];
    isRecurring: boolean;
    recurrenceRule?: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'custom_interval';
      intervalDays?: number;
      daysOfWeek?: number[];
      dayOfMonth?: number;
      timeString?: string;
    };
  }>().default({ dates: [], isRecurring: false }).notNull(),
  expenses: jsonb('expenses').$type<Array<{ item: string; amount: number; currency: string }>>().default([]).notNull(),
  income: jsonb('income').$type<Array<{ source: string; amount: number; currency: string }>>().default([]).notNull(),
  debt: jsonb('debt').$type<Array<{
    type: 'payable' | 'receivable';
    person: string;
    amount: number;
    notes?: string;
    isSettled?: boolean;
  }>>().default([]).notNull(),
  todos: jsonb('todos').$type<TodoEntry[]>().default([]).notNull(),
  bookmarkType: varchar('bookmark_type', { length: 50 }).$type<BookmarkType>(),
  bookmarkMeta: jsonb('bookmark_meta').$type<BookmarkMeta>(),
  credentialType: varchar('credential_type', { length: 50 }).$type<CredentialType>(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('notes_user_processed_idx').on(t.userId, t.isProcessed),
  index('notes_user_target_date_idx').on(t.userId, t.targetDate),
  index('notes_user_archived_idx').on(t.userId, t.isArchived),
  index('notes_expires_at_idx').on(t.expiresAt),
]);

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export type NoteAttachment = {
  fileId: string;
  type: 'image' | 'file';
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
  localPath?: string;
};

export type ScheduleMetadata = {
  dates: string[];
  isRecurring: boolean;
  recurrenceRule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom_interval';
    intervalDays?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    timeString?: string;
  };
};

export type ExpenseEntry = {
  item: string;
  amount: number;
  currency: string;
};

export type IncomeEntry = {
  source: string;
  amount: number;
  currency: string;
};

export type DebtEntry = {
  type: 'payable' | 'receivable';
  person: string;
  amount: number;
  notes?: string;
  isSettled?: boolean;
};

export type TodoEntry = {
  id: string;
  task: string;
  isCompleted: boolean;
  completedAt?: string | null;
  priority?: 'low' | 'normal' | 'high' | null;
};

export type BookmarkType =
  | 'tech_dev'
  | 'design_creative'
  | 'tools_utility'
  | 'finance_investment'
  | 'health_fitness'
  | 'lifestyle_hobbies'
  | 'media_social'
  | 'work_docs'
  | 'education_research'
  | 'audio_entertainment'
  | 'places'
  | 'shopping'
  | 'reading_other'
  | (string & {});

export interface BookmarkItemMeta {
  url: string;
  domain: string;
  title?: string;
  imageUrl?: string;
  faviconUrl?: string;
}

export interface BookmarkMeta {
  primaryUrl: string;
  domain: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  faviconUrl?: string;
  siteName?: string;
  caption?: string;
  author?: string;
  embeddedUrls?: string[];
  readingStatus?: 'unread' | 'reading' | 'read';
  readingTimeMin?: number;
  isContentExtracted?: boolean;
  articleContent?: string;
  aiSummary?: string[];
  isAiSupported?: boolean;
  unsupportedReason?: string;
  items?: BookmarkItemMeta[];
  fetchedAt?: string;
  readAt?: string;
}

export type CredentialType =
  | 'digital_access'
  | 'civil_identity'
  | 'financial_instrument'
  | 'cryptographic_token'
  | 'physical_access'
  | 'other'
  | (string & {});

export const paymentLogs = pgTable('payment_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  orderId: varchar('order_id', { length: 100 }).notNull().unique(),
  provider: varchar('provider', { length: 50 }).default('doku').notNull(),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 10 }).default('IDR').notNull(),
  plan: varchar('plan', { length: 50 }).default('pro').notNull(),
  period: varchar('period', { length: 20 }).default('monthly').notNull(), // 'monthly' | 'yearly'
  status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending' | 'paid' | 'failed'
  payloadRaw: jsonb('payload_raw'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tagSearches = pgTable('tag_searches', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tag: varchar('tag', { length: 100 }).notNull(),
  count: integer('count').default(1).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('tag_searches_user_tag_idx').on(t.userId, t.tag),
]);

export const aiUsageLogs = pgTable('ai_usage_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  feature: varchar('feature', { length: 50 }).notNull(), // 'ask' | 'enhance' | 'tagging' | 'batch_sync' | 'finance'
  model: varchar('model', { length: 100 }),
  promptTokens: integer('prompt_tokens').default(0).notNull(),
  completionTokens: integer('completion_tokens').default(0).notNull(),
  totalTokens: integer('total_tokens').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('ai_usage_logs_created_at_idx').on(t.createdAt),
  index('ai_usage_logs_user_id_idx').on(t.userId),
]);
