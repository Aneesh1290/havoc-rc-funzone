"use server";

import { revalidatePath } from "next/cache";
import { checkSessionAction } from "@/app/login/actions";
import {
  getColorInventory,
  syncColorInventoryFromSlots,
  updateColorStock,
  deleteColorInventoryRecord,
  WristbandColorInventoryItem,
} from "@/lib/color-inventory-db";

/**
 * Ensures authorized admin or staff access
 */
async function requireAdminSession() {
  const session = await checkSessionAction();
  if (!session) {
    throw new Error("Unauthorized: Please log in to manage wristband color inventory.");
  }
  return session;
}

export async function getColorInventoryAction(): Promise<{
  success: boolean;
  data?: WristbandColorInventoryItem[];
  error?: string;
}> {
  try {
    await requireAdminSession();
    const data = await getColorInventory();
    return { success: true, data };
  } catch (err: any) {
    console.error("[getColorInventoryAction Error]", err);
    return { success: false, error: err.message || "Failed to load color inventory" };
  }
}

export async function syncColorInventoryAction(): Promise<{
  success: boolean;
  addedCount?: number;
  addedColors?: string[];
  alreadyExistingCount?: number;
  message?: string;
  error?: string;
}> {
  try {
    await requireAdminSession();
    const result = await syncColorInventoryFromSlots();
    revalidatePath("/admin/slots");
    revalidatePath("/admin/bands");
    return result;
  } catch (err: any) {
    console.error("[syncColorInventoryAction Error]", err);
    return { success: false, error: err.message || "Failed to sync inventory" };
  }
}

export async function updateColorStockAction(params: {
  id: number;
  newQuantity?: number;
  addAmount?: number;
}): Promise<{
  success: boolean;
  item?: WristbandColorInventoryItem;
  error?: string;
}> {
  try {
    await requireAdminSession();
    const result = await updateColorStock(params);
    if (result.success) {
      revalidatePath("/admin/slots");
      revalidatePath("/admin/bands");
    }
    return result;
  } catch (err: any) {
    console.error("[updateColorStockAction Error]", err);
    return { success: false, error: err.message || "Failed to update stock" };
  }
}

export async function deleteColorInventoryAction(id: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await requireAdminSession();
    // Allow admin / super_admin to delete inventory record
    const role = (session.role || "").toLowerCase();
    const username = (session.username || "").toLowerCase();
    if (username !== "admin" && role !== "super_admin" && role !== "administrator") {
      return { success: false, error: "Only administrators can permanently delete inventory records." };
    }

    const result = await deleteColorInventoryRecord(id);
    if (result.success) {
      revalidatePath("/admin/slots");
      revalidatePath("/admin/bands");
    }
    return result;
  } catch (err: any) {
    console.error("[deleteColorInventoryAction Error]", err);
    return { success: false, error: err.message || "Failed to delete inventory record" };
  }
}
