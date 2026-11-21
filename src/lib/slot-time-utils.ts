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
  if (clean === 'ALL') return 'ALL';

  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  // 1. YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. DD-MM-YYYY or DD-MMM-YYYY (e.g. 08-Nov-2026, 8/11/2026)
  const dmyMatch = clean.match(/^(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const y = parseInt(dmyMatch[3], 10);
    const mIdx = /^\d+$/.test(dmyMatch[2])
      ? parseInt(dmyMatch[2], 10) - 1
      : monthNames.indexOf(dmyMatch[2].toLowerCase().slice(0, 3));
    if (mIdx >= 0) {
      const m = String(mIdx + 1).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 3. MMM DD or MMM DD (Ddd) (e.g. "Nov 8", "Nov 08 (Sun)")
  const textMatch = clean.match(/^([A-Za-z]{3,9})\s+(\d{1,2})/);
  if (textMatch) {
    const mIdx = monthNames.indexOf(textMatch[1].toLowerCase().slice(0, 3));
    const d = String(parseInt(textMatch[2], 10)).padStart(2, '0');
    if (mIdx >= 0) {
      const y = new Date().getFullYear();
      const m = String(mIdx + 1).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
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

/**
 * Normalizes any booking date string (e.g. "2026-11-22", "Nov 22", "22-Nov-2026", "Nov 22 (Sun)")
 * into all its common representations across Havoc RC Fun Zone and Sim Podium.
 */
export function normalizeBookingDateVariants(dateStr: string | null | undefined): string[] {
  if (!dateStr) return [];
  const raw = String(dateStr).trim();
  if (raw === 'ALL') return ['ALL'];

  const variants = new Set<string>([raw]);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let y: number | undefined;
  let m: number | undefined; // 0-indexed
  let d: number | undefined;

  // 1. YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    y = parseInt(isoMatch[1], 10);
    m = parseInt(isoMatch[2], 10) - 1;
    d = parseInt(isoMatch[3], 10);
  }

  // 2. DD-MM-YYYY or DD-MMM-YYYY (e.g. 22-Nov-2026)
  if (y === undefined) {
    const dmyMatch = raw.match(/^(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      d = parseInt(dmyMatch[1], 10);
      y = parseInt(dmyMatch[3], 10);
      if (/^\d+$/.test(dmyMatch[2])) {
        m = parseInt(dmyMatch[2], 10) - 1;
      } else {
        const mStr = dmyMatch[2].toLowerCase().slice(0, 3);
        m = monthNames.findIndex(mn => mn.toLowerCase() === mStr);
      }
    }
  }

  // 3. MMM DD or MMM DD (Ddd) or MMM D (e.g. "Nov 22", "Nov 22 (Sun)")
  if (y === undefined) {
    const textMatch = raw.match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:\s*\([A-Za-z]{3}\))?/);
    if (textMatch) {
      const mStr = textMatch[1].slice(0, 3).toLowerCase();
      m = monthNames.findIndex(mn => mn.toLowerCase() === mStr);
      d = parseInt(textMatch[2], 10);
      y = new Date().getFullYear();
    }
  }

  if (y !== undefined && m !== undefined && m >= 0 && m < 12 && d !== undefined && d >= 1 && d <= 31) {
    const dt = new Date(y, m, d);
    const mName = monthNames[m];
    const dPadded = String(d).padStart(2, '0');
    const mPadded = String(m + 1).padStart(2, '0');
    const dayOfWeek = dayNames[dt.getDay()];

    variants.add(`${y}-${mPadded}-${dPadded}`);
    variants.add(`${mName} ${dPadded}`);
    variants.add(`${mName} ${d}`);
    variants.add(`${mName} ${dPadded} (${dayOfWeek})`);
    variants.add(`${mName} ${d} (${dayOfWeek})`);
    variants.add(`${dPadded}-${mName}-${y}`);
  }

  return Array.from(variants);
}

/**
 * Checks if two date representations refer to the exact same calendar day
 */
export function matchesBookingDate(d1: string | null | undefined, d2: string | null | undefined): boolean {
  if (!d1 || !d2) return false;
  const s1 = d1.trim();
  const s2 = d2.trim();
  if (s1 === 'ALL' || s2 === 'ALL') return true;
  if (s1 === s2) return true;

  const v1 = normalizeBookingDateVariants(s1);
  const v2 = normalizeBookingDateVariants(s2);
  return v1.some(v => v2.includes(v));
}

/**
 * Checks whether a booking date is completely in the past (before today in IST/local time).
 * Dates like "ALL" or future/today dates return false.
 */
export function isBookingDatePast(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const clean = dateStr.trim();
  if (clean === 'ALL') return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  // 1. YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const target = new Date(y, m, d, 23, 59, 59, 999);
    return target < today;
  }

  // 2. DD-MM-YYYY or DD-MMM-YYYY (e.g. 08-Nov-2026)
  const dmyMatch = clean.match(/^(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const y = parseInt(dmyMatch[3], 10);
    const m = /^\d+$/.test(dmyMatch[2])
      ? parseInt(dmyMatch[2], 10) - 1
      : monthNames.indexOf(dmyMatch[2].toLowerCase().slice(0, 3));
    if (m >= 0) {
      const target = new Date(y, m, d, 23, 59, 59, 999);
      return target < today;
    }
  }

  // 3. MMM DD or MMM DD (Ddd) (e.g. "Nov 8", "Nov 08 (Sun)")
  const textMatch = clean.match(/^([A-Za-z]{3,9})\s+(\d{1,2})/);
  if (textMatch) {
    const m = monthNames.indexOf(textMatch[1].toLowerCase().slice(0, 3));
    const d = parseInt(textMatch[2], 10);
    if (m >= 0) {
      const y = now.getFullYear();
      const target = new Date(y, m, d, 23, 59, 59, 999);
      return target < today;
    }
  }

  return false;
}
