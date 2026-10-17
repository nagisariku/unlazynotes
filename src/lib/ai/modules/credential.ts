import { sanitizeTags } from '../sanitizer';
import { extractTagsFromContent } from '../taxonomy';
import type { NoteTagResult } from '../types';

/**
 * Specialized Credential Module with Bilingual Taxonomy.
 * Guaranteed category 'credential' with strict single-word security clusters.
 */
export function processCredentialNote(content: string): NoteTagResult {
  const text = content.trim();
  const lower = text.toLowerCase();
  const tags: string[] = [];

  // 1. Detect Bank Entity
  if (/\bbca\b/i.test(lower)) tags.push('bca');
  else if (/\bmandiri\b/i.test(lower)) tags.push('mandiri');
  else if (/\bbri\b/i.test(lower)) tags.push('bri');
  else if (/\bbni\b/i.test(lower)) tags.push('bni');
  else if (/\bcimb\b/i.test(lower)) tags.push('cimb');
  else if (/\bjago\b/i.test(lower)) tags.push('jago');

  // 2. Detect Credential Type & Target Systems
  if (/\badmin\b/i.test(lower)) tags.push('admin');
  if (/\bdashboard\b/i.test(lower)) tags.push('dashboard');
  if (/\blogin\b/i.test(lower)) tags.push('login');
  if (/\b(rekening|no\s*rek|nomor\s*rekening|norek)\b/i.test(lower)) tags.push('rekening');
  if (/\batm\b/i.test(lower)) tags.push('atm');
  if (/\bpin\b/i.test(lower)) tags.push('pin');
  if (/\bwifi\b/i.test(lower)) tags.push('wifi');
  if (/\b(token|api_key|apikey|secret)\b/i.test(lower)) tags.push('api');
  if (/\b(nik|ktp)\b/i.test(lower) && /\b\d{4,}\b/.test(lower)) tags.push('ktp');
  if (/\bsim\b/i.test(lower) && /\b\d{4,}\b/.test(lower)) tags.push('sim');
  if (/\bpaspor\b/i.test(lower) && /\b\d{4,}\b/.test(lower)) tags.push('paspor');

  // 3. Fallback to taxonomy extraction
  if (tags.length < 2) {
    const fromTax = extractTagsFromContent(text, 'credential', 3);
    for (const t of fromTax) {
      if (!tags.includes(t)) tags.push(t);
    }
  }

  return {
    category: 'credential',
    specific_tags: sanitizeTags(tags, 'credential', text, 3),
    source: null,
  };
}
