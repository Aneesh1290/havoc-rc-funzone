import { COUNTRY_CODES } from "./countries";
import { getSiteSetting } from "./db";

export interface WhatsAppOrderItem {
  ticketName: string;
  quantity: number;
  date: string;
  timeSlot: string;
  itemTotal?: number;
  simulatorName?: string;
  simulatorSlot?: string;
}

export interface BookingWhatsAppParams {
  orderId: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paymentStatus?: string;
  ticketName?: string;
  quantity?: number;
  date?: string;
  timeSlot?: string;
  simulatorName?: string;
  simulatorSlot?: string;
  items?: WhatsAppOrderItem[];
}

/**
 * Parses raw phone string into countryCode (e.g. "+91") and clean phoneNumber digits.
 * Supports numbers formatted like "+91 9876543210", "+1 (555) 000-1111", or "9876543210".
 */
export function parsePhoneAndCountryCode(rawPhone: string): { countryCode: string; phoneNumber: string } {
  if (!rawPhone) {
    return { countryCode: "+91", phoneNumber: "" };
  }

  const trimmed = rawPhone.trim();

  // If number starts with +, match against known dial codes (longest prefix match)
  if (trimmed.startsWith("+")) {
    const digitsOnly = trimmed.slice(1).replace(/\D/g, "");
    // Sort dial codes by length descending so +971 is matched before +97, etc.
    const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const c of sortedCodes) {
      const dialDigits = c.dialCode.replace(/\D/g, "");
      if (digitsOnly.startsWith(dialDigits)) {
        const remainingDigits = digitsOnly.slice(dialDigits.length);
        return {
          countryCode: c.dialCode,
          phoneNumber: remainingDigits,
        };
      }
    }
    // Fallback if country code is not in list
    return {
      countryCode: "+91",
      phoneNumber: digitsOnly.slice(-10),
    };
  }

  const digitsOnly = trimmed.replace(/\D/g, "");

  // If 12 digits starting with 91 (India)
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    return {
      countryCode: "+91",
      phoneNumber: digitsOnly.slice(2),
    };
  }

  // Default to +91 and keep clean digits
  return {
    countryCode: "+91",
    phoneNumber: digitsOnly,
  };
}

/**
 * Sends an automated WhatsApp booking confirmation notification via Interakt API.
 * Uses approved template (default: "havoc_booking_confirmation").
 */
export async function sendBookingConfirmationWhatsApp(
  params: BookingWhatsAppParams
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const interaktApiKey = process.env.INTERAKT_API_KEY;
    if (!interaktApiKey) {
      console.warn("[WhatsApp Notification] INTERAKT_API_KEY not configured. Skipping WhatsApp message dispatch.");
      return { success: false, message: "INTERAKT_API_KEY is not configured" };
    }

    if (!params.customerPhone) {
      return { success: false, message: "Missing customer phone number" };
    }

    const { countryCode, phoneNumber } = parsePhoneAndCountryCode(params.customerPhone);
    if (!phoneNumber || phoneNumber.length < 7) {
      console.warn("[WhatsApp Notification] Invalid phone number provided:", params.customerPhone);
      return { success: false, message: `Invalid phone number: ${params.customerPhone}` };
    }

    let authHeader = interaktApiKey.trim();
    if (!authHeader.toLowerCase().startsWith("basic ")) {
      authHeader = `Basic ${authHeader}`;
    }

    const templateName = process.env.INTERAKT_BOOKING_TEMPLATE || "havoc_booking_confirmation";

    // Format {{1}}: Customer Name
    const var1CustomerName = params.customerName?.trim() || "Racer";

    // Format {{2}}: Order ID
    const var2OrderId = params.orderId || "HVC-BOOKING";

    // Format {{3}}: Passes / Items Summary
    let var3Passes = "";
    if (params.items && params.items.length > 0) {
      var3Passes = params.items.map(item => `${item.quantity}x ${item.ticketName}`).join(", ");
    } else {
      var3Passes = `${params.quantity || 1}x ${params.ticketName || "RC Fun Zone Pass"}`;
    }
    // Truncate if exceptionally long to comply with WhatsApp parameter limits
    if (var3Passes.length > 120) {
      var3Passes = var3Passes.slice(0, 117) + "...";
    }

    // Format {{4}}: Date & Slot Summary
    let var4DateSlot = "";
    if (params.items && params.items.length > 0) {
      const uniqueDates = Array.from(new Set(params.items.map(i => i.date).filter(Boolean)));
      const uniqueSlots = Array.from(new Set(params.items.map(i => i.timeSlot).filter(Boolean)));
      var4DateSlot = `${uniqueDates.join(", ") || "Scheduled"} • ${uniqueSlots.join(", ") || "Open Slot"}`;
    } else {
      var4DateSlot = `${params.date || "Scheduled"} • ${params.timeSlot || "Open Slot"}`;
    }
    if (var4DateSlot.length > 100) {
      var4DateSlot = var4DateSlot.slice(0, 97) + "...";
    }

    // Format {{5}}: Total Amount & Payment Status
    const isPaid = (params.paymentStatus || "").toUpperCase() === "PAID";
    const paymentLabel = isPaid ? "Paid Online" : "Pay at Desk";
    const var5Amount = `₹${params.totalAmount.toLocaleString("en-IN")} (${paymentLabel})`;

    const payload = {
      countryCode: countryCode.startsWith("+") ? countryCode : `+${countryCode}`,
      phoneNumber: phoneNumber,
      type: "Template",
      template: {
        name: templateName,
        languageCode: "en",
        bodyValues: [
          var1CustomerName,
          var2OrderId,
          var3Passes,
          var4DateSlot,
          var5Amount,
        ],
      },
    };

    const response = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`[WhatsApp Notification] Confirmation sent successfully to ${countryCode} ${phoneNumber} for Order ${var2OrderId}`);
      return {
        success: true,
        message: `WhatsApp confirmation sent to ${countryCode} ${phoneNumber}`,
      };
    } else {
      const errText = await response.text();
      console.error("[WhatsApp Notification Error]", response.status, errText);
      return {
        success: false,
        message: `Interakt responded with status ${response.status}`,
        error: errText,
      };
    }
  } catch (err: any) {
    console.error("[WhatsApp Notification Exception]", err);
    return {
      success: false,
      message: `Failed to dispatch WhatsApp confirmation: ${err.message}`,
      error: err.message,
    };
  }
}

export interface GoogleReviewWhatsAppParams {
  customerName?: string;
  customerPhone: string;
  countryCode?: string;
  reviewUrl?: string;
}

/**
 * Google Review link sending is completely disabled per business requirements.
 */
export async function sendGoogleReviewWhatsApp(
  _params: GoogleReviewWhatsAppParams
): Promise<{ success: boolean; message: string; error?: string }> {
  return { success: false, message: "Google review WhatsApp link sending is disabled." };
}

export interface PaymentLinkWhatsAppParams {
  customerName: string;
  customerPhone: string;
  countryCode?: string;
  totalAmount: number;
  paymentUrl: string;
  brandName?: string;
  orderSummary?: string;
}

/**
 * Dispatches a payment link to customer via WhatsApp.
 * Supports:
 * 1. Interakt API Template with 4 body values:
 *    {{1}}: Customer Name
 *    {{2}}: Brand Name (e.g. "Havoc RC Fun Zone")
 *    {{3}}: Amount Due (e.g. "2,950")
 *    {{4}}: Payment Link URL (e.g. "https://havocrcfunzone.com/pay/xyz")
 * 2. WhatsApp Cloud API
 * 3. Direct wa.me fallback URL generation
 */
export async function sendPaymentLinkWhatsApp(
  params: PaymentLinkWhatsAppParams
): Promise<{ success: boolean; message: string; waMeUrl: string; error?: string }> {
  const { 
    countryCode: rawCountryCode, 
    customerPhone, 
    customerName, 
    totalAmount, 
    paymentUrl, 
    brandName = "Havoc RC Fun Zone",
    orderSummary 
  } = params;
  const { countryCode, phoneNumber } = parsePhoneAndCountryCode(rawCountryCode ? `${rawCountryCode}${customerPhone}` : customerPhone);
  const cleanCountryCode = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;

  const messageText = `Hi ${customerName || "Racer"}! 👋\n\nYour payment link for ${brandName} is ready:\n💳 Amount Due: ₹${Number(totalAmount).toLocaleString("en-IN")}\n${orderSummary ? `📋 Details: ${orderSummary}\n` : ""}🔗 Pay Now: ${paymentUrl}\n\nPlease tap the link above to complete your payment online. See you on the track! 🏁`;
  const digitsOnlyCountry = cleanCountryCode.replace(/\D/g, "");
  const waMeUrl = `https://wa.me/${digitsOnlyCountry}${phoneNumber}?text=${encodeURIComponent(messageText)}`;

  const interaktApiKey = getSiteSetting("interakt_api_key", process.env.INTERAKT_API_KEY || "");
  const templateName = getSiteSetting("desk_payment_link_template", process.env.INTERAKT_PAYMENT_LINK_TEMPLATE || "havoc_payment_link");

  // If Interakt API key & template name are available, send via Interakt
  if (interaktApiKey && templateName) {
    try {
      let authHeader = interaktApiKey.trim();
      if (!authHeader.toLowerCase().startsWith("basic ")) {
        authHeader = `Basic ${authHeader}`;
      }

      const formattedAmount = Number(totalAmount).toLocaleString("en-IN");

      const response = await fetch("https://api.interakt.ai/v1/public/message/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({
          countryCode: cleanCountryCode,
          phoneNumber: phoneNumber,
          type: "Template",
          template: {
            name: templateName,
            languageCode: "en",
            bodyValues: [
              customerName || "Racer",        // {{1}}: Name
              brandName || "Havoc RC Fun Zone", // {{2}}: Brand Name
              formattedAmount,                // {{3}}: Amount Due
              paymentUrl,                     // {{4}}: Direct Payment Link
            ],
          },
        }),
      });

      if (response.ok) {
        return {
          success: true,
          message: `Payment link sent via WhatsApp to ${cleanCountryCode} ${phoneNumber}`,
          waMeUrl,
        };
      } else {
        const errText = await response.text();
        console.warn("[Interakt Payment Link Warning]", response.status, errText);
      }
    } catch (err: any) {
      console.warn("[Interakt Payment Link Exception]", err?.message);
    }
  }

  // WhatsApp Cloud API fallback if available
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_KEY;
  const whatsappPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const cloudTemplate = process.env.WHATSAPP_PAYMENT_LINK_TEMPLATE;

  if (whatsappToken && whatsappPhoneId && cloudTemplate) {
    try {
      const fullRecipient = `${digitsOnlyCountry}${phoneNumber}`;
      const response = await fetch(`https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${whatsappToken.trim()}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: fullRecipient,
          type: "template",
          template: {
            name: cloudTemplate,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: customerName || "Racer" },
                  { type: "text", text: `₹${Number(totalAmount).toLocaleString("en-IN")}` },
                  { type: "text", text: paymentUrl },
                ],
              },
            ],
          },
        }),
      });

      if (response.ok) {
        return {
          success: true,
          message: `Payment link sent via WhatsApp Cloud to ${cleanCountryCode} ${phoneNumber}`,
          waMeUrl,
        };
      }
    } catch (err: any) {
      console.warn("[WhatsApp Cloud Payment Link Exception]", err?.message);
    }
  }

  // Standard direct WhatsApp link available (wa.me)
  return {
    success: true,
    message: `WhatsApp payment message prepared for ${cleanCountryCode} ${phoneNumber}`,
    waMeUrl,
  };
}
