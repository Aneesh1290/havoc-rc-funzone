export interface WristbandColor {
  hex: string;
  name: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  ringClass: string;
}

export const WRISTBAND_PALETTE: WristbandColor[] = [
  { hex: "#FFF0B3", name: "Yellow",          bgClass: "bg-yellow-100",  textClass: "text-yellow-800", borderClass: "border-yellow-300", ringClass: "ring-yellow-400" },
  { hex: "#10B981", name: "Green",           bgClass: "bg-emerald-100", textClass: "text-emerald-800", borderClass: "border-emerald-300", ringClass: "ring-emerald-400" },
  { hex: "#EF4444", name: "Red",             bgClass: "bg-rose-100",    textClass: "text-rose-800", borderClass: "border-rose-300", ringClass: "ring-rose-400" },
  { hex: "#3B82F6", name: "Blue",            bgClass: "bg-blue-100",    textClass: "text-blue-800", borderClass: "border-blue-300", ringClass: "ring-blue-400" },
  { hex: "#F97316", name: "Orange",          bgClass: "bg-orange-100",  textClass: "text-orange-800", borderClass: "border-orange-300", ringClass: "ring-orange-400" },
  { hex: "#8B5CF6", name: "Purple",          bgClass: "bg-purple-100",  textClass: "text-purple-800", borderClass: "border-purple-300", ringClass: "ring-purple-400" },
  { hex: "#18181B", name: "Black",           bgClass: "bg-zinc-800",    textClass: "text-zinc-100", borderClass: "border-zinc-900", ringClass: "ring-zinc-600" },
  { hex: "#1AF9F9", name: "Aqua",            bgClass: "bg-cyan-100",    textClass: "text-cyan-800", borderClass: "border-cyan-300", ringClass: "ring-cyan-400" },
  { hex: "#F4F4F5", name: "White",           bgClass: "bg-zinc-100",    textClass: "text-zinc-800", borderClass: "border-zinc-300", ringClass: "ring-zinc-400" },
  { hex: "#FFD700", name: "Gold",            bgClass: "bg-amber-100",   textClass: "text-amber-800", borderClass: "border-amber-300", ringClass: "ring-amber-400" },
  { hex: "#06B6D4", name: "Cyan / Neon Blue",bgClass: "bg-cyan-100",    textClass: "text-cyan-800", borderClass: "border-cyan-300", ringClass: "ring-cyan-400" },
  { hex: "#EC4899", name: "Neon Pink",        bgClass: "bg-pink-100",    textClass: "text-pink-800", borderClass: "border-pink-300", ringClass: "ring-pink-400" },
  { hex: "#14B8A6", name: "Mint Teal",        bgClass: "bg-teal-100",    textClass: "text-teal-800", borderClass: "border-teal-300", ringClass: "ring-teal-400" },
  { hex: "#84CC16", name: "Lime Green",       bgClass: "bg-lime-100",    textClass: "text-lime-800", borderClass: "border-lime-300", ringClass: "ring-lime-400" },
  { hex: "#6366F1", name: "Indigo Night",     bgClass: "bg-indigo-100",  textClass: "text-indigo-800", borderClass: "border-indigo-300", ringClass: "ring-indigo-400" },
  { hex: "#64748B", name: "Slate Silver",     bgClass: "bg-slate-100",   textClass: "text-slate-800", borderClass: "border-slate-300", ringClass: "ring-slate-400" },
];

/**
 * Fallback mapping if a slot does not have a color in database yet
 */
export const DEFAULT_SLOT_COLORS: Record<string, string> = {
  "11AM-12PM": "#FFF0B3", // Yellow
  "12PM-1PM":  "#10B981", // Green
  "1PM-2PM":   "#EF4444", // Red
  "2PM-3PM":   "#3B82F6", // Blue
  "3PM-4PM":   "#F97316", // Orange
  "4PM-5PM":   "#8B5CF6", // Purple
  "5PM-6PM":   "#18181B", // Black
  "6PM-7PM":   "#1AF9F9", // Aqua
  "7PM-8PM":   "#F4F4F5", // White
  "8PM-9PM":   "#FFD700", // Gold
  "9PM-10PM":  "#06B6D4", // Cyan
  "10PM-11PM": "#EC4899", // Pink
  "11PM-12AM": "#64748B", // Slate
};

/**
 * Common color name keywords to Hex codes mapping
 */
export const COLOR_NAME_TO_HEX: Record<string, string> = {
  "yellow": "#FFF0B3",
  "green": "#10B981",
  "emerald": "#10B981",
  "red": "#EF4444",
  "ruby": "#EF4444",
  "blue": "#3B82F6",
  "royal blue": "#3B82F6",
  "orange": "#F97316",
  "purple": "#8B5CF6",
  "black": "#18181B",
  "aqua": "#1AF9F9",
  "cyan": "#1AF9F9",
  "white": "#F4F4F5",
  "gold": "#FFD700",
  "golden": "#FFD700",
  "amber": "#F59E0B",
  "pink": "#EC4899",
  "teal": "#14B8A6",
  "lime": "#84CC16",
  "indigo": "#6366F1",
  "slate": "#64748B",
  "silver": "#94A3B8",
};

export function resolveColorNameToHex(name: string): string | null {
  if (!name) return null;
  const clean = name.trim().toLowerCase();
  
  // Exact match
  if (COLOR_NAME_TO_HEX[clean]) return COLOR_NAME_TO_HEX[clean];

  // Check if any keyword appears inside the typed string (e.g. "Bright Yellow", "Yellow Band", "Neon Green")
  for (const [key, hex] of Object.entries(COLOR_NAME_TO_HEX)) {
    // word boundary or contains
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(clean)) {
      return hex;
    }
  }

  return null;
}

export function getSlotWristbandColor(slotLabel?: string | null, customHex?: string | null, customColorName?: string | null): WristbandColor {
  // If customColorName resolves to a known hex and no customHex or customHex is empty, use resolved hex
  let targetHex = customHex;
  if (!targetHex && customColorName) {
    const resolved = resolveColorNameToHex(customColorName);
    if (resolved) targetHex = resolved;
  }

  const hex = (targetHex || (slotLabel ? DEFAULT_SLOT_COLORS[slotLabel.trim()] : null) || "#06B6D4").toUpperCase();
  
  const found = WRISTBAND_PALETTE.find(p => p.hex.toUpperCase() === hex);
  if (found) {
    return {
      ...found,
      name: (customColorName && customColorName.trim()) ? customColorName.trim() : found.name
    };
  }

  return {
    hex,
    name: (customColorName && customColorName.trim()) ? customColorName.trim() : "Custom Band",
    bgClass: "bg-gray-100",
    textClass: "text-gray-800",
    borderClass: "border-gray-300",
    ringClass: "ring-gray-400"
  };
}

/**
 * Helper to compute high-contrast inline styles for wristband badges.
 * Prevents light or white colors (e.g. #F4F4F5, #FFFFFF, pale yellows) from becoming unreadable invisible text.
 */
export function getWristbandBadgeStyle(hex: string): {
  backgroundColor: string;
  borderColor: string;
  color: string;
  dotBorderColor: string;
} {
  const cleanHex = hex.replace("#", "");
  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length >= 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }

  // Calculate perceived luminance (standard formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // If color is very bright (e.g. White, Cream, Pale Gray > 0.72)
  if (luminance > 0.72) {
    return {
      backgroundColor: "#F4F4F5",
      borderColor: "#D4D4D8",
      color: "#18181B", // Dark charcoal for high contrast readability
      dotBorderColor: "#71717A"
    };
  }

  return {
    backgroundColor: `${hex}18`,
    borderColor: `${hex}50`,
    color: hex,
    dotBorderColor: "rgba(0, 0, 0, 0.2)"
  };
}

/**
 * Formats time slot labels like "11AM-12PM" -> "11:00 AM - 12:00 PM"
 * Handles formats like "11AM-12PM", "11-12", "1PM-2PM", etc.
 */
export function formatTimeSlotLabel(label?: string | null): string {
  if (!label) return "";
  const clean = label.trim();
  
  // Format: "11AM-12PM" or "11AM - 12PM"
  const m = clean.match(/^(\d{1,2})\s*(AM|PM)?\s*[-–]\s*(\d{1,2})\s*(AM|PM)$/i);
  if (m) {
    const sNum = parseInt(m[1], 10);
    const sAmPm = m[2] ? m[2].toUpperCase() : (sNum === 12 ? "PM" : sNum >= 11 ? "AM" : "PM");
    const eNum = parseInt(m[3], 10);
    const eAmPm = m[4] ? m[4].toUpperCase() : "PM";
    return `${String(sNum).padStart(2, "0")}:00 ${sAmPm} - ${String(eNum).padStart(2, "0")}:00 ${eAmPm}`;
  }

  // If simple number range like "11-12" or "12-1"
  const mSimple = clean.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/);
  if (mSimple) {
    const s = parseInt(mSimple[1], 10);
    const e = parseInt(mSimple[2], 10);
    const sAmPm = s === 12 ? "PM" : s >= 11 ? "AM" : "PM";
    const eAmPm = e === 12 ? "PM" : e < 11 ? "PM" : "AM";
    return `${String(s).padStart(2, "0")}:00 ${sAmPm} - ${String(e).padStart(2, "0")}:00 ${eAmPm}`;
  }

  return clean;
}

/**
 * Resolves which time slot a wristband color belongs to, based on database time slots and standard rotation fallback.
 */
export function getSlotInfoForColor(
  colorHex: string,
  colorName: string,
  timeSlots: { label: string; start_hour?: number | null; end_hour?: number | null; sort_order?: number | null; color?: string | null; color_name?: string | null }[] = []
): { slotLabel: string; formattedSlot: string; sortOrder: number; startHour: number } | null {
  const cleanHex = (colorHex || "").trim().toUpperCase();
  const cleanName = (colorName || "").trim().toLowerCase();

  // 1. Match against database time_slots
  for (const s of timeSlots) {
    const sHex = (s.color || "").trim().toUpperCase();
    const sName = (s.color_name || "").trim().toLowerCase();
    const resolved = getSlotWristbandColor(s.label, s.color, s.color_name);
    const resolvedHex = (resolved.hex || "").trim().toUpperCase();
    const resolvedName = (resolved.name || "").trim().toLowerCase();

    const hexMatch = Boolean((sHex && sHex === cleanHex) || (resolvedHex && resolvedHex === cleanHex));
    const nameMatch = Boolean(
      (sName && (sName === cleanName || cleanName.includes(sName))) ||
      (resolvedName && (resolvedName === cleanName || cleanName.includes(resolvedName)))
    );

    if (hexMatch || nameMatch) {
      const sHour = s.start_hour ?? 99;
      return {
        slotLabel: s.label,
        formattedSlot: formatTimeSlotLabel(s.label),
        sortOrder: s.sort_order ?? sHour,
        startHour: sHour,
      };
    }
  }

  // 2. Fallback to standard DEFAULT_SLOT_COLORS:
  const defaultSlotOrder: { label: string; hex: string; hour: number; name: string }[] = [
    { label: "11AM-12PM", hex: "#FFF0B3", hour: 11, name: "yellow" },
    { label: "12PM-1PM",  hex: "#10B981", hour: 12, name: "green" },
    { label: "1PM-2PM",   hex: "#EF4444", hour: 13, name: "red" },
    { label: "2PM-3PM",   hex: "#3B82F6", hour: 14, name: "blue" },
    { label: "3PM-4PM",   hex: "#F97316", hour: 15, name: "orange" },
    { label: "4PM-5PM",   hex: "#8B5CF6", hour: 16, name: "purple" },
    { label: "5PM-6PM",   hex: "#18181B", hour: 17, name: "black" },
    { label: "6PM-7PM",   hex: "#1AF9F9", hour: 18, name: "aqua" },
    { label: "7PM-8PM",   hex: "#F4F4F5", hour: 19, name: "white" },
    { label: "8PM-9PM",   hex: "#FFD700", hour: 20, name: "gold" },
    { label: "9PM-10PM",  hex: "#06B6D4", hour: 21, name: "cyan" },
    { label: "10PM-11PM", hex: "#EC4899", hour: 22, name: "pink" },
    { label: "11PM-12AM", hex: "#64748B", hour: 23, name: "slate" },
  ];

  for (const def of defaultSlotOrder) {
    if (def.hex.toUpperCase() === cleanHex || cleanName === def.name || cleanName.includes(def.name)) {
      return {
        slotLabel: def.label,
        formattedSlot: formatTimeSlotLabel(def.label),
        sortOrder: def.hour,
        startHour: def.hour,
      };
    }
  }

  return null;
}


