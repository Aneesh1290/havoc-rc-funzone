import { NextRequest, NextResponse } from "next/server";
import { getSiteSetting, getUnnotifiedTodayBookings, markBookingsAdminUpcomingNotified } from "@/lib/db";
import { getCurrentIstDetails, isBookingStartingSoon } from "@/lib/slot-time-utils";
import { dispatchUpcomingBookingAlertsToAdmins } from "@/lib/whatsapp";
import { formatOrderNumber } from "@/lib/order-utils";

export const dynamic = "force-dynamic";

/**
 * Scheduled / Cron endpoint to check upcoming bookings and dispatch
 * 30-minute prior WhatsApp reminders to configured admin numbers.
 *
 * Can be pinged every 5 to 10 minutes by an external cron (e.g. cron-job.org,
 * Render cron, EasyCron) or by an internal background poller.
 */
export async function GET(req: NextRequest) {
  return handleUpcomingCheck(req);
}

export async function POST(req: NextRequest) {
  return handleUpcomingCheck(req);
}

async function handleUpcomingCheck(req: NextRequest) {
  try {
    const isAlertsEnabled = getSiteSetting("admin_booking_alert_enabled", "1") !== "0";
    const isUpcomingEnabled = getSiteSetting("admin_upcoming_alert_enabled", "1") !== "0";

    if (!isAlertsEnabled || !isUpcomingEnabled) {
      return NextResponse.json({
        success: true,
        message: "Admin upcoming booking alerts are currently disabled in Admin Settings.",
        dispatched: 0,
      });
    }

    const { todayIstStr, nowMinutes, formattedIstTime } = getCurrentIstDetails();
    const leadMinutes = parseInt(getSiteSetting("admin_upcoming_lead_minutes", "30"), 10) || 30;
    const brandName = getSiteSetting("admin_alert_brand_name", "Havoc RC Fun Zone");
    const templateName = getSiteSetting("admin_upcoming_template", "havoc_admin_booking_reminder");

    // Fetch all active, non-canceled, unnotified bookings for today (IST)
    const rawRows = getUnnotifiedTodayBookings(todayIstStr);
    if (!rawRows || rawRows.length === 0) {
      return NextResponse.json({
        success: true,
        istTime: formattedIstTime,
        today: todayIstStr,
        leadMinutes,
        message: "No unnotified bookings scheduled for today.",
        dispatched: 0,
      });
    }

    // Group items by order_number
    const ordersMap = new Map<number, any[]>();
    for (const row of rawRows) {
      const orderNum = row.order_number || row.id;
      if (!ordersMap.has(orderNum)) {
        ordersMap.set(orderNum, []);
      }
      ordersMap.get(orderNum)!.push(row);
    }

    const dispatchedOrders: any[] = [];
    const errors: string[] = [];

    for (const [orderNum, items] of ordersMap.entries()) {
      if (!items || items.length === 0) continue;
      const first = items[0];

      // Check if any slot in this order is starting soon
      let startingItem = items.find((item) => {
        const { isStartingSoon } = isBookingStartingSoon(
          item.booking_date || todayIstStr,
          item.time_slot,
          item.start_hour,
          leadMinutes
        );
        return isStartingSoon;
      });

      if (!startingItem) {
        continue;
      }

      // Calculate total order amount
      let orderTotal = 0;
      for (const item of items) {
        const itemAmount = item.total_amount !== null && item.total_amount !== undefined
          ? Number(item.total_amount)
          : (item.ticket_price || 0) * (item.quantity || 1);
        orderTotal += itemAmount;
      }

      const formattedOrderId = formatOrderNumber(orderNum, first.order_prefix || "PAID");
      const passesSummary = items
        .map((i) => `${i.quantity}x ${i.ticket_name || "RC Pass"} (${i.time_slot})`)
        .join(", ");

      const isPaid = (first.payment_status || "").toLowerCase() === "paid";
      const paymentStatusLabel = isPaid
        ? `Paid Online (₹${orderTotal.toLocaleString("en-IN")})`
        : `Pay at Desk (₹${orderTotal.toLocaleString("en-IN")} Due)`;

      const dispatchResult = await dispatchUpcomingBookingAlertsToAdmins({
        orderId: formattedOrderId,
        customerName: first.customer_name || "Guest Customer",
        customerPhone: first.customer_phone || "",
        totalAmount: orderTotal,
        paymentStatus: paymentStatusLabel,
        itemsSummary: passesSummary,
        timeSlot: startingItem.time_slot,
        bookingDate: startingItem.booking_date || todayIstStr,
        brandName,
        templateName,
      });

      // Mark all bookings for this order as alerted so they won't trigger again
      const bookingIds = items.map((i) => i.id);
      markBookingsAdminUpcomingNotified(bookingIds);

      dispatchedOrders.push({
        orderId: formattedOrderId,
        customerName: first.customer_name,
        timeSlot: startingItem.time_slot,
        sentCount: dispatchResult.sentCount,
        bookingIds,
      });

      if (dispatchResult.errors && dispatchResult.errors.length > 0) {
        errors.push(...dispatchResult.errors);
      }
    }

    return NextResponse.json({
      success: true,
      istTime: formattedIstTime,
      today: todayIstStr,
      leadMinutes,
      dispatched: dispatchedOrders.length,
      orders: dispatchedOrders,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("[Admin Upcoming Alerts Cron Error]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process upcoming alerts" },
      { status: 500 }
    );
  }
}
