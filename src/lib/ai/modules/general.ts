import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { VALID_SOURCES, type Source } from '../../constants';
import { sanitizeTags } from '../sanitizer';
import { NoteTagResultSchema, type NoteTagResult } from '../types';

/**
 * Specialized General AI Module.
 * Uses robust text generation with JSON extraction to prevent parser errors
 * caused by markdown code fences (```json ... ```) from models like DeepSeek.
 */
export async function processGeneralNote(
  content: string,
  heuristicFallback: (text: string) => NoteTagResult
): Promise<NoteTagResult> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.AI_MODEL_NAME || 'deepseek-v4.1-flash';

  if (!apiKey || apiKey === 'sk-xxxx' || apiKey.startsWith('mock-')) {
    return heuristicFallback(content);
  }

  try {
    const openaiCompatible = createOpenAICompatible({
      name: 'cosmoshub',
      baseURL: process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const result = await generateText({
      model: openaiCompatible(modelName),
      system: `You are an expert taxonomy, classification, and entity extraction engine for UnlazyNotes.
Analyze the user's note and return a strict JSON object with fields:
- category: one of 'bookmark', 'todo', 'schedule', 'finance', 'credential', 'draft', 'reference', 'random-yap', 'others'.
- specific_tags: array of 1 to 3 lowercase single-word tags representing specific items, entities, topics, games, food, actions, or subjects.
- source: null or one of 'youtube', 'instagram', 'twitter', 'tiktok', 'github', 'article'.

CATEGORIES:
- bookmark: Notes primarily saving web URLs/links.
- todo: Action items, tasks, errands, checklists, things to prepare/buy/bring.
- schedule: Events with dates/times, meetings, reminders, deadlines, travel plans (e.g. 'bulan depan bromo').
- finance: Expenses, purchases, prices, bills, debts (utang), bank transfers, salary, gaming items.
- credential: Passwords, tokens, PINs, Wi-Fi keys, server access credentials.
- draft: Long articles, detailed meeting notes, essays (>150 chars or multi-paragraph).
- reference: Snippets, quotes, documentation, factual reference data, postal codes (kodepos).
- random-yap: Spontaneous thoughts, complaints, rants (labrak/kesal), raw reflections, musings.
- others: Miscellaneous notes that don't fit any category above.

TAGGING RULES:
1. Always extract 1 to 3 meaningful, specific single-word lowercase tags.
2. For finance/purchases: identify the specific item/context (e.g. 'skin', 'vandal', 'gaming', 'kosan', 'makan', 'bensin', 'utang', 'bill').
3. For travel/places: extract the specific location (e.g. 'dieng', 'bromo', 'ciater').
4. Avoid generic filler words like 'money', 'task', 'schedule', 'daily', 'general', 'text'.
5. Output ONLY a valid JSON object. No conversational prefix or suffix.`,
      prompt: `Analyze and tag this note:\n"""\n${content}\n"""`,
    });

    // Extract JSON block even if model wraps in markdown code fences (```json ... ```)
    let rawJson = result.text.trim();
    const match = rawJson.match(/\{[\s\S]*\}/);
    if (match) {
      rawJson = match[0];
    }

    const json = JSON.parse(rawJson);
    const parsed = NoteTagResultSchema.parse(json);
    const cleanTags = sanitizeTags(parsed.specific_tags, parsed.category, content, 3);

    let cleanSource: Source | null = null;
    if (parsed.source) {
      const s = parsed.source.toLowerCase().trim();
      if (VALID_SOURCES.includes(s as Source)) {
        cleanSource = s as Source;
      }
    }

    return {
      category: parsed.category,
      specific_tags: cleanTags,
      source: cleanSource,
    };
  } catch (err) {
    console.warn('[AI] Error in processGeneralNote LLM, using heuristic fallback:', err);
    return heuristicFallback(content);
  }
}
