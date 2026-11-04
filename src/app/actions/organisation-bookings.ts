"use server";

import { checkSessionAction } from "@/app/login/actions";
import { 
  createOrganisationBooking, 
  CreateOrganisationBookingParams 
} from "@/lib/db";
import { formatOrderNumber } from "@/lib/order-utils";
import { revalidatePath } from "next/cache";
import {
  lockSimulatorSlot,
  parseSimulatorSlotAssignments,
} from "@/lib/simulator-db";
import { fetchSimulatorListAction } from "@/app/actions/tickets";

export async function createOrganisationBookingAction(params: CreateOrganisationBookingParams): Promise<{
  success: boolean;
  orderNumber?: number;
  primaryId?: number;
  orderCode?: string;
  simSlotsBlocked?: number;
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

    // ── Simulator Podium Slot Blocking ──────────────────────────────────────
    // If simulatorBlocking is configured, lock those sim slots in PostgreSQL
    let simSlotsBlocked = 0;
    const simBlock = params.simulatorBlocking;
    if (simBlock?.blockSimulators) {
      try {
        // Determine which simulators to block
        let simulatorsToBlock: string[] = [];
        if (simBlock.blockAllSimulators) {
          const allSims = await fetchSimulatorListAction();
          simulatorsToBlock = allSims.map(s => s.name);
        } else if (simBlock.selectedSimulators && simBlock.selectedSimulators.length > 0) {
          simulatorsToBlock = simBlock.selectedSimulators;
        }

        if (simulatorsToBlock.length > 0) {
          // For each reserved RC Fun Zone time slot, lock each simulator
          // RC slots are 1-hour (e.g. "11AM-12PM"), which parseSimulatorSlotAssignments
          // automatically expands into two 30-minute sim slots
          for (const rcSlot of params.timeSlots) {
            for (const simName of simulatorsToBlock) {
              const assignments = parseSimulatorSlotAssignments(simName, rcSlot);
              for (let i = 0; i < assignments.length; i++) {
                const a = assignments[i];
                const slotOrderId = assignments.length > 1
                  ? `${orderCode}_SIM_${i + 1}`
                  : `${orderCode}_SIM`;
                const res = await lockSimulatorSlot({
                  simulatorName: a.simulatorName,
                  bookingDate: params.eventDate,
                  bookingTime: a.slotLabel,
                  sourceOrderId: slotOrderId,
                  customerName: `${params.organizationName} (Org Reservation)`,
                  customerPhone: params.contactPhone,
                  status: 'CONFIRMED'
                });
                if (res.success) {
                  simSlotsBlocked++;
                } else {
                  console.warn(`[Org Booking] Could not lock sim slot ${a.simulatorName} @ ${a.slotLabel}:`, res.error);
                }
              }
            }
          }
        }

        revalidatePath("/admin/slots");
      } catch (simErr) {
        console.error("[Org Booking] Simulator blocking error (non-fatal, RC reservation still created):", simErr);
        // Non-fatal — RC reservation is already committed
      }
    }
    // ── End Simulator Blocking ──────────────────────────────────────────────

    return {
      success: true,
      orderNumber: result.orderNumber,
      primaryId: result.primaryId,
      orderCode,
      simSlotsBlocked
    };
  } catch (err: any) {
    console.error("[createOrganisationBookingAction Error]", err);
    return { success: false, error: err.message || "An unexpected error occurred while creating organisation reservation." };
  }
}
