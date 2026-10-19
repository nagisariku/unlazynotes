import { processCredentialNote } from './modules/credential';

/**
 * Local Credential Pre-Detection (Local Privacy Shield)
 * 
 * Melakukan pengecekan lokal di mesin server (Zero AI) terhadap isi catatan
 * untuk mendeteksi apakah memuat nilai kredensial/rahasia aktual.
 * 
 * Jika terdeteksi:
 * - category = 'credential'
 * - isProcessed = true (LANGSUNG DITANDAI SELESAI, TIDAK PERNAH DIKIRIM KE AI EKSTERNAL)
 * - specificTags = tag hasil ekstraksi heuristik lokal
 */

// 1. Pasangan kata sandi dengan nilai riil
const PASSWORD_REGEX = /\b(password|passwd|kata\s*sandi|sandi)(nya)?\s*[:=]\s*\S+/i;
const PASSWORD_NYA_REGEX = /\b(password|passwd|kata\s*sandi|sandi)nya\s+[^\s]+/i;

// 2. PIN kartu/ATM riil
const PIN_KEYWORD_REGEX = /\b(pin\s*atm|pin\s*kartu|pin\s*bank|atm\s*pin|pin\s*debit|pin\s*kredit)\b/i;
const PIN_DIGITS_REGEX = /\bpin\s*[:=]?\s*\d{4,8}\b/i;

// 3. Nomor Rekening Bank riil (diikuti digit >= 6)
const BANK_ACCOUNT_REGEX = /\b(nomor\s*rekening|no\s*rek(ening)?|norek)\b[^\n\r]*?\b\d{6,}\b/i;

// 4. Token & Private Keys
const TOKEN_KEY_REGEX = /\b(api[_-]?key|secret[_-]?key|private\s*key|seed\s*phrase)\s*[:=]?\s*\S+/i;
const BEARER_OR_TOKEN_REGEX = /\b(bearer\s+token|token\s*[:=]\s*\S+)/i;
const SSH_KEY_CONTENT_REGEX = /\b(ssh-ed\d+|ssh-rsa)\s+AAAA[A-Za-z0-9+/=]+/i;

// 5. CVV & Kartu Identitas bernomor riil (digit >= 6)
const CVV_REGEX = /\b(cvv|cvc)\s*[:=]?\s*\d{3,4}\b/i;
const ID_DOCUMENT_REGEX = /\b(nik|ktp|sim|paspor|passport)\b[^\n\r]*?\b\d{6,}\b/i;

export interface CredentialDetectionResult {
  isCredential: boolean;
  category?: 'credential';
  tags: string[];
}

export function detectLocalCredential(content: string): CredentialDetectionResult {
  if (!content) {
    return { isCredential: false, tags: [] };
  }

  const text = content.trim();

  const isMatched =
    PASSWORD_REGEX.test(text) ||
    PASSWORD_NYA_REGEX.test(text) ||
    PIN_KEYWORD_REGEX.test(text) ||
    PIN_DIGITS_REGEX.test(text) ||
    BANK_ACCOUNT_REGEX.test(text) ||
    TOKEN_KEY_REGEX.test(text) ||
    BEARER_OR_TOKEN_REGEX.test(text) ||
    SSH_KEY_CONTENT_REGEX.test(text) ||
    CVV_REGEX.test(text) ||
    ID_DOCUMENT_REGEX.test(text);

  if (!isMatched) {
    return { isCredential: false, tags: [] };
  }

  // Ekstrak tag kredensial secara lokal menggunakan heuristic module yang sudah ada
  const credentialModuleRes = processCredentialNote(text);
  let tags = credentialModuleRes.specific_tags || [];

  if (tags.length === 0) {
    if (/password|passwd|sandi/i.test(text)) tags.push('password');
    else if (/pin/i.test(text)) tags.push('pin');
    else if (/token|key/i.test(text)) tags.push('token');
    else if (/rekening|rek/i.test(text)) tags.push('rekening');
    else tags.push('credential');
  }

  return {
    isCredential: true,
    category: 'credential',
    tags,
  };
}
