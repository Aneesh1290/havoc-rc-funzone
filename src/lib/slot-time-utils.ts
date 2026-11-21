/**
 * Utility functions for parsing booking time slots and calculating
 * time differences against India Standard Time (IST).
 */

export function getCurrentIstDetails(): { todayIstStr: string; nowMinutes: number; formattedIstTime: string } {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = istFormatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const todayIstStr = `${map.year}-${map.month}-${map.day}`;
  const hour = parseInt(map.hour, 10) || 0;
  const minute = parseInt(map.minute, 10) || 0;
  const nowMinutes = hour * 60 + minute;
  const formattedIstTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return { todayIstStr, nowMinutes, formattedIstTime };
}

/**
 * Normalizes various date string formats into YYYY-MM-DD for reliable comparison
 */
export function normalizeDateToYmd(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  const ymdMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return clean;
}

/**
 * Extracts slot start time in total minutes from midnight (0 to 1439).
 * Supports:
 * - 11AM-12PM, 1PM-2PM, 12PM-1PM
 * - 04:00 PM - 05:00 PM, 4:30 PM
 * - 14:00 - 15:00, 14:00
 * - Database start_hour column fallback (e.g. 14.5 = 14:30 = 870 mins)
 */
export function parseSlotStartMinutes(timeSlot: string | null | undefined, startHourFromDb?: number | null): number | null {
  if (typeof startHourFromDb === 'number' && !isNaN(startHourFromDb) && startHourFromDb >= 0) {
    return Math.round(startHourFromDb * 60);
  }

  if (!timeSlot) return null;
  const clean = timeSlot.trim().toUpperCase();

  // Pattern 1: e.g. "11AM-12PM", "1PM-2PM", "12PM-1PM"
  const compactAmPm = clean.match(/^(\d{1,2})(AM|PM)/i);
  if (compactAmPm) {
    let h = parseInt(compactAmPm[1], 10);
    const mer = compactAmPm[2].toUpperCase();
    if (mer === 'PM' && h < 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return h * 60;
  }

  // Pattern 2: e.g. "04:30 PM - 05:00 PM", "4:00 PM", "12:00 PM"
  const standardAmPm = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (standardAmPm) {
    let h = parseInt(standardAmPm[1], 10);
    const m = parseInt(standardAmPm[2], 10);
    const mer = standardAmPm[3].toUpperCase();
    if (mer === 'PM' && h < 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }

  // Pattern 3: e.g. "14:00 - 15:00" or "14:30" (24-hour format)
  const twentyFourHr = clean.match(/^(\d{1,2}):(\d{2})/);
  if (twentyFourHr) {
    const h = parseInt(twentyFourHr[1], 10);
    const m = parseInt(twentyFourHr[2], 10);
    return h * 60 + m;
  }

  // Pattern 4: Single integer hour e.g. "14" or "2"
  const singleNum = clean.match(/^(\d{1,2})$/);
  if (singleNum) {
    const h = parseInt(singleNum[1], 10);
    return h * 60;
  }

  return null;
}

/**
 * Checks whether a booking starts within `leadMinutes` (default 30) from now.
 * Grace window: up to 10 minutes past start time to catch slight cron lag.
 */
export function isBookingStartingSoon(
  bookingDate: string,
  timeSlot: string,
  startHourFromDb?: number | null,
  leadMinutes: number = 30
): { isStartingSoon: boolean; diffMinutes: number; slotStartMinutes: number | null } {
  const { todayIstStr, nowMinutes } = getCurrentIstDetails();
  const normalizedBookingDate = normalizeDateToYmd(bookingDate);

  if (normalizedBookingDate !== todayIstStr) {
    return { isStartingSoon: false, diffMinutes: 9999, slotStartMinutes: null };
  }

  const slotStartMinutes = parseSlotStartMinutes(timeSlot, startHourFromDb);
  if (slotStartMinutes === null) {
    return { isStartingSoon: false, diffMinutes: 9999, slotStartMinutes: null };
  }

  const diffMinutes = slotStartMinutes - nowMinutes;

  // Starting soon if between `leadMinutes` in the future and -10 minutes in the past
  // e.g. for leadMinutes = 30: matches 30 mins to -10 mins away
  const isStartingSoon = diffMinutes <= leadMinutes && diffMinutes >= -10;

  return { isStartingSoon, diffMinutes, slotStartMinutes };
}
