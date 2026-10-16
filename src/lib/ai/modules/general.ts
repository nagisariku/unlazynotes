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
      temperature: 0,
      system: `You are an intelligent tagging engine for UnlazyNotes.
Analyze the user's note and return a strict JSON object with:
1. "category": exactly 1 category.
2. "specific_tags": 1 to 3 meaningful keyword tags (lowercase-with-hyphens).

CATEGORIES & INTENT PRIORITY:
- todo: Checklists, action items, tasks, wishlists, or multi-line plans WITHOUT prices/costs (e.g. "belanja bulanan tokma\\nhiling dieng\\npilates" -> category: "todo").
- finance: Actual money transactions, expenses, bills, income WITH price/amount or payment intent (e.g. "bayar wifi 300k", "tfr 50rb nasgor", "gaji cair").
- schedule: Specific dates, meetings, appointments, deadlines with temporal markers (e.g. "meeting bsk jam 2", "deadline tugas 18 okt").
- bookmark: URLs / links.
- credential: Passwords, tokens, pins, wifi keys.
- draft: Long structured text, minutes of meeting (>150 chars).
- reference: Snippets, recipes, quotes, documentation.
- random-yap: Spontaneous shower thoughts, rants, musings.
- others: Miscellaneous.

SPECIFIC TAG RULES:
1. Extract 1 to 3 specific keyword tags representing the core subject, place/destination, entity, brand, store, or activity (e.g. 'tokma', 'dieng', 'pilates', 'netflix', 'bca', 'indomie').
2. DO NOT output tags that merely repeat the category name (e.g. NEVER output 'todo', 'finance', 'expenses', 'task', 'money', 'schedule', 'note').
3. Keep tags lowercase, single-word or hyphenated, max 20 chars.

JSON FORMAT:
{"category": "todo", "specific_tags": ["tokma", "dieng", "pilates"], "source": null}`,
      prompt: `Classify this note and return JSON only:\n"""${content}"""`,
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
