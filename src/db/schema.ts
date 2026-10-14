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

// Better Auth User Schema
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  preferredLocale: varchar('preferred_locale', { length: 10 }).default('id').notNull(),
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
  telegramChatId: text('telegram_chat_id'),
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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
