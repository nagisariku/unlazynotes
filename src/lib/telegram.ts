import { Bot } from 'grammy';
import crypto from 'node:crypto';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath, override: true });
dotenv.config({ override: true });

// Hindari bentrok proxy lokal untuk request langsung ke api.telegram.org
delete process.env.http_proxy;
delete process.env.https_proxy;
delete process.env.all_proxy;
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.ALL_PROXY;

const token = process.env.TELEGRAM_BOT_TOKEN || 'mock-token';

export const bot = new Bot(token);

/**
 * Hash raw API key using SHA-256 to compare with keyHash in api_keys table.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

/**
 * Generate a new random API key (format: unz_xxxxxxxxxxxxxxxx)
 */
export function generateApiKey(): { rawKey: string; keyHash: string } {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const rawKey = `unz_${randomBytes}`;
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyHash };
}

/**
 * Send a message back to Telegram user with graceful error handling.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: { parse_mode?: 'Markdown' | 'HTML' }
): Promise<boolean> {
  const currentToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!currentToken || currentToken.includes('123456789') || currentToken.startsWith('mock-')) {
    console.log(`[Telegram Mock Send] to Chat ID ${chatId}:\n${text}`);
    return true;
  }

  try {
    await bot.api.sendMessage(chatId, text, options);
    return true;
  } catch (error: any) {
    // Jika gagal karena formatting markdown/HTML dari respons LLM, kirim ulang sebagai plain text
    if (options?.parse_mode) {
      try {
        await bot.api.sendMessage(chatId, text);
        return true;
      } catch (retryErr) {
        console.error(`[Telegram] Retry plain text send failed:`, retryErr);
      }
    }
    console.error(`[Telegram] Failed to send message to ${chatId}:`, error);
    return false;
  }
}

/**
 * Format saved confirmation message.
 * e.g. "Saved • tags: bookmark, read-later"
 */
export function formatSavedMessage(category: string, specificTags: string[]): string {
  const allTags = [category, ...specificTags];
  return `Saved • tags: ${allTags.join(', ')}`;
}
