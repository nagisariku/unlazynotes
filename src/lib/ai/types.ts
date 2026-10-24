import { z } from 'zod';
import { CATEGORIES, type Source, type Category } from '../constants';
import type { ScheduleMetadata, ExpenseEntry, IncomeEntry, DebtEntry, BookmarkType, CredentialType } from '../../db/schema';

export const BOOKMARK_TYPES = [
  'tech_dev',
  'media_social',
  'work_docs',
  'places',
  'shopping',
  'reading_other',
] as const;

export const CREDENTIAL_TYPES = [
  'account',
  'network',
  'identity_finance',
  'license',
  'other',
] as const;

export const ScheduleMetadataSchema = z.object({
  dates: z.array(z.string()),
  isRecurring: z.boolean(),
  recurrenceRule: z
    .object({
      frequency: z.enum(['daily', 'weekly', 'monthly', 'custom_interval']),
      intervalDays: z.number().optional(),
      daysOfWeek: z.array(z.number()).optional(),
      dayOfMonth: z.number().optional(),
      timeString: z.string().optional(),
    })
    .optional(),
});

export const ExpenseEntrySchema = z.object({
  item: z.string(),
  amount: z.number(),
  currency: z.string().default('IDR'),
});

export const IncomeEntrySchema = z.object({
  source: z.string(),
  amount: z.number(),
  currency: z.string().default('IDR'),
});

export const DebtEntrySchema = z.object({
  type: z.enum(['payable', 'receivable']),
  person: z.string(),
  amount: z.number(),
  notes: z.string().optional(),
  isSettled: z.boolean().optional().default(false),
});

export const NoteTagResultSchema = z.object({
  category: z.enum(CATEGORIES),
  specific_tags: z.array(z.string()),
  source: z.string().nullable().optional(),
  schedule: ScheduleMetadataSchema.optional(),
  schedule_dates: z.array(z.string()).optional(),
  expenses: z.array(ExpenseEntrySchema).optional(),
  income: z.array(IncomeEntrySchema).optional(),
  debt: z.array(DebtEntrySchema).optional(),
  bookmark_type: z.enum(BOOKMARK_TYPES).nullable().optional(),
  credential_type: z.enum(CREDENTIAL_TYPES).nullable().optional(),
});

export type NoteTagResult = {
  category: Category;
  specific_tags: string[];
  source?: Source | null;
  schedule?: ScheduleMetadata;
  schedule_dates?: string[];
  expenses?: ExpenseEntry[];
  income?: IncomeEntry[];
  debt?: DebtEntry[];
  bookmark_type?: BookmarkType | null;
  credential_type?: CredentialType | null;
  bookmarkType?: BookmarkType | null;
  credentialType?: CredentialType | null;
};

export type { Category, Source, ScheduleMetadata, ExpenseEntry, IncomeEntry, DebtEntry, BookmarkType, CredentialType };
