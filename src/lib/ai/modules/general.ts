import { generateObject } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { VALID_SOURCES, type Source } from '../../constants';
import { sanitizeTags } from '../sanitizer';
import { NoteTagResultSchema, type NoteTagResult } from '../types';

/**
 * Specialized General AI Module.
 * Handles notes that require LLM reasoning (schedule, draft, reference, random-yap, others)
 * with strict single-word rules and conservative anti-guessing taxonomy.
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

    const result = await generateObject({
      model: openaiCompatible(modelName),
      schema: NoteTagResultSchema,
      system: `You are an expert taxonomy and categorization engine for UnlazyNotes.
Analyze the user's note and output structured category, specific_tags, and source.

CATEGORIES (pick exactly one):
- bookmark: Any note containing a web URL (link).
- todo: Action items, tasks, checklists, things that need to be done.
- schedule: Events with dates/times, meetings, reminders, deadlines.
- finance: Expenses, income, purchases, prices, bills, bank transfers.
- credential: Passwords, tokens, PINs, Wi-Fi keys, server credentials.
- draft: Long articles, detailed meeting notes, essays (>150 chars or multi-paragraph).
- reference: Snippets, quotes, documentation, factual reference data.
- random-yap: Spontaneous ideas, shower thoughts, raw reflections, musings, rants.
- others: Miscellaneous notes that don't fit any category above.

SOURCE RULES:
- If note contains a URL, set source to one of: 'youtube', 'instagram', 'twitter', 'tiktok', 'github', or 'article'.
- If note does NOT contain a URL, source MUST BE null (do NOT output 'others', 'text', or any string).

==================================================
STRICT SINGLE-WORD & ANTI-GUESSING RULES:
==================================================
1. SPECIFIC TAGS MUST BE STRICTLY ONE SINGLE WORD (0 to 2 tags max).
   - Hyphenated compound words are FORBIDDEN (e.g. 'saas-ideas' -> 'saas', 'software-project' -> 'software', 'team-meeting' -> 'meeting').
   - Single words only: 'meeting', 'work', 'study', 'exam', 'dev', 'idea', 'saas'.

2. ANTI-GUESSING (Conservative Tagging):
   - If the note has noise, slang, or you are NOT confident about specific context, do NOT invent or guess micro-tags.
   - Return empty array [] or a broad single-word cluster (e.g. ['meeting'], ['work'], ['idea']).
   - Never extract ephemeral parameters, dates, or prices ('15k', '60k', 'besok', '14.00').

3. BANNED TAGS (Strictly Forbidden):
   - Never repeat the category name (e.g. no 'bookmark', 'todo', 'schedule', 'finance', 'note').
   - Never use generic filler words ('read-later', 'money', 'task', 'spending', 'daily', 'general', 'text').

FEW-SHOT EXAMPLES:
Input: "meeting sprint planning tim backend besok jam 14.00"
Output: {"category": "schedule", "specific_tags": ["meeting", "work"], "source": null}

Input: "ide bikin bot telegram otomatis kirim rekap mingguan"
Output: {"category": "random-yap", "specific_tags": ["idea", "bot"], "source": null}

Input: "arsitektur clean code memisahkan domain layer dan data layer"
Output: {"category": "reference", "specific_tags": ["architecture"], "source": null}

Input: "belajar rekursif, ujian minggu depan"
Output: {"category": "todo", "specific_tags": ["study", "exam"], "source": null}`,
      prompt: `Analyze and tag this note:\n"""\n${content}\n"""`,
    });

    const parsed = result.object;
    const cleanTags = sanitizeTags(parsed.specific_tags, parsed.category, content);

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
