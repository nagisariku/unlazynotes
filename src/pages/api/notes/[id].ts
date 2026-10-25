import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes, type NoteCategory, type ScheduleMetadata, type ExpenseEntry, type IncomeEntry, type DebtEntry, type BookmarkType, type CredentialType } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { CATEGORIES } from '@/lib/constants';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { extractEarliestScheduleDate } from '@/lib/date-extractor';
import { extractFinanceEntries } from '@/lib/ai';
import { normalizeBookmarkType, normalizeCredentialType } from '@/lib/ai/modules/general';

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
        targetDate: note.targetDate ? note.targetDate.toISOString() : null,
        scheduleDates: note.scheduleDates,
        schedule: note.schedule,
        expenses: note.expenses,
        income: note.income,
        debt: note.debt,
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
    } else if (category === 'schedule' && !existing.targetDate) {
      const textToInspect = content !== undefined ? content : (existing.isEncrypted ? decryptSecret(existing.content, user.id) : existing.content);
      updates.targetDate = extractEarliestScheduleDate(textToInspect);
    }

    if (!updates.targetDate && !existing.targetDate && updates.scheduleDates && updates.scheduleDates.length > 0) {
      const parsed = new Date(`${updates.scheduleDates[0]}T00:00:00Z`);
      if (!isNaN(parsed.getTime())) updates.targetDate = parsed;
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

    // Otomatisasi Background: Jika kategori finance dan teks konten berubah (atau beralih ke finance),
    // otomatis lakukan pemetaan cepat dan picu background re-ekstraksi secara hening
    const effectiveCategory = updates.category || existing.category;
    const existingCleanContent = existing.isEncrypted
      ? decryptSecret(existing.content, user.id)
      : existing.content;
    const isContentChanged = content !== undefined && content.trim() !== existingCleanContent;

    if (
      effectiveCategory === 'finance' &&
      (isContentChanged || (updates.category === 'finance' && existing.category !== 'finance'))
    ) {
      const targetText = content !== undefined ? content.trim() : existingCleanContent;

      // Picu re-ekstraksi finance di background secara hening (deepseek-v4.1-flash)
      extractFinanceEntries(targetText)
        .then(async (fin) => {
          if (fin.expenses.length > 0 || fin.income.length > 0 || fin.debt.length > 0) {
            await db
              .update(notes)
              .set({
                expenses: fin.expenses,
                income: fin.income,
                debt: fin.debt,
              })
              .where(eq(notes.id, id));
          }
        })
        .catch((err) => {
          console.warn('[Background Finance Re-extract Error]:', err);
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
          targetDate: updated.targetDate ? updated.targetDate.toISOString() : null,
          scheduleDates: updated.scheduleDates,
          schedule: updated.schedule,
          expenses: updated.expenses,
          income: updated.income,
          debt: updated.debt,
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

