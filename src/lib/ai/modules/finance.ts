import { recordAiUsage } from '@/lib/ai-usage';
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { sanitizeTags } from '../sanitizer';
import { extractTagsFromContent } from '../taxonomy';
import { enrichDualLayerTags } from './general';
import type { NoteTagResult } from '../types';
import type { ExpenseEntry, IncomeEntry, DebtEntry } from '../../../db/schema';

export type { ExpenseEntry, IncomeEntry, DebtEntry };

/**
 * Deterministic regex & unit parser for monetary transactions.
 * Supports Indonesian slang & global notation (k, rb, rebu, ribu, jt, juta, $, usd, rp, idr).
 */
export function heuristicExtractFinance(content: string): {
  expenses: ExpenseEntry[];
  income: IncomeEntry[];
  debt: DebtEntry[];
} {
  const text = content.trim();
  const expenses: ExpenseEntry[] = [];
  const income: IncomeEntry[] = [];
  const debt: DebtEntry[] = [];

  // Split multi-transaction notes by commas, newlines, or conjunctions ('dan', 'serta', '+')
  const rawSegments = text
    .split(/[\n,;]|\s+(?:dan|serta|\+)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const seg of rawSegments) {
    const lower = seg.toLowerCase();

    // Match amount patterns:
    // e.g. "35k", "25rb", "5rebu", "2.5jt", "$20", "20 usd", "rp 50.000", "50000"
    const moneyRegex = /(?:(\$|rp\.?|idr|usd)\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|rebu|ribu|jt|juta|usd|dollar|dollars|perak)?\b/i;
    const match = seg.match(moneyRegex);

    if (!match) continue;

    const prefixCurrency = match[1]?.toLowerCase();
    const rawNumberStr = match[2];
    const unit = match[3]?.toLowerCase();

    // Parse amount value
    let num = parseFloat(rawNumberStr.replace(/,/g, '.'));
    if (isNaN(num)) continue;

    if (unit === 'k' || unit === 'rb' || unit === 'rebu' || unit === 'ribu') {
      num = Math.round(num * 1000);
    } else if (unit === 'jt' || unit === 'juta') {
      num = Math.round(num * 1000000);
    } else if (!unit && rawNumberStr.includes('.') && rawNumberStr.length >= 5) {
      // e.g. 50.000 -> 50000
      num = parseInt(rawNumberStr.replace(/\./g, ''), 10);
    }

    let currency = 'IDR';
    if (
      prefixCurrency === '$' ||
      prefixCurrency === 'usd' ||
      unit === 'usd' ||
      unit === 'dollar' ||
      unit === 'dollars' ||
      lower.includes('usd') ||
      lower.includes('$')
    ) {
      currency = 'USD';
    }

    // Clean label item/source: remove the matched money token and common filler words
    let label = seg
      .replace(match[0], '')
      .replace(/\b(via|pake|pakai|qris|cash|transfer|bca|mandiri|bri|gopay|ovo|shopeepay|dana|kena tax|tax)\b/gi, '')
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!label) {
      label = 'Pengeluaran';
    }

    // Check if this segment represents Debt (Utang / Piutang)
    const isDebt = /\b(minjem|pinjem|pinjam|pinjamin|pinjemin|ngutang|utang|piutang|talangin|talangan|ditalangin|utangin|ngutangin|berutang)\b/i.test(lower);
    if (isDebt) {
      const isLending = /\b(talangin|talangan|ditalangin|pinjemin|pinjamin|kasih pinjam)\b/i.test(lower);
      const isBorrowing =
        /\b(aku|saya|gue|gua)\s+(minjem|pinjem|pinjam|ngutang|utang)\b/i.test(lower) ||
        /\b(minjem|pinjem|pinjam|ngutang|utang)\s+(?:uang\s+)?(?:ke\s+|sama\s+|dari\s+)?([a-z0-9_-]+)/i.test(lower);

      let person = 'Seseorang';
      let debtType: 'payable' | 'receivable' = 'receivable';

      if (isLending) {
        debtType = 'receivable';
        // e.g. "Talangin makan siang Rendy 45rb nanti diganti pas gajian"
        const commonNouns = new Set(['makan', 'siang', 'malam', 'pagi', 'tiket', 'kopi', 'bensin', 'belanja', 'uang', 'buat', 'beli', 'pesenan', 'ongkir', 'jajan']);
        const words = seg.split(/\s+/);
        const talanginIdx = words.findIndex((w) => /talangin|talangan|ditalangin|pinjemin|pinjamin|kasih/i.test(w));
        if (talanginIdx !== -1) {
          for (let i = talanginIdx + 1; i < words.length; i++) {
            const cleanW = words[i].replace(/[^\w]/g, '');
            if (!cleanW) continue;
            if (moneyRegex.test(cleanW) || /^\d+/.test(cleanW)) break;
            if (!commonNouns.has(cleanW.toLowerCase())) {
              person = cleanW;
              break;
            }
          }
        }
      } else if (isBorrowing) {
        debtType = 'payable';
        // e.g. "Pinjem uang Doni 200rb buat servis motor darurat"
        const m = seg.match(/\b(?:minjem|pinjem|pinjam|ngutang|utang)\s+(?:uang\s+)?(?:ke\s+|sama\s+|dari\s+)?([a-zA-Z0-9_-]+)/i);
        if (m && m[1] && !['uang', 'aku', 'saya', 'gue', 'gua'].includes(m[1].toLowerCase())) {
          person = m[1];
        }
      } else {
        const borrowerMatch = lower.match(/([a-z0-9_-]+)\s+(minjem|pinjem|pinjam|ngutang)/i);
        if (borrowerMatch && borrowerMatch[1] && !['aku', 'saya', 'gue', 'gua'].includes(borrowerMatch[1])) {
          person = borrowerMatch[1];
        }
      }

      debt.push({
        type: debtType,
        person,
        amount: num,
        notes: label,
        isSettled: false,
      });
      continue;
    }

    // Check if this segment represents Income
    const isIncome = /\b(dapet|dapat|gaji|salary|pemasukan|income|transfer masuk|transferan|tf masuk|invoice|cair|fee|honor|bonus|thr|dividen|cashback|omset|omzet|penjualan|balikin utang|dibayar|bayar utang)\b/i.test(
      lower
    );

    if (isIncome) {
      // Clean leading indicator words from source label
      const cleanSource = label
        .replace(/^(?:alhamdulillah|bismillah|puji tuhan)?\s*(?:cair|dapet|dapat)?\s*(?:transferan|transfer\s+masuk|tf\s+masuk|transfer)?\s*(?:dari)?\s*/gi, '')
        .trim();
      income.push({
        source: cleanSource || 'Pemasukan',
        amount: num,
        currency,
      });
    } else {
      // Clean leading action words
      const cleanItem = label
        .replace(/^(?:beli|bayar|pesen)\s+/gi, '')
        .trim();
      expenses.push({
        item: cleanItem || label,
        amount: num,
        currency,
      });
    }
  }

  return { expenses, income, debt };
}

/**
 * AI-powered finance extraction pipeline.
 * Runs structured LLM extraction and falls back to deterministic heuristic parsing if LLM is unreachable.
 */
export async function extractFinanceEntries(
  content: string,
  modelName: string = process.env.AI_MODEL_NAME || process.env.COSMOSHUB_MODEL || 'deepseek-v4.1-flash'
): Promise<{ expenses: ExpenseEntry[]; income: IncomeEntry[]; debt: DebtEntry[] }> {
  const text = content.trim();
  if (!text) return { expenses: [], income: [], debt: [] };

  const apiKey = process.env.AI_PROVIDER_API_KEY || process.env.COSMOSHUB_API_KEY;
  const baseURL = process.env.AI_BASE_URL || process.env.COSMOSHUB_BASE_URL || 'https://api.cosmoshub.tech/v1';

  if (!apiKey || apiKey === 'sk-xxxx' || apiKey.startsWith('mock-')) {
    return heuristicExtractFinance(text);
  }

  try {
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
      system: `You are an automated financial transaction extractor for UnlazyNotes.
Analyze the user's note and extract all monetary transactions into three structured arrays:
1. "expenses": Array of objects: [{"item": string, "amount": number, "currency": "IDR" | "USD" | string}]
2. "income": Array of objects: [{"source": string, "amount": number, "currency": "IDR" | "USD" | string}]
3. "debt": Array of objects: [{"type": "payable" | "receivable", "person": string, "amount": number, "notes": string, "isSettled": boolean}]

Rules:
- Standardize nominals into integer values: "35k" -> 35000, "2.5jt" -> 2500000, "5rebu" -> 5000, "$20" -> 20.
- Currency defaults to "IDR" unless stated as $, usd, dollar, eur, etc.
- Separate expenses (food, purchases, bills) from income (salary, client transfers, earnings) and debt (payable = we borrowed; receivable = we lent/covered for someone else).
- Output strict JSON ONLY: {"expenses": [...], "income": [...], "debt": [...]}`,
      prompt: `Extract financial transactions as JSON from:\n"""${text}"""`,
    });

    await recordAiUsage({
      feature: 'finance',
      model: modelName,
      usage: result.usage,
    });

    let rawJson = result.text.trim();
    const match = rawJson.match(/\{[\s\S]*\}/);
    if (match) rawJson = match[0];

    const parsed = JSON.parse(rawJson);
    const expenses: ExpenseEntry[] = Array.isArray(parsed.expenses)
      ? parsed.expenses.map((e: any) => ({
          item: String(e.item || 'Pengeluaran').trim(),
          amount: Number(e.amount) || 0,
          currency: e.currency || 'IDR',
        }))
      : [];

    const income: IncomeEntry[] = Array.isArray(parsed.income)
      ? parsed.income.map((i: any) => ({
          source: String(i.source || 'Pemasukan').trim(),
          amount: Number(i.amount) || 0,
          currency: i.currency || 'IDR',
        }))
      : [];

    const debt: DebtEntry[] = Array.isArray(parsed.debt)
      ? parsed.debt.map((d: any) => ({
          type: d.type === 'payable' ? 'payable' : 'receivable',
          person: String(d.person || 'Seseorang').trim(),
          amount: Number(d.amount) || 0,
          notes: d.notes ? String(d.notes) : undefined,
          isSettled: Boolean(d.isSettled || false),
        }))
      : [];

    if (expenses.length === 0 && income.length === 0 && debt.length === 0) {
      return heuristicExtractFinance(text);
    }

    return { expenses, income, debt };
  } catch (err) {
    console.warn('[Finance] LLM extraction error, using heuristic fallback:', err);
    return heuristicExtractFinance(text);
  }
}

/**
 * Specialized Finance Module with Bilingual Taxonomy.
 * Guaranteed category 'finance' with high-reusability single-word tags, expenses, income, and debt.
 */
export function processFinanceNote(content: string, existingUserTags?: string[]): NoteTagResult {
  const text = content.trim();
  const matchedCanonical = extractTagsFromContent(text, 'finance', 5);
  let enriched = enrichDualLayerTags(matchedCanonical, 'finance', text);

  // Filter out spiritual tags mistakenly matched on financial expressions like "alhamdulillah"
  enriched = enriched.filter((t) => !['quran', 'hadits', 'doa', 'quote', 'hadist'].includes(t));

  const { expenses, income, debt } = heuristicExtractFinance(text);

  const extraTags: string[] = [];
  if (debt.length > 0) {
    extraTags.push('debt');
    for (const d of debt) {
      if (d.type === 'receivable') extraTags.push('piutang');
      if (d.type === 'payable') extraTags.push('utang');
      if (d.person && d.person !== 'Seseorang') {
        extraTags.push(d.person.toLowerCase());
      }
    }
  } else if (income.length > 0) {
    extraTags.push('income');
    if (/\blanding[\s-]*page\b/i.test(text)) extraTags.push('landing-page');
    if (/\b(freelance|proyek|project|klien|client|fee)\b/i.test(text)) extraTags.push('freelance');
  } else if (expenses.length > 0) {
    extraTags.push('expenses');
  }

  const combined = Array.from(new Set([...extraTags, ...enriched]));

  return {
    category: 'finance',
    specific_tags: sanitizeTags(combined, 'finance', text, 5, existingUserTags),
    expenses,
    income,
    debt,
    source: null,
  };
}
