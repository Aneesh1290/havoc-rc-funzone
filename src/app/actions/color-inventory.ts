"use server";

import { revalidatePath } from "next/cache";
import { checkSessionAction } from "@/app/login/actions";
import { hasUserPermission } from "@/lib/permissions";
import {
  getColorInventory,
  syncColorInventoryFromSlots,
  updateColorStock,
  stockOutColorToReception,
  returnColorFromReception,
  setColorReception,
  deleteColorInventoryRecord,
  WristbandColorInventoryItem,
} from "@/lib/color-inventory-db";

/**
 * Ensures authorized admin or staff access
 */
async function requireAdminSession(requiredPerm?: string) {
  const session = await checkSessionAction();
  if (!session) {
    throw new Error("Unauthorized: Please log in to manage wristband color inventory.");
  }
  if (requiredPerm && !hasUserPermission(session, requiredPerm)) {
    throw new Error(`Forbidden: You do not have permission (${requiredPerm}) to manage wristband stock.`);
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
    await requireAdminSession("bands:manage_stock");
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

export async function stockOutColorToReceptionAction(params: {
  id: number;
  amount: number;
  notes?: string;
}): Promise<{
  success: boolean;
  item?: WristbandColorInventoryItem;
  error?: string;
}> {
  try {
    await requireAdminSession("bands:manage_stock");
    const result = await stockOutColorToReception(params);
    if (result.success) {
      revalidatePath("/admin/slots");
      revalidatePath("/admin/bands");
    }
    return result;
  } catch (err: any) {
    console.error("[stockOutColorToReceptionAction Error]", err);
    return { success: false, error: err.message || "Failed to stock out to reception" };
  }
}

export async function returnColorFromReceptionAction(params: {
  id: number;
  amount: number;
}): Promise<{
  success: boolean;
  item?: WristbandColorInventoryItem;
  error?: string;
}> {
  try {
    await requireAdminSession("bands:manage_stock");
    const result = await returnColorFromReception(params);
    if (result.success) {
      revalidatePath("/admin/slots");
      revalidatePath("/admin/bands");
    }
    return result;
  } catch (err: any) {
    console.error("[returnColorFromReceptionAction Error]", err);
    return { success: false, error: err.message || "Failed to return from reception" };
  }
}

export async function setColorReceptionAction(params: {
  id: number;
  receptionAmount: number;
  returnToWarehouse?: boolean;
}): Promise<{
  success: boolean;
  item?: WristbandColorInventoryItem;
  error?: string;
}> {
  try {
    await requireAdminSession("bands:manage_stock");
    const result = await setColorReception(params);
    if (result.success) {
      revalidatePath("/admin/slots");
      revalidatePath("/admin/bands");
    }
    return result;
  } catch (err: any) {
    console.error("[setColorReceptionAction Error]", err);
    return { success: false, error: err.message || "Failed to update reception count" };
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
