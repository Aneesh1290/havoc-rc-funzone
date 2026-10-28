"use server";

import { revalidatePath } from "next/cache";
import { checkSessionAction } from "@/app/login/actions";
import {
  getBandInventorySummary,
  getBandItems,
  getBandItemById,
  getBandItemByCode,
  createBandItem,
  bulkCreateBandItems,
  issueBandItem,
  returnBandItem,
  stockOutBandItem,
  restoreBandItem,
  updateBandItem,
  deleteBandItem,
  bulkDeleteBandItems,
  deleteAllBandInventory,
  getBandTransactions,
  BandItem,
  BandTransaction,
  BandInventorySummary,
  BandCategory,
  BandStatus,
  GetBandItemsOptions,
  GetBandTransactionsOptions,
} from "@/lib/band-inventory-db";

/**
 * Checks session and staff permissions
 */
async function getStaffSession() {
  const session = await checkSessionAction();
  if (!session) {
    throw new Error("Unauthorized: Please log in to access band inventory.");
  }
  return session;
}

export async function getBandInventorySummaryAction(): Promise<{
  success: boolean;
  data?: BandInventorySummary;
  error?: string;
}> {
  try {
    await getStaffSession();
    const summary = await getBandInventorySummary();
    return { success: true, data: summary };
  } catch (err: any) {
    console.error("[getBandInventorySummaryAction Error]", err);
    return { success: false, error: err.message || "Failed to load band summary" };
  }
}

export async function getBandItemsAction(options: GetBandItemsOptions = {}): Promise<{
  success: boolean;
  data?: { items: BandItem[]; totalCount: number };
  error?: string;
}> {
  try {
    await getStaffSession();
    const result = await getBandItems(options);
    return { success: true, data: result };
  } catch (err: any) {
    console.error("[getBandItemsAction Error]", err);
    return { success: false, error: err.message || "Failed to load band items" };
  }
}

export async function getBandTransactionsAction(options: GetBandTransactionsOptions = {}): Promise<{
  success: boolean;
  data?: { transactions: BandTransaction[]; totalCount: number };
  error?: string;
}> {
  try {
    await getStaffSession();
    const result = await getBandTransactions(options);
    return { success: true, data: result };
  } catch (err: any) {
    console.error("[getBandTransactionsAction Error]", err);
    return { success: false, error: err.message || "Failed to load transactions" };
  }
}

export async function createBandItemAction(data: {
  band_code: string;
  color_name: string;
  color_hex: string;
  category?: BandCategory;
  notes?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const session = await getStaffSession();
    const staffName = session.username || "Staff";
    const res = await createBandItem({ ...data, staff_name: staffName });
    if (res.success) {
      revalidatePath("/admin/bands");
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create band" };
  }
}

export async function bulkCreateBandItemsAction(data: {
  prefix: string;
  startingNumber: number;
  count: number;
  color_name: string;
  color_hex: string;
  category?: BandCategory;
  notes?: string;
}): Promise<{ success: boolean; createdCount: number; error?: string }> {
  try {
    const session = await getStaffSession();
    const staffName = session.username || "Staff";
    const res = await bulkCreateBandItems({ ...data, staff_name: staffName });
    if (res.success) {
      revalidatePath("/admin/bands");
    }
    return res;
  } catch (err: any) {
    return { success: false, createdCount: 0, error: err.message || "Failed to bulk generate bands" };
  }
}

export async function issueBandAction(data: {
  band_id?: number;
  band_code?: string;
  customer_name?: string;
  booking_id?: number;
  order_number?: string;
  notes?: string;
}): Promise<{ success: boolean; item?: BandItem; error?: string }> {
  try {
    const session = await getStaffSession();
    const staffName = session.username || "Staff";
    const res = await issueBandItem({ ...data, staff_name: staffName });
    if (res.success) {
      revalidatePath("/admin/bands");
      revalidatePath("/admin/bookings");
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to issue band" };
  }
}

export async function returnBandAction(data: {
  band_id?: number;
  band_code?: string;
  condition: "good" | "damaged" | "lost";
  notes?: string;
}): Promise<{ success: boolean; item?: BandItem; error?: string }> {
  try {
    const session = await getStaffSession();
    const staffName = session.username || "Staff";
    const res = await returnBandItem({ ...data, staff_name: staffName });
    if (res.success) {
      revalidatePath("/admin/bands");
      revalidatePath("/admin/bookings");
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to return band" };
  }
}

export async function stockOutBandAction(data: {
  band_id: number;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getStaffSession();
    const staffName = session.username || "Staff";
    const res = await stockOutBandItem({ ...data, staff_name: staffName });
    if (res.success) {
      revalidatePath("/admin/bands");
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to stock-out band" };
  }
}

export async function restoreBandAction(data: {
  band_id: number;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getStaffSession();
    const staffName = session.username || "Staff";
    const res = await restoreBandItem({ ...data, staff_name: staffName });
    if (res.success) {
      revalidatePath("/admin/bands");
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to restore band" };
  }
}

export async function updateBandItemAction(
  id: number,
  data: {
    band_code: string;
    color_name: string;
    color_hex: string;
    category?: BandCategory;
    status?: BandStatus;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await getStaffSession();
    const res = await updateBandItem(id, data);
    if (res.success) {
      revalidatePath("/admin/bands");
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update band" };
  }
}

export async function deleteBandItemAction(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await getStaffSession();
    const res = await deleteBandItem(id);
    if (res.success) {
      revalidatePath("/admin/bands");
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete band" };
  }
}

export async function bulkDeleteBandItemsAction(ids: number[]): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    await getStaffSession();
    if (!ids || ids.length === 0) {
      return { success: true, count: 0 };
    }
    const res = await bulkDeleteBandItems(ids);
    if (res.success) {
      revalidatePath("/admin/bands");
    }
    return res;
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || "Failed to bulk delete bands" };
  }
}

export async function deleteAllBandInventoryAction(options?: { resetStarterStock?: boolean }): Promise<{ success: boolean; error?: string }> {
  try {
    await getStaffSession();
    const res = await deleteAllBandInventory(options);
    if (res.success) {
      revalidatePath("/admin/bands");
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to clear band inventory" };
  }
}

export async function quickLookupBandAction(code: string): Promise<{
  success: boolean;
  item?: BandItem;
  error?: string;
}> {
  try {
    await getStaffSession();
    if (!code || !code.trim()) {
      return { success: false, error: "Band code is required." };
    }
    const item = await getBandItemByCode(code.trim());
    if (!item) {
      return { success: false, error: `Band with code '${code}' not found in inventory.` };
    }
    return { success: true, item };
  } catch (err: any) {
    return { success: false, error: err.message || "Lookup failed" };
  }
}
