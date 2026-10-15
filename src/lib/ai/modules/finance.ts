import { sanitizeTags } from '../sanitizer';
import { extractTagsFromContent } from '../taxonomy';
import type { NoteTagResult } from '../types';

/**
 * Specialized Finance Module with Bilingual Taxonomy.
 * Guaranteed category 'finance' with high-reusability single-word tags.
 */
export function processFinanceNote(content: string): NoteTagResult {
  const text = content.trim();
  const lower = text.toLowerCase();

  const isIncome = /gaji|salary|terima|pemasukan|transfer masuk|cair|earnings|dividend|bonus|paycheck/i.test(lower);
  const isBill = /tagihan|subscription|langganan|bill|listrik|pdam|pln|rent|sewa|utility/i.test(lower);

  const tags: string[] = [];

  if (isIncome) {
    tags.push('income');
  } else if (isBill) {
    tags.push('bill');
  } else {
    tags.push('expenses');
  }

  // Extract canonical category tags from bilingual taxonomy
  const matchedCanonical = extractTagsFromContent(text, 'finance', 2);
  for (const t of matchedCanonical) {
    if (t !== 'expenses' && t !== 'income' && t !== 'bill' && !tags.includes(t)) {
      tags.push(t);
      if (tags.length >= 2) break;
    }
  }

  // Conservative rule: If no canonical sub-item matches, tags has only 1 item ('expenses' or 'income'). No guessing!
  return {
    category: 'finance',
    specific_tags: sanitizeTags(tags, 'finance', text),
    source: null,
  };
}
