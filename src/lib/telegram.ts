import { Bot, InputFile } from 'grammy';
import crypto from 'node:crypto';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath, override: true });
dotenv.config({ override: true });

import https from 'node:https';
import dns from 'node:dns';

// Hindari bentrok proxy lokal untuk request langsung ke api.telegram.org
delete process.env.http_proxy;
delete process.env.https_proxy;
delete process.env.all_proxy;
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.ALL_PROXY;

// Paksa resolusi IPv4 terlebih dahulu untuk mencegah issue timeout rute IPv6 unreachable pada VPS
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Abaikan jika tidak didukung runtime tertentu
}

// Gunakan HTTPS agent dengan family IPv4 eksplisit untuk koneksi andal ke api.telegram.org
const httpsAgent = new https.Agent({
  keepAlive: true,
  family: 4,
});

const token = process.env.TELEGRAM_BOT_TOKEN || 'mock-token';

export const bot = new Bot(token, {
  client: {
    baseFetchConfig: {
      agent: httpsAgent,
    },
  },
});

// Secara global nonaktifkan preview link / og-images / thumbnail link pada seluruh pesan bot
bot.api.config.use(async (prev, method, payload, signal) => {
  if (method === 'sendMessage' || method === 'editMessageText') {
    (payload as any).link_preview_options = {
      is_disabled: true,
      ...((payload as any)?.link_preview_options || {}),
    };
  }
  return await prev(method, payload, signal);
});

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

export interface TelegramSendOptions {
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: any;
  link_preview_options?: { is_disabled?: boolean };
}

/**
 * Splits long text into safe chunks <= limit characters, preserving newline boundaries where possible.
 */
export function chunkText(text: string, limit = 4000): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf('\n', limit);
    if (splitIdx === -1 || splitIdx < limit / 2) {
      splitIdx = limit;
    }
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }
  return chunks;
}

async function sendSingleTelegramMessage(
  chatId: string | number,
  text: string,
  options?: TelegramSendOptions
): Promise<boolean> {
  const mergedOptions: any = {
    link_preview_options: { is_disabled: true },
    ...options,
  };
  try {
    await bot.api.sendMessage(chatId, text, mergedOptions);
    return true;
  } catch (error: any) {
    console.error(`[Telegram] Initial send failed to ${chatId}:`, error?.message || error);
    try {
      await bot.api.sendMessage(chatId, text);
      return true;
    } catch (retryErr: any) {
      console.error(`[Telegram] Retry plain text send failed:`, retryErr?.message || retryErr);
    }
    return false;
  }
}

/**
 * Send a message back to Telegram user with graceful error handling and auto-chunking safeguard (>4000 chars).
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: TelegramSendOptions
): Promise<boolean> {
  const currentToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!currentToken || currentToken.includes('123456789') || currentToken.startsWith('mock-')) {
    console.log(`[Telegram Mock Send] to Chat ID ${chatId}:\n${text}`);
    return true;
  }

  const chunks = chunkText(text, 4000);
  if (chunks.length > 1) {
    let allOk = true;
    for (let i = 0; i < chunks.length; i++) {
      const chunkOptions: TelegramSendOptions | undefined = options
        ? {
            ...options,
            reply_markup: i === chunks.length - 1 ? options.reply_markup : undefined,
          }
        : undefined;
      const ok = await sendSingleTelegramMessage(chatId, chunks[i], chunkOptions);
      if (!ok) allOk = false;
    }
    return allOk;
  }

  return sendSingleTelegramMessage(chatId, text, options);
}

/**
 * Send a single Telegram message and return its message ID if successful.
 */
export async function sendTelegramMessageWithId(
  chatId: string | number,
  text: string,
  options?: TelegramSendOptions
): Promise<{ ok: boolean; messageId?: number }> {
  const currentToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!currentToken || currentToken.includes('123456789') || currentToken.startsWith('mock-')) {
    console.log(`[Telegram Mock Send] to Chat ID ${chatId}:\n${text}`);
    return { ok: true, messageId: 999999 };
  }

  const mergedOptions: any = {
    link_preview_options: { is_disabled: true },
    ...options,
  };
  try {
    const sent = await bot.api.sendMessage(chatId, text, mergedOptions);
    return { ok: true, messageId: sent.message_id };
  } catch (error: any) {
    console.error(`[Telegram] Initial sendWithId failed to ${chatId}:`, error?.message || error);
    try {
      const sent = await bot.api.sendMessage(chatId, text);
      return { ok: true, messageId: sent.message_id };
    } catch (retryErr: any) {
      console.error(`[Telegram] Retry plain text sendWithId failed:`, retryErr?.message || retryErr);
      return { ok: false };
    }
  }
}

/**
 * Delete a Telegram message by ID.
 */
export async function deleteTelegramMessage(
  chatId: string | number,
  messageId: number
): Promise<boolean> {
  const currentToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!currentToken || currentToken.includes('123456789') || currentToken.startsWith('mock-')) {
    console.log(`[Telegram Mock Delete] Message ${messageId} in Chat ID ${chatId}`);
    return true;
  }

  try {
    await bot.api.deleteMessage(chatId, messageId);
    return true;
  } catch (err) {
    console.error(`[Telegram] Failed to delete message ${messageId} in ${chatId}:`, err);
    return false;
  }
}


/**
 * Edit an existing message in-place in Telegram chat.
 */
export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  options?: TelegramSendOptions
): Promise<boolean> {
  const currentToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!currentToken || currentToken.includes('123456789') || currentToken.startsWith('mock-')) {
    console.log(`[Telegram Mock Edit] Message ${messageId} in Chat ID ${chatId}:\n${text}`);
    return true;
  }

  const mergedOptions: any = {
    link_preview_options: { is_disabled: true },
    ...options,
  };
  try {
    await bot.api.editMessageText(chatId, messageId, text, mergedOptions);
    return true;
  } catch (error: any) {
    if (options?.parse_mode) {
      try {
        await bot.api.editMessageText(chatId, messageId, text, {
          reply_markup: options.reply_markup,
        });
        return true;
      } catch (retryErr) {
        console.error(`[Telegram] Retry plain text edit failed:`, retryErr);
      }
    }
    console.error(`[Telegram] Failed to edit message ${messageId} in ${chatId}:`, error);
    return false;
  }
}

/**
 * Edit an existing message reply_markup in-place in Telegram chat.
 */
export async function editTelegramReplyMarkup(
  chatId: string | number,
  messageId: number,
  replyMarkup?: any
): Promise<boolean> {
  const currentToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!currentToken || currentToken.includes('123456789') || currentToken.startsWith('mock-')) {
    console.log(`[Telegram Mock Edit Markup] Message ${messageId} in Chat ID ${chatId}`);
    return true;
  }

  try {
    await bot.api.editMessageReplyMarkup(chatId, messageId, {
      reply_markup: replyMarkup,
    });
    return true;
  } catch (error: any) {
    console.error(`[Telegram] Failed to edit markup for message ${messageId} in ${chatId}:`, error);
    return false;
  }
}

/**
 * Answer a callback query from an inline keyboard to dismiss the loading state.
 */
export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  options?: { text?: string; show_alert?: boolean }
): Promise<boolean> {
  const currentToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!currentToken || currentToken.includes('123456789') || currentToken.startsWith('mock-')) {
    console.log(`[Telegram Mock Answer Callback] Query ID ${callbackQueryId}`);
    return true;
  }

  try {
    await bot.api.answerCallbackQuery(callbackQueryId, options);
    return true;
  } catch (error: any) {
    console.error(`[Telegram] Failed to answer callback query ${callbackQueryId}:`, error);
    return false;
  }
}

/**
 * Format saved confirmation message.
 * e.g. 'Saved "seblak 15k" • tags: finance, expenses, food'
 */
export function formatSavedMessage(
  category: string,
  specificTags?: string[] | null,
  noteSnippet?: string
): string {
  const cleanTags = [category, ...(specificTags || [])].filter(Boolean);
  const uniqueTags = Array.from(new Set(cleanTags));

  if (noteSnippet) {
    const trimmed = noteSnippet.trim().replace(/\s+/g, ' ');
    const snippet = trimmed.length > 25 ? `${trimmed.slice(0, 25)}…` : trimmed;
    return `Saved "${snippet}" • tags: ${uniqueTags.join(', ')}`;
  }

  return `Saved • tags: ${uniqueTags.join(', ')}`;
}

/**
 * Sends a photo to Telegram via fileId or local file path.
 */
export async function sendTelegramPhoto(
  chatId: string | number,
  photo: string,
  caption?: string
): Promise<boolean> {
  const currentToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!currentToken || currentToken.includes('123456789') || currentToken.startsWith('mock-')) {
    console.log(`[Telegram Mock SendPhoto] to Chat ID ${chatId}: ${photo}`);
    return true;
  }

  try {
    if (photo.startsWith('/') || photo.startsWith('.')) {
      await bot.api.sendPhoto(chatId, new InputFile(photo), { caption });
    } else {
      await bot.api.sendPhoto(chatId, photo, { caption });
    }
    return true;
  } catch (error: any) {
    console.error(`[Telegram] Failed to send photo to ${chatId}:`, error);
    return false;
  }
}

/**
 * Sends a document to Telegram via fileId or local file path.
 */
export async function sendTelegramDocument(
  chatId: string | number,
  document: string,
  caption?: string
): Promise<boolean> {
  const currentToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!currentToken || currentToken.includes('123456789') || currentToken.startsWith('mock-')) {
    console.log(`[Telegram Mock SendDocument] to Chat ID ${chatId}: ${document}`);
    return true;
  }

  try {
    if (document.startsWith('/') || document.startsWith('.')) {
      await bot.api.sendDocument(chatId, new InputFile(document), { caption });
    } else {
      await bot.api.sendDocument(chatId, document, { caption });
    }
    return true;
  } catch (error: any) {
    console.error(`[Telegram] Failed to send document to ${chatId}:`, error);
    return false;
  }
}
