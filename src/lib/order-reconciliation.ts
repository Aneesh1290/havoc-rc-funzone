import { 
  db, 
  getOnlineCheckoutHold, 
  deleteOnlineCheckoutHold, 
  getNextOrderNumber, 
  getTickets,
  logPaymentGatewayAdvice
} from "@/lib/db";
import { confirmSimulatorSlotLocks } from "@/lib/simulator-db";
import { formatOrderNumber } from "@/lib/order-utils";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { sendBookingConfirmationWhatsApp, notifyAdminsBookingWhatsApp } from "@/lib/whatsapp";
import { checkIciciPaymentStatus } from "@/lib/icici";

export interface ConfirmBookingResult {
  success: boolean;
  alreadyProcessed?: boolean;
  orderId?: string;
  orderNumber?: number;
  message?: string;
}

/**
 * Confirms and registers a paid booking in the database with 100% deduplication.
 * Can be called by:
 * 1. Customer browser redirect callback
 * 2. ICICI S2S Payment Advice Webhook
 * 3. Server-to-server Status Inquiry reconciliation
 */
export async function confirmPaidOrderFromHold(params: {
  holdRow: any;
  txnID: string;
  source?: string;
}): Promise<ConfirmBookingResult> {
  const { holdRow, txnID, source = 'system' } = params;
  const baseOrderId = holdRow.txn_id;

  // 1. Check if already confirmed by gateway reference
  try {
    const existing = db.prepare(`
      SELECT order_number, order_prefix FROM bookings 
      WHERE payment_ref = ? OR icici_txn_id = ?
    `).get(txnID, txnID) as { order_number: number; order_prefix?: string } | undefined;

    if (existing && existing.order_number) {
      const code = formatOrderNumber(existing.order_number, existing.order_prefix || 'PAID');
      return { success: true, alreadyProcessed: true, orderId: code, orderNumber: existing.order_number };
    }
  } catch (_) {}

  const items = JSON.parse(holdRow.items_json || '[]');
  const totalBaseCost = items.reduce((sum: number, i: any) => sum + (Number(i.itemTotal) || 0), 0);

  let finalOrderId = "";
  let formattedOrderCode = "";

  // Check if items belong to existing desk-checkin booking IDs (paying for existing unpaid desk booking)
  const existingBookingIds = items
    .map((i: any) => i.bookingId || i.booking_id)
    .filter((id: any) => id && typeof id === 'number');

  if (existingBookingIds.length > 0 && existingBookingIds.length === items.length) {
    const placeholders = existingBookingIds.map(() => '?').join(',');
    db.prepare(`
      UPDATE bookings 
      SET payment_status = 'Paid', payment_ref = ?, icici_txn_id = ?
      WHERE id IN (${placeholders})
    `).run(txnID, txnID, ...existingBookingIds);

    // Update matched desk payment links
    try {
      const matchedLinks = db.prepare(`SELECT * FROM desk_payment_links WHERE status = 'pending'`).all() as any[];
      for (const l of matchedLinks) {
        const bIds: number[] = JSON.parse(l.booking_ids || '[]');
        if (bIds.some(id => existingBookingIds.includes(id))) {
          db.prepare(`UPDATE desk_payment_links SET status = 'completed', paid_at = datetime('now'), payment_ref = ? WHERE id = ?`).run(txnID, l.id);
        }
      }
    } catch (_) {}

    const firstRow = db.prepare('SELECT order_number, order_prefix FROM bookings WHERE id = ?').get(existingBookingIds[0]) as any;
    const existingOrderNo = firstRow?.order_number || existingBookingIds[0];
    formattedOrderCode = formatOrderNumber(existingOrderNo, firstRow?.order_prefix || 'PAYDUE');
    finalOrderId = formattedOrderCode;

    deleteOnlineCheckoutHold(baseOrderId);
    return { success: true, orderId: formattedOrderCode, orderNumber: existingOrderNo };
  }

  // Standard Online Checkout: assign order number strictly upon payment
  const orderNo = getNextOrderNumber();
  const createdAt = new Date().toISOString();
  formattedOrderCode = formatOrderNumber(orderNo, 'PAID');
  finalOrderId = formattedOrderCode;

  const couponCode = (items.length > 0 && items[0]?.appliedCoupon) ? String(items[0].appliedCoupon) : null;
  const insertStmt = db.prepare(`
    INSERT INTO bookings (
      order_number, ticket_id, booking_date, time_slot, quantity, 
      customer_name, customer_email, customer_phone, total_amount, 
      payment_status, fulfillment_status, simulator_name, simulator_slot, 
      created_at, payment_ref, icici_txn_id, applied_coupon, order_prefix
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid', 'Unfulfilled', ?, ?, ?, ?, ?, ?, 'PAID')
  `);

  let firstBookingId: number | null = null;
  const runInsertTxn = db.transaction(() => {
    for (const item of items) {
      let itemPrice = Number(holdRow.amount) / items.length;
      if (totalBaseCost > 0 && item.itemTotal) {
        const ratio = Number(item.itemTotal) / totalBaseCost;
        itemPrice = Number(holdRow.amount) * ratio;
      }

      const info = insertStmt.run(
        orderNo,
        item.ticketId || item.ticket_id,
        item.date || item.booking_date,
        item.timeSlot || item.time_slot || item.time,
        item.quantity || 1,
        holdRow.customer_name,
        holdRow.customer_email,
        holdRow.customer_phone,
        Math.round(itemPrice),
        item.simulatorName || null,
        item.simulatorSlot || null,
        createdAt,
        txnID,
        txnID,
        couponCode
      );
      if (firstBookingId === null && info?.lastInsertRowid) {
        firstBookingId = Number(info.lastInsertRowid);
      }
    }
  });

  runInsertTxn();

  // Auto-issue offer wristband if used coupon is a VIP band offer
  if (couponCode) {
    try {
      const couponRow = db.prepare('SELECT * FROM coupons WHERE code = ?').get(couponCode.toUpperCase().trim()) as any;
      if (couponRow) {
        db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(couponRow.id);
        if (couponRow.is_band_coupon === 1) {
          try {
            const { issueBandItem } = await import('@/lib/band-inventory-db');
            const bandItem = db.prepare('SELECT * FROM band_items WHERE (barcode = ? OR serial_number = ?) AND status != "issued" LIMIT 1').get(couponCode, couponCode) as any;
            if (bandItem) {
              await issueBandItem({
                band_id: bandItem.id,
                customer_name: holdRow.customer_name || 'Customer',
                order_number: formattedOrderCode,
                booking_id: firstBookingId || undefined,
                notes: `Auto-issued upon online payment redemption of VIP coupon: ${couponCode}`
              });
            } else if (couponRow.band_color) {
              const { decrementColorStockByHex } = await import('@/lib/color-inventory-db');
              await decrementColorStockByHex(couponRow.band_color, 1);
            }
          } catch (invErr) {
            console.error(`[Order Confirmation (${source})] VIP band inventory error:`, invErr);
          }
        }
      }
    } catch (couponErr) {
      console.error(`[Order Confirmation (${source})] Coupon error:`, couponErr);
    }
  }

  // Confirm simulator locks
  try {
    await confirmSimulatorSlotLocks(baseOrderId, finalOrderId, holdRow.customer_name || undefined, holdRow.customer_phone || undefined);
  } catch (pgErr) {
    console.error(`[Order Confirmation (${source})] Error confirming simulator locks:`, pgErr);
  }

  // Delete hold
  deleteOnlineCheckoutHold(baseOrderId);

  // Dispatch Email & WhatsApp asynchronously
  try {
    const allTickets = getTickets();
    const emailItems = items.map((item: any) => {
      const tObj = allTickets.find(t => t.id === (item.ticketId || item.ticket_id));
      return {
        ticketName: tObj?.name || 'RC Fun Zone Pass',
        quantity: item.quantity || 1,
        date: item.date || item.booking_date,
        timeSlot: item.timeSlot || item.time_slot || item.time,
        itemTotal: item.itemTotal,
        simulatorName: item.simulatorName,
        simulatorSlot: item.simulatorSlot
      };
    });

    if (holdRow.customer_email) {
      sendBookingConfirmationEmail({
        orderId: formattedOrderCode,
        customerName: holdRow.customer_name || 'Customer',
        customerEmail: holdRow.customer_email,
        customerPhone: holdRow.customer_phone || '',
        totalAmount: holdRow.amount,
        paymentStatus: 'Paid',
        items: emailItems
      }).catch(e => console.error(`[Order Confirmation (${source})] Email error:`, e));
    }

    if (holdRow.customer_phone) {
      sendBookingConfirmationWhatsApp({
        orderId: formattedOrderCode,
        customerName: holdRow.customer_name || 'Customer',
        customerPhone: holdRow.customer_phone,
        totalAmount: holdRow.amount,
        paymentStatus: 'Paid',
        items: emailItems
      }).catch(e => console.error(`[Order Confirmation (${source})] WhatsApp error:`, e));
    }

    notifyAdminsBookingWhatsApp({
      orderId: formattedOrderCode,
      customerName: holdRow.customer_name || 'Customer',
      customerPhone: holdRow.customer_phone || '',
      totalAmount: holdRow.amount,
      paymentStatus: 'Paid',
      items: emailItems
    }).catch(e => console.error(`[Order Confirmation (${source})] Admin WhatsApp alert error:`, e));
  } catch (commErr) {
    console.error(`[Order Confirmation (${source})] Communication dispatch error:`, commErr);
  }

  return { success: true, orderId: formattedOrderCode, orderNumber: orderNo };
}

/**
 * Reconciles in-flight checkout transactions directly against ICICI Bank's server.
 * If ICICI confirms payment was received, the booking is instantly confirmed and registered!
 */
export async function reconcilePendingHold(txnId: string): Promise<ConfirmBookingResult> {
  const hold = getOnlineCheckoutHold(txnId);
  if (!hold) {
    // Check if it was already confirmed into a booking
    try {
      const existing = db.prepare(`
        SELECT order_number, order_prefix FROM bookings 
        WHERE icici_txn_id LIKE ? OR payment_ref LIKE ?
      `).get(`%${txnId}%`, `%${txnId}%`) as { order_number: number; order_prefix?: string } | undefined;
      if (existing) {
        return {
          success: true,
          alreadyProcessed: true,
          orderId: formatOrderNumber(existing.order_number, existing.order_prefix || 'PAID'),
          orderNumber: existing.order_number
        };
      }
    } catch (_) {}

    return { success: false, message: "No active hold found for transaction." };
  }

  // Call ICICI Server directly (Zero Customer Dependence)
  const statusRes = await checkIciciPaymentStatus(txnId);

  if (statusRes.isPaid) {
    const gatewayTxnId = statusRes.txnID || `ICICI_${txnId}`;

    // Log the advice in audit logs
    logPaymentGatewayAdvice({
      gateway: 'icici',
      merchant_txn_no: txnId,
      gateway_txn_id: gatewayTxnId,
      response_code: statusRes.responseCode || '0000',
      status: 'SUCCESS',
      amount: statusRes.amount || hold.amount,
      customer_phone: hold.customer_phone || undefined,
      customer_email: hold.customer_email || undefined,
      raw_payload: JSON.stringify(statusRes.data || statusRes)
    });

    return await confirmPaidOrderFromHold({
      holdRow: hold,
      txnID: gatewayTxnId,
      source: 'icici_s2s_status_reconcile'
    });
  }

  return {
    success: false,
    message: statusRes.description || "Transaction not marked as paid by bank."
  };
}
