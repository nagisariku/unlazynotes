import 'dotenv/config';
import assert from 'node:assert';
import { db } from '../src/db';
import { notes } from '../src/db/schema';
import { eq, and, or, ilike, desc, gte } from 'drizzle-orm';

// Common Indonesian & English conversational stopwords for search term extraction
const STOPWORDS = new Set([
  'apa', 'apakah', 'siapa', 'siapakah', 'kapan', 'dimana', 'bagaimana', 'kenapa', 'mengapa',
  'berapa', 'tolong', 'bisa', 'dong', 'cek', 'cari', 'carikan', 'lihat', 'tampilkan',
  'saya', 'aku', 'kami', 'kita', 'kamu', 'anda', 'dia', 'mereka',
  'ini', 'itu', 'sini', 'situ', 'sana', 'yang', 'di', 'ke', 'dari', 'pada', 'dalam', 'untuk',
  'dengan', 'dan', 'atau', 'tapi', 'tetapi', 'karena', 'jika', 'kalau', 'tentang', 'mengenai',
  'ada', 'adalah', 'yaitu', 'sudah', 'telah', 'sedang', 'akan', 'belum', 'bukan', 'tidak',
  'notes', 'note', 'catatan', 'catatanku', 'semua', 'semuanya', 'daftar', 'list',
  'the', 'is', 'at', 'which', 'on', 'in', 'to', 'for', 'from', 'with', 'and', 'or', 'my'
]);

function extractSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !STOPWORDS.has(word));
}

async function retrieveRelevantNotes(userId: string, question: string, categoryFilter?: string) {
  const terms = extractSearchTerms(question);
  console.log('Extracted search terms for "' + question + '":', terms);

  const baseConditions = [
    eq(notes.userId, userId),
    eq(notes.isEncrypted, false),
    eq(notes.isArchived, false),
  ];

  if (categoryFilter && categoryFilter !== 'workspace' && categoryFilter !== 'all') {
    baseConditions.push(eq(notes.category, categoryFilter as any));
  }

  // 1. Text/Keyword Relevance Search (if terms exist)
  let relevantNotes: Array<any> = [];
  if (terms.length > 0) {
    const termConditions = terms.map(term => ilike(notes.content, `%${term}%`));
    relevantNotes = await db
      .select({
        id: notes.id,
        content: notes.content,
        category: notes.category,
        specificTags: notes.specificTags,
        createdAt: notes.createdAt,
        targetDate: notes.targetDate,
        todos: notes.todos,
        bookmarkMeta: notes.bookmarkMeta,
      })
      .from(notes)
      .where(and(...baseConditions, or(...termConditions)))
      .orderBy(desc(notes.createdAt))
      .limit(15);
  }

  // 2. Temporal & Recency Anchors (Top 10)
  const anchorNotes = await db
    .select({
      id: notes.id,
      content: notes.content,
      category: notes.category,
      specificTags: notes.specificTags,
      createdAt: notes.createdAt,
      targetDate: notes.targetDate,
      todos: notes.todos,
      bookmarkMeta: notes.bookmarkMeta,
    })
    .from(notes)
    .where(and(...baseConditions))
    .orderBy(desc(notes.createdAt))
    .limit(10);

  // 3. Merge & Deduplicate
  const noteMap = new Map<string, any>();
  for (const n of relevantNotes) {
    noteMap.set(n.id, n);
  }
  for (const n of anchorNotes) {
    if (!noteMap.has(n.id)) {
      noteMap.set(n.id, n);
    }
  }

  const merged = Array.from(noteMap.values());
  // Sort by createdAt descending
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Cap to max 25 notes
  return merged.slice(0, 25);
}

async function main() {
  console.log('Testing Smart Context Retrieval for Ask AI...');
  const userId = 'usr_1792431114098';

  // Test 1: Targeted query "pengeluaran server tencent"
  const res1 = await retrieveRelevantNotes(userId, 'berapa biaya pengeluaran server tencent?');
  console.log('Query 1 count:', res1.length);
  const foundFin = res1.some(n => n.id === 'note_fin_01');
  assert.ok(foundFin, 'Targeted query must find note_fin_01');
  console.log('✅ PASS | Targeted query finds matching note');

  // Test 2: Targeted query "diskusi sqlite"
  const res2 = await retrieveRelevantNotes(userId, 'rekomendasi artikel diskusi sqlite');
  const foundBm = res2.some(n => n.id === 'note_bm_03');
  assert.ok(foundBm, 'Targeted query must find note_bm_03');
  console.log('✅ PASS | Bookmark query finds matching note');

  // Test 3: Broad query "apa saja jadwalku atau tugasku?"
  const res3 = await retrieveRelevantNotes(userId, 'apa saja catatan terbaruku?');
  assert.ok(res3.length > 0, 'Broad query must retrieve recent anchor notes');
  assert.ok(res3.length <= 25, 'Total notes must be capped at 25');
  console.log('✅ PASS | Broad query retrieves capped recency notes (count: ' + res3.length + ')');

  // Test 4: Live AI Question Answering with Note Link
  console.log('\n--- Test 4: Live AI Response with Note Deep Links ---');
  const { answerNoteQuestion } = await import('../src/lib/ask');
  const answer = await answerNoteQuestion(userId, 'Berapa total biaya pengeluaran devops minggu ini? Tolong sebutkan rincian dan referensinya.');
  console.log('Ask AI Answer:\n', answer);
  assert.ok(answer.includes('425.000') || answer.includes('Tencent'), 'Answer must mention the expense details');
  assert.ok(answer.includes('note://note_fin_01'), 'Answer must include note link note://note_fin_01');
  console.log('✅ PASS | AI response correctly cited note://note_fin_01');

  console.log('\nAll retrieval tests passed successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
