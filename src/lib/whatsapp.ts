import { COUNTRY_CODES } from "./countries";

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
