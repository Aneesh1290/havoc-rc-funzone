"use server";

import { checkSessionAction } from "@/app/login/actions";
import { hasUserPermission } from "@/lib/permissions";
import { 
  createCashWalkinSession, 
  getCashWalkinSessionByToken, 
  markCashWalkinSessionCompleted,
  getSiteSetting 
} from "@/lib/db";
import { generateCashWalkinToken } from "@/lib/cash-booking-token";
import { sendPaymentLinkWhatsApp } from "@/lib/whatsapp";

export interface CreateCashWalkinParams {
  phone: string;
  countryCode?: string;
  customerName?: string;
  items?: Array<{
    ticketId: number;
    ticketName: string;
    date: string;
    timeSlot: string;
    quantity: number;
    price: number;
    simulatorName?: string;
    simulatorSlot?: string;
  }>;
}

export async function createCashWalkinSessionAction(params: CreateCashWalkinParams) {
  try {
    const session = await checkSessionAction();
    if (!session || (!hasUserPermission(session, "bookings:status") && !hasUserPermission(session, "bookings:payment"))) {
      return { success: false, error: "Unauthorized: Admin or desk staff permission required." };
    }

    const rawPhone = (params.phone || "").replace(/\D/g, "");
    if (!rawPhone || rawPhone.length < 7) {
      return { success: false, error: "Please enter a valid customer phone number (minimum 7 digits)." };
    }

    const countryCode = params.countryCode || "+91";
    const cleanCustomerName = (params.customerName || "").trim();
    const token = generateCashWalkinToken();

    const itemsJson = params.items && params.items.length > 0 
      ? JSON.stringify(params.items) 
      : null;

    // Persist session to database (expires in 2 hours)
    createCashWalkinSession({
      token,
      customer_name: cleanCustomerName || null,
      customer_phone: rawPhone,
      country_code: countryCode,
      items_json: itemsJson,
      expires_in_hours: 2,
    });

    const returnBase = process.env.ICICI_RETURN_BASE 
      || process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.NODE_ENV === 'production' ? 'https://havocrcfunzone.in' : 'https://havocrcfunzone.in');

    // Route to passes/tickets selection page for current month so customer can choose passes & add to cart
    const now = new Date();
    const currentMonth = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const currentYear = now.getFullYear();
    const bookingUrl = `${returnBase}/tickets/${currentMonth}-${currentYear}?desk_cash=${encodeURIComponent(token)}`;

    // Build 1-click wa.me URL
    const digitsOnlyCountry = countryCode.replace(/\D/g, "");
    const fullPhoneDigits = `${digitsOnlyCountry}${rawPhone}`;
    const brandName = getSiteSetting("desk_payment_brand_name", "Havoc RC Fun Zone");
    const waText = `Hi ${cleanCustomerName || 'Guest'}! Welcome to ${brandName}. Tap this link to select your passes. Your checkout will be set to Pay with Cash at the Counter: ${bookingUrl}`;
    const waMeUrl = `https://wa.me/${fullPhoneDigits}?text=${encodeURIComponent(waText)}`;

    // QR Code Image URL pointing directly to the passes selection page
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(bookingUrl)}`;

    // Attempt automatic WhatsApp dispatch via Interakt / WhatsApp API
    let waSent = false;
    let waError: string | undefined;

    try {
      const waRes = await sendPaymentLinkWhatsApp({
        customerName: cleanCustomerName || "Racer",
        customerPhone: rawPhone,
        countryCode: countryCode,
        totalAmount: params.items ? params.items.reduce((s, i) => s + (i.price * i.quantity), 0) : 0,
        paymentUrl: bookingUrl,
        brandName,
        bookingDate: params.items?.[0]?.date || "Today",
        timeSlot: params.items?.[0]?.timeSlot || "Walk-In Cash Booking",
        orderSummary: params.items?.[0] ? `${params.items.length} Pass(es)` : "Pay at Desk Walk-In",
      });

      if (waRes.success) {
        waSent = true;
      } else {
        waError = waRes.message || "WhatsApp template dispatch not acknowledged.";
      }
    } catch (err: any) {
      console.warn("[Cash Walk-In WhatsApp Dispatch Warning]", err?.message);
      waError = err.message;
    }

    return {
      success: true,
      token,
      bookingUrl,
      checkoutUrl: bookingUrl, // Alias for seamless compatibility
      waMeUrl,
      qrUrl,
      whatsappSent: waSent,
      whatsappError: waError,
      phone: rawPhone,
      countryCode,
    };
  } catch (err: any) {
    console.error("[Create Cash Walk-In Error]", err);
    return { success: false, error: err.message || "Failed to create cash walk-in session." };
  }
}

export async function verifyCashWalkinSessionAction(token: string) {
  try {
    if (!token || !token.trim()) {
      return { valid: false, error: "Missing token" };
    }

    const session = getCashWalkinSessionByToken(token.trim());
    if (!session) {
      return { valid: false, error: "This cash booking link has expired or has already been used." };
    }

    let items: any[] = [];
    if (session.items_json) {
      try {
        items = JSON.parse(session.items_json);
      } catch {}
    }

    return {
      valid: true,
      session: {
        phone: session.customer_phone,
        countryCode: session.country_code || "+91",
        customerName: session.customer_name || "",
        items,
        status: session.status,
      },
    };
  } catch (err: any) {
    return { valid: false, error: err.message || "Failed to verify cash session." };
  }
}

export async function completeCashWalkinSessionAction(token: string, orderNumber: number) {
  try {
    if (!token || !orderNumber) return { success: false };
    markCashWalkinSessionCompleted(token.trim(), orderNumber);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
