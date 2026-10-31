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
  benefits?: string;
  image?: string;
  sort_order?: number;
}) {
  try {
    const res = createAddon(data);
    revalidatePath("/admin/addons");
    revalidatePath("/tickets");
    revalidatePath("/ticket-type");
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
    benefits?: string;
    image?: string;
    active?: number;
    sort_order?: number;
  }
) {
  try {
    updateAddon(id, data);
    revalidatePath("/admin/addons");
    revalidatePath("/tickets");
    revalidatePath("/ticket-type");
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
    revalidatePath("/ticket-type");
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
    revalidatePath("/ticket-type");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete add-on" };
  }
}

export async function fetchAddonExclusionNoticeAction(): Promise<string> {
  try {
    const { getSiteSetting } = await import("@/lib/db");
    return getSiteSetting(
      "addon_exclusion_notice", 
      "*Excavator Activity is not included in the package. It can be purchased separately as an add-on."
    );
  } catch (err) {
    return "*Excavator Activity is not included in the package. It can be purchased separately as an add-on.";
  }
}

export async function saveAddonExclusionNoticeAction(notice: string) {
  try {
    const { setSiteSetting } = await import("@/lib/db");
    setSiteSetting("addon_exclusion_notice", notice.trim(), "Exclusion notice displayed for add-on activities on pass comparison");
    revalidatePath("/admin/addons");
    revalidatePath("/ticket-type");
    revalidatePath("/tickets");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save notice" };
  }
}

export async function fetchAddonMandatoryPassNoticeAction(): Promise<string> {
  try {
    const { getSiteSetting } = await import("@/lib/db");
    return getSiteSetting(
      "addon_mandatory_pass_notice", 
      "*Note: This is an add-on package and requires a valid entry ticket. Any ticket type (Visitor, Participant, VIP Visitor, or VIP Participant) is valid."
    );
  } catch (err) {
    return "*Note: This is an add-on package and requires a valid entry ticket. Any ticket type (Visitor, Participant, VIP Visitor, or VIP Participant) is valid.";
  }
}

export async function saveAddonMandatoryPassNoticeAction(notice: string) {
  try {
    const { setSiteSetting } = await import("@/lib/db");
    setSiteSetting("addon_mandatory_pass_notice", notice.trim(), "Mandatory entry pass notice displayed for add-on packages on pass comparison");
    revalidatePath("/admin/addons");
    revalidatePath("/ticket-type");
    revalidatePath("/tickets");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save notice" };
  }
}
