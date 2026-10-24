/**
 * Date Extraction Utility for Multi-Schedule Notes
 * Extracts mentioned dates from unstructured text and identifies the
 * Earliest Anchor Date (Primary Event Date) for calendar visualization.
 */

const MONTH_MAP: Record<string, number> = {
  // Indonesian & English
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1,
  mar: 2, maret: 2, march: 2,
  apr: 3, april: 3,
  mei: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  agu: 7, agustus: 7, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oktober: 9, oct: 9, october: 9,
  nov: 10, nop: 10, november: 10,
  des: 11, desember: 11, dec: 11, december: 11,
};

const DAY_OF_WEEK_MAP: Record<string, number> = {
  minggu: 0, ahad: 0, sunday: 0, sun: 0,
  senin: 1, monday: 1, mon: 1,
  selasa: 2, tuesday: 2, tue: 2,
  rabu: 3, wednesday: 3, wed: 3,
  kamis: 4, thursday: 4, thu: 4,
  jumat: 5, "jum'at": 5, friday: 5, fri: 5,
  sabtu: 6, saturday: 6, sat: 6,
};

export interface ExtractedDateEntry {
  date: Date;
  rawMatch: string;
  index: number;
}

/**
 * Extracts all valid dates mentioned in the note text.
 */
export function extractAllDates(content: string, refDate: Date = new Date()): ExtractedDateEntry[] {
  if (!content || !content.trim()) return [];

  const text = content.toLowerCase();
  const entries: ExtractedDateEntry[] = [];
  const refYear = refDate.getFullYear();
  const refMonth = refDate.getMonth();

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoRegex = /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g;
  let match: RegExpExecArray | null;
  while ((match = isoRegex.exec(text)) !== null) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      const date = new Date(y, m, d, 9, 0, 0);
      entries.push({ date, rawMatch: match[0], index: match.index });
    }
  }

  // 2. Format: DD/MM/YYYY or DD-MM-YYYY
  const dmyRegex = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/g;
  while ((match = dmyRegex.exec(text)) !== null) {
    const d = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const y = parseInt(match[3], 10);
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      const date = new Date(y, m, d, 9, 0, 0);
      entries.push({ date, rawMatch: match[0], index: match.index });
    }
  }

  // 2b. Date range with named month (e.g., "10-14 November 2026", "10 - 14 Nov", "10 s/d 14 November")
  const dateRangeNamedMonthRegex = /\b(\d{1,2})\s*(?:-|–|—|\s+s\/?d\s+|\s+sd\s+|\s+sampai\s+|\s+to\s+)\s*(\d{1,2})\s+(jan(?:uari|uary)?|feb(?:ruari|ruary)?|mar(?:et|ch)?|apr(?:il)?|mei|may|jun(?:i|e)?|jul(?:i|y)?|agu(?:stus)?|aug(?:ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|des(?:ember)?|dec(?:ember)?)(?:[\s/-]+(\d{4}))?\b/gi;
  while ((match = dateRangeNamedMonthRegex.exec(text)) !== null) {
    const startDay = parseInt(match[1], 10);
    const endDay = parseInt(match[2], 10);
    const monthKey = match[3].toLowerCase();
    const m = MONTH_MAP[monthKey];
    const y = match[4] ? parseInt(match[4], 10) : refYear;

    if (m !== undefined && startDay >= 1 && endDay <= 31 && startDay <= endDay) {
      for (let d = startDay; d <= endDay; d++) {
        const date = new Date(y, m, d, 9, 0, 0);
        entries.push({ date, rawMatch: match[0], index: match.index });
      }
    }
  }

  // 3. Format: Day + Named Month (e.g., "24 Okt", "24 Oktober 2026", "24th October")
  const namedMonthRegex = /\b(?:tgl|tanggal\s+)?(\d{1,2})(?:st|nd|rd|th)?[\s/-]+(jan(?:uari|uary)?|feb(?:ruari|ruary)?|mar(?:et|ch)?|apr(?:il)?|mei|may|jun(?:i|e)?|jul(?:i|y)?|agu(?:stus)?|aug(?:ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|des(?:ember)?|dec(?:ember)?)(?:[\s/-]+(\d{4}))?\b/g;
  while ((match = namedMonthRegex.exec(text)) !== null) {
    const d = parseInt(match[1], 10);
    const monthKey = match[2].toLowerCase();
    const m = MONTH_MAP[monthKey];
    const y = match[3] ? parseInt(match[3], 10) : refYear;

    if (m !== undefined && d >= 1 && d <= 31) {
      const date = new Date(y, m, d, 9, 0, 0);
      // Adjust year if date in past by > 6 months and no year was specified
      if (!match[3] && date.getTime() < refDate.getTime() - 1000 * 60 * 60 * 24 * 180) {
        date.setFullYear(refYear + 1);
      }
      entries.push({ date, rawMatch: match[0], index: match.index });
    }
  }

  // 4. Standalone "tgl DD" or "tanggal DD" without month (assumes refMonth)
  const standaloneTglRegex = /\b(?:tgl|tanggal)\s+(\d{1,2})\b(?!\s+(?:jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec))/g;
  while ((match = standaloneTglRegex.exec(text)) !== null) {
    const d = parseInt(match[1], 10);
    if (d >= 1 && d <= 31) {
      const date = new Date(refYear, refMonth, d, 9, 0, 0);
      // If day has passed in current month, could be next month
      if (d < refDate.getDate() && date.getTime() < refDate.getTime()) {
        date.setMonth(refMonth + 1);
      }
      entries.push({ date, rawMatch: match[0], index: match.index });
    }
  }

  // 5. Relative day words: hari ini, besok, lusa
  const relRegex = /\b(hari ini|today|besok(?:an)?|tomorrow|lusa)\b/g;
  while ((match = relRegex.exec(text)) !== null) {
    const word = match[1];
    const date = new Date(refDate);
    date.setHours(9, 0, 0, 0);
    if (word === 'besok' || word === 'besokan' || word === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    } else if (word === 'lusa') {
      date.setDate(date.getDate() + 2);
    }
    entries.push({ date, rawMatch: match[0], index: match.index });
  }

  // 6. Day of the week without explicit date (e.g. "senin depan", "hari jumat meeting")
  // Only match if not part of "senin 24 okt" (already captured by namedMonth)
  const dowRegex = /\b(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(depan|next))?\b/g;
  while ((match = dowRegex.exec(text)) !== null) {
    const dowWord = match[1].replace("'", '');
    const isNext = Boolean(match[2]);
    const targetDow = DAY_OF_WEEK_MAP[dowWord];

    // Check if immediately followed by a digit (e.g. "senin 24 okt")
    const afterMatch = text.slice(match.index + match[0].length).trim();
    if (/^\d{1,2}\b/.test(afterMatch)) {
      continue; // Handled by namedMonthRegex
    }

    if (targetDow !== undefined) {
      const date = new Date(refDate);
      date.setHours(9, 0, 0, 0);
      const currentDow = refDate.getDay();
      let diff = targetDow - currentDow;
      if (diff <= 0 || isNext) diff += 7;
      date.setDate(date.getDate() + diff);
      entries.push({ date, rawMatch: match[0], index: match.index });
    }
  }

  // Check for time modifiers like "jam 14:00", "jam 10", "14:00", "jam 3 sore"
  const timeRegex = /(?:(?:jam|pukul)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(pagi|siang|sore|malam|am|pm)?)|(?:\b(\d{1,2})[:.](\d{2})\s*(pagi|siang|sore|malam|am|pm)?)|(?:\b(\d{1,2})\s*(am|pm|pagi|siang|sore|malam)\b)/i;
  for (const entry of entries) {
    // Look ahead within 35 chars directly AFTER the matched date
    const surrounding = text.slice(entry.index + entry.rawMatch.length, entry.index + entry.rawMatch.length + 35);
    const tm = timeRegex.exec(surrounding);
    if (tm) {
      let h = parseInt(tm[1] || tm[4] || tm[7], 10);
      const m = parseInt(tm[2] || tm[5] || '0', 10);
      const meridiem = (tm[3] || tm[6] || tm[8])?.toLowerCase();

      if ((meridiem === 'sore' || meridiem === 'malam' || meridiem === 'pm') && h < 12) {
        h += 12;
      } else if (meridiem === 'siang' && h < 11) {
        h += 12;
      } else if (meridiem === 'am' && h === 12) {
        h = 0;
      }

      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        entry.date.setHours(h, m, 0, 0);
      }
    }
  }

  // Sort entries by timestamp asc
  return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Extracts the single Earliest Anchor Date for a multi-schedule note.
 *
 * Rules:
 * 1. If upcoming dates exist (>= refDate), choose the earliest upcoming date.
 * 2. If all dates are in the past or text has multiple past dates, choose the earliest mentioned date.
 * 3. Returns null if no valid date pattern found.
 */
export function extractEarliestScheduleDate(content: string, refDate: Date = new Date()): Date | null {
  const entries = extractAllDates(content, refDate);
  if (entries.length === 0) return null;

  const startOfRefDay = new Date(refDate);
  startOfRefDay.setHours(0, 0, 0, 0);

  // 1. Find upcoming dates (>= today)
  const upcoming = entries.filter((e) => e.date.getTime() >= startOfRefDay.getTime());
  if (upcoming.length > 0) {
    return upcoming[0].date;
  }

  // 2. If all dates are before today, return the earliest mentioned date
  return entries[0].date;
}
