import { sanitizeTags } from '../sanitizer';
import { extractTagsFromContent } from '../taxonomy';
import { enrichDualLayerTags } from './general';
import type { NoteTagResult } from '../types';

/**
 * Specialized Finance Module with Bilingual Taxonomy.
 * Guaranteed category 'finance' with high-reusability single-word tags.
 */
export function processFinanceNote(content: string, existingUserTags?: string[]): NoteTagResult {
  const text = content.trim();
  const matchedCanonical = extractTagsFromContent(text, 'finance', 5);
  const enriched = enrichDualLayerTags(matchedCanonical, 'finance', text);

  return {
    category: 'finance',
    specific_tags: sanitizeTags(enriched, 'finance', text, 5, existingUserTags),
    source: null,
  };
}
