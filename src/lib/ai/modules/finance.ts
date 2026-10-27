import { recordAiUsage } from '@/lib/ai-usage';
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ExpenseEntry, IncomeEntry, DebtEntry } from '../../../db/schema';

export type { ExpenseEntry, IncomeEntry, DebtEntry };

/**
 * Pure AI-powered finance transaction extraction pipeline.
 * Runs structured LLM extraction. Zero regex / keyword fallbacks.
 */
export async function extractFinanceEntries(
  content: string,
  modelName: string = process.env.AI_MODEL_NAME || process.env.COSMOSHUB_MODEL || 'gemini-3.8-flash'
): Promise<{ expenses: ExpenseEntry[]; income: IncomeEntry[]; debt: DebtEntry[] }> {
  const text = content.trim();
  if (!text) return { expenses: [], income: [], debt: [] };

  const apiKey = process.env.AI_PROVIDER_API_KEY || process.env.COSMOSHUB_API_KEY;
  const baseURL = process.env.AI_BASE_URL || process.env.COSMOSHUB_BASE_URL || 'https://api.cosmoshub.tech/v1';

  if (!apiKey || apiKey === 'sk-xxxx' || apiKey.startsWith('mock-')) {
    throw new Error('[Finance] AI Provider API key not configured');
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

  return { expenses, income, debt };
}
