import { db } from '@/db';
import { aiUsageLogs } from '@/db/schema';
import crypto from 'node:crypto';

export interface RecordAiUsageParams {
  userId?: string | null;
  feature: 'ask' | 'enhance' | 'tagging' | 'batch_sync' | 'finance';
  model?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Record token and call usage from any AI/LLM operation.
 * Silently catches errors to never disrupt primary user request flow.
 */
export async function recordAiUsage({
  userId,
  feature,
  model = process.env.AI_MODEL_NAME || 'claude-haiku-5.5',
  usage,
}: RecordAiUsageParams): Promise<void> {
  try {
    const promptTokens = usage?.promptTokens ?? 0;
    const completionTokens = usage?.completionTokens ?? 0;
    const totalTokens = usage?.totalTokens ?? promptTokens + completionTokens;

    await db.insert(aiUsageLogs).values({
      id: crypto.randomUUID(),
      userId: userId || null,
      feature,
      model,
      promptTokens,
      completionTokens,
      totalTokens: totalTokens > 0 ? totalTokens : 250, // Baseline estimate if provider omits token stats
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn('[AI Usage Tracker] Non-fatal error recording token usage:', err);
  }
}
