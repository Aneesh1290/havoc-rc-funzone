import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { 
  getAllBookings, 
  getBookingById, 
  createDeskPaymentLink, 
  createOnlineCheckoutHold, 
  markBookingsAdvanceNotified,
  getTickets, 
  getSiteSetting 
} from "@/lib/db";
import { sendPaymentLinkWhatsApp } from "@/lib/whatsapp";
import { checkSessionAction } from "@/app/login/actions";

interface AdvanceCandidate {
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  timeSlot: string;
  totalAmount: number;
  sessionCount: number;
  bookingIds: number[];
  itemsSummary: string;
  advanceNotifiedAt: string | null;
}

// GET: Returns list of upcoming advance bookings eligible for reminder notification
export async function GET(req: NextRequest) {
  try {
    const isEnabled = getSiteSetting("advance_notify_enabled", "1") !== "0";
    const hoursBefore = parseInt(getSiteSetting("advance_notify_hours_before", "24"), 10) || 24;

    const allBookings = getAllBookings() as any[];

    // Group unpaid / pay-at-desk bookings that are not canceled
    const ordersMap = new Map<number, any[]>();
    for (const b of allBookings) {
      const isPaid = (b.payment_status || "").toLowerCase() === "paid";
      const isCanceled = (b.fulfillment_status || "").toLowerCase() === "canceled" || (b.payment_status || "").toLowerCase() === "refunded";
      if (isPaid || isCanceled) continue;

      const orderNum = b.order_number || b.id;
      if (!ordersMap.has(orderNum)) {
        ordersMap.set(orderNum, []);
      }
      ordersMap.get(orderNum)!.push(b);
    }

    const candidates: AdvanceCandidate[] = [];

    for (const [orderNum, items] of ordersMap.entries()) {
      if (items.length === 0) continue;
      const first = items[0];

      // Calculate total amount due for this order
      let orderTotal = 0;
      for (const item of items) {
        const hasStoredTotal = item.total_amount !== null && item.total_amount !== undefined && !isNaN(Number(item.total_amount));
        const baseAmount = (item.ticket_price || 0) * (item.quantity || 1);
        const effectiveAmount = hasStoredTotal ? Number(item.total_amount) : (baseAmount > 0 ? Math.round(baseAmount * 1.18) : 0);
        orderTotal += effectiveAmount;
      }

      if (orderTotal <= 0) continue;

      const summary = items.map(i => `${i.quantity}x ${i.ticket_name} (${i.time_slot})`).join(", ");

      candidates.push({
        orderNumber: orderNum,
        customerName: first.customer_name || "Guest Customer",
        customerPhone: first.customer_phone || "",
        bookingDate: first.booking_date,
        timeSlot: first.time_slot,
        totalAmount: orderTotal,
        sessionCount: items.length,
        bookingIds: items.map(i => i.id),
        itemsSummary: summary,
        advanceNotifiedAt: first.advance_notified_at || null,
      });
    }

    return NextResponse.json({
      success: true,
      enabled: isEnabled,
      hours_before: hoursBefore,
      candidates,
    });
  } catch (err: any) {
    console.error("[Advance Notification Candidates Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Dispatches advance notification with payment link for specific order or bulk orders
export async function POST(req: NextRequest) {
  try {
    const isEnabled = getSiteSetting("advance_notify_enabled", "1") !== "0";
    if (!isEnabled) {
      return NextResponse.json(
        { success: false, error: "Advance Booking Notifications are disabled in Admin Settings." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { order_numbers, booking_ids, auto } = body;

    let targetBookingIds: number[] = [];

    if (Array.isArray(booking_ids) && booking_ids.length > 0) {
      targetBookingIds = booking_ids.map(Number).filter(n => !isNaN(n));
    } else if (Array.isArray(order_numbers) && order_numbers.length > 0) {
      const allBookings = getAllBookings() as any[];
      targetBookingIds = allBookings
        .filter(b => order_numbers.includes(b.order_number || b.id))
        .map(b => b.id);
    } else if (auto) {
      const allBookings = getAllBookings() as any[];
      targetBookingIds = allBookings
        .filter(b => {
          const isPaid = (b.payment_status || "").toLowerCase() === "paid";
          const isCanceled = (b.fulfillment_status || "").toLowerCase() === "canceled" || (b.payment_status || "").toLowerCase() === "refunded";
          const isNotified = Boolean(b.advance_notified_at);
          return !isPaid && !isCanceled && !isNotified && Boolean(b.customer_phone);
        })
        .map(b => b.id);
    }

    if (targetBookingIds.length === 0) {
      return NextResponse.json(
        { success: false, error: auto ? "No eligible unpaid bookings found waiting for advance notification." : "Please provide order_numbers or booking_ids to dispatch advance notifications." },
        { status: 400 }
      );
    }

    const allTickets = getTickets();
    const ticketMap = new Map(allTickets.map(t => [t.id, t]));

    // Group target bookings by order_number
    const orderGroups = new Map<number, any[]>();
    for (const bId of targetBookingIds) {
      const b = getBookingById(bId) as any;
      if (!b) continue;
      if ((b.payment_status || "").toLowerCase() === "paid") continue;

      const orderNum = b.order_number || b.id;
      if (!orderGroups.has(orderNum)) {
        orderGroups.set(orderNum, []);
      }
      orderGroups.get(orderNum)!.push(b);
    }

    if (orderGroups.size === 0) {
      return NextResponse.json(
        { success: false, error: "All selected bookings are already paid or invalid." },
        { status: 400 }
      );
    }

    const brandName = getSiteSetting("advance_notify_brand_name", "Havoc RC Fun Zone");
    const templateName = getSiteSetting("advance_notify_template", "havoc_payment_link");
    const returnBase = process.env.ICICI_RETURN_BASE 
      || process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.NODE_ENV === 'production' 
          ? 'https://havocrcfunzone.com' 
          : `${req.nextUrl.protocol}//${req.nextUrl.host}`);

    let sentCount = 0;
    const results: any[] = [];

    for (const [orderNum, items] of orderGroups.entries()) {
      const first = items[0];
      const custName = first.customer_name || "Guest Customer";
      const custPhone = first.customer_phone || "";
      const custEmail = first.customer_email || "";

      if (!custPhone) continue;

      let orderTotal = 0;
      const holdItems: any[] = [];

      for (const item of items) {
        const hasStoredTotal = item.total_amount !== null && item.total_amount !== undefined && !isNaN(Number(item.total_amount));
        const baseAmount = (item.ticket_price || 0) * (item.quantity || 1);
        const effectiveAmount = hasStoredTotal ? Number(item.total_amount) : (baseAmount > 0 ? Math.round(baseAmount * 1.18) : 0);
        orderTotal += effectiveAmount;

        const ticketDef = ticketMap.get(item.ticket_id);
        holdItems.push({
          ticketId: item.ticket_id,
          ticket_id: item.ticket_id,
          ticketName: ticketDef?.name || item.ticket_name || "RC Session",
          date: item.booking_date,
          booking_date: item.booking_date,
          timeSlot: item.time_slot,
          time_slot: item.time_slot,
          quantity: item.quantity || 1,
          itemTotal: effectiveAmount,
          simulatorName: item.simulator_name,
          simulatorSlot: item.simulator_slot,
          bookingId: item.id,
        });
      }

      if (orderTotal <= 0) continue;

      // Generate unique secure token for payment link
      const token = crypto.randomBytes(16).toString("hex");

      createDeskPaymentLink({
        token,
        customer_name: custName,
        customer_phone: custPhone,
        total_amount: orderTotal,
        booking_ids: items.map(i => i.id),
      });

      // Create online hold record
      const tempTxnId = `TXN_RC_${Date.now().toString().slice(-6)}`;
      createOnlineCheckoutHold({
        txn_id: tempTxnId,
        customer_name: custName,
        customer_email: custEmail,
        customer_phone: custPhone,
        amount: orderTotal,
        items_json: JSON.stringify(holdItems),
        whatsapp_consent: 1,
      });

      const paymentPageUrl = `${returnBase}/pay/${token}`;
      const orderSummary = holdItems.map(i => `${i.quantity}x ${i.ticketName} (${i.timeSlot})`).join(", ");

      const waResult = await sendPaymentLinkWhatsApp({
        customerName: custName,
        customerPhone: custPhone,
        totalAmount: orderTotal,
        paymentUrl: paymentPageUrl,
        brandName: brandName,
        orderSummary: orderSummary,
        templateName: templateName,
      });

      // Mark advance notified in DB
      markBookingsAdvanceNotified(items.map(i => i.id));
      sentCount += 1;

      results.push({
        order_number: orderNum,
        customer_name: custName,
        customer_phone: custPhone,
        total_amount: orderTotal,
        payment_url: paymentPageUrl,
        wa_me_url: waResult.waMeUrl,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Advance notifications sent for ${sentCount} order(s).`,
      sent_count: sentCount,
      orders: results,
    });
  } catch (error: any) {
    console.error("[Send Advance Notification Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to dispatch advance notifications." },
      { status: 500 }
    );
  }
}
