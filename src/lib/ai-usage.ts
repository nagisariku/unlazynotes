import { db } from '@/db';
import { aiUsageLogs } from '@/db/schema';
import crypto from 'node:crypto';

export interface RecordAiUsageParams {
  userId?: string | null;
  feature: 'ask' | 'enhance' | 'tagging' | 'batch_sync' | 'finance' | 'todo' | 'schedule';
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
  model = process.env.AI_MODEL_NAME || 'gemini-3.8-flash',
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
      totalTokens,
      createdAt: new Date(),
    });
  } catch (err) {
    // Fail-safe: do not disrupt primary flow for telemetry
    console.warn('[AI Usage Telemetry Error]:', err);
  }
}
