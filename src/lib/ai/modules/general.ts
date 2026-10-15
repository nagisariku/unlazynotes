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
      system: `You are a strict JSON API backend for UnlazyNotes that classifies notes into standard categories and broad, reusable umbrella tags (topik payung).
You must output ONLY a valid JSON object. No explanations, no markdown, no conversational commentary.

CATEGORIES:
- bookmark: Saves web links/URLs.
- todo: Action items, tasks, checklists.
- schedule: Events, dates, meetings, travel/trip plans.
- finance: Expenses, purchases, bills, debt (utang), income.
- credential: Passwords, tokens, Wi-Fi keys, server credentials.
- draft: Long essays, articles (>150 chars).
- reference: Snippets, recipes, quotes, postal codes.
- random-yap: Spontaneous thoughts, rants, emotional venting.
- others: Miscellaneous.

TAG RULES:
1. Output 0 to 2 broad, reusable lowercase single-word tags (topik payung).
2. NEVER extract literal item/product names ('skin', 'vandal', 'indomie'), person names ('righty', 'ubed'), city/mountain names ('bromo', 'dieng', 'bali'), dates/temporal words ('mingdep', 'besok', 'lusa'), or prices ('15k', '250k').
3. Examples of broad umbrella tags:
   - Games/skins -> ["expenses", "gaming"]
   - Food/meals -> ["expenses", "food"]
   - Transport/fuel -> ["expenses", "transport"]
   - Bills/ISP -> ["bill"]
   - Debt/borrowing -> ["expenses", "debt"]
   - Salary -> ["income"]
   - Trips/vacation -> ["travel"]
   - Meetings -> ["meeting", "work"]
   - Exams -> ["exam"]
   - Recipes -> ["recipe"]
   - Venting/curhat -> ["rant"]
   - Ideas -> ["idea"]

JSON FORMAT:
{"category": "finance", "specific_tags": ["bill"], "source": null}`,
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
    const cleanTags = sanitizeTags(parsed.specific_tags, parsed.category, content, 2);

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
