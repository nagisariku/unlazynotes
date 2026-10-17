import { sanitizeTags } from '../sanitizer';
import { extractTagsFromContent } from '../taxonomy';
import { enrichDualLayerTags } from './general';
import type { NoteTagResult } from '../types';

/**
 * Specialized Todo Module with Bilingual Taxonomy.
 * Guaranteed category 'todo' with broad, reusable single-word tags.
 */
export function processTodoNote(content: string, existingUserTags?: string[]): NoteTagResult {
  const text = content.trim();
  const lower = text.toLowerCase();
  const tags: string[] = [];

  // 1. Food orders, multi-line shopping lists, research/comparison tasks, or rich entity tasks
  const isShoppingList =
    /\b(beli|stok|belanja|pesen|pesan|order)\b/i.test(lower) &&
    (content.includes('\n') || /\b(dan|serta|stok)\b/i.test(lower));

  const isResearchOrChore =
    /\b(cari|bandingin|bandingkan|compare|riset|research|survey|survei|analisa|perpanjang|urus|bawa|fotokopi|kuliah|macbook|laptop|sim|ktp)\b/i.test(lower);

  if (
    isShoppingList ||
    isResearchOrChore ||
    /\b(martabak|cilok|tahu\s*gejrot|nasgor|cimin|seblak|ayam|bakso|mie|sate|makan|food|gojek|grab)\b/i.test(lower)
  ) {
    const enriched = enrichDualLayerTags([], 'todo', text);
    if (enriched.length > 0) {
      return {
        category: 'todo',
        specific_tags: sanitizeTags(enriched, 'todo', text, 5, existingUserTags),
        source: null,
      };
    }
  }

  // 2. Communication task: Person name + Topic
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

  // 3. Study & Exam priority pairing
  if (/belajar|study|kuliah|kursus|materi|pr\b|tugas|homework|reading/i.test(lower)) {
    if (!tags.includes('study')) tags.push('study');
    if (/ujian|exam|uts|uas|kuis|quiz|tes|midterm|finals/i.test(lower)) {
      if (!tags.includes('exam')) tags.push('exam');
    }
  } else if (/ujian|exam|uts|uas|kuis|quiz|tes|midterm|finals/i.test(lower)) {
    if (!tags.includes('exam')) tags.push('exam');
  }

  // 4. Extract remaining canonical tags from taxonomy
  if (tags.length < 2) {
    const matched = extractTagsFromContent(text, 'todo', 2);
    for (const m of matched) {
      if (!tags.includes(m)) {
        tags.push(m);
        if (tags.length >= 2) break;
      }
    }
  }

  // 5. Fallback: extract concrete entity words from task (e.g. "beli odol dan sabun")
  if (tags.length === 0) {
    const words = lower
      .replace(/\b(beli|cek|revisi|kerjakan|kirim|bereskan|harus|wajib|jangan|lupa|dan|atau|ke|di|pesen|pesan|order|cari|bandingin|bandingkan|riset|survey|perpanjang|urus|bawa)\b/gi, '')
      .split(/[^a-z0-9-]+/)
      .filter((w) => w.length >= 3);
    for (const w of words) {
      tags.push(w);
      if (tags.length >= 2) break;
    }
  }

  return {
    category: 'todo',
    specific_tags: sanitizeTags(tags, 'todo', text, 5, existingUserTags),
    source: null,
  };
}
