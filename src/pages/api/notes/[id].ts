import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes, type NoteCategory, type ScheduleMetadata, type ExpenseEntry, type IncomeEntry, type DebtEntry, type BookmarkType, type CredentialType, type TodoEntry } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { CATEGORIES } from '@/lib/constants';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { extractFinanceEntries, extractTodoEntries, extractScheduleEntries, safeExtractTargetDate } from '@/lib/ai';
import { enrichNoteBookmarkAsync } from '@/lib/link-enricher';
import { normalizeBookmarkType, normalizeCredentialType } from '@/lib/ai/modules/general';
import crypto from 'node:crypto';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing note ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
    .limit(1);

  if (!note) {
    return new Response(JSON.stringify({ error: 'Note not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      note: {
        id: note.id,
        content: note.isEncrypted ? decryptSecret(note.content, user.id) : note.content,
        category: note.category,
        specificTags: note.specificTags,
        source: note.source,
        isEncrypted: note.isEncrypted,
        vaultKey: note.vaultKey,
        isPinned: note.isPinned,
        isProcessed: note.isProcessed,
        targetDate: note.targetDate instanceof Date && !isNaN(note.targetDate.getTime()) ? note.targetDate.toISOString() : (typeof note.targetDate === 'string' ? note.targetDate : null),
        scheduleDates: note.scheduleDates,
        schedule: note.schedule,
        expenses: note.expenses,
        income: note.income,
        debt: note.debt,
        todos: note.todos,
        attachments: note.attachments,
        createdAt: note.createdAt.toISOString(),
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing note ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
    .limit(1);

  if (!existing) {
    return new Response(JSON.stringify({ error: 'Note not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await db.delete(notes).where(eq(notes.id, id));

  return new Response(JSON.stringify({ success: true, deletedId: id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing note ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
    .limit(1);

  if (!existing) {
    return new Response(JSON.stringify({ error: 'Note not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { content, category, specificTags, targetDate, attachments, isPinned, isProcessed, vaultKey } = body;

    const updates: Partial<{
      content: string;
      category: NoteCategory;
      specificTags: string[];
      isPinned: boolean;
      isProcessed: boolean;
      targetDate: Date | null;
      attachments: any;
      vaultKey: string | null;
      scheduleDates: string[];
      schedule: ScheduleMetadata;
      expenses: ExpenseEntry[];
      income: IncomeEntry[];
      debt: DebtEntry[];
      todos: TodoEntry[];
      bookmarkType: BookmarkType | null;
      credentialType: CredentialType | null;
    }> = {};

    if (vaultKey !== undefined) {
      updates.vaultKey = vaultKey ? String(vaultKey).trim() : null;
    }

    if (isPinned !== undefined) {
      updates.isPinned = Boolean(isPinned);
    }

    if (content !== undefined) {
      if (typeof content !== 'string' || !content.trim()) {
        return new Response(JSON.stringify({ error: 'Konten tidak boleh kosong' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updates.content = existing.isEncrypted
        ? encryptSecret(content.trim(), user.id)
        : content.trim();
    }

    if (category !== undefined) {
      if (!CATEGORIES.includes(category as NoteCategory)) {
        return new Response(JSON.stringify({ error: 'Kategori tidak valid' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updates.category = category as NoteCategory;
    }

    if (specificTags !== undefined) {
      if (!Array.isArray(specificTags)) {
        return new Response(JSON.stringify({ error: 'specificTags harus berupa array string' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const sanitized = specificTags
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20))
        .filter(Boolean);
      updates.specificTags = Array.from(new Set(sanitized));
    }

    if (targetDate !== undefined) {
      if (targetDate === null || targetDate === '') {
        updates.targetDate = null;
      } else {
        const parsed = new Date(targetDate);
        if (!isNaN(parsed.getTime())) {
          updates.targetDate = parsed;
        }
      }
    }

    const clientTz = request.headers.get('x-user-timezone') || user.timezone;

    if (!updates.targetDate && !existing.targetDate && updates.scheduleDates && updates.scheduleDates.length > 0) {
      const parsed = safeExtractTargetDate(updates.scheduleDates[0], undefined, clientTz);
      if (parsed) updates.targetDate = parsed;
    }

    if (attachments !== undefined) {
      if (Array.isArray(attachments)) {
        updates.attachments = attachments;
      }
    }

    if (body.schedule !== undefined && typeof body.schedule === 'object') {
      const dates = Array.isArray(body.schedule.dates)
        ? body.schedule.dates.map(String).filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        : [];
      updates.schedule = {
        dates,
        isRecurring: Boolean(body.schedule.isRecurring),
        recurrenceRule: body.schedule.recurrenceRule,
      };
      updates.scheduleDates = dates;
    } else if (body.scheduleDates !== undefined && Array.isArray(body.scheduleDates)) {
      const dates = body.scheduleDates.map(String).filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d));
      updates.scheduleDates = dates;
      updates.schedule = {
        dates,
        isRecurring: false,
      };
    }

    if (category === 'schedule' && body.schedule === undefined && body.scheduleDates === undefined) {
      const textToInspect = content !== undefined ? content : (existing.isEncrypted ? decryptSecret(existing.content, user.id) : existing.content);
      try {
        const sched = await extractScheduleEntries(textToInspect, new Date(), undefined, clientTz);
        updates.schedule = sched.schedule;
        updates.scheduleDates = sched.scheduleDates;
        if (!updates.targetDate && !existing.targetDate) {
          updates.targetDate = sched.targetDate;
        }
      } catch (err) {
        console.warn('[Schedule Update Extraction Error]:', err);
      }
    }

    if (body.expenses !== undefined && Array.isArray(body.expenses)) {
      updates.expenses = body.expenses.map((e: any) => ({
        item: String(e.item || 'Pengeluaran').trim(),
        amount: Number(e.amount) || 0,
        currency: e.currency || 'IDR',
      }));
    }

    if (body.income !== undefined && Array.isArray(body.income)) {
      updates.income = body.income.map((i: any) => ({
        source: String(i.source || 'Pemasukan').trim(),
        amount: Number(i.amount) || 0,
        currency: i.currency || 'IDR',
      }));
    }

    if (body.debt !== undefined && Array.isArray(body.debt)) {
      updates.debt = body.debt.map((d: any) => ({
        type: d.type === 'payable' ? 'payable' : 'receivable',
        person: String(d.person || 'Seseorang').trim(),
        amount: Number(d.amount) || 0,
        notes: d.notes ? String(d.notes) : undefined,
        isSettled: Boolean(d.isSettled || false),
      }));
    }

    if (body.todos !== undefined && Array.isArray(body.todos)) {
      updates.todos = body.todos
        .map((t: any) => ({
          id: String(t.id || crypto.randomUUID()),
          task: String(t.task || t.title || '').trim(),
          isCompleted: Boolean(t.isCompleted),
          completedAt: t.completedAt ? String(t.completedAt) : t.isCompleted ? new Date().toISOString() : null,
          priority: t.priority && ['low', 'normal', 'high'].includes(t.priority) ? t.priority : null,
        }))
        .filter((t: any) => t.task.length > 0);
    }

    if (body.bookmarkType !== undefined) {
      updates.bookmarkType = body.bookmarkType ? normalizeBookmarkType(body.bookmarkType) : null;
    }

    if (body.credentialType !== undefined) {
      updates.credentialType = body.credentialType ? normalizeCredentialType(body.credentialType) : null;
    }

    // 0-Token Lightweight Settlement Toggle
    if (body.debtIndex !== undefined && typeof body.isSettled === 'boolean') {
      const currentDebt = Array.isArray(existing.debt) ? [...existing.debt] : [];
      if (currentDebt[body.debtIndex]) {
        currentDebt[body.debtIndex] = {
          ...currentDebt[body.debtIndex],
          isSettled: body.isSettled,
        };
        updates.debt = currentDebt;
      }
    }

    // 0-Token Lightweight To-Do Completion / Priority Toggle
    if (body.todoId !== undefined) {
      const currentTodos = Array.isArray(existing.todos) ? [...existing.todos] : [];
      let idx = currentTodos.findIndex((t: any) => t.id === body.todoId);
      if (idx === -1 && (body.todoId === 'default' || currentTodos.length === 0)) {
        currentTodos.push({
          id: crypto.randomUUID(),
          task: existing.content,
          isCompleted: false,
          completedAt: null,
          priority: null,
        });
        idx = currentTodos.length - 1;
      }
      if (idx !== -1 && currentTodos[idx]) {
        if (typeof body.isCompleted === 'boolean') {
          currentTodos[idx] = {
            ...currentTodos[idx],
            isCompleted: body.isCompleted,
            completedAt: body.isCompleted ? new Date().toISOString() : null,
          };
        }
        if (body.priority !== undefined) {
          const validPriority = ['low', 'normal', 'high'].includes(body.priority) ? body.priority : null;
          currentTodos[idx] = {
            ...currentTodos[idx],
            priority: validPriority,
          };
        }
        updates.todos = currentTodos;
      }
    } else if (body.todoIndex !== undefined) {
      const currentTodos = Array.isArray(existing.todos) ? [...existing.todos] : [];
      if (currentTodos.length === 0 && body.todoIndex === 0) {
        currentTodos.push({
          id: crypto.randomUUID(),
          task: existing.content,
          isCompleted: false,
          completedAt: null,
          priority: null,
        });
      }
      if (currentTodos[body.todoIndex]) {
        if (typeof body.isCompleted === 'boolean') {
          currentTodos[body.todoIndex] = {
            ...currentTodos[body.todoIndex],
            isCompleted: body.isCompleted,
            completedAt: body.isCompleted ? new Date().toISOString() : null,
          };
        }
        if (body.priority !== undefined) {
          const validPriority = ['low', 'normal', 'high'].includes(body.priority) ? body.priority : null;
          currentTodos[body.todoIndex] = {
            ...currentTodos[body.todoIndex],
            priority: validPriority,
          };
        }
        updates.todos = currentTodos;
      }
    }

    // 1. Pembersihan Metadata jika beralih KELUAR dari finance atau todo
    if (updates.category && updates.category !== 'finance' && existing.category === 'finance') {
      if (body.expenses === undefined) updates.expenses = [];
      if (body.income === undefined) updates.income = [];
      if (body.debt === undefined) updates.debt = [];
    }
    if (updates.category && updates.category !== 'todo' && existing.category === 'todo') {
      if (body.todos === undefined) updates.todos = [];
    }

    // 2. Ekstraksi Sinkron (await) via LLM jika kategori finance dan konten berubah, atau baru beralih ke finance
    const effectiveCategory = updates.category || existing.category;
    const existingCleanContent = existing.isEncrypted
      ? decryptSecret(existing.content, user.id)
      : existing.content;
    const isContentChanged = content !== undefined && content.trim() !== existingCleanContent;

    if (
      effectiveCategory === 'finance' &&
      (isContentChanged || (updates.category === 'finance' && existing.category !== 'finance')) &&
      body.expenses === undefined &&
      body.income === undefined &&
      body.debt === undefined
    ) {
      const targetText = content !== undefined ? content.trim() : existingCleanContent;
      try {
        const fin = await extractFinanceEntries(targetText);
        updates.expenses = fin.expenses;
        updates.income = fin.income;
        updates.debt = fin.debt;
      } catch (err) {
        console.warn('[Finance Re-extract Error]:', err);
      }
    }

    // 2b. Ekstraksi Sinkron via LLM jika kategori todo dan konten berubah, atau baru beralih ke todo
    if (
      effectiveCategory === 'todo' &&
      (isContentChanged || (updates.category === 'todo' && existing.category !== 'todo')) &&
      body.todos === undefined &&
      body.todoId === undefined &&
      body.todoIndex === undefined
    ) {
      const targetText = content !== undefined ? content.trim() : existingCleanContent;
      try {
        const extractedTodos = await extractTodoEntries(targetText);

        // Smart reconciliation with existing.todos:
        // Preserves completion state, completed timestamp, and user-assigned priority
        const existingTodos: TodoEntry[] = Array.isArray(existing.todos) ? existing.todos : [];
        const matchedOldIds = new Set<string>();

        const mergedTodos: TodoEntry[] = extractedTodos.map((newTodo) => {
          const newNormalized = newTodo.task.trim().toLowerCase();

          // Priority 1: Exact task match
          let match = existingTodos.find(
            (old) => !matchedOldIds.has(old.id) && old.task.trim().toLowerCase() === newNormalized
          );

          // Priority 2: Substring / minor phrasing match for small edits
          if (!match) {
            match = existingTodos.find(
              (old) =>
                !matchedOldIds.has(old.id) &&
                ((old.task.trim().toLowerCase().length >= 4 && newNormalized.includes(old.task.trim().toLowerCase())) ||
                 (newNormalized.length >= 4 && old.task.trim().toLowerCase().includes(newNormalized)))
            );
          }

          if (match) {
            matchedOldIds.add(match.id);
            return {
              id: match.id,
              task: newTodo.task,
              isCompleted: newTodo.isCompleted || match.isCompleted,
              completedAt: newTodo.isCompleted && !match.isCompleted ? new Date().toISOString() : match.completedAt,
              priority: match.priority || null,
            };
          }

          return newTodo;
        });

        updates.todos = mergedTodos;
      } catch (err) {
        console.warn('[Todo Re-extract Error]:', err);
        // Fail-safe: Jangan timpa atau rusak existing.todos jika AI mengalami network error
        updates.todos = Array.isArray(existing.todos) && existing.todos.length > 0 ? existing.todos : [
          {
            id: crypto.randomUUID(),
            task: targetText,
            isCompleted: false,
            completedAt: null,
          },
        ];
      }
    }

    // 3. Otomatisasi Bookmark: Jika beralih ke bookmark atau konten link berubah, jalankan background enrichment
    if (
      effectiveCategory === 'bookmark' &&
      (updates.category === 'bookmark' || isContentChanged) &&
      /(https?:\/\/[^\s]+)/i.test(content !== undefined ? content : existingCleanContent)
    ) {
      enrichNoteBookmarkAsync(id, content !== undefined ? content : existingCleanContent).catch((err) => {
        console.warn('[Background Bookmark Re-enrich Error]:', err);
      });
    }

    // Human Intent Trumps AI: Any explicit edit from web locks the note from future AI batch sync overwrites
    updates.isProcessed = true;

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'Tidak ada perubahan yang diberikan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [updated] = await db
      .update(notes)
      .set(updates)
      .where(eq(notes.id, id))
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        note: {
          id: updated.id,
          content: content !== undefined ? content.trim() : (existing.isEncrypted ? decryptSecret(updated.content, user.id) : updated.content),
          vaultKey: updated.vaultKey,
          isPinned: updated.isPinned,
          category: updated.category,
          specificTags: updated.specificTags,
          source: updated.source,
          isProcessed: updated.isProcessed,
          targetDate: updated.targetDate instanceof Date && !isNaN(updated.targetDate.getTime()) ? updated.targetDate.toISOString() : (typeof updated.targetDate === 'string' ? updated.targetDate : null),
          scheduleDates: updated.scheduleDates,
          schedule: updated.schedule,
          expenses: updated.expenses,
          income: updated.income,
          debt: updated.debt,
          todos: updated.todos,
          bookmarkType: updated.bookmarkType,
          credentialType: updated.credentialType,
          attachments: updated.attachments,
          createdAt: updated.createdAt.toISOString(),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[PATCH /api/notes/:id] Error updating note:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = PATCH;

