import { Bot } from 'grammy';
import crypto from 'node:crypto';
import * as dotenv from 'dotenv';

dotenv.config();

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
  } catch (error) {
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
