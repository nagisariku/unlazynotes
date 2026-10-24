import { NoteTagResultSchema, type NoteTagResult } from './ai/types';
import { BANNED_TAGS, normalizeTag, sanitizeTags, SHORT_TAG_WHITELIST } from './ai/sanitizer';
import { routeNoteIntent, type DetectedModule } from './ai/router';
import { processBookmarkNote } from './ai/modules/bookmark';
import { processFinanceNote, extractFinanceEntries, heuristicExtractFinance } from './ai/modules/finance';
import { processCredentialNote } from './ai/modules/credential';
import { processTodoNote } from './ai/modules/todo';
import { processScheduleNote, parseScheduleDates, parseScheduleMetadata } from './ai/modules/schedule';
import { processGeneralNote, enrichDualLayerTags } from './ai/modules/general';
import { fetchLinkMetadata } from './link-enricher';

// Export core types and schemas for backward compatibility
export { NoteTagResultSchema, type NoteTagResult };
export { BANNED_TAGS, normalizeTag, sanitizeTags, SHORT_TAG_WHITELIST };
export { routeNoteIntent, type DetectedModule };
export { parseScheduleDates, parseScheduleMetadata, extractFinanceEntries, heuristicExtractFinance };
export * from './ai/taxonomy';

/**
 * Heuristic fallback parser when AI provider is unreachable or for deterministic offline routing.
 * Follows the modular category handlers and reusable clustering formula.
 */
export function heuristicTagNote(
  content: string,
  existingUserTags?: string[],
  baseDate: Date = new Date()
): NoteTagResult {
  const text = content.trim();
  const lower = text.toLowerCase();
  const module = routeNoteIntent(content);

  switch (module) {
    case 'bookmark':
      return processBookmarkNote(content);
    case 'finance':
      return processFinanceNote(content, existingUserTags);
    case 'credential':
      return processCredentialNote(content);
    case 'todo':
      return processTodoNote(content, existingUserTags);
    case 'schedule':
      return processScheduleNote(content, baseDate, existingUserTags);
    case 'general':
    default: {
      // 1. Detect Scripture / Quotes / Prayers / Reflections -> reference or draft (NEVER todo)
      const isArabicScript = /[\u0600-\u06FF]/.test(content);
      const isScriptureOrQuote =
        isArabicScript ||
        /\b(surah|qs\b|q\.s\b|ayat|al-qur'?an|quran|hadits|hadist|rasulullah|allah|bismillah|alhamdulillah|doa|quote|kutipan|pepatah|filosofi|renungan|refleksi|asy-syarh|ash-sharh|al-baqarah|al-fatihah)\b/i.test(lower);

      if (isScriptureOrQuote) {
        const cat = text.length > 250 ? 'draft' : 'reference';
        const enriched = enrichDualLayerTags([], cat, text);
        return {
          category: cat,
          specific_tags: sanitizeTags(enriched, cat, text, 5, existingUserTags),
          source: null,
        };
      }

      // 2. Detect Draft (Long structured text >200 chars or Markdown headers)
      const hasMarkdownHeaders = /^#{1,6}\s+/m.test(text) || text.includes('\n#');
      if (
        text.length > 200 ||
        hasMarkdownHeaders ||
        lower.includes('draft') ||
        lower.includes('draf') ||
        lower.includes('catatan hasil diskusi') ||
        lower.includes('rangkuman')
      ) {
        const enriched = enrichDualLayerTags([], 'draft', text);
        const tags = enriched.length > 0 ? enriched : ['writing'];
        return {
          category: 'draft',
          specific_tags: sanitizeTags(tags, 'draft', text, 5, existingUserTags),
          source: null,
        };
      }

      // 3. Detect Random-Yap (Curhat, shower thoughts, rants, uneg-uneg)
      const isRandomYap =
        /\b(kadang mikir|kepikiran|kenapa ya|heran|curhat|uneg-uneg|capek banget|males banget|kok bisa|shower thought|renungan|kenapa orang|ngapain ya)\b/i.test(lower);
      if (isRandomYap) {
        const enriched = enrichDualLayerTags([], 'random-yap', text);
        return {
          category: 'random-yap',
          specific_tags: sanitizeTags(enriched, 'random-yap', text, 5, existingUserTags),
          source: null,
        };
      }

      // 4. Dual-layer entity extraction for health, ideas, workout, etc.
      const enriched = enrichDualLayerTags([], 'others', text);
      return {
        category: 'others',
        specific_tags: sanitizeTags(enriched, 'others', text, 5, existingUserTags),
        source: null,
      };
    }
  }
}

/**
 * Generate structured note tags using AI.
 * Pure URLs are fast-tracked through the bookmark module, while all text-bearing notes
 * are analyzed by the LLM for deep contextual intelligence, Indonesian slang understanding,
 * and entity extraction.
 */
export async function generateNoteTags(
  content: string,
  existingUserTags?: string[],
  noteCreatedAt?: Date | string
): Promise<NoteTagResult> {
  const text = content.trim();
  const baseDate = noteCreatedAt ? new Date(noteCreatedAt) : new Date();
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const isPureUrl = urlRegex.test(text) && text.replace(/(https?:\/\/[^\s]+)/gi, '').trim().length === 0;

  // Lightweight link metadata enrichment for bare/short URLs
  let enrichedContent = content;
  const urlMatch = text.match(urlRegex);
  if (urlMatch && urlMatch[1] && text.length < 150) {
    try {
      const meta = await fetchLinkMetadata(urlMatch[1]);
      if (meta?.title) {
        enrichedContent = `${content}\nLink Content: Title: "${meta.title}", Summary: "${meta.description || ''}"`;
      }
    } catch {
      // Non-fatal fallback
    }
  }

  if (isPureUrl && enrichedContent === content) {
    return processBookmarkNote(content);
  }

  const result = await processGeneralNote(
    enrichedContent,
    (fallbackText) => heuristicTagNote(fallbackText, existingUserTags, baseDate),
    existingUserTags,
    baseDate
  );

  // If the note was classified as bookmark and contains URLs, merge with bookmark module for rich platform & URL tags
  if (result.category === 'bookmark' && urlRegex.test(text)) {
    const bm = processBookmarkNote(content);
    const bType = result.bookmarkType || bm.bookmarkType || 'reading_other';
    return {
      category: 'bookmark',
      source: bm.source || result.source,
      specific_tags: sanitizeTags(
        [...bm.specific_tags, ...result.specific_tags],
        'bookmark',
        content,
        5,
        existingUserTags
      ),
      bookmark_type: bType,
      bookmarkType: bType,
    };
  }

  if (result.category === 'bookmark' && !result.bookmarkType) {
    result.bookmarkType = 'reading_other';
    result.bookmark_type = 'reading_other';
  }

  if (result.category === 'credential' && !result.credentialType) {
    result.credentialType = 'other';
    result.credential_type = 'other';
  }

  // If classified as schedule, ensure schedule and schedule_dates are populated
  if (result.category === 'schedule') {
    const meta = parseScheduleMetadata(content, baseDate);
    if (!result.schedule) {
      result.schedule = meta;
    }
    const combinedDates = Array.from(
      new Set([...(result.schedule?.dates || []), ...(result.schedule_dates || []), ...meta.dates])
    ).sort();
    result.schedule.dates = combinedDates;
    result.schedule_dates = combinedDates;
  }

  // If classified as finance, ensure expenses, income, and debt are extracted
  if (result.category === 'finance') {
    if (!result.expenses || !result.income || !result.debt) {
      const fin = await extractFinanceEntries(content);
      result.expenses = result.expenses && result.expenses.length > 0 ? result.expenses : fin.expenses;
      result.income = result.income && result.income.length > 0 ? result.income : fin.income;
      result.debt = result.debt && result.debt.length > 0 ? result.debt : fin.debt;
    }
  }

  return result;
}
