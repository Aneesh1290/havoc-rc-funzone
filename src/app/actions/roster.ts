"use server";

import { getBookingsForSlotRoster, getTimeSlots } from "@/lib/db";
import { verifySlotRosterToken } from "@/lib/roster-token";
import { checkSessionAction } from "@/app/login/actions";
import { formatOrderNumber } from "@/lib/order-utils";
import { getSlotWristbandColor } from "@/lib/slotColors";

export interface RosterOrderItem {
  orderNumber: number;
  formattedOrderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  totalAmount: number;
  paymentStatus: string;
  isPaid: boolean;
  orderPrefix: string;
  items: Array<{
    id: number;
    ticketName: string;
    quantity: number;
    price: number;
    isAddon: boolean;
    simulatorName?: string;
    simulatorSlot?: string;
  }>;
  totalRacers: number;
  created_at?: string;
}

export interface SlotRosterData {
  timeSlot: string;
  bookingDate: string;
  displayDate: string;
  wristbandColor: {
    hex: string;
    name: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    ringClass: string;
  };
  totalOrders: number;
  totalRacers: number;
  totalRevenue: number;
  paidRevenue: number;
  dueRevenue: number;
  paidCount: number;
  dueCount: number;
  orders: RosterOrderItem[];
  isAuthorized: boolean;
}

export async function fetchSlotRosterAction(date: string, slot: string, token?: string): Promise<{
  success: boolean;
  data?: SlotRosterData;
  error?: string;
}> {
  try {
    const isTokenValid = verifySlotRosterToken(date, slot, token);
    const session = await checkSessionAction();

    if (!isTokenValid && !session) {
      return { success: false, error: "Access expired or invalid link. Please open from your WhatsApp alert or log in as Admin." };
    }

    const rawBookings = getBookingsForSlotRoster(date, slot);

    // Group bookings by order_number
    const orderMap = new Map<number, any[]>();
    for (const b of rawBookings) {
      const orderNum = b.order_number || b.id;
      if (!orderMap.has(orderNum)) {
        orderMap.set(orderNum, []);
      }
      orderMap.get(orderNum)!.push(b);
    }

    const orders: RosterOrderItem[] = [];
    let totalRacers = 0;
    let totalRevenue = 0;
    let paidRevenue = 0;
    let dueRevenue = 0;
    let paidCount = 0;
    let dueCount = 0;

    for (const [orderNum, items] of orderMap.entries()) {
      const first = items[0];
      const isPaid = (first.payment_status || "").toLowerCase() === "paid";
      let orderTotal = 0;
      let orderRacers = 0;

      const mappedItems = items.map(item => {
        const itemQty = item.quantity || 1;
        const baseAmount = (item.ticket_price || 0) * itemQty;
        const itemTotal = (item.total_amount !== null && item.total_amount !== undefined && !isNaN(Number(item.total_amount)))
          ? Number(item.total_amount) 
          : Math.round(baseAmount * 1.18);
        orderTotal += itemTotal;

        if (!item.is_addon) {
          orderRacers += itemQty;
        }

        return {
          id: item.id,
          ticketName: item.ticket_name || "Pass",
          quantity: itemQty,
          price: item.ticket_price || 0,
          isAddon: Boolean(item.is_addon),
          simulatorName: item.simulator_name,
          simulatorSlot: item.simulator_slot,
        };
      });

      totalRacers += orderRacers;
      totalRevenue += orderTotal;

      if (isPaid) {
        paidRevenue += orderTotal;
        paidCount++;
      } else {
        dueRevenue += orderTotal;
        dueCount++;
      }

      orders.push({
        orderNumber: orderNum,
        formattedOrderId: formatOrderNumber(orderNum, first.order_prefix || (isPaid ? "PAID" : "PAYDUE")),
        customerName: first.customer_name || "Guest Customer",
        customerPhone: first.customer_phone || "",
        customerEmail: first.customer_email || "",
        totalAmount: orderTotal,
        paymentStatus: first.payment_status || (isPaid ? "Paid" : "Due at Desk"),
        isPaid,
        orderPrefix: first.order_prefix || (isPaid ? "PAID" : "PAYDUE"),
        items: mappedItems,
        totalRacers: orderRacers,
        created_at: first.created_at,
      });
    }

    // Get slot wristband color
    const slots = getTimeSlots(false);
    const matchedSlot = slots.find(s => s.label.toLowerCase() === slot.toLowerCase());
    const wristbandColor = getSlotWristbandColor(slot, matchedSlot?.color, matchedSlot?.color_name);

    return {
      success: true,
      data: {
        timeSlot: slot,
        bookingDate: date,
        displayDate: date,
        wristbandColor,
        totalOrders: orders.length,
        totalRacers,
        totalRevenue,
        paidRevenue,
        dueRevenue,
        paidCount,
        dueCount,
        orders,
        isAuthorized: true,
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load slot roster" };
  }
}
