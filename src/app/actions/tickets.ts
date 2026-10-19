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
  getAllBookings,
  getCoupons,
  createCoupon,
  bulkCreateCoupons,
  deleteCoupon,
  deleteAllCoupons,
  deleteMultipleCoupons,
  getCouponByCode,
  incrementCouponUsage,
  CouponRow,
  getBookingById,
  updateBookingStatus,
  updateBookingTags,
  cancelBooking,
  deleteBookings,
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
  deleteTimeSlot
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

  revalidatePath('/tickets');
  revalidatePath('/admin/bookings');
  revalidatePath('/admin');
  return result;
}

export async function fetchAllBookingsAction() {
  return getAllBookings();
}

export async function fetchBookingByIdAction(id: number) {
  return getBookingById(id);
}

export async function updateBookingStatusAction(id: number, paymentStatus?: string, fulfillmentStatus?: string) {
  updateBookingStatus(id, paymentStatus, fulfillmentStatus);
  revalidatePath('/admin/bookings');
  revalidatePath('/admin');
  return { success: true };
}

export async function updateBookingTagsAction(id: number, tags: string) {
  updateBookingTags(id, tags);
  revalidatePath('/admin/bookings');
  return { success: true };
}

export async function cancelBookingAction(id: number) {
  try {
    const booking = getBookingById(id) as any;
    if (booking && booking.simulator_name && booking.simulator_slot) {
      const orderId = formatOrderNumber(booking.id, booking.created_at);
      await releaseSimulatorSlots(orderId);
    }
  } catch (pgErr) {
    console.error("Failed to release PostgreSQL simulator slot lock for booking", id, pgErr);
  }

  cancelBooking(id);
  revalidatePath('/admin/bookings');
  revalidatePath('/admin');
  return { success: true };
}

export async function deleteBookingsAction(ids: number[]) {
  if (!ids || ids.length === 0) return { success: true, count: 0 };
  
  // Release any associated simulator locks
  for (const id of ids) {
    try {
      const booking = getBookingById(id) as any;
      if (booking && booking.simulator_name && booking.simulator_slot) {
        const orderId = formatOrderNumber(booking.id, booking.created_at);
        await releaseSimulatorSlots(orderId);
      }
    } catch (pgErr) {
      console.error("Failed to release simulator slot for booking", id, pgErr);
    }
  }

  deleteBookings(ids);
  revalidatePath('/admin/bookings');
  revalidatePath('/admin');
  return { success: true, count: ids.length };
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

export async function blockSlotOrDateAction(date: string, timeSlot: string, reason?: string) {
  try {
    blockSlotOrDate(date, timeSlot, reason);
    revalidatePath('/admin/slots');
    revalidatePath('/tickets');
    return { success: true };
  } catch (error: any) {
    console.error("blockSlotOrDateAction error:", error);
    return { success: false, error: error.message || "Failed to block slot/date" };
  }
}

export async function blockMultipleSlotsAction(date: string, timeSlots: string[], reason?: string) {
  try {
    for (const slot of timeSlots) {
      blockSlotOrDate(date, slot, reason);
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


