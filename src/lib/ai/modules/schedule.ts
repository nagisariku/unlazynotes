import { recordAiUsage } from '@/lib/ai-usage';
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { formatInUserTz, formatInWib, getTimezoneOffsetString, resolveUserTimezone } from '@/lib/timezone';
import type { ScheduleMetadata } from '../../../db/schema';

export type { ScheduleMetadata };

const ICAL_DAY_MAP: Record<string, number> = {
  su: 0, sun: 0, sunday: 0, minggu: 0, ahad: 0,
  mo: 1, mon: 1, monday: 1, senin: 1,
  tu: 2, tue: 2, tuesday: 2, selasa: 2,
  we: 3, wed: 3, wednesday: 3, rabu: 3,
  th: 4, thu: 4, thursday: 4, kamis: 4,
  fr: 5, fri: 5, friday: 5, jumat: 5, "jum'at": 5,
  sa: 6, sat: 6, saturday: 6, sabtu: 6,
};

/**
 * Safely extracts a valid Date object from date strings and optional time strings.
 * Operates purely on structured data (never on raw user text).
 * Returns null if invalid, never throws or returns Invalid Date.
 */
export function safeExtractTargetDate(dateStr: string | null | undefined, timeStr?: string, userTimezone?: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:Z|[+-]\d{2}:?\d{2})?)?/i);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);

    let hours = 0;
    let minutes = 0;

    if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
      const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
      hours = h;
      minutes = m;
    } else if (match[4] && match[5]) {
      hours = parseInt(match[4], 10);
      minutes = parseInt(match[5], 10);
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    // Anchor explicitly to user's timezone offset so server timezone differences never shift the date/time
    const offset = getTimezoneOffsetString(userTimezone);
    const isoString = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00${offset}`;
    const d = new Date(isoString);
    return !isNaN(d.getTime()) ? d : null;
  }

  const genericDate = new Date(trimmed);
  return !isNaN(genericDate.getTime()) ? genericDate : null;
}

/**
 * Sanitizes and validates structured schedule JSON returned by the LLM.
 * Operates strictly on LLM output objects (zero regex or parsing on user text).
 */
export function sanitizeScheduleJson(
  rawSchedule: any,
  baseDate: Date | string = new Date(),
  userTimezone?: string
): {
  schedule: ScheduleMetadata;
  scheduleDates: string[];
  targetDate: Date | null;
} {
  const baseDateObj = baseDate instanceof Date ? baseDate : new Date(baseDate);
  const safeBaseDate = !isNaN(baseDateObj.getTime()) ? baseDateObj : new Date();

  if (!rawSchedule || typeof rawSchedule !== 'object') {
    return {
      schedule: { dates: [], isRecurring: false },
      scheduleDates: [],
      targetDate: null,
    };
  }

  // 1. Sanitize dates into clean YYYY-MM-DD strings
  const cleanDates: string[] = [];
  let embeddedTime: string | undefined = undefined;

  const rawArray = Array.isArray(rawSchedule.dates)
    ? rawSchedule.dates
    : (rawSchedule.dates ? [rawSchedule.dates] : []);

  for (const raw of rawArray) {
    if (!raw) continue;
    const str = String(raw).trim();
    const m = str.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}))?/);
    if (m) {
      if (!cleanDates.includes(m[1])) {
        cleanDates.push(m[1]);
      }
      if (m[2] && !embeddedTime) {
        embeddedTime = m[2];
      }
    }
  }
  cleanDates.sort();

  // 2. Sanitize recurrence
  const isRecurring = Boolean(rawSchedule.isRecurring);
  let recurrenceRule: ScheduleMetadata['recurrenceRule'] = undefined;

  if (isRecurring && rawSchedule.recurrenceRule && typeof rawSchedule.recurrenceRule === 'object') {
    const rawRule = rawSchedule.recurrenceRule;

    // Frequency
    const rawFreq = String(rawRule.frequency || rawRule.freq || 'weekly').toLowerCase();
    let frequency: 'daily' | 'weekly' | 'monthly' | 'custom_interval' = 'weekly';
    if (rawFreq.includes('daily') || rawFreq === 'day') {
      frequency = 'daily';
    } else if (rawFreq.includes('monthly') || rawFreq === 'month') {
      frequency = 'monthly';
    } else if (rawFreq.includes('custom') || rawFreq.includes('interval')) {
      frequency = 'custom_interval';
    } else {
      frequency = 'weekly';
    }

    // Days of week
    const daysOfWeekSet = new Set<number>();
    const rawDays = rawRule.daysOfWeek ?? rawRule.byDay ?? rawRule.byday ?? rawRule.days ?? [];
    const daysArray = Array.isArray(rawDays)
      ? rawDays
      : typeof rawDays === 'string'
        ? rawDays.split(',')
        : [rawDays];

    for (const item of daysArray) {
      if (typeof item === 'number' && item >= 0 && item <= 6) {
        daysOfWeekSet.add(item);
      } else if (typeof item === 'string') {
        const clean = item.trim().toLowerCase();
        if (/^[0-6]$/.test(clean)) {
          daysOfWeekSet.add(parseInt(clean, 10));
        } else if (ICAL_DAY_MAP[clean] !== undefined) {
          daysOfWeekSet.add(ICAL_DAY_MAP[clean]);
        }
      }
    }

    const anchorDate = cleanDates.length > 0 ? safeExtractTargetDate(cleanDates[0], embeddedTime) : safeBaseDate;
    if (frequency === 'weekly' && daysOfWeekSet.size === 0 && anchorDate && !isNaN(anchorDate.getTime())) {
      daysOfWeekSet.add(anchorDate.getDay());
    }

    const daysOfWeek = Array.from(daysOfWeekSet).sort((a, b) => a - b);

    // TimeString
    let timeString = rawRule.timeString || rawRule.time || embeddedTime;
    if (typeof timeString === 'string') {
      const tm = timeString.trim().match(/^(\d{1,2})[:.](\d{2})/);
      timeString = tm ? `${tm[1].padStart(2, '0')}:${tm[2]}` : undefined;
    } else {
      timeString = undefined;
    }

    let intervalDays: number | undefined = undefined;
    if (rawRule.intervalDays || rawRule.interval) {
      const parsed = parseInt(rawRule.intervalDays || rawRule.interval, 10);
      if (!isNaN(parsed) && parsed > 0) intervalDays = parsed;
    }

    let dayOfMonth: number | undefined = undefined;
    if (rawRule.dayOfMonth || rawRule.day) {
      const parsed = parseInt(rawRule.dayOfMonth || rawRule.day, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) dayOfMonth = parsed;
    }

    recurrenceRule = {
      frequency,
      ...(daysOfWeek.length > 0 ? { daysOfWeek } : {}),
      ...(intervalDays !== undefined ? { intervalDays } : {}),
      ...(dayOfMonth !== undefined ? { dayOfMonth } : {}),
      ...(timeString ? { timeString } : {}),
    };
  }

  // 3. Compute targetDate from LLM targetDate or cleanDates[0]
  let targetDate: Date | null = null;
  if (rawSchedule.targetDate) {
    targetDate = safeExtractTargetDate(String(rawSchedule.targetDate), recurrenceRule?.timeString || embeddedTime, userTimezone);
  }
  if (!targetDate && cleanDates.length > 0) {
    targetDate = safeExtractTargetDate(cleanDates[0], recurrenceRule?.timeString || embeddedTime, userTimezone);
  }

  return {
    schedule: {
      dates: cleanDates,
      isRecurring,
      ...(recurrenceRule ? { recurrenceRule } : {}),
    },
    scheduleDates: cleanDates,
    targetDate,
  };
}

/**
 * Pure AI-powered schedule extraction pipeline.
 * Extracts event dates, times, and recurrence rules using Gemini 3.8 Flash.
 * 100% Pure LLM processing. Zero regex / keyword fallbacks on user text.
 */
export async function extractScheduleEntries(
  content: string,
  baseDate: Date | string = new Date(),
  modelName: string = process.env.AI_MODEL_NAME || process.env.COSMOSHUB_MODEL || 'gemini-3.8-flash',
  userTimezone?: string
): Promise<{
  schedule: ScheduleMetadata;
  scheduleDates: string[];
  targetDate: Date | null;
}> {
  const text = content.trim();
  if (!text) {
    return {
      schedule: { dates: [], isRecurring: false },
      scheduleDates: [],
      targetDate: null,
    };
  }

  const safeTz = resolveUserTimezone(userTimezone);
  const baseDateObj = baseDate instanceof Date ? baseDate : new Date(baseDate);
  const safeBaseDate = !isNaN(baseDateObj.getTime()) ? baseDateObj : new Date();
  const { dateStr: refDateStr, dayName: refDayName, timeStr: refTimeStr, offsetStr } = formatInUserTz(safeBaseDate, safeTz);

  const apiKey = process.env.AI_PROVIDER_API_KEY || process.env.COSMOSHUB_API_KEY;
  const baseURL = process.env.AI_BASE_URL || process.env.COSMOSHUB_BASE_URL || 'https://api.cosmoshub.tech/v1';

  if (!apiKey || apiKey === 'sk-xxxx' || apiKey.startsWith('mock-')) {
    throw new Error('[Schedule] AI Provider API key not configured');
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
    system: `You are an automated schedule and calendar event extractor for UnlazyNotes.
User Timezone: ${safeTz} (${offsetStr}).
Reference Date: ${refDateStr} (${refDayName}), Current Time: ${refTimeStr}.
All relative terms like "hari ini", "besok", "lusa", "minggu depan" MUST be resolved strictly relative to this reference date in ${safeTz}.

Analyze the note and extract structured schedule metadata:
1. "dates": Array of target date strings in "YYYY-MM-DD" format only (e.g. ["2026-11-04"]). Do NOT include time in this array.
2. "isRecurring": boolean (true if the event is a routine, recurring schedule, weekly habit, or repeated occurrence).
3. "recurrenceRule": Optional object if isRecurring is true:
   {
     "frequency": "daily" | "weekly" | "monthly" | "custom_interval",
     "daysOfWeek": number[], // 0 for Sunday, 1 for Monday, ..., 3 for Wednesday, 6 for Saturday
     "intervalDays"?: number,
     "dayOfMonth"?: number,
     "timeString"?: string // e.g. "16:00" in 24-hour HH:mm
   }
4. "targetDate": Earliest upcoming event timestamp in ISO 8601 (e.g. "2026-11-04T16:00:00${offsetStr}") or null.

Return strict JSON ONLY:
{
  "dates": string[],
  "isRecurring": boolean,
  "recurrenceRule"?: object,
  "targetDate"?: string | null
}`,
    prompt: `Extract schedule data as JSON from:\n"""${text}"""`,
  });

  await recordAiUsage({
    feature: 'schedule',
    model: modelName,
    usage: result.usage,
  });

  const rawJson = result.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    console.error('[Schedule] Failed to parse AI JSON:', result.text);
    throw new Error('AI returned invalid schedule JSON');
  }

  return sanitizeScheduleJson(parsed, safeBaseDate, safeTz);
}
