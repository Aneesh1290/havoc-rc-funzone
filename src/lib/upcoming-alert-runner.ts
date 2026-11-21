import { getSiteSetting, getUnnotifiedTodayBookings, markBookingsAdminUpcomingNotified } from "@/lib/db";
import { getCurrentIstDetails, isBookingStartingSoon } from "@/lib/slot-time-utils";
import { dispatchUpcomingBookingAlertsToAdmins } from "@/lib/whatsapp";
import { formatOrderNumber } from "@/lib/order-utils";

export interface UpcomingAlertResult {
  success: boolean;
  message?: string;
  istTime: string;
  today: string;
  leadMinutes: number;
  dispatched: number;
  orders: any[];
  errors?: string[];
  error?: string;
}

export interface UpcomingOrderInfo {
  orderNumber: number;
  formattedOrderId: string;
  customerName: string;
  customerPhone: string;
  orderTotal: number;
  isPaid: boolean;
  orderPrefix: string;
  items: any[];
  startingSlot: string;
  bookingDate: string;
  bookingIds: number[];
}

/**
 * Checks for upcoming bookings starting within `leadMinutes` (default 30 mins)
 * and dispatches WhatsApp alerts to configured admin phone numbers.
 *
 * If `admin_consolidate_slot_alerts` is enabled and multiple bookings exist
 * for the same upcoming slot, it sends 1 consolidated slot summary message
 * instead of multiple separate chimes.
 */
export async function runUpcomingBookingAlertsCheck(): Promise<UpcomingAlertResult> {
  const isAlertsEnabled = getSiteSetting("admin_booking_alert_enabled", "1") !== "0";
  const isUpcomingEnabled = getSiteSetting("admin_upcoming_alert_enabled", "1") !== "0";
  const consolidateSlotAlerts = getSiteSetting("admin_consolidate_slot_alerts", "1") !== "0";

  const { todayIstStr, formattedIstTime } = getCurrentIstDetails();
  const leadMinutes = parseInt(getSiteSetting("admin_upcoming_lead_minutes", "30"), 10) || 30;
  const brandName = getSiteSetting("admin_alert_brand_name", "Havoc RC Fun Zone");
  const templateName = getSiteSetting("admin_upcoming_template", "havoc_admin_booking_reminder");

  if (!isAlertsEnabled || !isUpcomingEnabled) {
    return {
      success: true,
      message: "Admin upcoming booking alerts are currently disabled in Admin Settings.",
      istTime: formattedIstTime,
      today: todayIstStr,
      leadMinutes,
      dispatched: 0,
      orders: [],
    };
  }

  // Fetch all active, non-canceled, unnotified bookings for today (IST)
  const rawRows = getUnnotifiedTodayBookings(todayIstStr);
  if (!rawRows || rawRows.length === 0) {
    return {
      success: true,
      istTime: formattedIstTime,
      today: todayIstStr,
      leadMinutes,
      message: `No unnotified bookings scheduled for today (${todayIstStr}).`,
      dispatched: 0,
      orders: [],
    };
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

  // Find orders that have an item starting soon
  const upcomingOrders: UpcomingOrderInfo[] = [];

  for (const [orderNum, items] of ordersMap.entries()) {
    if (!items || items.length === 0) continue;
    const first = items[0];

    const startingItem = items.find((item) => {
      const { isStartingSoon } = isBookingStartingSoon(
        item.booking_date || todayIstStr,
        item.time_slot,
        item.start_hour,
        leadMinutes
      );
      return isStartingSoon;
    });

    if (!startingItem) continue;

    let orderTotal = 0;
    for (const item of items) {
      const itemAmount = item.total_amount !== null && item.total_amount !== undefined
        ? Number(item.total_amount)
        : (item.ticket_price || 0) * (item.quantity || 1);
      orderTotal += itemAmount;
    }

    const isPaid = (first.payment_status || "").toLowerCase() === "paid";
    const formattedOrderId = formatOrderNumber(orderNum, first.order_prefix || (isPaid ? "PAID" : "PAYDUE"));
    const bookingIds = items.map((i) => i.id);

    upcomingOrders.push({
      orderNumber: orderNum,
      formattedOrderId,
      customerName: (first.customer_name || "Guest Customer").trim(),
      customerPhone: (first.customer_phone || "").trim(),
      orderTotal,
      isPaid,
      orderPrefix: first.order_prefix || (isPaid ? "PAID" : "PAYDUE"),
      items,
      startingSlot: startingItem.time_slot,
      bookingDate: startingItem.booking_date || todayIstStr,
      bookingIds,
    });
  }

  if (upcomingOrders.length === 0) {
    return {
      success: true,
      istTime: formattedIstTime,
      today: todayIstStr,
      leadMinutes,
      message: `Checked at ${formattedIstTime} IST — no bookings are starting within ${leadMinutes} minutes.`,
      dispatched: 0,
      orders: [],
    };
  }

  const dispatchedOrders: any[] = [];
  const errors: string[] = [];

  if (consolidateSlotAlerts) {
    // ── CONSOLIDATED SLOT MODE ──────────────────────────────────────────────
    // Group upcoming orders by their starting time slot (e.g. "5PM-6PM")
    const slotsMap = new Map<string, UpcomingOrderInfo[]>();
    for (const ord of upcomingOrders) {
      const slot = ord.startingSlot;
      if (!slotsMap.has(slot)) {
        slotsMap.set(slot, []);
      }
      slotsMap.get(slot)!.push(ord);
    }

    for (const [timeSlot, slotOrders] of slotsMap.entries()) {
      if (slotOrders.length === 1) {
        // Only 1 order for this slot: send the regular single-order card
        const ord = slotOrders[0];
        const passesSummary = ord.items
          .map((i) => `${i.quantity}x ${i.ticket_name || "RC Pass"}`)
          .join(", ");
        const paymentStatusLabel = ord.isPaid
          ? `Paid Online (₹${ord.orderTotal.toLocaleString("en-IN")})`
          : `Pay at Desk (₹${ord.orderTotal.toLocaleString("en-IN")} Due)`;

        const dispatchResult = await dispatchUpcomingBookingAlertsToAdmins({
          orderId: ord.formattedOrderId,
          customerName: ord.customerName,
          customerPhone: ord.customerPhone,
          totalAmount: ord.orderTotal,
          paymentStatus: paymentStatusLabel,
          itemsSummary: passesSummary,
          timeSlot: ord.startingSlot,
          bookingDate: ord.bookingDate,
          brandName,
          templateName,
        });

        markBookingsAdminUpcomingNotified(ord.bookingIds);

        dispatchedOrders.push({
          type: "single",
          orderId: ord.formattedOrderId,
          customerName: ord.customerName,
          timeSlot: ord.startingSlot,
          sentCount: dispatchResult.sentCount,
          bookingIds: ord.bookingIds,
        });

        if (dispatchResult.errors && dispatchResult.errors.length > 0) {
          errors.push(...dispatchResult.errors);
        }
      } else {
        // Multiple orders for this slot: compile 1 Consolidated Slot Summary message
        const totalOrders = slotOrders.length;
        const totalRacers = slotOrders.reduce(
          (sum, ord) => sum + ord.items.reduce((s, i) => s + (Number(i.quantity) || 1), 0),
          0
        );
        const totalRevenue = slotOrders.reduce((sum, ord) => sum + ord.orderTotal, 0);
        const paidCount = slotOrders.filter((ord) => ord.isPaid).length;
        const deskDueCount = totalOrders - paidCount;

        // Build guest lines
        const guestLines: string[] = [];
        for (let idx = 0; idx < slotOrders.length; idx++) {
          const ord = slotOrders[idx];
          const nameParts = (ord.customerName || "Guest").trim().split(/\s+/);
          const shortName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1][0]}.` : nameParts[0];
          const phoneLast = ord.customerPhone ? ord.customerPhone.replace(/\D/g, "").slice(-4) : "";
          const phoneTag = phoneLast ? `(..${phoneLast})` : "";
          const passSummary = ord.items.map((i) => `${i.quantity}x ${i.ticket_name || "Pass"}`).join(", ");
          const payBadge = ord.isPaid ? "Paid" : `Due ₹${ord.orderTotal}`;

          guestLines.push(`${idx + 1}. #${ord.orderNumber} ${shortName} ${phoneTag}: ${passSummary} [${payBadge}]`);
        }

        // Limit guestList length to stay safely under Meta WhatsApp 1024-char body variable limit
        let guestListStr = guestLines.join("\n");
        if (guestListStr.length > 900) {
          const trimmedLines: string[] = [];
          let currentLen = 0;
          for (let i = 0; i < guestLines.length; i++) {
            if (currentLen + guestLines[i].length + 40 > 850) {
              const remaining = guestLines.length - i;
              trimmedLines.push(`+ ${remaining} more booking${remaining > 1 ? "s" : ""}...`);
              break;
            }
            trimmedLines.push(guestLines[i]);
            currentLen += guestLines[i].length + 1;
          }
          guestListStr = trimmedLines.join("\n");
        }

        const consolidatedPayload = {
          orderId: `${totalOrders} Orders (${timeSlot})`,
          customerName: `Slot Summary (${totalOrders} Bookings • ${totalRacers} Racers)`,
          customerPhone: `${paidCount} Paid • ${deskDueCount} Due at Desk`,
          totalAmount: totalRevenue,
          paymentStatus: `Total: ₹${totalRevenue.toLocaleString("en-IN")} (${paidCount} Paid, ${deskDueCount} Due)`,
          itemsSummary: guestListStr,
          timeSlot: timeSlot,
          bookingDate: slotOrders[0].bookingDate,
          brandName,
          templateName,
        };

        const dispatchResult = await dispatchUpcomingBookingAlertsToAdmins(consolidatedPayload);

        // Mark all booking IDs across all orders in this slot as alerted
        const allBookingIds = slotOrders.flatMap((ord) => ord.bookingIds);
        markBookingsAdminUpcomingNotified(allBookingIds);

        dispatchedOrders.push({
          type: "consolidated_slot",
          timeSlot,
          totalOrders,
          totalRacers,
          totalRevenue,
          orderIds: slotOrders.map((o) => o.formattedOrderId),
          sentCount: dispatchResult.sentCount,
          bookingIds: allBookingIds,
        });

        if (dispatchResult.errors && dispatchResult.errors.length > 0) {
          errors.push(...dispatchResult.errors);
        }
      }
    }
  } else {
    // ── INDIVIDUAL ORDER MODE ───────────────────────────────────────────────
    for (const ord of upcomingOrders) {
      const passesSummary = ord.items
        .map((i) => `${i.quantity}x ${i.ticket_name || "RC Pass"} (${i.time_slot})`)
        .join(", ");
      const paymentStatusLabel = ord.isPaid
        ? `Paid Online (₹${ord.orderTotal.toLocaleString("en-IN")})`
        : `Pay at Desk (₹${ord.orderTotal.toLocaleString("en-IN")} Due)`;

      const dispatchResult = await dispatchUpcomingBookingAlertsToAdmins({
        orderId: ord.formattedOrderId,
        customerName: ord.customerName,
        customerPhone: ord.customerPhone,
        totalAmount: ord.orderTotal,
        paymentStatus: paymentStatusLabel,
        itemsSummary: passesSummary,
        timeSlot: ord.startingSlot,
        bookingDate: ord.bookingDate,
        brandName,
        templateName,
      });

      markBookingsAdminUpcomingNotified(ord.bookingIds);

      dispatchedOrders.push({
        type: "single",
        orderId: ord.formattedOrderId,
        customerName: ord.customerName,
        timeSlot: ord.startingSlot,
        sentCount: dispatchResult.sentCount,
        bookingIds: ord.bookingIds,
      });

      if (dispatchResult.errors && dispatchResult.errors.length > 0) {
        errors.push(...dispatchResult.errors);
      }
    }
  }

  return {
    success: true,
    istTime: formattedIstTime,
    today: todayIstStr,
    leadMinutes,
    dispatched: dispatchedOrders.length,
    orders: dispatchedOrders,
    errors: errors.length > 0 ? errors : undefined,
  };
}
