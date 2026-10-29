import { NextRequest, NextResponse } from "next/server";
import { getBookingById, cancelDeskBookings, reduceBookingQuantity, adjustBookingQuantity, eliminateBookingParticipant } from "@/lib/db";
import { deleteSimulatorSlotLocks, releaseSpecificSimulatorSlot } from "@/lib/simulator-db";
import { checkSessionAction } from "@/app/login/actions";

export async function POST(req: NextRequest) {
  try {
    const session = await checkSessionAction();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized: Please log in." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { order_ids, reason, release_slots = true, reduce_quantity, target_quantity, eliminate_participant_num } = body || {};

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "No orders specified for cancellation." },
        { status: 400 }
      );
    }

    // 0. Dedicated Specific Participant Elimination mode (e.g. Participant 1 or Participant 2 backed out)
    if (typeof eliminate_participant_num === "number" && eliminate_participant_num >= 1 && order_ids.length === 1) {
      const targetId = Number(order_ids[0]);
      const booking = getBookingById(targetId) as any;
      if (!booking) {
        return NextResponse.json({ success: false, error: "Booking session not found." }, { status: 404 });
      }

      const finalReason = reason && typeof reason === "string" && reason.trim()
        ? reason.trim()
        : `Participant ${eliminate_participant_num} Backed Out at Desk`;

      const result = eliminateBookingParticipant(targetId, eliminate_participant_num, finalReason);
      if (!result) {
        return NextResponse.json({ success: false, error: "Failed to eliminate specified participant." }, { status: 500 });
      }

      // If this participant had specific simulator slot(s), release them immediately in PostgreSQL
      if (release_slots && result.removedSlotInfo && result.removedSlotInfo.length > 0) {
        const orderPrefix = booking.order_number ? `RC_${booking.order_number}` : undefined;
        for (const slotItem of result.removedSlotInfo) {
          if (slotItem.simulatorName && slotItem.slotLabel && result.bookingDate) {
            await releaseSpecificSimulatorSlot({
              simulatorName: slotItem.simulatorName,
              bookingDate: result.bookingDate,
              bookingTime: slotItem.slotLabel,
              sourceOrderIdPrefix: orderPrefix
            }).catch((err) => {
              console.warn("[Cancel Walkout] Error releasing specific simulator slot:", slotItem, err);
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        eliminated_participant: eliminate_participant_num,
        canceled: result.canceled,
        new_quantity: result.newQuantity,
        new_total: result.newTotal,
        removed_slots: result.removedSlotInfo,
        message: result.canceled
          ? `All participants backed out. Session #${booking.order_number || targetId} canceled.`
          : `Participant ${eliminate_participant_num} eliminated. Remaining players: ${result.newQuantity}.`,
      });
    }

    // 1. Direct target quantity adjustment mode (set exact player count or add/remove multiple)
    if (typeof target_quantity === "number" && target_quantity >= 0 && order_ids.length === 1) {
      const targetId = Number(order_ids[0]);
      const booking = getBookingById(targetId) as any;
      if (!booking) {
        return NextResponse.json({ success: false, error: "Booking session not found." }, { status: 404 });
      }

      const finalReason = reason && typeof reason === "string" && reason.trim()
        ? reason.trim()
        : "Desk Player Count Adjustment";

      const adjustmentResult = adjustBookingQuantity(targetId, target_quantity, finalReason);
      if (!adjustmentResult) {
        return NextResponse.json({ success: false, error: "Failed to adjust session quantity." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        adjusted: true,
        canceled: adjustmentResult.canceled,
        new_quantity: adjustmentResult.newQuantity,
        new_total: adjustmentResult.newTotal,
        message: adjustmentResult.canceled
          ? "All participants in this ticket backed out. Session canceled."
          : `Updated player count to ${adjustmentResult.newQuantity}.`,
      });
    }

    // 2. Partial quantity reduction mode
    if (reduce_quantity && typeof reduce_quantity === "number" && reduce_quantity > 0 && order_ids.length === 1) {
      const targetId = Number(order_ids[0]);
      const booking = getBookingById(targetId) as any;
      if (!booking) {
        return NextResponse.json({ success: false, error: "Booking session not found." }, { status: 404 });
      }

      const finalReason = reason && typeof reason === "string" && reason.trim()
        ? reason.trim()
        : "Partial Walkout at Desk";

      const reductionResult = reduceBookingQuantity(targetId, reduce_quantity, finalReason);
      if (!reductionResult) {
        return NextResponse.json({ success: false, error: "Failed to reduce session quantity." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        reduced: true,
        canceled: reductionResult.canceled,
        new_quantity: reductionResult.newQuantity,
        new_total: reductionResult.newTotal,
        message: reductionResult.canceled
          ? "All participants in this ticket backed out. Session canceled."
          : `Removed ${reduce_quantity} participant(s). Remaining: ${reductionResult.newQuantity}.`,
      });
    }

    const validIds: number[] = [];
    const sourceOrderIdsToRelease: string[] = [];

    for (const rawId of order_ids) {
      const idNum = Number(rawId);
      if (isNaN(idNum)) continue;

      const booking = getBookingById(idNum) as any;
      if (booking) {
        validIds.push(booking.id);

        // Track simulator order ids or merchant txn id if present
        if (booking.order_number) {
          sourceOrderIdsToRelease.push(`RC_${booking.order_number}`);
          sourceOrderIdsToRelease.push(String(booking.order_number));
        }
      }
    }

    if (validIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No matching bookings found to cancel." },
        { status: 404 }
      );
    }

    // Cancel the bookings in local DB and tag them as desk walkout
    const finalReason = reason && typeof reason === "string" && reason.trim() 
      ? reason.trim() 
      : "Customer Not Interested / Walkout";
    cancelDeskBookings(validIds, finalReason);

    // Release simulator locks if requested
    if (release_slots && sourceOrderIdsToRelease.length > 0) {
      for (const srcId of sourceOrderIdsToRelease) {
        await deleteSimulatorSlotLocks(srcId).catch((err) => {
          console.warn("[Cancel Walkout] Error releasing simulator slot lock:", srcId, err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully released ${validIds.length} session(s) and marked as '${finalReason}'.`,
      canceled_count: validIds.length,
      canceled_ids: validIds,
    });
  } catch (error: any) {
    console.error("[Cancel Walkout API Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cancel sessions." },
      { status: 500 }
    );
  }
}
