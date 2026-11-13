import { NextRequest, NextResponse } from "next/server";
import { normalizePhone, isBookingForToday } from "@/lib/deskOtpStore";
import { getBookingsByPhone, attendPaidBookings } from "@/lib/db";
import { syncSimulatorOrderStatus } from "@/lib/simulator-db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = body?.phone;
    const countryCode = (body?.countryCode || "+91").trim();

    if (!rawPhone) {
      return NextResponse.json(
        { success: false, error: "Phone number is required." },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhone(rawPhone);

    // Retrieve today's sessions for this customer
    const allBookings = getBookingsByPhone(cleanPhone, countryCode);
    const todayBookings = allBookings.filter((b) => {
      const isCanceled =
        (b.fulfillment_status || "").toLowerCase() === "canceled" ||
        (b.payment_status || "").toLowerCase() === "refunded";
      if (isCanceled) return false;
      return isBookingForToday(b.booking_date);
    });

    if (todayBookings.length === 0) {
      return NextResponse.json(
        { success: false, error: "No active bookings found for today." },
        { status: 404 }
      );
    }

    const targetSessionIds: number[] | undefined = Array.isArray(body?.sessionIds) && body.sessionIds.length > 0
      ? body.sessionIds.map(Number)
      : undefined;

    // Auto-fulfill ONLY the selected paid sessions
    const paidBookingIds = todayBookings
      .filter((b) => (b.payment_status || "").toLowerCase() === "paid")
      .filter((b) => !targetSessionIds || targetSessionIds.includes(b.id))
      .map((b) => b.id);

    if (paidBookingIds.length > 0) {
      attendPaidBookings(paidBookingIds);
      // Automatically sync fulfillment status to Havoc Sim Podium
      paidBookingIds.forEach(bId => {
        const bk = todayBookings.find(b => b.id === bId);
        const orderRef = (bk && bk.order_number) ? bk.order_number : bId;
        syncSimulatorOrderStatus(orderRef, "Fulfilled", "Paid").catch(e => console.error("[Sync Sim Podium]", e));
      });
    }

    // Re-fetch fresh statuses for the checked-in sessions
    const freshBookings = getBookingsByPhone(cleanPhone, countryCode).filter((b) => {
      const isCanceled =
        (b.fulfillment_status || "").toLowerCase() === "canceled" ||
        (b.payment_status || "").toLowerCase() === "refunded";
      if (isCanceled) return false;
      if (!isBookingForToday(b.booking_date)) return false;
      if (targetSessionIds && !targetSessionIds.includes(b.id)) return false;
      return true;
    });

    const formattedSessions = freshBookings.map((b) => {
      const hasStoredTotal = b.total_amount !== null && b.total_amount !== undefined && !isNaN(Number(b.total_amount));
      const baseAmount = (b.ticket_price || 0) * (b.quantity || 1);
      const effectiveAmount = hasStoredTotal
        ? Number(b.total_amount)
        : baseAmount > 0
        ? Math.round(baseAmount * 1.18)
        : 0;

      return {
        id: b.id,
        order_number: b.order_number || b.id,
        booking_date: b.booking_date,
        time_slot: b.time_slot,
        quantity: b.quantity || 1,
        ticket_name: b.ticket_name || "RC Drift Session",
        ticket_price: b.ticket_price || 0,
        total_amount: effectiveAmount,
        payment_status: b.payment_status || "Unpaid",
        fulfillment_status: b.fulfillment_status || "Unfulfilled",
        payment_ref: b.payment_ref || null,
        simulator_name: b.simulator_name || null,
        simulator_slot: b.simulator_slot || null,
        slot_color: b.slot_color || null,
        slot_color_name: b.slot_color_name || null,
        wristband_number: b.wristband_number || null,
        category_wristband_number: b.category_wristband_number || null,
      };
    });

    const unpaidSessions = formattedSessions.filter(
      (s) => (s.payment_status || "").toLowerCase() !== "paid"
    );

    const totalDue = unpaidSessions.reduce((sum, s) => sum + s.total_amount, 0);

    const customerName =
      todayBookings.find((b) => b.customer_name?.trim())?.customer_name?.trim() || "Guest Customer";

    return NextResponse.json({
      success: true,
      message: "Customer check-in confirmed successfully.",
      customer_name: customerName,
      customer_phone: cleanPhone,
      auto_fulfilled_count: paidBookingIds.length,
      bookings: formattedSessions,
      has_unpaid: unpaidSessions.length > 0,
      unpaid_count: unpaidSessions.length,
      unpaid_order_ids: unpaidSessions.map((s) => s.id),
      total_due: totalDue,
    });
  } catch (error: any) {
    console.error("[Desk Direct Check-in Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to check-in customer." },
      { status: 500 }
    );
  }
}
