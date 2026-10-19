export interface WristbandColor {
  hex: string;
  name: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  ringClass: string;
}

export const WRISTBAND_PALETTE: WristbandColor[] = [
  { hex: "#06B6D4", name: "Cyan / Neon Blue", bgClass: "bg-cyan-100", textClass: "text-cyan-800", borderClass: "border-cyan-300", ringClass: "ring-cyan-400" },
  { hex: "#10B981", name: "Emerald Green",    bgClass: "bg-emerald-100", textClass: "text-emerald-800", borderClass: "border-emerald-300", ringClass: "ring-emerald-400" },
  { hex: "#F59E0B", name: "Amber Yellow",     bgClass: "bg-amber-100", textClass: "text-amber-800", borderClass: "border-amber-300", ringClass: "ring-amber-400" },
  { hex: "#F97316", name: "Vibrant Orange",   bgClass: "bg-orange-100", textClass: "text-orange-800", borderClass: "border-orange-300", ringClass: "ring-orange-400" },
  { hex: "#EF4444", name: "Ruby Red",         bgClass: "bg-rose-100", textClass: "text-rose-800", borderClass: "border-rose-300", ringClass: "ring-rose-400" },
  { hex: "#8B5CF6", name: "Electric Purple",  bgClass: "bg-purple-100", textClass: "text-purple-800", borderClass: "border-purple-300", ringClass: "ring-purple-400" },
  { hex: "#EC4899", name: "Neon Pink",        bgClass: "bg-pink-100", textClass: "text-pink-800", borderClass: "border-pink-300", ringClass: "ring-pink-400" },
  { hex: "#3B82F6", name: "Royal Blue",       bgClass: "bg-blue-100", textClass: "text-blue-800", borderClass: "border-blue-300", ringClass: "ring-blue-400" },
  { hex: "#14B8A6", name: "Mint Teal",        bgClass: "bg-teal-100", textClass: "text-teal-800", borderClass: "border-teal-300", ringClass: "ring-teal-400" },
  { hex: "#84CC16", name: "Lime Green",       bgClass: "bg-lime-100", textClass: "text-lime-800", borderClass: "border-lime-300", ringClass: "ring-lime-400" },
  { hex: "#EAB308", name: "Golden Yellow",    bgClass: "bg-yellow-100", textClass: "text-yellow-800", borderClass: "border-yellow-300", ringClass: "ring-yellow-400" },
  { hex: "#6366F1", name: "Indigo Night",     bgClass: "bg-indigo-100", textClass: "text-indigo-800", borderClass: "border-indigo-300", ringClass: "ring-indigo-400" },
  { hex: "#64748B", name: "Slate Silver",     bgClass: "bg-slate-100", textClass: "text-slate-800", borderClass: "border-slate-300", ringClass: "ring-slate-400" },
];

/**
 * Fallback mapping if a slot does not have a color in database yet
 */
export const DEFAULT_SLOT_COLORS: Record<string, string> = {
  "11AM-12PM": "#06B6D4", // Cyan
  "12PM-1PM":  "#10B981", // Emerald
  "1PM-2PM":   "#F59E0B", // Amber
  "2PM-3PM":   "#F97316", // Orange
  "3PM-4PM":   "#EF4444", // Red
  "4PM-5PM":   "#8B5CF6", // Purple
  "5PM-6PM":   "#EC4899", // Pink
  "6PM-7PM":   "#3B82F6", // Royal Blue
  "7PM-8PM":   "#14B8A6", // Teal
  "8PM-9PM":   "#84CC16", // Lime
  "9PM-10PM":  "#EAB308", // Golden Yellow
  "10PM-11PM": "#6366F1", // Indigo
  "11PM-12AM": "#64748B", // Slate
};

export function getSlotWristbandColor(slotLabel?: string | null, customHex?: string | null): WristbandColor {
  const hex = (customHex || (slotLabel ? DEFAULT_SLOT_COLORS[slotLabel.trim()] : null) || "#06B6D4").toUpperCase();
  
  const found = WRISTBAND_PALETTE.find(p => p.hex.toUpperCase() === hex);
  if (found) return found;

  return {
    hex,
    name: "Custom Band",
    bgClass: "bg-gray-100",
    textClass: "text-gray-800",
    borderClass: "border-gray-300",
    ringClass: "ring-gray-400"
  };
}
