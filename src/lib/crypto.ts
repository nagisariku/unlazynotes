import crypto from 'node:crypto';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath, override: true });
dotenv.config({ override: true });

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for AES-GCM

/**
 * Derives a 32-byte key from APP_SECRET / BETTER_AUTH_SECRET and userKey (userId or user custom key).
 */
function deriveKey(userKey: string): Buffer {
  const masterSecret =
    process.env.APP_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    'unlazynotes-vault-default-key-32bytes';
  return crypto
    .createHash('sha256')
    .update(`${masterSecret}:${userKey}`)
    .digest();
}

/**
 * Encrypts a secret text using AES-256-GCM.
 * Format: ivHex:authTagHex:encryptedHex
 */
export function encryptSecret(text: string, userKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(userKey);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted payload (ivHex:authTagHex:encryptedHex) using AES-256-GCM.
 */
export function decryptSecret(encryptedData: string, userKey: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = deriveKey(userKey);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
