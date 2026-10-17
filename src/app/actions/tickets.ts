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
  VipPerkRow
} from "@/lib/db";
import { 
  getTakenSimulatorSlots, 
  lockSimulatorSlot, 
  releaseSimulatorSlots, 
  parseSimulatorSlotAssignments,
  getSimPodiumSimulators
} from "@/lib/simulator-db";
import { formatOrderNumber } from "@/lib/order-utils";
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

      for (const item of assignments) {
        if (item.simulatorName && item.slotLabel) {
          await lockSimulatorSlot({
            simulatorName: item.simulatorName,
            bookingDate: date,
            bookingTime: item.slotLabel,
            sourceOrderId: orderId,
            customerName,
            customerPhone,
            status: 'CONFIRMED'
          });
        }
      }
    } catch (pgErr) {
      console.error("Failed to sync lock to PostgreSQL simulator_slot_locks:", pgErr);
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
    }
  } catch (err) {
    console.error("Could not sync Sim Podium simulators:", err);
  }

  return getVipPerks(activeOnly);
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
