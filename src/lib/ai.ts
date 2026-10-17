import { NoteTagResultSchema, type NoteTagResult } from './ai/types';
import { BANNED_TAGS, normalizeTag, sanitizeTags } from './ai/sanitizer';
import { routeNoteIntent, type DetectedModule } from './ai/router';
import { processBookmarkNote } from './ai/modules/bookmark';
import { processFinanceNote } from './ai/modules/finance';
import { processCredentialNote } from './ai/modules/credential';
import { processTodoNote } from './ai/modules/todo';
import { processGeneralNote, enrichDualLayerTags } from './ai/modules/general';

// Export core types and schemas for backward compatibility
export { NoteTagResultSchema, type NoteTagResult };
export { BANNED_TAGS, normalizeTag, sanitizeTags };
export { routeNoteIntent, type DetectedModule };
export * from './ai/taxonomy';

/**
 * Heuristic fallback parser when AI provider is unreachable or for deterministic offline routing.
 * Follows the modular category handlers and reusable clustering formula.
 */
export function heuristicTagNote(content: string, existingUserTags?: string[]): NoteTagResult {
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
    case 'schedule': {
      const enriched = enrichDualLayerTags([], 'schedule', text);
      const tags: string[] = [...enriched];

      if (tags.length === 0) {
        if (lower.includes('desain')) tags.push('desain');
        if (lower.includes('meeting') || lower.includes('rapat')) tags.push('meeting');
        else if (lower.includes('deadline') || lower.includes('tenggat')) tags.push('deadline');
        else if (lower.includes('dokter')) tags.push('dokter');
        else if (lower.includes('flight')) tags.push('flight');
      }

      if (tags.length === 0) tags.push('event');

      return {
        category: 'schedule',
        specific_tags: sanitizeTags(tags, 'schedule', text, 3, existingUserTags),
        source: null,
      };
    }
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
          specific_tags: sanitizeTags(enriched, cat, text, 3, existingUserTags),
          source: null,
        };
      }

      // 2. Detect Draft (Long structured text >250 chars)
      if (
        text.length > 250 ||
        lower.includes('draft') ||
        lower.includes('draf') ||
        lower.includes('catatan hasil diskusi') ||
        lower.includes('rangkuman')
      ) {
        return {
          category: 'draft',
          specific_tags: sanitizeTags(['writing'], 'draft', text, 3, existingUserTags),
          source: null,
        };
      }

      // 3. Dual-layer entity extraction for health, ideas, workout, rants, etc.
      const enriched = enrichDualLayerTags([], 'others', text);
      return {
        category: 'others',
        specific_tags: sanitizeTags(enriched, 'others', text, 3, existingUserTags),
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
  existingUserTags?: string[]
): Promise<NoteTagResult> {
  const text = content.trim();
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const isPureUrl = urlRegex.test(text) && text.replace(/(https?:\/\/[^\s]+)/gi, '').trim().length === 0;

  if (isPureUrl) {
    return processBookmarkNote(content);
  }

  const result = await processGeneralNote(
    content,
    (fallbackText) => heuristicTagNote(fallbackText, existingUserTags),
    existingUserTags
  );

  // If the note was classified as bookmark and contains URLs, merge with bookmark module for rich platform & URL tags
  if (result.category === 'bookmark' && urlRegex.test(text)) {
    const bm = processBookmarkNote(content);
    return {
      category: 'bookmark',
      source: bm.source,
      specific_tags: sanitizeTags(
        [...bm.specific_tags, ...result.specific_tags],
        'bookmark',
        content,
        3,
        existingUserTags
      ),
    };
  }

  return result;
}
