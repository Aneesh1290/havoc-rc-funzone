import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { 
  getBookingById, 
  createDeskPaymentLink, 
  getDeskPaymentLinkByToken, 
  createOnlineCheckoutHold, 
  getTickets,
  getSiteSetting
} from "@/lib/db";
import { sendPaymentLinkWhatsApp } from "@/lib/whatsapp";
import { getIciciMerchantId, getIciciAggregatorId, getIciciBaseUrl, generateIciciHash } from "@/lib/icici";
import { formatOrderNumber } from "@/lib/order-utils";

export async function POST(req: NextRequest) {
  try {
    const isEnabled = getSiteSetting("desk_payment_link_enabled", "1") !== "0";
    if (!isEnabled) {
      return NextResponse.json(
        { success: false, error: "WhatsApp payment link feature is currently disabled in Admin Settings." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { order_ids, phone, country_code, customer_name } = body;

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please select at least one unpaid session to generate a payment link." },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Customer phone number is required." },
        { status: 400 }
      );
    }

    // Retrieve bookings and calculate total due
    const validBookingIds: number[] = [];
    const holdItems: any[] = [];
    let totalDue = 0;
    let custName = customer_name || "Guest Customer";
    let custEmail = "";

    const allTickets = getTickets();
    const ticketMap = new Map(allTickets.map(t => [t.id, t]));

    for (const rawId of order_ids) {
      const idNum = Number(rawId);
      if (isNaN(idNum)) continue;
      const b = getBookingById(idNum) as any;
      if (!b) continue;

      if ((b.payment_status || "").toLowerCase() === "paid") continue;

      validBookingIds.push(b.id);
      if (b.customer_name && !customer_name) custName = b.customer_name;
      if (b.customer_email && !custEmail) custEmail = b.customer_email;

      const hasStoredTotal = b.total_amount !== null && b.total_amount !== undefined && !isNaN(Number(b.total_amount));
      const baseAmount = (b.ticket_price || 0) * (b.quantity || 1);
      const effectiveAmount = hasStoredTotal ? Number(b.total_amount) : (baseAmount > 0 ? Math.round(baseAmount * 1.18) : 0);
      totalDue += effectiveAmount;

      const ticketDef = ticketMap.get(b.ticket_id);
      holdItems.push({
        ticketId: b.ticket_id,
        ticket_id: b.ticket_id,
        ticketName: ticketDef?.name || b.ticket_name || "RC Session",
        date: b.booking_date,
        booking_date: b.booking_date,
        timeSlot: b.time_slot,
        time_slot: b.time_slot,
        quantity: b.quantity || 1,
        itemTotal: effectiveAmount,
        simulatorName: b.simulator_name,
        simulatorSlot: b.simulator_slot,
        bookingId: b.id,
      });
    }

    if (validBookingIds.length === 0 || totalDue <= 0) {
      return NextResponse.json(
        { success: false, error: "Selected sessions have zero amount due or are already paid." },
        { status: 400 }
      );
    }

    // Generate unique secure token for desk payment link
    const token = crypto.randomBytes(16).toString("hex");

    createDeskPaymentLink({
      token,
      customer_name: custName,
      customer_phone: String(phone),
      country_code: country_code || "+91",
      total_amount: totalDue,
      booking_ids: validBookingIds,
    });

    // Create online checkout hold so ICICI can verify against tempTxnId
    const attemptSuffix = Date.now().toString().slice(-6);
    const tempTxnId = `TXN_RC_${attemptSuffix}`;

    createOnlineCheckoutHold({
      txn_id: tempTxnId,
      customer_name: custName,
      customer_email: custEmail,
      customer_phone: String(phone),
      amount: totalDue,
      items_json: JSON.stringify(holdItems),
      whatsapp_consent: 1,
    });

    // Resolve base application URL
    const returnBase = process.env.ICICI_RETURN_BASE 
      || process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.NODE_ENV === 'production' 
          ? 'https://havocrcfunzone.com' 
          : `${req.nextUrl.protocol}//${req.nextUrl.host}`);

    const paymentPageUrl = `${returnBase}/pay/${token}`;

    // Prepare item summary
    const orderSummary = holdItems.map(i => `${i.quantity}x ${i.ticketName} (${i.timeSlot})`).join(", ");

    // Fetch custom brand name from site settings (defaults to "Havoc RC Fun Zone")
    const brandName = getSiteSetting("desk_payment_brand_name", "Havoc RC Fun Zone");

    // Send WhatsApp notification
    const waResult = await sendPaymentLinkWhatsApp({
      customerName: custName,
      customerPhone: String(phone),
      countryCode: country_code || "+91",
      totalAmount: totalDue,
      paymentUrl: paymentPageUrl,
      brandName: brandName,
      orderSummary: orderSummary,
    });

    return NextResponse.json({
      success: true,
      message: waResult.message || "Payment link generated successfully.",
      payment_url: paymentPageUrl,
      wa_me_url: waResult.waMeUrl,
      total_amount: totalDue,
      token,
      customer_phone: phone,
      session_count: validBookingIds.length,
    });
  } catch (error: any) {
    console.error("[Send Payment Link Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate and send payment link." },
      { status: 500 }
    );
  }
}

