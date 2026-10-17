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

  // 1. Communication task: Person name + Topic
  const commMatch = lower.match(/\b(chat|telepon|telpon|wa|whatsapp|hubungi|dm|email|call)\s+([a-z0-9_-]+)(.*)/i);
  if (commMatch) {
    const person = commMatch[2].trim();
    if (person && !['ke', 'sama', 'tentang', 'soal', 'ini', 'itu'].includes(person)) {
      tags.push(person);
    }
    const rest = commMatch[3];
    const topicMatch = rest.match(/\b(tanya|soal|tentang|minta|bahas|cek|follow up|mengenai)\s+([a-z0-9_-]+)/i);
    if (topicMatch && topicMatch[2] && !tags.includes(topicMatch[2])) {
      tags.push(topicMatch[2]);
    } else {
      const tokens = rest
        .replace(/[^a-z0-9\s-]/g, '')
        .split(/\s+/)
        .filter(t => t.length > 2 && !['tanya', 'soal', 'tentang', 'minta', 'bahas', 'dan', 'ini', 'itu', 'ke', 'sama', 'buat', 'untuk'].includes(t));
      if (tokens.length > 0 && !tags.includes(tokens[0])) {
        tags.push(tokens[0]);
      }
    }
  }

  // 2. Study & Exam priority pairing
  if (/belajar|study|kuliah|kursus|materi|pr\b|tugas|homework|reading/i.test(lower)) {
    if (!tags.includes('study')) tags.push('study');
    if (/ujian|exam|uts|uas|kuis|quiz|tes|midterm|finals/i.test(lower)) {
      if (!tags.includes('exam')) tags.push('exam');
    }
  } else if (/ujian|exam|uts|uas|kuis|quiz|tes|midterm|finals/i.test(lower)) {
    if (!tags.includes('exam')) tags.push('exam');
  }

  // 3. Extract remaining canonical tags from taxonomy
  if (tags.length < 2) {
    const matched = extractTagsFromContent(text, 'todo', 2);
    for (const m of matched) {
      if (!tags.includes(m)) {
        tags.push(m);
        if (tags.length >= 2) break;
      }
    }
  }

  // 4. Fallback: extract concrete entity words from task (e.g. "beli odol dan sabun")
  if (tags.length === 0) {
    const words = lower
      .replace(/\b(beli|cek|revisi|kerjakan|kirim|bereskan|harus|wajib|jangan|lupa|dan|atau|ke|di)\b/gi, '')
      .split(/[^a-z0-9-]+/)
      .filter(w => w.length >= 3);
    for (const w of words) {
      tags.push(w);
      if (tags.length >= 2) break;
    }
  }

  return {
    category: 'todo',
    specific_tags: sanitizeTags(tags, 'todo', text),
    source: null,
  };
}
