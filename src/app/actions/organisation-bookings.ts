"use server";

import { checkSessionAction } from "@/app/login/actions";
import { 
  createOrganisationBooking, 
  CreateOrganisationBookingParams 
} from "@/lib/db";
import { 
  lockSimulatorSlot, 
  parseSimulatorSlotAssignments 
} from "@/lib/simulator-db";
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

    if (!params.items || params.items.length === 0) {
      return { success: false, error: "At least one session or ticket item must be selected." };
    }

    const result = createOrganisationBooking(params);
    if (!result) {
      return { success: false, error: "Failed to persist reservation in database." };
    }

    const orderCode = formatOrderNumber(result.orderNumber, result.createdAt, params.paymentStatus);

    // If any items contain simulator sessions, lock the simulator slots in Supabase / PostgreSQL
    for (let itemIdx = 0; itemIdx < params.items.length; itemIdx++) {
      const item = params.items[itemIdx];
      if (item.simulatorName && item.simulatorSlot) {
        try {
          const assignments = parseSimulatorSlotAssignments(item.simulatorName, item.simulatorSlot);
          for (let idx = 0; idx < assignments.length; idx++) {
            const assign = assignments[idx];
            if (assign.simulatorName && assign.slotLabel) {
              const itemOrderId = assignments.length > 1 || params.items.length > 1
                ? `${orderCode}-${itemIdx + 1}-${idx + 1}`
                : orderCode;

              await lockSimulatorSlot({
                simulatorName: assign.simulatorName,
                bookingDate: item.date || params.eventDate,
                bookingTime: assign.slotLabel,
                sourceOrderId: itemOrderId,
                customerName: `${params.organizationName} (${params.contactName || "Coordinator"})`,
                customerEmail: params.contactEmail,
                customerPhone: params.contactPhone,
                status: 'CONFIRMED'
              });
            }
          }
        } catch (simLockErr) {
          console.warn("[Organisation Reservation] Simulator slot lock notice:", simLockErr);
        }
      }
    }

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
