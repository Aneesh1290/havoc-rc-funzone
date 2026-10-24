import { NextRequest, NextResponse } from "next/server";
import {
  normalizePhone,
  verifyDeskOtp,
  deleteDeskOtp,
  isBookingForToday,
} from "@/lib/deskOtpStore";
import { getBookingsByPhone, attendPaidBookings } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = body?.phone;
    const rawOtp = body?.otp;
    const countryCode = (body?.countryCode || "+91").trim();

    if (!rawPhone || !rawOtp) {
      return NextResponse.json(
        { success: false, error: "Phone and 4-digit OTP are required." },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhone(rawPhone);
    const cleanOtp = String(rawOtp).trim();

    if (cleanOtp.length !== 4) {
      return NextResponse.json(
        { success: false, error: "Please enter the complete 4-digit verification code." },
        { status: 400 }
      );
    }

    // Verify against in-memory store
    const isValid = verifyDeskOtp(cleanPhone, cleanOtp, countryCode);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired OTP. Please double-check or request a new code.",
        },
        { status: 400 }
      );
    }

    // Clear OTP once verified
    deleteDeskOtp(cleanPhone, countryCode);

    // Retrieve today's sessions for this customer
    const allBookings = getBookingsByPhone(cleanPhone);
    const todayBookings = allBookings.filter((b) => {
      const isCanceled =
        (b.fulfillment_status || "").toLowerCase() === "canceled" ||
        (b.payment_status || "").toLowerCase() === "refunded";
      if (isCanceled) return false;
      return isBookingForToday(b.booking_date);
    });

    // Auto-fulfill already paid sessions
    const paidBookingIds = todayBookings
      .filter((b) => (b.payment_status || "").toLowerCase() === "paid")
      .map((b) => b.id);

    if (paidBookingIds.length > 0) {
      attendPaidBookings(paidBookingIds);
    }

    // Re-fetch fresh statuses
    const freshBookings = getBookingsByPhone(cleanPhone).filter((b) => {
      const isCanceled =
        (b.fulfillment_status || "").toLowerCase() === "canceled" ||
        (b.payment_status || "").toLowerCase() === "refunded";
      if (isCanceled) return false;
      return isBookingForToday(b.booking_date);
    });

    const formattedSessions = freshBookings.map((b) => {
      const rawAmount = Number(b.total_amount || 0);
      const baseAmount = (b.ticket_price || 0) * (b.quantity || 1);
      const effectiveAmount =
        rawAmount > baseAmount
          ? rawAmount
          : baseAmount > 0
          ? Math.round(baseAmount * 1.18)
          : rawAmount;

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
      };
    });

    const unpaidSessions = formattedSessions.filter(
      (s) => (s.payment_status || "").toLowerCase() !== "paid"
    );

    const totalDue = unpaidSessions.reduce((sum, s) => sum + s.total_amount, 0);

    const customerName =
      formattedSessions.find((b) => b.ticket_name)?.ticket_name ? (todayBookings[0]?.customer_name || "Guest Customer") : "Guest Customer";

    return NextResponse.json({
      success: true,
      message: "Customer OTP verified successfully.",
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
    console.error("[Desk Confirm OTP Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to confirm OTP." },
      { status: 500 }
    );
  }
}
