import { NextRequest, NextResponse } from "next/server";
import { getBookingById, collectAndFulfillBookings } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { order_ids, amount_collected, transaction_ref } = body || {};

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "No orders specified for payment collection." },
        { status: 400 }
      );
    }

    if (!transaction_ref || typeof transaction_ref !== "string" || !transaction_ref.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction Reference / Note is required (e.g. UPI Ref, Cash, POS slip).",
        },
        { status: 400 }
      );
    }

    const collectedNum = Number(amount_collected);
    if (isNaN(collectedNum) || collectedNum < 0) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid collected amount." },
        { status: 400 }
      );
    }

    // Retrieve each booking to compute exact expected total
    const bookingIdsToUpdate: number[] = [];
    let expectedTotal = 0;

    for (const rawId of order_ids) {
      const idNum = Number(rawId);
      if (isNaN(idNum)) continue;

      const booking = getBookingById(idNum) as any;
      if (booking) {
        bookingIdsToUpdate.push(booking.id);

        // If booking was already paid, expected due for this booking is 0,
        // otherwise it's the effective amount
        if ((booking.payment_status || "").toLowerCase() !== "paid") {
          const rawAmount = Number(booking.total_amount || 0);
          const baseAmount = (booking.ticket_price || 0) * (booking.quantity || 1);
          const effectiveAmount =
            rawAmount > baseAmount
              ? rawAmount
              : baseAmount > 0
              ? Math.round(baseAmount * 1.18)
              : rawAmount;

          expectedTotal += effectiveAmount;
        }
      }
    }

    if (bookingIdsToUpdate.length === 0) {
      return NextResponse.json(
        { success: false, error: "No matching bookings found to fulfill." },
        { status: 404 }
      );
    }

    // Exact amount validation guard
    if (Math.round(collectedNum) !== Math.round(expectedTotal)) {
      return NextResponse.json(
        {
          success: false,
          error: `Amount entered (₹${collectedNum.toLocaleString("en-IN")}) does not match the total due (₹${expectedTotal.toLocaleString("en-IN")}).`,
          expected_amount: expectedTotal,
          collected_amount: collectedNum,
        },
        { status: 400 }
      );
    }

    // Update statuses to ATTENDED, Paid, and record payment_ref
    collectAndFulfillBookings(bookingIdsToUpdate, transaction_ref.trim());

    return NextResponse.json({
      success: true,
      message: `Payment of ₹${collectedNum.toLocaleString("en-IN")} recorded successfully (${transaction_ref.trim()}). All sessions marked ATTENDED.`,
      updated_count: bookingIdsToUpdate.length,
      amount_collected: collectedNum,
      transaction_ref: transaction_ref.trim(),
    });
  } catch (error: any) {
    console.error("[Desk Collect & Fulfill Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record payment and fulfill orders." },
      { status: 500 }
    );
  }
}
