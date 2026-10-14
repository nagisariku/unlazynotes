import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';

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

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  preferredLocale: varchar('preferred_locale', { length: 10 }).default('id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
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
  userId: text('user_id').references(() => users.id).notNull().unique(),
  keyHash: text('key_hash').notNull().unique(),
  telegramChatId: text('telegram_chat_id'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notes = pgTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  category: categoryEnum('category').default('others').notNull(),
  specificTags: jsonb('specific_tags').$type<string[]>().default([]).notNull(),
  source: varchar('source', { length: 100 }), // youtube, instagram, twitter, etc.
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
