import { generateObject } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { CATEGORIES, type Source } from './constants';

export const NoteTagResultSchema = z.object({
  category: z.enum(CATEGORIES),
  specific_tags: z.array(z.string()).max(2),
  source: z.string().optional().nullable(),
});

export type NoteTagResult = z.infer<typeof NoteTagResultSchema>;

export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Heuristic fallback parser when AI provider is not reachable or keys are not provided.
 * Ensures robust 100% uptime for note tagging even under offline or mock environments.
 */
export function heuristicTagNote(content: string): NoteTagResult {
  const text = content.trim();
  const lower = text.toLowerCase();

  // Detect URLs
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const urlMatch = text.match(urlRegex);

  if (urlMatch) {
    const url = urlMatch[0].toLowerCase();
    let source: Source | string = 'article';
    let tag = 'read-later';

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      source = 'youtube';
      tag = 'youtube';
    } else if (url.includes('instagram.com')) {
      source = 'instagram';
      tag = 'instagram';
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      source = 'twitter';
      tag = 'twitter';
    } else if (url.includes('tiktok.com')) {
      source = 'tiktok';
      tag = 'tiktok';
    } else if (url.includes('github.com')) {
      source = 'github';
      tag = 'github';
    }

    return {
      category: 'bookmark',
      specific_tags: [tag],
      source,
    };
  }

  // Detect credential
  if (
    lower.includes('pass ') ||
    lower.includes('password') ||
    lower.includes('sandi') ||
    lower.includes('wifi') ||
    lower.includes('kredensial') ||
    lower.includes('pin:') ||
    lower.includes('token:')
  ) {
    const tags: string[] = ['password'];
    if (lower.includes('wifi')) tags.push('wifi');
    else if (lower.includes('gmail') || lower.includes('google')) tags.push('gmail');
    else if (lower.includes('netflix')) tags.push('netflix');
    return {
      category: 'credential',
      specific_tags: tags.slice(0, 2),
      source: null,
    };
  }

  // Detect finance
  if (
    lower.includes('bayar') ||
    lower.includes('transfer') ||
    lower.includes('invoice') ||
    lower.includes('gaji') ||
    lower.includes('rp') ||
    lower.includes('rb') ||
    lower.includes('jt') ||
    lower.includes('uang') ||
    lower.includes('beli') ||
    lower.includes('harga') ||
    lower.includes('cost') ||
    lower.includes('usd') ||
    lower.includes('$')
  ) {
    return {
      category: 'finance',
      specific_tags: ['money'],
      source: null,
    };
  }

  // Detect schedule
  if (
    lower.includes('meeting') ||
    lower.includes('jadwal') ||
    lower.includes('agenda') ||
    lower.includes('jam ') ||
    lower.includes('besok') ||
    lower.includes('hari ini') ||
    lower.includes('lusa') ||
    lower.includes('deadline') ||
    lower.includes('tanggal')
  ) {
    const tags: string[] = [];
    if (lower.includes('meeting')) tags.push('meeting');
    else if (lower.includes('deadline')) tags.push('deadline');

    // Check entity names (e.g., "dengan rina")
    const withMatch = lower.match(/(?:dengan|sama|with)\s+([a-z0-9_-]+)/);
    if (withMatch && withMatch[1]) {
      tags.push(normalizeTag(withMatch[1]));
    }

    if (tags.length === 0) tags.push('schedule');

    return {
      category: 'schedule',
      specific_tags: tags.slice(0, 2),
      source: null,
    };
  }

  // Detect todo
  if (
    lower.startsWith('todo') ||
    lower.startsWith('task') ||
    lower.includes('harus ') ||
    lower.includes('ingat ') ||
    lower.includes('kerjakan') ||
    lower.includes('fix ') ||
    lower.includes('revisi') ||
    lower.includes('update ') ||
    lower.includes('kirim ')
  ) {
    const tags: string[] = ['task'];
    if (lower.includes('landing-page') || lower.includes('landing page')) tags.push('landing-page');
    else if (lower.includes('web-agent') || lower.includes('web agent')) tags.push('web-agent');
    else if (lower.includes('onboarding')) tags.push('onboarding');

    const clientMatch = lower.match(/client\s+([a-z0-9_-]+)/);
    if (clientMatch && clientMatch[1]) {
      tags.push(normalizeTag(`client-${clientMatch[1]}`));
    }

    return {
      category: 'todo',
      specific_tags: tags.slice(0, 2),
      source: null,
    };
  }

  // Detect draft (long text or conceptual notes)
  if (
    text.length > 250 ||
    lower.includes('draft') ||
    lower.includes('draf') ||
    lower.includes('catatan hasil diskusi') ||
    lower.includes('rangkuman')
  ) {
    return {
      category: 'draft',
      specific_tags: [],
      source: null,
    };
  }

  // Detect random-yap (ideas, thoughts)
  if (
    lower.includes('ide ') ||
    lower.includes('idea') ||
    lower.includes('kepikiran') ||
    lower.includes('opini')
  ) {
    return {
      category: 'random-yap',
      specific_tags: ['idea'],
      source: null,
    };
  }

  // Detect reference
  if (
    lower.includes('referensi') ||
    lower.includes('rujukan') ||
    lower.includes('kutipan') ||
    lower.includes('source code') ||
    lower.includes('catatan penting')
  ) {
    return {
      category: 'reference',
      specific_tags: ['reference'],
      source: null,
    };
  }

  // Default
  return {
    category: 'others',
    specific_tags: [],
    source: null,
  };
}

/**
 * Generate structured note tags using Vercel AI SDK with heuristic fallback.
 */
export async function generateNoteTags(content: string): Promise<NoteTagResult> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.AI_MODEL_NAME || 'gpt-4o-mini';

  // If no realistic API key is provided, use heuristic directly
  if (!apiKey || apiKey === 'sk-xxxx' || apiKey.startsWith('mock-')) {
    return heuristicTagNote(content);
  }

  try {
    const openaiCompatible = createOpenAICompatible({
      name: 'openai-compatible',
      baseURL: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const systemPrompt = `You are an automated categorization assistant for UnlazyNotes, an ultra-fast note-taking system.
Your job is to analyze user notes (frequently written in Indonesian or English) and classify them accurately.

CATEGORIES (Select exactly 1):
- random-yap: Spontaneous ideas, shower thoughts, raw reflections, musings, rants.
- draft: Long articles, detailed meeting notes, scripts, essays, thread drafts (usually >150 chars or multi-paragraph).
- bookmark: URLs, links to read/watch later.
- todo: Tasks to do, actionable items, checklists, reminders to take action (e.g., 'ingat beli susu', 'kirim email ke klien').
- schedule: Meetings, dated agendas, appointments, deadlines with times/dates (e.g., 'meeting jam 2 siang besok').
- finance: Expenses, income, purchases, prices, bills, bank transfers, money records (e.g., 'beli kopi 25rb', 'tagihan wifi 350k').
- credential: Passwords, tokens, PINs, Wi-Fi keys, server credentials.
- reference: Snippets, quotes, documentation, factual reference data, lookup tables.
- others: Miscellaneous notes that don't fit any category above.

SPECIFIC TAGS (0 to 2 tags):
- Extract specific keywords, project names, brand/place names, person names, or core topics.
- Examples: 'kopi-kenangan', 'rina', 'astro', 'deepseek', 'deploy', 'kantor'.
- Format: lowercase-with-hyphens.
- Do NOT output generic tags that just repeat the category name (e.g., don't use 'money', 'task', 'note', 'schedule').

Source Rules:
- If note contains a URL, identify source: youtube, instagram, twitter, tiktok, github, article, or similar.
- If no URL, return null for source.`;

    const result = await generateObject({
      model: openaiCompatible(modelName),
      schema: NoteTagResultSchema,
      system: systemPrompt,
      prompt: `Analyze and tag this note:\n"""\n${content}\n"""`,
    });

    const parsed = result.object;
    return {
      category: parsed.category,
      specific_tags: parsed.specific_tags.map(normalizeTag).filter(Boolean).slice(0, 2),
      source: parsed.source ? normalizeTag(parsed.source) : null,
    };
  } catch (err) {
    console.warn('[AI] Error in LLM categorization, falling back to heuristic:', err);
    return heuristicTagNote(content);
  }
}
