import { sanitizeTags } from '../sanitizer';
import { extractTagsFromContent } from '../taxonomy';
import type { NoteTagResult } from '../types';

/**
 * Specialized Todo Module with Bilingual Taxonomy.
 * Guaranteed category 'todo' with broad, reusable single-word tags.
 */
export function processTodoNote(content: string): NoteTagResult {
  const text = content.trim();
  const lower = text.toLowerCase();
  const tags: string[] = [];

  // 1. Study & Exam priority pairing
  if (/belajar|study|kuliah|kursus|materi|pr\b|tugas|homework|reading/i.test(lower)) {
    tags.push('study');
    if (/ujian|exam|uts|uas|kuis|quiz|tes|midterm|finals/i.test(lower)) {
      tags.push('exam');
    }
  } else if (/ujian|exam|uts|uas|kuis|quiz|tes|midterm|finals/i.test(lower)) {
    tags.push('exam');
  }

  // 2. Extract remaining canonical tags from taxonomy
  if (tags.length < 2) {
    const matched = extractTagsFromContent(text, 'todo', 2);
    for (const m of matched) {
      if (!tags.includes(m)) {
        tags.push(m);
        if (tags.length >= 2) break;
      }
    }
  }

  return {
    category: 'todo',
    specific_tags: sanitizeTags(tags, 'todo', text),
    source: null,
  };
}
