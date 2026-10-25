import { NoteTagResultSchema, type NoteTagResult } from './ai/types';
import { BANNED_TAGS, normalizeTag, sanitizeTags, SHORT_TAG_WHITELIST } from './ai/sanitizer';
import { extractFinanceEntries } from './ai/modules/finance';
import { parseScheduleDates, parseScheduleMetadata } from './ai/modules/schedule';
import { processGeneralNote, enrichDualLayerTags, normalizeBookmarkType, normalizeCredentialType, normalizeCategory } from './ai/modules/general';
import { fetchLinkMetadata } from './link-enricher';

// Export core types and schemas for backward compatibility
export { NoteTagResultSchema, type NoteTagResult };
export { BANNED_TAGS, normalizeTag, sanitizeTags, SHORT_TAG_WHITELIST };
export { extractFinanceEntries, parseScheduleDates, parseScheduleMetadata, normalizeCategory, normalizeBookmarkType, normalizeCredentialType, enrichDualLayerTags };
export * from './ai/taxonomy';

/**
 * Generate structured note tags using Pure AI (deepseek-v4.1-flash).
 * 100% pure LLM processing with zero regex / keyword fallbacks.
 */
export async function generateNoteTags(
  content: string,
  existingUserTags?: string[],
  noteCreatedAt?: Date | string
): Promise<NoteTagResult> {
  const text = content.trim();
  const urlRegex = /(https?:\/\/[^\s]+)/i;

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

  const result = await processGeneralNote(
    enrichedContent,
    existingUserTags,
    noteCreatedAt
  );

  if (result.category === 'bookmark' && !result.bookmarkType) {
    result.bookmarkType = 'reading_other';
    result.bookmark_type = 'reading_other';
  }

  if (result.category === 'credential' && !result.credentialType) {
    result.credentialType = 'other';
    result.credential_type = 'other';
  }

  return result;
}
