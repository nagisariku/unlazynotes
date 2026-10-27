import { recordAiUsage } from '@/lib/ai-usage';
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { TodoEntry } from '../../../db/schema';
import crypto from 'node:crypto';

export type { TodoEntry };

/**
 * Pure AI-powered to-do item extraction pipeline.
 * Extracts atomic actionable checklist tasks from note content.
 * 100% Pure LLM processing. Zero regex / heuristic fallbacks.
 */
export async function extractTodoEntries(
  content: string,
  modelName: string = process.env.AI_MODEL_NAME || process.env.COSMOSHUB_MODEL || 'gemini-3.8-flash'
): Promise<TodoEntry[]> {
  const text = content.trim();
  if (!text) return [];

  const apiKey = process.env.AI_PROVIDER_API_KEY || process.env.COSMOSHUB_API_KEY;
  const baseURL = process.env.AI_BASE_URL || process.env.COSMOSHUB_BASE_URL || 'https://api.cosmoshub.tech/v1';

  if (!apiKey || apiKey === 'sk-xxxx' || apiKey.startsWith('mock-')) {
    throw new Error('[Todo] AI Provider API key not configured');
  }

  const openaiCompatible = createOpenAICompatible({
    name: 'cosmoshub',
    baseURL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const result = await generateText({
    model: openaiCompatible(modelName),
    temperature: 0,
    system: `You are an automated to-do checklist extractor for UnlazyNotes.
Analyze the user's note and break down all actionable tasks, errands, shopping items, chores, or reminders into a clean array of independent items.

Rules:
- Break down compound sentences or multi-item notes into separate atomic tasks (e.g., "beli beras 5kg, telur 1kg, bayar tagihan wifi" -> 3 distinct tasks).
- Preserve specific details (quantities, names, targets) in the task text.
- Determine completion status ("isCompleted"):
  - Default to false.
  - Set to true ONLY if the text explicitly states it has already been finished (e.g. "[x]", "(sudah)", "selesai", "done", "tadi udah dibeli").
- Return strict JSON array ONLY:
[
  {
    "task": string,
    "isCompleted": boolean
  }
]`,
    prompt: `Extract actionable to-do checklist items as JSON from:\n"""${text}"""`,
  });

  await recordAiUsage({
    feature: 'todo',
    model: modelName,
    usage: result.usage,
  });

  let rawJson = result.text.trim();
  const match = rawJson.match(/\[[\s\S]*\]/);
  if (match) rawJson = match[0];

  const parsed = JSON.parse(rawJson);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item: any) => typeof item.task === 'string' && item.task.trim().length > 0)
    .map((item: any) => ({
      id: crypto.randomUUID(),
      task: String(item.task).trim(),
      isCompleted: Boolean(item.isCompleted),
      completedAt: item.isCompleted ? new Date().toISOString() : null,
    }));
}
