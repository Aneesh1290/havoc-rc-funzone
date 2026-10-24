"use server";

import { 
  initDB, 
  getTickets, 
  updateTicketStatus, 
  updateTicket, 
  createTicket,
  deleteTicket,
  TicketRow, 
  getBookedQuantities, 
  addBooking, 
  addBatchBooking,
  BatchBookingItem,
  getAllBookings,
  getCoupons,
  createCoupon,
  bulkCreateCoupons,
  deleteCoupon,
  deleteAllCoupons,
  deleteMultipleCoupons,
  bulkUpdateCouponsExpiry,
  bulkUpdateAllCouponsExpiry,
  getCouponByCode,
  incrementCouponUsage,
  CouponRow,
  getBookingById,
  getBookingsByOrderNumber,
  updateBookingStatus,
  updateOrderGroupStatus,
  updateBookingTags,
  updateOrderGroupTags,
  cancelBooking,
  cancelOrderGroup,
  deleteBookings,
  deleteOrderGroup,
  getVipPerks,
  createVipPerk,
  updateVipPerk,
  toggleVipPerkStatus,
  deleteVipPerk,
  syncSimPodiumSimulators,
  VipPerkRow,
  BlockedSlotRow,
  getBlockedSlots,
  getBlockedSlotsForDate,
  blockSlotOrDate,
  unblockSlot,
  TimeSlotRow,
  getTimeSlots,
  createTimeSlot,
  updateTimeSlot,
  toggleTimeSlotStatus,
  deleteTimeSlot,
  getSiteSetting,
  setSiteSetting,
  getAllAdminUsers,
  getAdminUserById,
  getAdminUserByUsername,
  createAdminStaffUser,
  updateStaffRoleAndPerms,
  resetStaffUserPassword,
  deleteStaffUser
} from "@/lib/db";
import { 
  getTakenSimulatorSlots, 
  lockSimulatorSlot, 
  releaseSimulatorSlots, 
  parseSimulatorSlotAssignments,
  getSimPodiumSimulators,
  getSimPodiumSlots,
  SimPodiumSlot
} from "@/lib/simulator-db";
import { formatOrderNumber } from "@/lib/order-utils";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { sendBookingConfirmationWhatsApp } from "@/lib/whatsapp";
import { checkSessionAction } from "@/app/login/actions";
import { hasUserPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// Ensure DB is initialized
initDB();

export async function fetchTakenSimulatorSlotsAction(simulatorName: string, date: string): Promise<string[]> {
  try {
    return await getTakenSimulatorSlots(simulatorName, date);
  } catch (err) {
    console.error("fetchTakenSimulatorSlotsAction error:", err);
    return [];
  }
}

export async function fetchSimPodiumSlotsAction(): Promise<SimPodiumSlot[]> {
  try {
    return await getSimPodiumSlots();
  } catch (err) {
    console.error("fetchSimPodiumSlotsAction error:", err);
    return [];
  }
}

export async function fetchTicketsAction(): Promise<TicketRow[]> {
  return getTickets();
}

export async function fetchBookedQuantitiesAction(date: string, timeSlot: string): Promise<{ ticket_id: number, total_booked: number }[]> {
  return getBookedQuantities(date, timeSlot);
}

export async function addBookingAction(
  ticketId: number, 
  date: string, 
  timeSlot: string, 
  quantity: number, 
  customerName: string, 
  customerEmail: string, 
  customerPhone: string, 
  totalAmount: number,
  simulatorName?: string,
  simulatorSlot?: string
) {
  const result = addBooking(ticketId, date, timeSlot, quantity, customerName, customerEmail, customerPhone, totalAmount, simulatorName, simulatorSlot);
  
  // If this booking has an attached simulator session, lock it in the shared PostgreSQL database
  if (simulatorName && simulatorSlot && result?.id) {
    try {
      const orderId = formatOrderNumber(result.id, result.createdAt);
      const assignments = parseSimulatorSlotAssignments(simulatorName, simulatorSlot);

      for (let idx = 0; idx < assignments.length; idx++) {
        const item = assignments[idx];
        if (item.simulatorName && item.slotLabel) {
          const itemOrderId = assignments.length > 1 ? `${orderId}_${idx + 1}` : orderId;
          await lockSimulatorSlot({
            simulatorName: item.simulatorName,
            bookingDate: date,
            bookingTime: item.slotLabel,
            sourceOrderId: itemOrderId,
            customerName,
            customerEmail,
            customerPhone,
            status: 'CONFIRMED'
          });
        }
      }
    } catch (pgErr) {
      console.error("Failed to sync lock to PostgreSQL simulator_slot_locks:", pgErr);
    }
  }

  // Send Email Confirmation via Gmail SMTP
  if (result?.id && customerEmail) {
    try {
      const orderId = formatOrderNumber(result.id, result.createdAt);
      const allTickets = getTickets();
      const ticketObj = allTickets.find(t => t.id === ticketId);
      const ticketName = ticketObj?.name || 'RC Fun Zone Pass';

      // Send asynchronously without blocking the user response
      sendBookingConfirmationEmail({
        orderId,
        customerName,
        customerEmail,
        customerPhone,
        ticketName,
        quantity,
        date,
        timeSlot,
        totalAmount,
        simulatorName,
        simulatorSlot,
        paymentStatus: 'Unpaid'
      }).catch(err => {
        console.error("Async confirmation email error:", err);
      });
    } catch (emailErr) {
      console.error("Failed to trigger confirmation email:", emailErr);
    }
  }

  // Send WhatsApp Booking Confirmation via Interakt
  if (result?.id && customerPhone) {
    try {
      const orderId = formatOrderNumber(result.id, result.createdAt);
      const allTickets = getTickets();
      const ticketObj = allTickets.find(t => t.id === ticketId);
      const ticketName = ticketObj?.name || 'RC Fun Zone Pass';

      sendBookingConfirmationWhatsApp({
        orderId,
        customerName,
        customerPhone,
        ticketName,
        quantity,
        date,
        timeSlot,
        totalAmount,
        simulatorName,
        simulatorSlot,
        paymentStatus: 'Unpaid'
      }).catch(err => {
        console.error("Async confirmation WhatsApp error:", err);
      });
    } catch (waErr) {
      console.error("Failed to trigger confirmation WhatsApp:", waErr);
    }
  }

  revalidatePath('/tickets');
  revalidatePath('/admin/bookings');
  revalidatePath('/admin');
  return result;
}

export async function createBatchOrderAction(
  items: BatchBookingItem[],
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  totalAmount: number
) {
  const result = addBatchBooking(items, customerName, customerEmail, customerPhone);
  if (!result) return null;

  const orderId = formatOrderNumber(result.orderNumber, result.createdAt, 'Unpaid');

  // Lock simulator slots for any items with simulator sessions
  for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
    const item = items[itemIdx];
    if (item.simulatorName && item.simulatorSlot) {
      try {
        const assignments = parseSimulatorSlotAssignments(item.simulatorName, item.simulatorSlot);
        for (let idx = 0; idx < assignments.length; idx++) {
          const assign = assignments[idx];
          if (assign.simulatorName && assign.slotLabel) {
            const itemOrderId = assignments.length > 1 || items.length > 1 
              ? `${orderId}_${itemIdx + 1}_${idx + 1}` 
              : orderId;
            await lockSimulatorSlot({
              simulatorName: assign.simulatorName,
              bookingDate: item.date,
              bookingTime: assign.slotLabel,
              sourceOrderId: itemOrderId,
              customerName,
              customerEmail,
              customerPhone,
              status: 'CONFIRMED'
            });
          }
        }
      } catch (pgErr) {
        console.error("Failed to sync lock to PostgreSQL simulator_slot_locks for batch order:", pgErr);
      }
    }
  }

  // Send ONE consolidated confirmation email for all tickets under this order
  if (customerEmail) {
    try {
      const allTickets = getTickets();
      const emailItems = items.map(item => {
        const tObj = allTickets.find(t => t.id === item.ticketId);
        return {
          ticketName: tObj?.name || 'RC Fun Zone Pass',
          quantity: item.quantity,
          date: item.date,
          timeSlot: item.timeSlot,
          itemTotal: item.itemTotal,
          simulatorName: item.simulatorName,
          simulatorSlot: item.simulatorSlot
        };
      });

      sendBookingConfirmationEmail({
        orderId,
        customerName,
        customerEmail,
        customerPhone,
        totalAmount,
        paymentStatus: 'Unpaid',
        items: emailItems
      }).catch(err => {
        console.error("Async batch confirmation email error:", err);
      });
    } catch (emailErr) {
      console.error("Failed to trigger batch confirmation email:", emailErr);
    }
  }

  // Send Consolidated WhatsApp Confirmation for all tickets under this order
  if (customerPhone) {
    try {
      const allTickets = getTickets();
      const orderItems = items.map(item => {
        const tObj = allTickets.find(t => t.id === item.ticketId);
        return {
          ticketName: tObj?.name || 'RC Fun Zone Pass',
          quantity: item.quantity,
          date: item.date,
          timeSlot: item.timeSlot,
          itemTotal: item.itemTotal,
          simulatorName: item.simulatorName,
          simulatorSlot: item.simulatorSlot
        };
      });

      sendBookingConfirmationWhatsApp({
        orderId,
        customerName,
        customerPhone,
        totalAmount,
        paymentStatus: 'Unpaid',
        items: orderItems
      }).catch(err => {
        console.error("Async batch confirmation WhatsApp error:", err);
      });
    } catch (waErr) {
      console.error("Failed to trigger batch confirmation WhatsApp:", waErr);
    }
  }

  revalidatePath('/tickets');
  revalidatePath('/admin/bookings');
  revalidatePath('/admin');

  return {
    orderNumber: result.orderNumber,
    primaryId: result.primaryId,
    orderCode: orderId,
    createdAt: result.createdAt,
    insertedIds: result.insertedIds
  };
}

export async function fetchAllBookingsAction() {
  return getAllBookings();
}

export async function fetchBookingByIdAction(id: number) {
  return getBookingById(id);
}

export async function fetchBookingsByOrderNumberAction(orderNum: number) {
  return getBookingsByOrderNumber(orderNum);
}

export async function updateBookingStatusAction(id: number, paymentStatus?: string, fulfillmentStatus?: string) {
  const session = await checkSessionAction();
  if (paymentStatus && !hasUserPermission(session, "bookings:payment")) {
    return { success: false, error: "Access denied: You do not have permission to modify payment status." };
  }
  if (fulfillmentStatus && !hasUserPermission(session, "bookings:status")) {
    return { success: false, error: "Access denied: You do not have permission to modify order fulfillment status." };
  }

  // Update all tickets under this booking's order_number if present
  const booking = getBookingById(id) as any;
  const targetNum = (booking && booking.order_number) ? booking.order_number : id;
  updateOrderGroupStatus(targetNum, paymentStatus, fulfillmentStatus);
  revalidatePath('/admin/bookings');
  revalidatePath('/admin');
  return { success: true };
}

export async function updateBookingTagsAction(id: number, tags: string) {
  const booking = getBookingById(id) as any;
  const targetNum = (booking && booking.order_number) ? booking.order_number : id;
  updateOrderGroupTags(targetNum, tags);
  revalidatePath('/admin/bookings');
  return { success: true };
}

export async function cancelBookingAction(id: number) {
  const session = await checkSessionAction();
  if (!hasUserPermission(session, "bookings:status")) {
    return { success: false, error: "Access denied: You do not have permission to cancel orders." };
  }

  const booking = getBookingById(id) as any;
  const targetNum = (booking && booking.order_number) ? booking.order_number : id;
  const groupRows = getBookingsByOrderNumber(targetNum) as any[];

  for (const b of groupRows) {
    if (b.simulator_name && b.simulator_slot) {
      try {
        const orderId = formatOrderNumber(targetNum, b.created_at);
        await releaseSimulatorSlots(orderId, b.id);
      } catch (pgErr) {
        console.error("Failed to release PostgreSQL simulator slot lock for booking", b.id, pgErr);
      }
    }
  }

  cancelOrderGroup(targetNum);
  revalidatePath('/admin/bookings');
  revalidatePath('/admin');
  return { success: true };
}

export async function deleteBookingsAction(ids: number[]) {
  const session = await checkSessionAction();
  if (!hasUserPermission(session, "bookings:delete")) {
    return { success: false, error: "Access denied: You do not have permission to delete bookings/orders." };
  }

  if (!ids || ids.length === 0) return { success: true, count: 0 };
  
  // Find all distinct order numbers represented by these IDs
  const orderNumsToDelete = new Set<number>();
  for (const id of ids) {
    const booking = getBookingById(id) as any;
    const targetNum = (booking && booking.order_number) ? booking.order_number : id;
    orderNumsToDelete.add(targetNum);
  }

  // Release any associated simulator locks
  for (const orderNum of Array.from(orderNumsToDelete)) {
    const groupRows = getBookingsByOrderNumber(orderNum) as any[];
    for (const b of groupRows) {
      if (b.simulator_name && b.simulator_slot) {
        try {
          const orderId = formatOrderNumber(orderNum, b.created_at);
          await releaseSimulatorSlots(orderId, b.id);
        } catch (pgErr) {
          console.error("Failed to release simulator slot for booking", b.id, pgErr);
        }
      }
    }
  }

  deleteOrderGroup(Array.from(orderNumsToDelete));
  revalidatePath('/admin/bookings');
  revalidatePath('/admin');
  return { success: true, count: orderNumsToDelete.size };
}

export async function toggleTicketStatusAction(id: number, active: boolean) {
  updateTicketStatus(id, active);
  revalidatePath('/admin/tickets');
  revalidatePath('/tickets');
}

export async function updateTicketAction(
  id: number, 
  price: number, 
  capacity: number,
  hasSimulatorPerk = false,
  perkDurationMins = 30,
  perkTitle = "",
  description = "",
  benefits = ""
) {
  updateTicket(id, price, capacity, hasSimulatorPerk, perkDurationMins, perkTitle, description, benefits);
  revalidatePath('/admin/tickets');
  revalidatePath('/tickets');
}

export async function createTicketAction(
  name: string, 
  price: number, 
  capacity: number,
  hasSimulatorPerk = false,
  perkDurationMins = 30,
  perkTitle = "",
  description = "",
  benefits = ""
) {
  try {
    createTicket(name, price, capacity, hasSimulatorPerk, perkDurationMins, perkTitle, description, benefits);
    revalidatePath('/admin/tickets');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create ticket" };
  }
}

export async function deleteTicketAction(id: number) {
  try {
    deleteTicket(id);
    revalidatePath('/admin/tickets');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete ticket" };
  }
}

// Coupon Actions
export async function fetchCouponsAction(): Promise<CouponRow[]> {
  return getCoupons();
}

export async function createCouponAction(code: string, discountType: 'percentage' | 'flat', value: number, maxUses: number | null, expiryDate: string | null) {
  try {
    createCoupon(code, discountType, value, maxUses, expiryDate);
    revalidatePath('/admin/coupons');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create coupon" };
  }
}

export async function bulkCreateCouponsAction(coupons: { code: string; discountType: 'percentage' | 'flat'; value: number; maxUses: number | null }[]) {
  try {
    const count = bulkCreateCoupons(coupons);
    revalidatePath('/admin/coupons');
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to bulk generate coupons" };
  }
}

export async function deleteCouponAction(id: number) {
  deleteCoupon(id);
  revalidatePath('/admin/coupons');
  return { success: true };
}

export async function deleteAllCouponsAction() {
  try {
    const result = deleteAllCoupons();
    revalidatePath('/admin/coupons');
    return { success: true, count: result.changes };
  } catch (error: any) {
    console.error("deleteAllCouponsAction error:", error);
    return { success: false, error: error.message || "Failed to clear all coupons" };
  }
}

export async function deleteMultipleCouponsAction(ids: number[]) {
  try {
    const result = deleteMultipleCoupons(ids);
    revalidatePath('/admin/coupons');
    return { success: true, count: result.changes };
  } catch (error: any) {
    console.error("deleteMultipleCouponsAction error:", error);
    return { success: false, error: error.message || "Failed to delete selected coupons" };
  }
}

export async function bulkUpdateCouponsExpiryAction(ids: number[], expiryDate: string | null) {
  try {
    const result = bulkUpdateCouponsExpiry(ids, expiryDate);
    revalidatePath('/admin/coupons');
    return { success: true, count: result.changes };
  } catch (error: any) {
    console.error("bulkUpdateCouponsExpiryAction error:", error);
    return { success: false, error: error.message || "Failed to update expiry date" };
  }
}

export async function bulkUpdateAllCouponsExpiryAction(expiryDate: string | null) {
  try {
    const result = bulkUpdateAllCouponsExpiry(expiryDate);
    revalidatePath('/admin/coupons');
    return { success: true, count: result.changes };
  } catch (error: any) {
    console.error("bulkUpdateAllCouponsExpiryAction error:", error);
    return { success: false, error: error.message || "Failed to update expiry date for all coupons" };
  }
}

export async function validateCouponAction(code: string, subtotal: number) {
  const coupon = getCouponByCode(code);
  if (!coupon) {
    return { valid: false, error: "Invalid coupon code" };
  }

  // Check max uses
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return { valid: false, error: "Coupon usage limit reached" };
  }

  // Check expiry
  if (coupon.expiry_date) {
    const today = new Date().toISOString().split('T')[0];
    if (coupon.expiry_date < today) {
      return { valid: false, error: "Coupon has expired" };
    }
  }

  // Calculate discount amount
  let discountAmount = 0;
  if (coupon.discount_type === 'percentage') {
    discountAmount = (subtotal * coupon.value) / 100;
  } else {
    discountAmount = Math.min(coupon.value, subtotal);
  }

  return {
    valid: true,
    code: coupon.code,
    discountType: coupon.discount_type,
    value: coupon.value,
    discountAmount: Math.round(discountAmount * 100) / 100,
  };
}

export async function useCouponAction(code: string) {
  incrementCouponUsage(code);
  revalidatePath('/admin/coupons');
}

// VIP Perks Actions
export async function fetchVipPerksAction(activeOnly = false): Promise<VipPerkRow[]> {
  return getVipPerks(activeOnly);
}

export async function syncSimPodiumSimulatorsAction(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const simPodiumProducts = await getSimPodiumSimulators();
    if (simPodiumProducts.length > 0) {
      const formattedForSync = simPodiumProducts.map(p => ({
        name: p.name,
        category: p.type || "Simulator",
        tagline: p.description ? p.description.split("\n")[0].slice(0, 100) : "",
        image: p.image_url || "/simulators/race-sim-gt.png"
      }));
      syncSimPodiumSimulators(formattedForSync);
      revalidatePath('/admin/vip-perks');
      revalidatePath('/tickets');
      return { success: true, count: simPodiumProducts.length };
    }
    return { success: true, count: 0 };
  } catch (err: any) {
    console.error("Could not sync Sim Podium simulators:", err);
    return { success: false, error: err.message || "Failed to sync" };
  }
}

export async function createVipPerkAction(name: string, category: string, tagline: string, image: string, sortOrder = 0) {
  try {
    createVipPerk(name, category, tagline, image, sortOrder);
    revalidatePath('/admin/vip-perks');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to create simulator/perk" };
  }
}

export async function updateVipPerkAction(id: number, name: string, category: string, tagline: string, image: string, sortOrder = 0) {
  try {
    updateVipPerk(id, name, category, tagline, image, sortOrder);
    revalidatePath('/admin/vip-perks');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to update simulator/perk" };
  }
}

export async function toggleVipPerkStatusAction(id: number, active: boolean) {
  toggleVipPerkStatus(id, active);
  revalidatePath('/admin/vip-perks');
  revalidatePath('/tickets');
}

export async function deleteVipPerkAction(id: number) {
  try {
    deleteVipPerk(id);
    revalidatePath('/admin/vip-perks');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to delete simulator/perk" };
  }
}

// Blocked Slots / Dates Server Actions
export async function fetchBlockedSlotsAction(): Promise<BlockedSlotRow[]> {
  return getBlockedSlots();
}

export async function fetchBlockedSlotsForDateAction(date: string): Promise<BlockedSlotRow[]> {
  return getBlockedSlotsForDate(date);
}

export async function blockSlotOrDateAction(date: string, timeSlot: string, reason?: string, ticketId?: number | null) {
  try {
    blockSlotOrDate(date, timeSlot, reason, ticketId);
    revalidatePath('/admin/slots');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error: any) {
    console.error("blockSlotOrDateAction error:", error);
    return { success: false, error: error.message || "Failed to block slot/date" };
  }
}

export async function blockMultipleSlotsAction(date: string, timeSlots: string[], reason?: string, ticketId?: number | null) {
  try {
    for (const slot of timeSlots) {
      blockSlotOrDate(date, slot, reason, ticketId);
    }
    revalidatePath('/admin/slots');
    revalidatePath('/tickets');
    return { success: true, count: timeSlots.length };
  } catch (error: any) {
    console.error("blockMultipleSlotsAction error:", error);
    return { success: false, error: error.message || "Failed to block slots" };
  }
}

export async function unblockSlotAction(id: number) {
  try {
    unblockSlot(id);
    revalidatePath('/admin/slots');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error: any) {
    console.error("unblockSlotAction error:", error);
    return { success: false, error: error.message || "Failed to unblock slot" };
  }
}

// Global Time Slot Management Actions
export async function fetchTimeSlotsAction(activeOnly = false): Promise<TimeSlotRow[]> {
  return getTimeSlots(activeOnly);
}

export async function createTimeSlotAction(label: string, startHour: number, endHour: number, sortOrder = 0, color?: string, colorName?: string, remark?: string) {
  try {
    createTimeSlot(label, startHour, endHour, sortOrder, color, colorName, remark);
    revalidatePath('/admin/slots');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error: any) {
    console.error("createTimeSlotAction error:", error);
    return { success: false, error: error.message || "Failed to create time slot" };
  }
}

export async function updateTimeSlotAction(id: number, label: string, startHour: number, endHour: number, sortOrder = 0, color?: string, colorName?: string, remark?: string) {
  try {
    updateTimeSlot(id, label, startHour, endHour, sortOrder, color, colorName, remark);
    revalidatePath('/admin/slots');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error: any) {
    console.error("updateTimeSlotAction error:", error);
    return { success: false, error: error.message || "Failed to update time slot" };
  }
}

export async function toggleTimeSlotStatusAction(id: number, active: boolean) {
  try {
    toggleTimeSlotStatus(id, active);
    revalidatePath('/admin/slots');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error: any) {
    console.error("toggleTimeSlotStatusAction error:", error);
    return { success: false, error: error.message || "Failed to toggle status" };
  }
}

export async function deleteTimeSlotAction(id: number) {
  try {
    deleteTimeSlot(id);
    revalidatePath('/admin/slots');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error: any) {
    console.error("deleteTimeSlotAction error:", error);
    return { success: false, error: error.message || "Failed to delete slot" };
  }
}

// Site Settings Actions (e.g. monday_open, opened_specific_dates)
export async function fetchSiteSettingAction(key: string, defaultValue = ""): Promise<string> {
  return getSiteSetting(key, defaultValue);
}

export async function updateSiteSettingAction(key: string, value: string, description?: string) {
  try {
    setSiteSetting(key, value, description);
    revalidatePath('/admin/slots');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error: any) {
    console.error("updateSiteSettingAction error:", error);
    return { success: false, error: error.message || "Failed to update setting" };
  }
}

export async function fetchOpenedSpecificDatesAction(): Promise<string[]> {
  try {
    const raw = getSiteSetting('opened_specific_dates', '[]');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export async function toggleOpenedSpecificDateAction(dateStr: string, shouldOpen: boolean) {
  try {
    const raw = getSiteSetting('opened_specific_dates', '[]');
    let current: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) current = parsed;
    } catch {}

    let updated: string[];
    if (shouldOpen) {
      updated = Array.from(new Set([...current, dateStr]));
    } else {
      updated = current.filter(d => d !== dateStr);
    }

    setSiteSetting('opened_specific_dates', JSON.stringify(updated), 'List of specifically opened dates (e.g. holiday Mondays)');
    revalidatePath('/admin/slots');
    revalidatePath('/tickets');
    return { success: true, dates: updated };
  } catch (error: any) {
    console.error("toggleOpenedSpecificDateAction error:", error);
    return { success: false, error: error.message || "Failed to update date" };
  }
}

// ==========================================
// STAFF USER MANAGEMENT SERVER ACTIONS
// ==========================================
import bcrypt from "bcryptjs";

export async function fetchStaffUsersAction() {
  try {
    const users = getAllAdminUsers();
    return { success: true, users };
  } catch (error: any) {
    console.error("fetchStaffUsersAction error:", error);
    return { success: false, error: error.message || "Failed to fetch staff accounts" };
  }
}

export async function createStaffUserAction(data: {
  username: string;
  name?: string;
  role: string;
  permissions: string[];
  customPassword?: string;
}) {
  try {
    const username = data.username?.trim().toLowerCase();
    if (!username) {
      return { success: false, error: "Username is required" };
    }

    const existing = getAdminUserByUsername(username);
    if (existing) {
      return { success: false, error: `Username '${username}' is already taken` };
    }

    const rawPassword = data.customPassword && data.customPassword.trim() ? data.customPassword.trim() : "sabharwal@65";
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const userRole = data.role === "super_admin" ? "super_admin" : "staff";
    const perms = userRole === "super_admin" ? "all" : (data.permissions && data.permissions.length > 0 ? data.permissions.join(",") : "bookings,slots");
    const displayName = data.name && data.name.trim() ? data.name.trim() : username;

    const res = createAdminStaffUser(username, passwordHash, displayName, userRole, perms, 1);
    revalidatePath('/admin/staff');
    return { success: true, id: Number(res.lastInsertRowid) };
  } catch (error: any) {
    console.error("createStaffUserAction error:", error);
    return { success: false, error: error.message || "Failed to create staff account" };
  }
}

export async function updateStaffRoleAndPermsAction(id: number, role: string, permissions: string[]) {
  try {
    const target = getAdminUserById(id);
    if (!target) return { success: false, error: "User not found" };
    if (target.username === "admin") {
      return { success: false, error: "Cannot modify the primary admin account permissions" };
    }

    const userRole = role === "super_admin" ? "super_admin" : "staff";
    const perms = userRole === "super_admin" ? "all" : permissions.join(",");

    updateStaffRoleAndPerms(id, userRole, perms);
    revalidatePath('/admin/staff');
    return { success: true };
  } catch (error: any) {
    console.error("updateStaffRoleAndPermsAction error:", error);
    return { success: false, error: error.message || "Failed to update role/permissions" };
  }
}

export async function resetStaffPasswordAction(id: number, customPassword?: string) {
  try {
    const target = getAdminUserById(id);
    if (!target) return { success: false, error: "User not found" };
    if (target.username === "admin") {
      return { success: false, error: "Cannot reset the primary admin account from staff management" };
    }

    const rawPassword = customPassword && customPassword.trim() ? customPassword.trim() : "sabharwal@65";
    if (rawPassword.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }

    const hash = await bcrypt.hash(rawPassword, 10);
    resetStaffUserPassword(id, hash, 1);
    revalidatePath('/admin/staff');
    return { success: true, message: `Password for '${target.username}' has been set successfully.` };
  } catch (error: any) {
    console.error("resetStaffPasswordAction error:", error);
    return { success: false, error: error.message || "Failed to reset password" };
  }
}

export async function deleteStaffUserAction(id: number) {
  try {
    const target = getAdminUserById(id);
    if (!target) return { success: false, error: "User not found" };
    if (target.username === "admin") {
      return { success: false, error: "Cannot delete the primary admin account" };
    }

    deleteStaffUser(id);
    revalidatePath('/admin/staff');
    return { success: true };
  } catch (error: any) {
    console.error("deleteStaffUserAction error:", error);
    return { success: false, error: error.message || "Failed to delete staff account" };
  }
}



