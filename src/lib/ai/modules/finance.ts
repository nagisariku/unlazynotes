import { sanitizeTags } from '../sanitizer';
import { extractTagsFromContent } from '../taxonomy';
import type { NoteTagResult } from '../types';

/**
 * Specialized Finance Module with Bilingual Taxonomy.
 * Guaranteed category 'finance' with high-reusability single-word tags.
 */
export function processFinanceNote(content: string): NoteTagResult {
  const text = content.trim();
  const matchedCanonical = extractTagsFromContent(text, 'finance', 3);

  return {
    category: 'finance',
    specific_tags: sanitizeTags(matchedCanonical, 'finance', text, 3),
    source: null,
  };
}
