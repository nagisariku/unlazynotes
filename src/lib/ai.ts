import { NoteTagResultSchema, type NoteTagResult } from './ai/types';
import { BANNED_TAGS, normalizeTag, sanitizeTags } from './ai/sanitizer';
import { routeNoteIntent, type DetectedModule } from './ai/router';
import { processBookmarkNote } from './ai/modules/bookmark';
import { processFinanceNote } from './ai/modules/finance';
import { processCredentialNote } from './ai/modules/credential';
import { processTodoNote } from './ai/modules/todo';
import { processGeneralNote } from './ai/modules/general';

// Export core types and schemas for backward compatibility
export { NoteTagResultSchema, type NoteTagResult };
export { BANNED_TAGS, normalizeTag, sanitizeTags };
export { routeNoteIntent, type DetectedModule };
export * from './ai/taxonomy';

/**
 * Heuristic fallback parser when AI provider is unreachable or for deterministic offline routing.
 * Follows the modular category handlers and reusable clustering formula.
 */
export function heuristicTagNote(content: string): NoteTagResult {
  const text = content.trim();
  const lower = text.toLowerCase();
  const module = routeNoteIntent(content);

  switch (module) {
    case 'bookmark':
      return processBookmarkNote(content);
    case 'finance':
      return processFinanceNote(content);
    case 'credential':
      return processCredentialNote(content);
    case 'todo':
      return processTodoNote(content);
    case 'general':
    default: {
      // 1. Detect Schedule
      if (
        lower.includes('meeting') ||
        lower.includes('jadwal') ||
        lower.includes('agenda') ||
        lower.includes('jam ') ||
        lower.includes('besok') ||
        lower.includes('hari ini') ||
        lower.includes('lusa') ||
        lower.includes('deadline') ||
        lower.includes('tanggal')
      ) {
        const tags: string[] = [];
        if (lower.includes('meeting') || lower.includes('rapat')) tags.push('meeting');
        else if (lower.includes('deadline') || lower.includes('tenggat')) tags.push('deadline');

        if (lower.includes('kantor') || lower.includes('kerja') || lower.includes('sprint') || lower.includes('client')) {
          tags.push('work');
        }

        if (tags.length === 0) tags.push('event');

        return {
          category: 'schedule',
          specific_tags: sanitizeTags(tags, 'schedule'),
          source: null,
        };
      }

      // 2. Detect Draft (Long text, summaries, articles)
      if (
        text.length > 250 ||
        lower.includes('draft') ||
        lower.includes('draf') ||
        lower.includes('catatan hasil diskusi') ||
        lower.includes('rangkuman')
      ) {
        return {
          category: 'draft',
          specific_tags: sanitizeTags(['writing'], 'draft'),
          source: null,
        };
      }

      // 3. Detect Random-yap
      if (
        lower.includes('ide ') ||
        lower.includes('idea') ||
        lower.includes('kepikiran') ||
        lower.includes('opini')
      ) {
        return {
          category: 'random-yap',
          specific_tags: sanitizeTags(['idea'], 'random-yap'),
          source: null,
        };
      }

      // 4. Detect Reference
      if (
        lower.includes('referensi') ||
        lower.includes('rujukan') ||
        lower.includes('kutipan') ||
        lower.includes('source code') ||
        lower.includes('catatan penting')
      ) {
        return {
          category: 'reference',
          specific_tags: sanitizeTags(['reference'], 'reference'),
          source: null,
        };
      }

      // Default
      return {
        category: 'others',
        specific_tags: [],
        source: null,
      };
    }
  }
}

/**
 * Generate structured note tags using Modular Routing Architecture.
 * Fast deterministic router intercepts high-confidence modules (bookmark, finance, credential, todo)
 * while delegating unrouted notes to the specialized general LLM classifier.
 */
export async function generateNoteTags(content: string): Promise<NoteTagResult> {
  const detected = routeNoteIntent(content);

  switch (detected) {
    case 'bookmark':
      return processBookmarkNote(content);
    case 'finance':
      return processFinanceNote(content);
    case 'credential':
      return processCredentialNote(content);
    case 'todo':
      return processTodoNote(content);
    case 'general':
    default:
      return await processGeneralNote(content, heuristicTagNote);
  }
}
