"use server";

import crypto from "crypto";
import { checkSessionAction } from "@/app/login/actions";
import { hasUserPermission } from "@/lib/permissions";
import { 
  db,
  createDeskPaymentLink, 
  createOnlineCheckoutHold, 
  getNextOrderNumber,
  getSiteSetting 
} from "@/lib/db";
import { sendPaymentLinkWhatsApp } from "@/lib/whatsapp";
import { formatOrderNumber } from "@/lib/order-utils";

export interface CreateCustomPaymentLinkParams {
  amount: number;
  customerName: string;
  customerPhone?: string;
  countryCode?: string;
  customerEmail?: string;
  purpose?: string;
  notes?: string;
  sendWhatsApp?: boolean;
}

export async function createCustomPaymentLinkAction(params: CreateCustomPaymentLinkParams) {
  try {
    const session = await checkSessionAction();
    if (!session || (!hasUserPermission(session, "bookings:status") && !hasUserPermission(session, "bookings:payment") && !hasUserPermission(session, "bookings:reserve"))) {
      return { success: false, error: "Access denied: Status or payment permission required." };
    }

    const amount = Number(params.amount);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: "Please enter a valid amount greater than ₹0." };
    }

    const cleanName = (params.customerName || "").trim() || "Customer";
    const cleanPhone = (params.customerPhone || "").trim();
    const countryCode = params.countryCode || "+91";
    const cleanEmail = (params.customerEmail || "").trim();
    const purpose = (params.purpose || "").trim() || "Custom Payment";
    const notes = (params.notes || "").trim();

    // 1. Get next order number for this custom payment order
    const orderNumber = getNextOrderNumber();
    const formattedOrderCode = formatOrderNumber(orderNumber, "PAYDUE");

    // 2. Resolve a ticket ID (dedicated ORGANISATION_RESERVATION or fallback)
    let ticket = db.prepare("SELECT id FROM tickets WHERE UPPER(name) = 'ORGANISATION_RESERVATION'").get() as { id: number } | undefined;
    if (!ticket) {
      ticket = db.prepare("SELECT id FROM tickets LIMIT 1").get() as { id: number } | undefined;
    }
    const ticketId = ticket?.id || 1;

    // 3. Current IST / local date string
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

    const createdAt = new Date().toISOString();
    const fullTag = `CUSTOM_PAYMENT_LINK,DESK_LINK${notes ? `,NOTE:${notes.replace(/,/g, ' ')}` : ''}`;

    // 4. Create the booking entry in SQLite so it appears in Bookings and syncs cleanly
    const ins = db.prepare(`
      INSERT INTO bookings (
        order_number, ticket_id, booking_date, time_slot, quantity,
        customer_name, customer_email, customer_phone, total_amount,
        payment_status, fulfillment_status, created_at, order_prefix, tags, special_requests
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Unpaid', 'Unfulfilled', ?, 'PAYDUE', ?, ?)
    `).run(
      orderNumber,
      ticketId,
      todayStr,
      purpose,
      1,
      cleanName,
      cleanEmail,
      cleanPhone ? `${countryCode} ${cleanPhone}` : "",
      amount,
      createdAt,
      fullTag,
      notes || purpose
    );

    const bookingId = Number(ins.lastInsertRowid);

    // 5. Generate secure desk payment token
    const token = crypto.randomBytes(16).toString("hex");

    createDeskPaymentLink({
      token,
      customer_name: cleanName,
      customer_phone: cleanPhone || "9999999999",
      country_code: countryCode,
      total_amount: amount,
      booking_ids: [bookingId],
    });

    // 6. Pre-create online hold record for ICICI callback verification
    const attemptSuffix = Date.now().toString().slice(-6);
    const tempTxnId = `TXN_RC_${attemptSuffix}`;

    createOnlineCheckoutHold({
      txn_id: tempTxnId,
      customer_name: cleanName,
      customer_email: cleanEmail,
      customer_phone: cleanPhone,
      amount: amount,
      items_json: JSON.stringify([{
        ticketId,
        ticket_id: ticketId,
        ticketName: purpose,
        date: todayStr,
        booking_date: todayStr,
        timeSlot: purpose,
        time_slot: purpose,
        quantity: 1,
        itemTotal: amount,
        bookingId: bookingId
      }]),
      whatsapp_consent: 1,
    });

    // 7. Base application URL
    const returnBase = process.env.ICICI_RETURN_BASE 
      || process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.NODE_ENV === "production" ? "https://havocrcfunzone.in" : "https://havocrcfunzone.in");

    const paymentUrl = `${returnBase}/pay/${token}`;

    // 8. 1-Click WhatsApp link (wa.me)
    let waMeUrl: string | undefined;
    const digitsOnlyPhone = cleanPhone.replace(/\D/g, "");
    if (digitsOnlyPhone) {
      const countryDigits = countryCode.replace(/\D/g, "") || "91";
      const fullDigits = `${countryDigits}${digitsOnlyPhone}`;
      const brandName = getSiteSetting("desk_payment_brand_name", "Havoc RC Fun Zone");
      const waText = `Hi ${cleanName}! Here is your payment link for ₹${amount.toLocaleString("en-IN")} (${purpose}) from ${brandName}: ${paymentUrl}`;
      waMeUrl = `https://wa.me/${fullDigits}?text=${encodeURIComponent(waText)}`;
    }

    // 9. QR Code image url
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(paymentUrl)}`;

    // 10. Attempt automatic WhatsApp dispatch if requested and phone provided
    let waAutoSent = false;
    let waError: string | undefined;
    if (params.sendWhatsApp && digitsOnlyPhone && digitsOnlyPhone.length >= 7) {
      try {
        const brandName = getSiteSetting("desk_payment_brand_name", "Havoc RC Fun Zone");
        const waRes = await sendPaymentLinkWhatsApp({
          customerName: cleanName,
          customerPhone: digitsOnlyPhone,
          countryCode: countryCode,
          totalAmount: amount,
          paymentUrl,
          brandName,
          bookingDate: todayStr,
          timeSlot: purpose,
          orderSummary: `Custom Payment of ₹${amount.toLocaleString("en-IN")} for ${purpose}`,
          orderId: formattedOrderCode
        });
        if (waRes.success) {
          waAutoSent = true;
        } else {
          waError = waRes.message;
        }
      } catch (err: any) {
        waError = err.message;
      }
    }

    return {
      success: true,
      token,
      paymentUrl,
      orderCode: formattedOrderCode,
      orderNumber,
      bookingId,
      totalAmount: amount,
      waMeUrl,
      qrUrl,
      waAutoSent,
      waError
    };
  } catch (err: any) {
    console.error("[createCustomPaymentLinkAction Error]", err);
    return {
      success: false,
      error: err.message || "Failed to create custom payment link."
    };
  }
}
