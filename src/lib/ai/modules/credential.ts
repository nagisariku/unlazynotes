import { sanitizeTags } from '../sanitizer';
import { extractTagsFromContent } from '../taxonomy';
import type { NoteTagResult } from '../types';
import type { CredentialType } from '@/db/schema';

function heuristicClassifyCredentialType(tags: string[], text: string): CredentialType {
  const lower = text.toLowerCase();
  if (/\b(token|api_key|apikey|secret_key|secret|license|serial|voucher|ssh|ed25519|rsa)\b/i.test(lower)) {
    return 'license';
  }
  if (/\b(wifi|ssid|router|wlan|hotspot|pin\s*pintu)\b/i.test(lower)) {
    return 'network';
  }
  if (/\b(bca|mandiri|bri|bni|cimb|jago|rekening|norek|no\s*rek|atm|ktp|nik|sim|paspor|bpjs|npwp|kk)\b/i.test(lower)) {
    return 'identity_finance';
  }
  if (/\b(login|password|passwd|sandi|username|email|admin|dashboard|user)\b/i.test(lower)) {
    return 'account';
  }
  return 'other';
}

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
  if (/\b(ssh-ed25519|ed25519)\b/i.test(lower)) tags.push('ed25519');
  if (/\b(ssh-rsa|rsa4096|rsa2048)\b/i.test(lower)) tags.push('rsa');
  if (/\b(ssh|ssh-key)\b/i.test(lower)) tags.push('ssh');
  if (/\b(vps|server|root)\b/i.test(lower)) tags.push('server');

  // 3. Fallback to taxonomy extraction
  if (tags.length < 2) {
    const fromTax = extractTagsFromContent(text, 'credential', 5);
    for (const t of fromTax) {
      if (!tags.includes(t)) tags.push(t);
    }
  }

  const credentialType = heuristicClassifyCredentialType(tags, text);

  return {
    category: 'credential',
    specific_tags: sanitizeTags(tags, 'credential', text, 5),
    source: null,
    credential_type: credentialType,
    credentialType,
  };
}
