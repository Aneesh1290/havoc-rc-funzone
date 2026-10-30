import { NextRequest, NextResponse } from "next/server";
import { getBookingsByPhone } from "@/lib/db";
import { normalizePhone, isBookingForToday } from "@/lib/deskOtpStore";
import { getCountryByDialCode, validatePhoneNumber } from "@/lib/countries";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = body?.phone;
    const countryCode = (body?.countryCode || "+91").trim();

    if (!rawPhone || typeof rawPhone !== "string") {
      return NextResponse.json(
        { found: false, error: "Please enter a valid phone number." },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhone(rawPhone);
    const country = getCountryByDialCode(countryCode);
    const check = validatePhoneNumber(cleanPhone, country);
    if (!check.valid) {
      return NextResponse.json(
        { found: false, error: check.error || "Please enter a valid mobile number." },
        { status: 400 }
      );
    }

    // Query bookings matching phone and country code
    const matchingBookings = getBookingsByPhone(cleanPhone, countryCode);

    if (!matchingBookings || matchingBookings.length === 0) {
      return NextResponse.json({
        found: false,
        error: `No customer bookings found for phone ${countryCode} ${cleanPhone}.`,
      });
    }

    // Filter strictly for TODAY
    const todayBookings = matchingBookings.filter((b) => {
      // Exclude canceled / refunded bookings
      const isCanceled =
        (b.fulfillment_status || "").toLowerCase() === "canceled" ||
        (b.payment_status || "").toLowerCase() === "refunded";
      if (isCanceled) return false;

      return isBookingForToday(b.booking_date);
    });

    // If customer has bookings, but none for today
    if (todayBookings.length === 0) {
      const distinctDates = Array.from(
        new Set(
          matchingBookings
            .map((b) => b.booking_date)
            .filter((d) => d && d !== "UNASSIGNED")
        )
      );

      return NextResponse.json({
        found: false,
        error: `Customer found with ${matchingBookings.length} booking(s), but none are scheduled for TODAY. Scheduled dates: ${
          distinctDates.length > 0 ? distinctDates.join(", ") : "None"
        }. Desk check-in is strictly permitted on the session day only.`,
        other_dates: distinctDates,
      });
    }

    // Customer name from first booking
    const customerName =
      todayBookings.find((b) => b.customer_name?.trim())?.customer_name?.trim() ||
      "Guest Customer";

    // Format session objects for UI preview
    const formattedSessions = todayBookings.map((b) => {
      const rawAmount = Number(b.total_amount || 0);
      const baseAmount = (b.ticket_price || 0) * (b.quantity || 1);
      const effectiveAmount =
        rawAmount > 0
          ? rawAmount
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
      };
    });

    const unpaidCount = formattedSessions.filter(
      (s) => (s.payment_status || "").toLowerCase() !== "paid"
    ).length;

    const totalDue = formattedSessions
      .filter((s) => (s.payment_status || "").toLowerCase() !== "paid")
      .reduce((sum, s) => sum + s.total_amount, 0);

    return NextResponse.json({
      found: true,
      customer_name: customerName,
      customer_phone: cleanPhone,
      session_count: formattedSessions.length,
      bookings: formattedSessions,
      unpaid_count: unpaidCount,
      total_due: totalDue,
    });
  } catch (error: any) {
    console.error("[Desk Lookup API Error]", error);
    return NextResponse.json(
      { found: false, error: error.message || "Failed to lookup customer bookings." },
      { status: 500 }
    );
  }
}
