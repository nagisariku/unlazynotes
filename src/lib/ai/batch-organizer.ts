import { db } from '../../db';
import { notes, type NoteCategory } from '../../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { heuristicTagNote } from '../ai';
import { sanitizeTags } from './sanitizer';
import { detectLocalCredential } from './credential-detector';
import { getOrFetchUserTags, invalidateUserTagsCache, resetUnorganizedCount } from '../cache';

export interface OrganizedNoteItem {
  id: string;
  content: string;
  category: NoteCategory;
  specificTags: string[];
}

export interface OrganizedBatchResult {
  total: number;
  categorized: Record<string, OrganizedNoteItem[]>;
  items: OrganizedNoteItem[];
}

const VALID_CATEGORIES: NoteCategory[] = [
  'todo',
  'finance',
  'schedule',
  'draft',
  'reference',
  'bookmark',
  'random-yap',
  'credential',
  'others',
];

const CHUNK_SIZE = 12; // Safeguard chunking 10-15 catatan per panggilan API

/**
 * Memproses seluruh catatan is_processed = false milik pengguna secara batch
 */
export async function organizeUserNotes(userId: string): Promise<OrganizedBatchResult> {
  // 1. Ambil seluruh catatan unorganized user terurut kronologis
  const unorganizedNotes = await db.query.notes.findMany({
    where: and(eq(notes.userId, userId), eq(notes.isProcessed, false)),
    orderBy: [asc(notes.createdAt)],
  });

  if (!unorganizedNotes || unorganizedNotes.length === 0) {
    resetUnorganizedCount(userId);
    return {
      total: 0,
      categorized: {},
      items: [],
    };
  }

  const existingUserTags = await getOrFetchUserTags(userId);
  const organizedItems: OrganizedNoteItem[] = [];

  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.AI_MODEL_NAME || 'claude-haiku-5.5';
  const baseURL = process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1';

  // 2. Chunking Safeguard: Proses catatan dalam chunk maksimal 12 catatan
  for (let i = 0; i < unorganizedNotes.length; i += CHUNK_SIZE) {
    const chunk = unorganizedNotes.slice(i, i + CHUNK_SIZE);
    const chunkProcessed: OrganizedNoteItem[] = [];
    const notesForLLM: typeof chunk = [];

    // Local Privacy Shield & Fast-Path: deteksi kredensial dan URL bookmark secara instan
    for (const note of chunk) {
      const credCheck = detectLocalCredential(note.content);
      if (credCheck.isCredential) {
        chunkProcessed.push({
          id: note.id,
          content: note.content,
          category: 'credential',
          specificTags: credCheck.tags,
        });
      } else if (/(https?:\/\/[^\s]+)/i.test(note.content)) {
        const res = heuristicTagNote(note.content, existingUserTags);
        chunkProcessed.push({
          id: note.id,
          content: note.content,
          category: 'bookmark',
          specificTags: res.specific_tags || ['bookmark'],
        });
      } else {
        notesForLLM.push(note);
      }
    }

    // Jika ada catatan yang perlu dikirim ke LLM
    if (notesForLLM.length > 0) {
      if (!apiKey || apiKey === 'sk-xxxx' || apiKey.startsWith('mock-')) {
        // Fallback Heuristic Offline
        for (const note of notesForLLM) {
          const hasAttachments = note.attachments && Array.isArray(note.attachments) && note.attachments.length > 0;
          const contentText = hasAttachments
            ? `[Catatan ini memiliki lampiran gambar/file]\n${note.content}`
            : note.content;
          const res = heuristicTagNote(contentText, existingUserTags);
          chunkProcessed.push({
            id: note.id,
            content: note.content,
            category: (VALID_CATEGORIES.includes(res.category as NoteCategory)
              ? res.category
              : 'others') as NoteCategory,
            specificTags: res.specific_tags || [],
          });
        }
      } else {
        // Panggil Claude Haiku 5.5 secara batch
        try {
          const openaiCompatible = createOpenAICompatible({
            name: 'cosmoshub',
            baseURL,
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          });

          const userTagContext =
            existingUserTags && existingUserTags.length > 0
              ? `\nUSER EXISTING TAG MEMORY (Prioritize reusing these tags over inventing new synonyms):\n${JSON.stringify(
                  existingUserTags.slice(0, 30)
                )}\n`
              : '';

          const payload = notesForLLM.map((n) => {
            const hasAttachments = n.attachments && Array.isArray(n.attachments) && n.attachments.length > 0;
            const contentText = hasAttachments
              ? `[Catatan ini memiliki lampiran gambar/file]\n${n.content}`
              : n.content;
            return {
              id: n.id,
              content: contentText,
            };
          });

          const response = await generateText({
            model: openaiCompatible(modelName),
            temperature: 0,
            maxTokens: 1500,
            abortSignal: AbortSignal.timeout(20000),
            system: `You are an intelligent batch semantic classifier and tagging engine for UnlazyNotes.
Analyze the user's batch of notes and return a strict JSON Array of objects with:
1. "id": the exact note id provided.
2. "category": exactly 1 primary intent category from:
   - "todo": actionable tasks, dev instructions, orders, follow-ups, shopping items.
   - "finance": cash flow transactions with explicit price/amount (purchases, expenses, debt/loan).
   - "schedule": events bound to calendar date or specific clock time.
   - "draft": long structured documents, SaaS specs, articles, markdown essays (>200 chars).
   - "reference": static references, holy scriptures (Quran, hadith), quotes, recipes, code snippets.
   - "bookmark": URL links (saved websites, youtube, medium articles).
   - "random-yap": casual musings, rants, shower thoughts without actionable tasks.
   - "credential": passwords, account credentials, ATM PINs, bank accounts, API keys.
   - "others": workout logs, raw ideas, health symptoms.
3. "specific_tags": 2 to 4 domain-aware tags (lowercase-with-hyphens).
   HIERARCHY: specific_tags[0] MUST BE the Main Tag (domain umbrella / main topic). specific_tags[1..] are specific entities, details, and contexts.
${userTagContext}
Formatting:
- Return ONLY valid JSON array: [{"id": "...", "category": "...", "specific_tags": [...]}]
- No conversational prose or explanations.`,
            prompt: `Classify these notes:\n${JSON.stringify(payload)}`,
          });

          let rawJson = response.text.trim();
          const match = rawJson.match(/\[[\s\S]*\]/);
          if (match) {
            rawJson = match[0];
          }

          let parsedList: any[] = [];
          try {
            parsedList = JSON.parse(rawJson);
          } catch {
            console.warn('[Batch AI] JSON parse failed, falling back to heuristic for chunk:', rawJson);
            parsedList = [];
          }

          const parsedMap = new Map<string, any>();
          if (Array.isArray(parsedList)) {
            for (const item of parsedList) {
              if (item && item.id) parsedMap.set(item.id, item);
            }
          }

          for (const note of notesForLLM) {
            const aiItem = parsedMap.get(note.id);
            if (aiItem && aiItem.category) {
              const rawCat = String(aiItem.category).toLowerCase().trim() as NoteCategory;
              const cat = VALID_CATEGORIES.includes(rawCat) ? rawCat : 'others';
              const rawTags = Array.isArray(aiItem.specific_tags)
                ? aiItem.specific_tags
                : Array.isArray(aiItem.tags)
                ? aiItem.tags
                : [];
              const cleanTags = sanitizeTags(rawTags, cat, note.content, 5, existingUserTags);

              chunkProcessed.push({
                id: note.id,
                content: note.content,
                category: cat,
                specificTags: cleanTags,
              });
            } else {
              // Fallback heuristic jika per-note gagal diparse
              const res = heuristicTagNote(note.content, existingUserTags);
              chunkProcessed.push({
                id: note.id,
                content: note.content,
                category: (VALID_CATEGORIES.includes(res.category as NoteCategory)
                  ? res.category
                  : 'others') as NoteCategory,
                specificTags: res.specific_tags || [],
              });
            }
          }
        } catch (err) {
          console.warn('[Batch AI] Error in batch LLM call, falling back to heuristic for chunk:', err);
          for (const note of notesForLLM) {
            const res = heuristicTagNote(note.content, existingUserTags);
            chunkProcessed.push({
              id: note.id,
              content: note.content,
              category: (VALID_CATEGORIES.includes(res.category as NoteCategory)
                ? res.category
                : 'others') as NoteCategory,
              specificTags: res.specific_tags || [],
            });
          }
        }
      }
    }

    // 4. Bulk Update Database untuk setiap catatan dalam chunk
    for (const item of chunkProcessed) {
      await db
        .update(notes)
        .set({
          isProcessed: true,
          category: item.category,
          specificTags: item.specificTags,
        })
        .where(eq(notes.id, item.id));

      organizedItems.push(item);
    }
  }

  // 5. Invalidasi cache tag user dan reset unorganized counter ke 0
  invalidateUserTagsCache(userId);
  resetUnorganizedCount(userId);

  // 6. Kelompokkan per kategori untuk kemudahan ringkasan
  const categorized: Record<string, OrganizedNoteItem[]> = {};
  for (const item of organizedItems) {
    if (!categorized[item.category]) {
      categorized[item.category] = [];
    }
    categorized[item.category].push(item);
  }

  return {
    total: organizedItems.length,
    categorized,
    items: organizedItems,
  };
}

/**
 * Format ringkasan estetik Telegram (Single Recapitulation Message)
 */
export function formatOrganizedSummary(result: OrganizedBatchResult): string {
  if (result.total === 0) {
    return 'Semua catatan sudah rapi! Belum ada catatan baru untuk dirapikan.';
  }

  const categoryMeta: Record<string, { emoji: string; title: string }> = {
    todo: { emoji: '📁', title: 'Todo' },
    finance: { emoji: '💰', title: 'Finance' },
    schedule: { emoji: '📅', title: 'Schedule' },
    draft: { emoji: '📝', title: 'Draft' },
    bookmark: { emoji: '🔖', title: 'Bookmark' },
    credential: { emoji: '🔐', title: 'Credential' },
    reference: { emoji: '📚', title: 'Reference' },
    'random-yap': { emoji: '💭', title: 'Random Yap' },
    others: { emoji: '📦', title: 'Others' },
  };

  const lines: string[] = [];
  lines.push(`🪄 *${result.total} Catatan Berhasil Dirapikan!*\n`);

  for (const [catKey, meta] of Object.entries(categoryMeta)) {
    const items = result.categorized[catKey];
    if (!items || items.length === 0) continue;

    lines.push(`${meta.emoji} *${meta.title} (${items.length})*`);
    for (const item of items) {
      const cleanContent = item.content.replace(/[\r\n\t]+/g, ' ').replace(/`/g, "'").trim();
      const preview = cleanContent.length > 36 ? cleanContent.slice(0, 36) + '...' : cleanContent;

      const tagsStr =
        item.specificTags && item.specificTags.length > 0
          ? ' — ' + item.specificTags.map((t) => `\`#${t}\``).join(' ')
          : '';

      lines.push(`• \`${preview}\`${tagsStr}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
