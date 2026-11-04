"use server";

import { checkSessionAction } from "@/app/login/actions";
import { 
  createOrganisationBooking, 
  CreateOrganisationBookingParams 
} from "@/lib/db";
import { formatOrderNumber } from "@/lib/order-utils";
import { revalidatePath } from "next/cache";

export async function createOrganisationBookingAction(params: CreateOrganisationBookingParams): Promise<{
  success: boolean;
  orderNumber?: number;
  primaryId?: number;
  orderCode?: string;
  error?: string;
}> {
  try {
    const session = await checkSessionAction();
    if (!session) {
      return { success: false, error: "Unauthorized: Please log in to create an organisation reservation." };
    }

    if (!params.organizationName || !params.organizationName.trim()) {
      return { success: false, error: "Organisation or group name is required." };
    }

    if (!params.eventDate) {
      return { success: false, error: "Event date is required." };
    }

    if (!params.timeSlots || params.timeSlots.length === 0) {
      return { success: false, error: "At least one time slot must be selected to reserve." };
    }

    const result = createOrganisationBooking(params);
    if (!result) {
      return { success: false, error: "Failed to persist reservation in database." };
    }

    const orderCode = formatOrderNumber(result.orderNumber, result.createdAt, "Reserved");

    revalidatePath("/admin/bookings");
    revalidatePath("/admin");
    if (result.primaryId) {
      revalidatePath(`/admin/bookings/${result.primaryId}`);
    }

    return {
      success: true,
      orderNumber: result.orderNumber,
      primaryId: result.primaryId,
      orderCode
    };
  } catch (err: any) {
    console.error("[createOrganisationBookingAction Error]", err);
    return { success: false, error: err.message || "An unexpected error occurred while creating organisation reservation." };
  }
}
