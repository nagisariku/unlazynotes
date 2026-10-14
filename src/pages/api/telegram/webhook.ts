import type { APIRoute } from 'astro';
import { processTelegramMessage } from '@/lib/telegram-handler';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // 1. Validasi Keamanan Header Secret Token
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const incomingSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');

  if (configuredSecret && configuredSecret !== 'super_secret_webhook_token_123') {
    if (incomingSecret !== configuredSecret) {
      return new Response('Unauthorized', { status: 401 });
    }
  } else if (configuredSecret && incomingSecret && incomingSecret !== configuredSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Parsing Payload
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const message = body?.message || body?.edited_message;
  const result = await processTelegramMessage(message);

  return new Response(JSON.stringify(result), {
    status: result.httpStatus || 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
