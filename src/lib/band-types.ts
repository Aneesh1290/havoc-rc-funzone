export type BandStatus = "available" | "issued" | "damaged" | "lost" | "retired";

export type BandCategory = 
  | "Participant"
  | "Visitor"
  | "VIP Participant"
  | "VIP Visitor"
  | "Staff / Marshal"
  | "Standard"
  | "VIP"
  | "Child"
  | string;

export type BandLocation = "warehouse" | "reception";

export const BAND_SUBCATEGORIES = [
  { id: "Participant", name: "Participant", codePrefix: "PART", color: "#3B82F6", badgeBg: "bg-blue-50 text-blue-700 border-blue-200", description: "Full RC Fun Zone Track Pass" },
  { id: "Visitor", name: "Visitor", codePrefix: "VIS", color: "#10B981", badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200", description: "Companion / Lounge Pass" },
  { id: "VIP Participant", name: "VIP Participant", codePrefix: "VIPP", color: "#8B5CF6", badgeBg: "bg-purple-50 text-purple-700 border-purple-200", description: "VIP RC Track + Sim Podium Session" },
  { id: "VIP Visitor", name: "VIP Visitor", codePrefix: "VIPV", color: "#F59E0B", badgeBg: "bg-amber-50 text-amber-700 border-amber-200", description: "VIP Simulator Pass" },
  { id: "Staff / Marshal", name: "Staff / Marshal", codePrefix: "STF", color: "#EC4899", badgeBg: "bg-pink-50 text-pink-700 border-pink-200", description: "Staff & Track Marshals" },
  { id: "Standard", name: "Standard", codePrefix: "STD", color: "#64748B", badgeBg: "bg-slate-100 text-slate-700 border-slate-300", description: "General Entry / Fallback" }
] as const;

export function normalizeBandCategory(cat?: string | null): string {
  if (!cat) return "Standard";
  const clean = cat.trim().toUpperCase().replace(/[\s_-]+/g, " ");
  // Standardize Participant, Standard, and generic entries to "Standard"
  if (clean === "PARTICIPANT" || clean.includes("PARTICIPANT") || clean === "STANDARD" || clean === "") return "Standard";
  if (clean.includes("VIP") && clean.includes("VISITOR")) return "VIP Visitor";
  if (clean.includes("VISITOR")) return "Visitor";
  if (clean.includes("STAFF") || clean.includes("MARSHAL")) return "Staff / Marshal";
  if (clean === "CHILD") return "Child";
  return "Standard";
}

export type BandTransactionType = 
  | "STOCK_IN" 
  | "STOCK_OUT" 
  | "HANDOVER"
  | "ISSUE" 
  | "RETURN" 
  | "DAMAGED" 
  | "LOST" 
  | "STATUS_CHANGE";

export interface BandItem {
  id: number;
  band_code: string;
  color_name: string;
  color_hex: string;
  category: BandCategory;
  status: BandStatus;
  location?: BandLocation;
  current_holder_name?: string | null;
  current_booking_id?: number | null;
  current_order_number?: string | null;
  total_uses: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BandTransaction {
  id: number;
  band_id: number;
  band_code: string;
  color_name: string;
  color_hex: string;
  transaction_type: BandTransactionType;
  quantity: number;
  customer_name?: string | null;
  booking_id?: number | null;
  order_number?: string | null;
  staff_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface BandSubcategoryBreakdown {
  category: string;
  total: number;
  available: number;
  issued: number;
  damaged: number;
  lost: number;
  retired: number;
  in_reception: number;
  warehouse: number;
}

export interface BandColorBreakdown {
  color_name: string;
  color_hex: string;
  total: number;
  available: number;
  issued: number;
  damaged: number;
  lost: number;
  retired: number;
  in_reception?: number;
  warehouse?: number;
  color_inventory_id?: number;
  subcategories?: BandSubcategoryBreakdown[];
  time_slot_label?: string | null;
  slot_sort_order?: number;
  start_hour?: number;
  is_subcategory_band?: boolean;
}

export interface BandInventorySummary {
  totalBands: number;
  available: number;
  issued: number;
  damaged: number;
  lost: number;
  retired: number;
  activeInventory: number;
  issuedToday: number;
  returnedToday: number;
  availabilityRate: number;
  colorBreakdown: BandColorBreakdown[];
  categoryBreakdown: { category: string; total: number; available: number; issued: number; warehouse?: number; in_reception?: number }[];
  lowStockColors: { color_name: string; color_hex: string; available: number }[];
}
