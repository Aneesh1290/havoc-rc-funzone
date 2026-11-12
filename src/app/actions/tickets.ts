"use server";

import {
  initDB,
  getTickets,
  updateTicketStatus,
  updateTicket,
  createTicket,
  deleteTicket,
  syncOfficialTicketPricing,
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
  bulkConvertToBandCoupons,
  convertCouponToBandCoupon,
  getCouponByCode,
  incrementCouponUsage,
  getCouponBandInventory,
  updateCouponBandsLocation,
  handoverCouponBandsByOffer,
  CouponBandInventoryItem,
  CouponBandBreakdown,
  CouponBandSummary,
  CouponRow,
  getBookingById,
  getBookingsByOrderNumber,
  updateBookingStatus,
  updateOrderGroupStatus,
  updateOrderGroupPaymentRef,
  updateBookingTags,
  updateBookingWristbandNumber,
  updateBookingCategoryWristbandNumber,
  updateOrderGroupTags,
  cancelBooking,
  cancelOrderGroup,
  refundOrderGroup,
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
  deleteStaffUser,
  cleanupExpiredHolds,
  getAvailableAddonTickets,
  addAddonToOrder,
  removeBookingItem,
  upgradeBookingItem,
  updateBookingScheduleAndContact
} from "@/lib/db";
import {
  getTakenSimulatorSlots,
  lockSimulatorSlot,
  releaseSimulatorSlots,
  parseSimulatorSlotAssignments,
  getSimPodiumSimulators,
  getSimPodiumSlots,
  deleteSimulatorSlotLockById,
  getSimulatorSlotLocks,
  SimPodiumSlot
} from "@/lib/simulator-db";
import { formatOrderNumber } from "@/lib/order-utils";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { sendBookingConfirmationWhatsApp } from "@/lib/whatsapp";
import { checkSessionAction } from "@/app/login/actions";
import { hasUserPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { 
  DEFAULT_TICKET_GUIDELINES, 
  type TicketGuidelinesConfig, 
  type TicketGuidelineItem 
} from "@/lib/ticket-guidelines";
import { issueBandItem, getBandItemByCode } from "@/lib/band-inventory-db";
import { decrementColorStockByHex } from "@/lib/color-inventory-db";
import { processIciciRefund } from "@/lib/icici";

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
  if (!result) return null;

  const effectiveOrderNum = result.orderNumber || result.id;
  const orderId = formatOrderNumber(effectiveOrderNum, result.createdAt, 'Unpaid');

  // If this booking has an attached simulator session, lock it in the shared PostgreSQL database
  if (simulatorName && simulatorSlot && result?.id) {
    try {
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
  totalAmount: number,
  appliedCoupon?: string | null
) {
  // 1. Clean up expired holds older than 2 minutes
  await cleanupExpiredHolds(2);

  // 2. Concurrency check: check capacity including active holds
  const allTickets = getTickets();
  const ticketMap = new Map(allTickets.map(t => [t.id, t]));

  for (const item of items) {
    const ticketDef = ticketMap.get(item.ticketId);
    if (ticketDef) {
      const bookedList = getBookedQuantities(item.date, item.timeSlot);
      const bookedRow = bookedList.find(b => b.ticket_id === item.ticketId);
      const currentBooked = bookedRow ? bookedRow.total_booked : 0;
      if (currentBooked + item.quantity > ticketDef.capacity) {
        throw new Error(`Slot for "${ticketDef.name}" on ${item.date} (${item.timeSlot}) is fully booked or held by another guest.`);
      }
    }

    if (item.simulatorName && item.simulatorSlot) {
      const assignments = parseSimulatorSlotAssignments(item.simulatorName, item.simulatorSlot);
      for (const assign of assignments) {
        if (assign.simulatorName && assign.slotLabel) {
          const takenSlots = await getTakenSimulatorSlots(assign.simulatorName, item.date);
          if (takenSlots.includes(assign.slotLabel)) {
            throw new Error(`Simulator slot "${assign.simulatorName}" at ${assign.slotLabel} on ${item.date} is already reserved.`);
          }
        }
      }
    }
  }

  const initialPaymentStatus = (totalAmount <= 0) ? 'Paid' : 'Unpaid';
  const result = addBatchBooking(items, customerName, customerEmail, customerPhone, appliedCoupon, initialPaymentStatus);
  if (!result) return null;

  const orderId = formatOrderNumber(result.orderNumber, result.createdAt, initialPaymentStatus);

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
        paymentStatus: initialPaymentStatus,
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

export async function updateBookingStatusAction(id: number, paymentStatus?: string, fulfillmentStatus?: string, paymentRef?: string) {
  const session = await checkSessionAction();
  if ((paymentStatus || paymentRef !== undefined) && !hasUserPermission(session, "bookings:payment")) {
    return { success: false, error: "Access denied: You do not have permission to modify payment status or transaction reference." };
  }
  if (fulfillmentStatus && !hasUserPermission(session, "bookings:status")) {
    return { success: false, error: "Access denied: You do not have permission to modify order fulfillment status." };
  }

  // Update all tickets under this booking's order_number if present
  const booking = getBookingById(id) as any;
  const targetNum = (booking && booking.order_number) ? booking.order_number : id;
  updateOrderGroupStatus(targetNum, paymentStatus, fulfillmentStatus, paymentRef);
  revalidatePath('/admin/bookings');
  revalidatePath('/admin');
  return { success: true };
}

export async function updateBookingPaymentRefAction(id: number, paymentRef: string) {
  const session = await checkSessionAction();
  if (!hasUserPermission(session, "bookings:payment")) {
    return { success: false, error: "Access denied: You do not have permission to modify transaction reference." };
  }

  const booking = getBookingById(id) as any;
  const targetNum = (booking && booking.order_number) ? booking.order_number : id;
  updateOrderGroupPaymentRef(targetNum, paymentRef.trim());
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

export async function updateBookingWristbandNumberAction(
  id: number,
  wristbandNumber: string,
  options?: {
    color_hex?: string;
    color_name?: string;
    category?: string;
    staff_name?: string;
    band_type?: 'slot' | 'category';
  }
) {
  try {
    const isCategoryBand = options?.band_type === 'category';
    const prevBooking = getBookingById(id) as any;
    const oldBandNumber = isCategoryBand
      ? (prevBooking?.category_wristband_number || "")
      : (prevBooking?.wristband_number || "");
    const cleanBand = (wristbandNumber || "").trim();

    // 2. Sync with Band Items & Reception Inventory
    const slotColorHex = options?.color_hex || (isCategoryBand ? "" : (prevBooking?.slot_color || ""));
    const slotColorName = options?.color_name || (isCategoryBand ? "" : (prevBooking?.slot_color_name || ""));
    const targetCategory = options?.category || prevBooking?.ticket_name || "";
    const customerName = prevBooking?.customer_name || "Guest";
    const orderNum = prevBooking?.order_number || id;
    const staffName = options?.staff_name || "Reception Desk";

    // Dynamic import to avoid circular dependencies
    const { issueBandItem, returnBandItem } = await import("@/lib/band-inventory-db");
    const { decrementReceptionCountByHex, incrementReceptionCountByHex } = await import("@/lib/color-inventory-db");

    // Parse old band codes and new band codes (comma-separated or single)
    const oldCodes = oldBandNumber.split(/[\s,]+/).map((s: string) => s.trim()).filter(Boolean);
    const newCodes = cleanBand.split(/[\s,]+/).map((s: string) => s.trim()).filter(Boolean);
    const removedCodes = oldCodes.filter((c: string) => !newCodes.includes(c));

    // For codes that are newly added: validate that every band exists and is stocked out to reception
    const addedCodes = newCodes.filter((c: string) => !oldCodes.includes(c));

    for (const code of addedCodes) {
      const issueCheck = await issueBandItem({
        band_code: code,
        color_hex: slotColorHex || undefined,
        color_name: slotColorName || undefined,
        expected_category: targetCategory,
        allow_category_override: !isCategoryBand, // Category band must match ticket category; slot band is flexible
        customer_name: customerName,
        booking_id: id,
        order_number: `#${orderNum}`,
        staff_name: staffName,
        notes: isCategoryBand
          ? `Issued to ${customerName} (${targetCategory}) [Ticket Sub-Category Band]`
          : `Issued to ${customerName} (${targetCategory || 'Pass'}) for ${prevBooking?.time_slot || 'Slot'}`
      });

      if (!issueCheck.success) {
        // Rollback any codes that were just issued during this loop
        const currentIdx = addedCodes.indexOf(code);
        for (let rollbackIdx = 0; rollbackIdx < currentIdx; rollbackIdx++) {
          const rollbackCode = addedCodes[rollbackIdx];
          await returnBandItem({
            band_code: rollbackCode,
            color_hex: slotColorHex,
            color_name: slotColorName,
            condition: "good",
            staff_name: staffName,
            notes: `Rollback after failed assignment of ${code}`
          });
          if (slotColorHex || slotColorName) {
            await incrementReceptionCountByHex(slotColorHex || slotColorName, 1);
          }
        }
        return { success: false, error: issueCheck.error || `Band ${code} cannot be assigned.` };
      }

      if (slotColorHex || slotColorName) {
        await decrementReceptionCountByHex(slotColorHex || slotColorName, 1);
      }
    }

    // Now that added codes succeeded, process any removed codes
    for (const code of removedCodes) {
      try {
        await returnBandItem({
          band_code: code,
          color_hex: slotColorHex,
          color_name: slotColorName,
          condition: "good",
          staff_name: staffName,
          notes: `Unassigned ${isCategoryBand ? 'Ticket Band' : 'Slot Band'} from Order #${orderNum}`
        });
      } catch (e) {
        console.warn(`[Band Sync] Return item error for ${code}:`, e);
      }
      if (slotColorHex || slotColorName) {
        await incrementReceptionCountByHex(slotColorHex || slotColorName, 1);
      }
    }

    // Save final updated wristband string in bookings
    if (isCategoryBand) {
      updateBookingCategoryWristbandNumber(id, cleanBand);
    } else {
      updateBookingWristbandNumber(id, cleanBand);
    }

    revalidatePath('/admin/bookings');
    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath('/admin/bands');
    revalidatePath('/admin/slots');
    return { success: true };
  } catch (err: any) {
    console.error("[updateBookingWristbandNumberAction Error]", err);
    return { success: false, error: err.message || "Failed to update wristband number" };
  }
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

export async function issueRefundAction(params: {
  orderNumberOrId: number;
  refundAmount: number;
  refundMethod: 'icici' | 'manual';
  reason?: string;
  cancelBooking?: boolean;
}) {
  const session = await checkSessionAction();
  if (!hasUserPermission(session, "bookings:payment") && !hasUserPermission(session, "bookings:status")) {
    return { success: false, error: "Access denied: You do not have permission to process refunds." };
  }

  const booking = getBookingById(params.orderNumberOrId) as any;
  const targetNum = (booking && booking.order_number) ? booking.order_number : params.orderNumberOrId;
  const groupRows = (getBookingsByOrderNumber(targetNum) || []) as any[];
  const mainBooking = groupRows.length > 0 ? groupRows[0] : booking;

  if (!mainBooking) {
    return { success: false, error: "Booking or order not found." };
  }

  const totalOrderAmount = groupRows.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  const refundAmount = Number(params.refundAmount) || totalOrderAmount;

  if (refundAmount <= 0) {
    return { success: false, error: "Refund amount must be greater than zero." };
  }

  // Strictly verify on the basis of payment (NOT order number) that payment was done via the payment gateway
  const isOnlineGatewayPayment = Boolean(
    (mainBooking.icici_txn_id && String(mainBooking.icici_txn_id).trim() !== "" && String(mainBooking.icici_txn_id).toLowerCase() !== "null") ||
    groupRows.some(b => b.icici_txn_id && String(b.icici_txn_id).trim() !== "" && String(b.icici_txn_id).toLowerCase() !== "null") ||
    (() => {
      const allRefs = [mainBooking.payment_ref, ...groupRows.map(b => b.payment_ref)].filter(Boolean);
      for (const rawRef of allRefs) {
        const ref = String(rawRef || "").trim();
        if (!ref) continue;
        const lower = ref.toLowerCase();
        if (["cash", "counter", "desk", "manual", "unpaid", "pos", "card swipe", "upi counter", "upi desk"].includes(lower)) continue;
        if (lower.startsWith("desk_")) continue;
        if (/^\d{8,24}$/.test(ref) || lower.startsWith("icici") || lower.startsWith("txn_rc_") || lower.startsWith("pg_")) return true;
      }
      return false;
    })()
  );

  if (!isOnlineGatewayPayment) {
    return {
      success: false,
      error: "Refunds are only available for payments processed through the online payment gateway."
    };
  }

  let refundRef = `REF_${Date.now().toString().slice(-8)}`;

  // Process via ICICI Direct Payment Gateway
  const originalTxnNo = mainBooking.icici_txn_id || mainBooking.payment_ref;
  if (!originalTxnNo) {
    return { 
      success: false, 
      error: "Cannot process gateway refund: No Gateway Transaction ID found on this booking." 
    };
  }

  try {
    const refundResult = await processIciciRefund({
      originalTxnNo: String(originalTxnNo),
      refundAmount: refundAmount,
      refundTxnNo: `REF_${targetNum}_${Date.now().toString().slice(-4)}`,
      reason: params.reason || "Staff issued refund"
    });

    if (!refundResult.success) {
      return {
        success: false,
        error: `ICICI Bank PG Refund Failed: ${refundResult.description || refundResult.responseCode || 'Gateway rejected refund'}`
      };
    }

    refundRef = refundResult.refundTxnId || refundRef;
  } catch (iciciErr: any) {
    console.error("[ICICI Refund Action Error]", iciciErr);
    return {
      success: false,
      error: `Error communicating with ICICI Gateway: ${iciciErr.message}`
    };
  }

  // Update in SQLite
  refundOrderGroup(
    targetNum,
    refundAmount,
    refundRef,
    params.reason || "Refund issued by staff",
    params.cancelBooking ?? true
  );

  // Release simulator locks if canceling or fully refunded
  if (params.cancelBooking || refundAmount >= totalOrderAmount) {
    for (const b of groupRows) {
      if (b.simulator_name && b.simulator_slot) {
        try {
          const orderId = formatOrderNumber(targetNum, b.created_at);
          await releaseSimulatorSlots(orderId, b.id);
        } catch (pgErr) {
          console.error("Failed to release simulator slot for refunded booking", b.id, pgErr);
        }
      }
    }
  }

  revalidatePath('/admin/bookings');
  revalidatePath('/admin');
  return {
    success: true,
    refundRef,
    refundAmount,
    message: `Refund of ₹${refundAmount.toFixed(2)} processed successfully.`
  };
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

export async function fetchAvailableAddonsAction() {
  return getAvailableAddonTickets();
}

export async function addAddonToOrderAction(params: {
  orderNumber: number;
  ticketId: number;
  quantity: number;
}) {
  const session = await checkSessionAction();
  if (!hasUserPermission(session, "bookings:status") && !hasUserPermission(session, "bookings:payment")) {
    return { success: false, error: "Access denied: You do not have permission to modify order items." };
  }

  try {
    const result = addAddonToOrder(params.orderNumber, params.ticketId, params.quantity);
    revalidatePath('/admin/bookings');
    revalidatePath(`/admin/bookings/${params.orderNumber}`);
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to add addon to order." };
  }
}

export async function removeOrderItemAction(bookingItemId: number, orderNumber: number) {
  const session = await checkSessionAction();
  if (!hasUserPermission(session, "bookings:status")) {
    return { success: false, error: "Access denied: You do not have permission to remove order items." };
  }

  try {
    removeBookingItem(bookingItemId);
    revalidatePath('/admin/bookings');
    revalidatePath(`/admin/bookings/${orderNumber}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to remove item." };
  }
}

export async function upgradeBookingItemAction(params: {
  orderNumber: number;
  bookingItemId: number;
  targetTicketId: number;
  paymentConfirmed: boolean;
  paymentMode?: string;
  paymentRef?: string;
  customDiffAmount?: number | null;
}) {
  const session = await checkSessionAction();
  if (!hasUserPermission(session, "bookings:status") && !hasUserPermission(session, "bookings:payment")) {
    return { success: false, error: "Access denied: You do not have permission to upgrade booking packages." };
  }

  try {
    const result = upgradeBookingItem(params);
    revalidatePath('/admin/bookings');
    revalidatePath(`/admin/bookings/${params.orderNumber}`);
    return { ...result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to upgrade package." };
  }
}

export async function updateBookingScheduleAndContactAction(params: {
  orderNumber: number;
  bookingItemId?: number;
  scope?: 'order' | 'item';
  newDate?: string;
  newTimeSlot?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}) {
  const session = await checkSessionAction();
  if (!hasUserPermission(session, "bookings:status") && !hasUserPermission(session, "bookings:payment")) {
    return { success: false, error: "Access denied: You do not have permission to update booking schedule or details." };
  }

  try {
    const result = updateBookingScheduleAndContact(params);
    revalidatePath('/admin/bookings');
    revalidatePath(`/admin/bookings/${params.orderNumber}`);
    return { ...result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update booking schedule." };
  }
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
  benefits = "",
  perkBadge = "",
  perkDescription = ""
) {
  updateTicket(id, price, capacity, hasSimulatorPerk, perkDurationMins, perkTitle, description, benefits, perkBadge, perkDescription);
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
  benefits = "",
  perkBadge = "",
  perkDescription = ""
) {
  try {
    createTicket(name, price, capacity, hasSimulatorPerk, perkDurationMins, perkTitle, description, benefits, perkBadge, perkDescription);
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
    revalidatePath('/ticket-type');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete ticket" };
  }
}

export async function syncOfficialTicketPricingAction() {
  try {
    const updated = syncOfficialTicketPricing();
    revalidatePath('/admin/tickets');
    revalidatePath('/tickets');
    revalidatePath('/ticket-type');
    return { success: true, tickets: updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to sync ticket pricing" };
  }
}

// Coupon Actions
export async function fetchCouponsAction(): Promise<CouponRow[]> {
  return getCoupons();
}

export async function createCouponAction(
  code: string,
  discountType: 'percentage' | 'flat',
  value: number,
  maxUses: number | null,
  expiryDate: string | null,
  isBandCoupon: boolean = false,
  bandCategory: string = 'VIP',
  bandColor: string | null = null
) {
  try {
    createCoupon(code, discountType, value, maxUses, expiryDate, isBandCoupon, bandCategory, bandColor);
    revalidatePath('/admin/coupons');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create coupon" };
  }
}

export async function bulkCreateCouponsAction(coupons: {
  code: string;
  discountType: 'percentage' | 'flat';
  value: number;
  maxUses: number | null;
  expiryDate?: string | null;
  isBandCoupon?: boolean;
  bandCategory?: string;
  bandColor?: string;
}[]) {
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

export async function bulkConvertToBandCouponsAction(
  ids: number[],
  isBandCoupon: boolean = true,
  bandCategory: string = 'VIP',
  bandColor: string | null = '#FFD700'
) {
  try {
    const result = bulkConvertToBandCoupons(ids, isBandCoupon, bandCategory, bandColor);
    revalidatePath('/admin/coupons');
    return { success: true, count: result.changes };
  } catch (error: any) {
    console.error("bulkConvertToBandCouponsAction error:", error);
    return { success: false, error: error.message || "Failed to convert coupons to VIP Band Offer" };
  }
}

export async function convertCouponToBandCouponAction(
  id: number,
  isBandCoupon: boolean = true,
  bandCategory: string = 'VIP',
  bandColor: string | null = '#FFD700'
) {
  try {
    const result = convertCouponToBandCoupon(id, isBandCoupon, bandCategory, bandColor);
    revalidatePath('/admin/coupons');
    return { success: true, count: result.changes };
  } catch (error: any) {
    console.error("convertCouponToBandCouponAction error:", error);
    return { success: false, error: error.message || "Failed to convert coupon" };
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

export async function useCouponAction(code: string, context?: { customerName?: string; orderCode?: string; bookingId?: number }) {
  if (!code) return;
  const cleanCode = code.trim().toUpperCase();
  incrementCouponUsage(cleanCode, { customerName: context?.customerName, bookingId: context?.bookingId });

  try {
    const coupon = getCouponByCode(cleanCode);
    if (coupon && coupon.is_band_coupon) {
      // If an explicit band exists with this code in the master band table, issue it
      const bandItem = await getBandItemByCode(cleanCode);
      if (bandItem && bandItem.status === "available") {
        await issueBandItem({
          band_id: bandItem.id,
          customer_name: context?.customerName || "VIP Offer Guest",
          order_number: context?.orderCode || (context?.bookingId ? `#${context.bookingId}` : undefined),
          booking_id: context?.bookingId,
          notes: `Auto-issued upon booking redemption of VIP Coupon: ${cleanCode}`,
        });
      }
      // Note: We do NOT decrement the regular 15-minute slot color pool because coupon bands
      // maintain their own dedicated, segregated inventory and serial tracking!
    }
    revalidatePath('/admin/bands');
    revalidatePath('/admin/coupons');
  } catch (err) {
    console.warn("[useCouponAction] Error updating band inventory for coupon:", err);
  }


  revalidatePath('/admin/coupons');
  revalidatePath('/admin/bands');
  revalidatePath('/admin/slots');
}

// VIP Perks Actions
export async function fetchVipPerksAction(activeOnly = false): Promise<VipPerkRow[]> {
  return getVipPerks(activeOnly);
}

export async function fetchSimulatorListAction(): Promise<Array<{ id: number | string; name: string; category?: string }>> {
  try {
    // 1. Try fetching live from Havoc Sim Podium Postgres
    const simPodiumProducts = await getSimPodiumSimulators();
    if (simPodiumProducts && simPodiumProducts.length > 0) {
      return simPodiumProducts.map(p => ({
        id: p.id,
        name: p.name,
        category: p.type || "Simulator"
      }));
    }
  } catch (err) {
    console.warn("Could not fetch remote Sim Podium simulators, falling back to local vip_perks:", err);
  }

  // 2. Fallback to local vip_perks in havoc.db
  const perks = getVipPerks(true);
  return perks.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category
  }));
}

export async function fetchSimulatorSlotLocksAction(date?: string) {
  try {
    return await getSimulatorSlotLocks(date);
  } catch (err: any) {
    console.error("fetchSimulatorSlotLocksAction error:", err);
    return [];
  }
}

export async function blockSimulatorSlotManualAction(params: {
  simulatorName: string;
  bookingDate: string;
  bookingTime: string;
  reason?: string;
}): Promise<{ success: boolean; slotsBlocked?: number; error?: string }> {
  try {
    const session = await checkSessionAction();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const { simulatorName, bookingDate, bookingTime, reason } = params;
    if (!simulatorName || !bookingDate || !bookingTime) {
      return { success: false, error: "Simulator, Date and Time slot are required." };
    }

    // Expand 1-hour slot (e.g. 11AM-12PM) to two 30-min slots if needed
    const assignments = parseSimulatorSlotAssignments(simulatorName, bookingTime);
    const sourceOrderId = `BLOCK_SIM_${Date.now()}`;
    let slotsBlocked = 0;

    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      const slotOrderId = assignments.length > 1 ? `${sourceOrderId}_${i + 1}` : sourceOrderId;
      const res = await lockSimulatorSlot({
        simulatorName: a.simulatorName,
        bookingDate,
        bookingTime: a.slotLabel,
        sourceOrderId: slotOrderId,
        customerName: reason ? `Admin Block: ${reason}` : `Admin Block (Manual)`,
        status: 'CONFIRMED'
      });
      if (res.success) {
        slotsBlocked++;
      } else if (assignments.length === 1) {
        return res;
      }
    }

    revalidatePath('/admin/slots');
    return { success: true, slotsBlocked };
  } catch (err: any) {
    console.error("blockSimulatorSlotManualAction error:", err);
    return { success: false, error: err.message || "Failed to block simulator slot" };
  }
}

export async function unblockSimulatorSlotManualAction(lockId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await checkSessionAction();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const ok = await deleteSimulatorSlotLockById(lockId);
    if (!ok) {
      return { success: false, error: "Failed to release simulator slot lock" };
    }

    revalidatePath('/admin/slots');
    return { success: true };
  } catch (err: any) {
    console.error("unblockSimulatorSlotManualAction error:", err);
    return { success: false, error: err.message || "Failed to unblock simulator slot" };
  }
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
    } catch { }

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
    if (target.username.toLowerCase() === "admin") {
      return { success: false, error: "Cannot modify the primary admin account permissions" };
    }

    const userRole = role === "super_admin" ? "super_admin" : "staff";
    // Strictly strip "all" from permissions if role is staff so it never bypasses restrictions
    const cleanPerms = permissions.filter(p => p !== "all" && p.trim() !== "");
    const perms = userRole === "super_admin" ? "all" : cleanPerms.join(",");

    updateStaffRoleAndPerms(id, userRole, perms);
    revalidatePath('/admin');
    revalidatePath('/admin/staff');
    revalidatePath('/admin/bookings');
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

// ==========================================
// DEDICATED COUPON BAND INVENTORY ACTIONS
// ==========================================

export async function fetchCouponBandInventoryAction() {
  try {
    return { success: true, data: getCouponBandInventory() };
  } catch (error: any) {
    console.error("fetchCouponBandInventoryAction error:", error);
    return { success: false, error: error.message || "Failed to fetch coupon band inventory" };
  }
}

export async function handoverCouponBandsAction(params: {
  ids?: number[];
  codes?: string[];
  band_category?: string;
  band_color?: string;
  amount?: number;
  targetLocation: 'reception' | 'warehouse';
  notes?: string;
}) {
  try {
    if (params.amount && params.band_category) {
      const res = handoverCouponBandsByOffer({
        band_category: params.band_category,
        band_color: params.band_color,
        amount: params.amount,
        targetLocation: params.targetLocation,
      });
      revalidatePath('/admin/bands');
      revalidatePath('/admin/coupons');
      return { 
        success: true, 
        count: res.changes, 
        movedCodes: res.movedCodes,
        message: `Successfully moved ${res.changes} band(s) to ${params.targetLocation}` 
      };
    }

    const res = updateCouponBandsLocation(
      { ids: params.ids, codes: params.codes },
      params.targetLocation
    );
    revalidatePath('/admin/bands');
    revalidatePath('/admin/coupons');
    return { 
      success: true, 
      count: res.changes,
      message: `Successfully updated location for ${res.changes} coupon band(s)` 
    };
  } catch (error: any) {
    console.error("handoverCouponBandsAction error:", error);
    return { success: false, error: error.message || "Failed to handover coupon bands" };
  }
}

// =========================================================================
// Ticket Guidelines Actions (Displayed on /tickets & /tickets/[month])
// =========================================================================

export async function fetchTicketGuidelinesAction(): Promise<TicketGuidelinesConfig> {
  try {
    const raw = getSiteSetting("ticket_guidelines", "");
    if (!raw) return DEFAULT_TICKET_GUIDELINES;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) {
      return {
        sectionTitle: parsed.sectionTitle || DEFAULT_TICKET_GUIDELINES.sectionTitle,
        items: parsed.items
      };
    }
    return DEFAULT_TICKET_GUIDELINES;
  } catch (err) {
    console.error("fetchTicketGuidelinesAction error:", err);
    return DEFAULT_TICKET_GUIDELINES;
  }
}

export async function saveTicketGuidelinesAction(config: TicketGuidelinesConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const value = JSON.stringify(config);
    setSiteSetting("ticket_guidelines", value, "Important Guidelines displayed on /tickets");
    
    // Also mirror to PG if available
    try {
      const { simulatorPool } = await import("@/lib/simulator-db");
      if (simulatorPool) {
        await simulatorPool.query(`
          INSERT INTO site_settings (key, value, description)
          VALUES ($1, $2, $3)
          ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description
        `, ["ticket_guidelines", value, "Important Guidelines displayed on /tickets"]);
      }
    } catch (_) {}

    revalidatePath("/tickets");
    revalidatePath("/tickets/[month]");
    revalidatePath("/admin/tickets");
    return { success: true };
  } catch (err: any) {
    console.error("saveTicketGuidelinesAction error:", err);
    return { success: false, error: err.message || "Failed to save guidelines" };
  }
}

export async function resetTicketGuidelinesAction(): Promise<{ success: boolean; config: TicketGuidelinesConfig; error?: string }> {
  try {
    const value = JSON.stringify(DEFAULT_TICKET_GUIDELINES);
    setSiteSetting("ticket_guidelines", value, "Important Guidelines displayed on /tickets");

    try {
      const { simulatorPool } = await import("@/lib/simulator-db");
      if (simulatorPool) {
        await simulatorPool.query(`
          INSERT INTO site_settings (key, value, description)
          VALUES ($1, $2, $3)
          ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description
        `, ["ticket_guidelines", value, "Important Guidelines displayed on /tickets"]);
      }
    } catch (_) {}

    revalidatePath("/tickets");
    revalidatePath("/tickets/[month]");
    revalidatePath("/admin/tickets");
    return { success: true, config: DEFAULT_TICKET_GUIDELINES };
  } catch (err: any) {
    console.error("resetTicketGuidelinesAction error:", err);
    return { success: false, config: DEFAULT_TICKET_GUIDELINES, error: err.message || "Failed to reset guidelines" };
  }
}

