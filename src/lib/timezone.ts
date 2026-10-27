/**
 * Timezone utilities for UnlazyNotes.
 * Supports multi-tenant dynamic user timezones with fallback to 'Asia/Jakarta'.
 * Ensures deterministic date and time evaluation across all servers (VPS, cloud, local).
 */

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

/**
 * Validates whether an IANA timezone identifier is valid.
 */
export function isValidTimezone(tz?: string | null): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a safe IANA timezone string, falling back to DEFAULT_TIMEZONE.
 */
export function resolveUserTimezone(tz?: string | null): string {
  if (tz && isValidTimezone(tz)) return tz;
  return DEFAULT_TIMEZONE;
}

/**
 * Calculates current UTC offset string for an IANA timezone (e.g. "+07:00", "-05:00", "+00:00").
 * Uses native Intl.DateTimeFormat longOffset without relying on host system timezone.
 */
export function getTimezoneOffsetString(timezone: string = DEFAULT_TIMEZONE, date: Date = new Date()): string {
  const safeTz = resolveUserTimezone(timezone);
  try {
    const validDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTz,
      timeZoneName: 'longOffset',
    }).formatToParts(validDate);

    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value; // e.g. "GMT+07:00", "GMT-05:00", "GMT"
    if (tzPart) {
      const match = tzPart.match(/GMT([+-]\d{2}:\d{2})/);
      if (match) return match[1];
      if (tzPart === 'GMT') return '+00:00';
    }
    return '+07:00';
  } catch {
    return '+07:00';
  }
}

/**
 * Formats any Date or timestamp into the user's local timezone components.
 * Guarantees consistent relative day resolution ("hari ini", "besok", "lusa", "rabu depan").
 */
export function formatInUserTz(
  date: Date | string | number = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): {
  dateStr: string; // 'YYYY-MM-DD'
  timeStr: string; // 'HH:mm'
  dayName: string; // 'Wednesday'
  offsetStr: string; // '+07:00'
  fullIsoLocal: string; // 'YYYY-MM-DDTHH:mm:ss+07:00'
  timezone: string;
} {
  const safeTz = resolveUserTimezone(timezone);
  const d = date instanceof Date ? date : new Date(date);
  const validDate = !isNaN(d.getTime()) ? d : new Date();

  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(validDate);

  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(validDate);

  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    weekday: 'long',
  }).format(validDate);

  const offsetStr = getTimezoneOffsetString(safeTz, validDate);

  return {
    dateStr,
    timeStr,
    dayName,
    offsetStr,
    fullIsoLocal: `${dateStr}T${timeStr}:00${offsetStr}`,
    timezone: safeTz,
  };
}

/**
 * Backward-compatible wrapper for WIB-specific formatting.
 */
export function formatInWib(date: Date | string | number = new Date()) {
  return formatInUserTz(date, DEFAULT_TIMEZONE);
}
