import { format, addDays, setDate, setMonth, isValid } from 'date-fns';
import type { ScheduleMetadata } from '../../../db/schema';

export type { ScheduleMetadata };

const DAY_MAP: Record<string, number> = {
  minggu: 0,
  ahad: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  "jum'at": 5,
  sabtu: 6,
};

const MONTH_MAP: Record<string, number> = {
  jan: 0, januari: 0,
  feb: 1, februari: 1,
  mar: 2, maret: 2,
  apr: 3, april: 3,
  mei: 4,
  jun: 5, juni: 5,
  jul: 6, juli: 6,
  agu: 7, agustus: 7,
  sep: 8, september: 8,
  okt: 9, oktober: 9,
  nov: 10, november: 10,
  des: 11, desember: 11,
};

/**
 * Parses all implied and explicit schedule target dates from text into ISO 'YYYY-MM-DD' strings.
 * Accurately maps relative future days based on baseDate (e.g. Kamis 22 Okt -> Sabtu: 2026-10-24, Senin: 2026-10-26).
 */
export function parseScheduleDates(content: string, baseDate: Date = new Date()): string[] {
  const text = content.toLowerCase();
  const foundDates: Set<string> = new Set();
  const baseDayOfWeek = baseDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 4 = Thursday, 6 = Saturday

  // 1a. Date range with named month (e.g. "10-14 November 2026", "10 - 14 Nov", "10 s/d 14 November")
  const dateRangeMonthRegex = /\b(\d{1,2})\s*(?:-|–|—|\s+s\/?d\s+|\s+sd\s+|\s+sampai\s+|\s+to\s+)\s*(\d{1,2})\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)(?:\s+(\d{4}))?\b/gi;
  for (const m of text.matchAll(dateRangeMonthRegex)) {
    const startDay = parseInt(m[1], 10);
    const endDay = parseInt(m[2], 10);
    const monthKey = m[3].toLowerCase();
    const month = MONTH_MAP[monthKey];
    const year = m[4] ? parseInt(m[4], 10) : baseDate.getFullYear();
    if (!isNaN(startDay) && !isNaN(endDay) && month !== undefined && startDay <= endDay) {
      for (let d = startDay; d <= endDay; d++) {
        const dateObj = new Date(year, month, d);
        if (isValid(dateObj)) {
          foundDates.add(format(dateObj, 'yyyy-MM-dd'));
        }
      }
    }
  }

  // 1. Explicit calendar dates: "tanggal 25", "tgl 16", "25 okt", "16 oktober 2026"
  const explicitMonthRegex = /\b(\d{1,2})\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)(?:\s+(\d{4}))?\b/gi;
  for (const m of text.matchAll(explicitMonthRegex)) {
    const day = parseInt(m[1], 10);
    const monthKey = m[2].toLowerCase();
    const month = MONTH_MAP[monthKey];
    const year = m[3] ? parseInt(m[3], 10) : baseDate.getFullYear();
    if (!isNaN(day) && month !== undefined) {
      const d = new Date(year, month, day);
      if (isValid(d)) {
        foundDates.add(format(d, 'yyyy-MM-dd'));
      }
    }
  }

  const explicitDayOnlyRegex = /\b(?:tanggal|tgl)\s+(\d{1,2})\b/gi;
  for (const m of text.matchAll(explicitDayOnlyRegex)) {
    const day = parseInt(m[1], 10);
    if (!isNaN(day) && day >= 1 && day <= 31) {
      let target = setDate(baseDate, day);
      // If day has passed earlier this month, map to next month
      if (day < baseDate.getDate() - 3) {
        target = setMonth(target, target.getMonth() + 1);
      }
      if (isValid(target)) {
        foundDates.add(format(target, 'yyyy-MM-dd'));
      }
    }
  }

  // 2. Relative keywords: "besok", "lusa"
  if (/\bbesok\b/i.test(text)) {
    foundDates.add(format(addDays(baseDate, 1), 'yyyy-MM-dd'));
  }
  if (/\blusa\b/i.test(text)) {
    foundDates.add(format(addDays(baseDate, 2), 'yyyy-MM-dd'));
  }

  // 3. Named day keywords: senin, selasa, rabu, kamis, jumat, sabtu, minggu
  const dayRegex = /\b(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|ahad)\b/gi;
  for (const m of text.matchAll(dayRegex)) {
    const dayName = m[1].toLowerCase();
    const targetDay = DAY_MAP[dayName];
    if (targetDay !== undefined) {
      let diff = (targetDay - baseDayOfWeek + 7) % 7;
      // If same day mentioned in schedule context, treat as today (or if past, next week)
      if (diff === 0 && text.includes('minggu depan')) {
        diff = 7;
      }
      const targetDate = addDays(baseDate, diff);
      foundDates.add(format(targetDate, 'yyyy-MM-dd'));
    }
  }

  return Array.from(foundDates).sort();
}

/**
 * Parses recurrence patterns and time details into structured ScheduleMetadata.
 */
export function parseScheduleMetadata(content: string, baseDate: Date = new Date()): ScheduleMetadata {
  const dates = parseScheduleDates(content, baseDate);
  const lower = content.toLowerCase();

  // Extract explicit time string if present (e.g. "14.00", "08:20", "jam 3 sore", "19:00")
  let timeString: string | undefined = undefined;
  const timeRegex = /\b(?:jam|pukul)?\s*(\d{1,2})[.:](\d{2})(?:\s*(pagi|siang|sore|malam|am|pm))?\b/i;
  const timeMatch = lower.match(timeRegex);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2];
    const period = timeMatch[3];
    if (period === 'sore' || period === 'malam' || period === 'pm') {
      if (hour < 12) hour += 12;
    }
    timeString = `${String(hour).padStart(2, '0')}:${minute}`;
  } else {
    const singleHourMatch = lower.match(/\b(?:jam|pukul)\s*(\d{1,2})(?:\s*(pagi|siang|sore|malam))?\b/i);
    if (singleHourMatch) {
      let hour = parseInt(singleHourMatch[1], 10);
      const period = singleHourMatch[2];
      if (period === 'sore' || period === 'malam') {
        if (hour < 12) hour += 12;
      }
      timeString = `${String(hour).padStart(2, '0')}:00`;
    }
  }

  // Recurrence detection
  const isRecurring = /\b(tiap|setiap|rutin|berkala|daily|weekly|monthly|sehari-hari|mingguan|bulanan)\b/i.test(lower);

  if (!isRecurring) {
    return {
      dates,
      isRecurring: false,
    };
  }

  // Custom interval (e.g. "tiap 3 hari sekali", "tiap 2 minggu")
  const intervalDaysMatch = lower.match(/\b(?:tiap|setiap)\s*(\d+)\s*hari\s*(?:sekali)?\b/i);
  if (intervalDaysMatch) {
    const intervalDays = parseInt(intervalDaysMatch[1], 10);
    return {
      dates,
      isRecurring: true,
      recurrenceRule: {
        frequency: 'custom_interval',
        intervalDays,
        timeString,
      },
    };
  }

  // Daily
  if (/\b(?:tiap|setiap)\s*hari\b/i.test(lower) || /\bdaily\b/i.test(lower)) {
    return {
      dates,
      isRecurring: true,
      recurrenceRule: {
        frequency: 'daily',
        timeString,
      },
    };
  }

  // Monthly by day of month (e.g. "tiap tanggal 25", "setiap tgl 10")
  const dayOfMonthMatch = lower.match(/\b(?:tiap|setiap)\s*(?:tanggal|tgl)\s*(\d{1,2})\b/i);
  if (dayOfMonthMatch) {
    const dayOfMonth = parseInt(dayOfMonthMatch[1], 10);
    return {
      dates,
      isRecurring: true,
      recurrenceRule: {
        frequency: 'monthly',
        dayOfMonth,
        timeString,
      },
    };
  }

  if (/\b(?:tiap|setiap)\s*(?:awal\s*bulan|bulan)\b/i.test(lower) || /\bmonthly\b/i.test(lower)) {
    return {
      dates,
      isRecurring: true,
      recurrenceRule: {
        frequency: 'monthly',
        dayOfMonth: 1,
        timeString,
      },
    };
  }

  // Weekly by days of week (e.g. "tiap selasa", "tiap senin-jumat")
  const daysOfWeek: number[] = [];
  if (/\b(?:tiap|setiap)\s*senin\s*-\s*jumat\b/i.test(lower)) {
    daysOfWeek.push(1, 2, 3, 4, 5);
  } else {
    for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
      const dayPat = new RegExp(`\\b(?:tiap|setiap)\\s*${dayName}\\b`, 'i');
      if (dayPat.test(lower)) {
        if (!daysOfWeek.includes(dayNum)) daysOfWeek.push(dayNum);
      }
    }
  }

  if (daysOfWeek.length > 0 || /\bweekly\b/i.test(lower) || /\b(?:tiap|setiap)\s*minggu\b/i.test(lower)) {
    return {
      dates,
      isRecurring: true,
      recurrenceRule: {
        frequency: 'weekly',
        daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : undefined,
        timeString,
      },
    };
  }

  return {
    dates,
    isRecurring: true,
    recurrenceRule: {
      frequency: 'custom_interval',
      timeString,
    },
  };
}

