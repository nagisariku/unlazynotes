import { z } from 'zod';
import { CATEGORIES, type Source, type Category } from '../constants';

export const NoteTagResultSchema = z.object({
  category: z.enum(CATEGORIES),
  specific_tags: z.array(z.string()),
  source: z.string().nullable().optional(),
});

export type NoteTagResult = {
  category: Category;
  specific_tags: string[];
  source?: Source | null;
};

export type { Category, Source };
