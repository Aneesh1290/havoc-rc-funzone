"use server";

import { 
  getAddons, 
  getAddonById, 
  createAddon, 
  updateAddon, 
  toggleAddonStatus, 
  deleteAddon,
  AddonRow 
} from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function fetchAddonsAction(activeOnly: boolean = false): Promise<AddonRow[]> {
  try {
    return getAddons(activeOnly);
  } catch (err) {
    console.error("fetchAddonsAction error:", err);
    return [];
  }
}

export async function createAddonAction(data: {
  name: string;
  price: number;
  tagline?: string;
  description?: string;
  image?: string;
  sort_order?: number;
}) {
  try {
    const res = createAddon(data);
    revalidatePath("/admin/addons");
    revalidatePath("/tickets");
    return { success: true, addon: res };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create add-on" };
  }
}

export async function updateAddonAction(
  id: number, 
  data: {
    name?: string;
    price?: number;
    tagline?: string;
    description?: string;
    image?: string;
    active?: number;
    sort_order?: number;
  }
) {
  try {
    updateAddon(id, data);
    revalidatePath("/admin/addons");
    revalidatePath("/tickets");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update add-on" };
  }
}

export async function toggleAddonStatusAction(id: number, active: boolean) {
  try {
    toggleAddonStatus(id, active);
    revalidatePath("/admin/addons");
    revalidatePath("/tickets");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to toggle add-on status" };
  }
}

export async function deleteAddonAction(id: number) {
  try {
    deleteAddon(id);
    revalidatePath("/admin/addons");
    revalidatePath("/tickets");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete add-on" };
  }
}
