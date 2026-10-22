import type { APIRoute } from 'astro';
import { getSessionUser } from '@/lib/session';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

export const prerender = false;

/**
 * Heuristic fallback note enhancer for offline or mock AI environments.
 */
function heuristicEnhanceText(raw: string): string {
  const text = raw.trim();
  if (!text) return '';

  // 1. Detect if text is a list of items (separated by commas, semicolons, or newlines)
  const isMultiItem =
    text.includes('\n') ||
    (text.includes(',') && !/^\d+,\d+$/.test(text)) ||
    (text.includes(';') && text.length > 10);

  // If text looks like a checklist or tasks (contains verbs or list keywords)
  const isTaskLike =
    /\b(beli|bayar|kerjain|bikin|buat|kirim|pesan|cek|hubungi|chat|telp|meeting|rapat|deadline|simpan)\b/i.test(
      text
    );

  if (isMultiItem && isTaskLike) {
    const rawItems = text
      .split(/[\n,;]+/)
      .map((i) => i.trim().replace(/^[-*•\d.)\]\s]+/, '').trim())
      .filter(Boolean);

    if (rawItems.length > 1) {
      return rawItems
        .map((item) => `- [ ] ${item.charAt(0).toUpperCase() + item.slice(1)}`)
        .join('\n');
    }
  }

  // 2. Expand common Indonesian shorthand while preserving meaning
  let polished = text
    .replace(/\byg\b/gi, 'yang')
    .replace(/\bdgn\b/gi, 'dengan')
    .replace(/\butk\b/gi, 'untuk')
    .replace(/\bbgt\b/gi, 'banget')
    .replace(/\bga\b|\bgak\b/gi, 'tidak')
    .replace(/\bsy\b/gi, 'saya')
    .replace(/\btdk\b/gi, 'tidak')
    .replace(/\bsdh\b|\bsudah\b/gi, 'sudah')
    .replace(/\bblm\b/gi, 'belum')
    .replace(/\btlg\b/gi, 'tolong')
    .replace(/\bkmrn\b/gi, 'kemarin')
    .replace(/\bbsk\b/gi, 'besok');

  // Capitalize sentence start
  polished = polished.charAt(0).toUpperCase() + polished.slice(1);

  return polished;
}

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawText = body.text ? String(body.text).trim() : '';
  if (!rawText) {
    return new Response(JSON.stringify({ error: 'Teks catatan tidak boleh kosong' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.AI_MODEL_NAME || 'claude-haiku-5.5';
  const baseURL = process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1';

  // Fallback to heuristic if no LLM key configured or mock
  if (!apiKey || apiKey.startsWith('mock-')) {
    const enhancedText = heuristicEnhanceText(rawText);
    return new Response(JSON.stringify({ success: true, enhancedText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const openaiCompatible = createOpenAICompatible({
      name: 'openai-compatible',
      baseURL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const { text } = await generateText({
      model: openaiCompatible(modelName),
      temperature: 0.2,
      system: `You are an expert note polisher and editor for UnlazyNotes.
Your mission is to take raw, messy, or unstructured notes and enhance them into clean, structured, and beautifully formatted notes.

Strict Rules:
1. Preserve 100% of the original information, factual details, names, numbers, and URLs.
2. If the user note contains tasks or actionable items, format them with clean Markdown checkboxes (- [ ] task).
3. If it contains a list of thoughts, points, or items, format into clean Markdown bullets.
4. Correct spelling, capitalization, and punctuation naturally in the original language (Indonesian or English).
5. Never add introductory filler, conversational responses, explanations, or quotes. Output ONLY the enhanced note content directly.`,
      prompt: rawText,
    });

    const enhancedText = text.trim() || heuristicEnhanceText(rawText);

    return new Response(JSON.stringify({ success: true, enhancedText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.warn('[AI Note Enhance] LLM call failed, falling back to heuristic:', err?.message);
    const enhancedText = heuristicEnhanceText(rawText);
    return new Response(JSON.stringify({ success: true, enhancedText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
