// Hindari bentrok proxy lokal
delete process.env.http_proxy;
delete process.env.https_proxy;
delete process.env.all_proxy;
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.ALL_PROXY;

import dns from 'node:dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

import * as dotenv from 'dotenv';
dotenv.config({ override: true });

import { bot } from '../src/lib/telegram';
import {
  processTelegramMessage,
  processTelegramCallbackQuery,
  flushAllDebounceBuffers,
} from '../src/lib/telegram-handler';

async function main() {
  console.log('=== Starting UnlazyNotes Telegram Polling Worker ===');

  try {
    // 1. Pastikan Webhook dimatikan agar Telegram mengizinkan mode Long Polling
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    console.log('✅ Webhook successfully removed. Polling mode enabled.');

    // 2. Register message & edited_message handlers
    bot.on('message', async (ctx) => {
      try {
        await processTelegramMessage(ctx.message);
      } catch (err) {
        console.error('[Bot Polling Message Error]:', err);
      }
    });

    bot.on('edited_message', async (ctx) => {
      try {
        await processTelegramMessage(ctx.update.edited_message);
      } catch (err) {
        console.error('[Bot Polling Edited Message Error]:', err);
      }
    });

    // 3. Register callback_query handler untuk Inline Keyboard pagination
    bot.on('callback_query', async (ctx) => {
      try {
        await processTelegramCallbackQuery(ctx.callbackQuery);
      } catch (err) {
        console.error('[Bot Polling Callback Query Error]:', err);
      }
    });

    // 4. Tangani graceful shutdown
    const handleShutdown = async (signal: string) => {
      console.log(`Received ${signal}, flushing active debounced notes...`);
      try {
        await flushAllDebounceBuffers();
      } catch (e) {
        console.error('Error during shutdown buffer flush:', e);
      }
      bot.stop();
    };

    process.once('SIGINT', () => handleShutdown('SIGINT'));
    process.once('SIGTERM', () => handleShutdown('SIGTERM'));

    // 4. Jalankan bot
    console.log('🚀 Connecting to Telegram via Long Polling...');
    await bot.start({
      onStart: (botInfo) => {
        console.log(`✅ Telegram Bot @${botInfo.username} (ID: ${botInfo.id}) is now ACTIVE and POLLING on this VPS.`);
      },
    });
  } catch (error) {
    console.error('❌ Failed to start bot polling:', error);
    process.exit(1);
  }
}

main();
