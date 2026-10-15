import { sanitizeTags } from '../sanitizer';
import { extractTagsFromContent } from '../taxonomy';
import type { NoteTagResult } from '../types';

/**
 * Specialized Credential Module with Bilingual Taxonomy.
 * Guaranteed category 'credential' with strict single-word security clusters.
 */
export function processCredentialNote(content: string): NoteTagResult {
  const text = content.trim();
  const tags = extractTagsFromContent(text, 'credential', 1);

  return {
    category: 'credential',
    specific_tags: sanitizeTags(tags, 'credential', text),
    source: null,
  };
}
