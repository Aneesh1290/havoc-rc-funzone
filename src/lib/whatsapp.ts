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
 * Sanitizes variable strings sent to WhatsApp / Interakt template endpoints.
 * Meta / WhatsApp strictly prohibits:
 * 1. Newlines (\r, \n)
 * 2. Tabs (\t)
 * 3. 2 or more consecutive spaces (\s{2,})
 */
export function sanitizeWhatsAppTemplateVar(val: any, maxLength = 120): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/[\r\n\t]+/g, " • ") // Replace any newlines/tabs with bullets
    .replace(/\s{2,}/g, " ")      // Collapse multiple consecutive spaces
    .trim()
    .slice(0, maxLength);
}

/**
 * Sends an automated WhatsApp booking confirmation notification via Interakt API.
 * Uses approved template (default: "havoc_booking_confirmation").
 */
export async function sendBookingConfirmationWhatsApp(
  params: BookingWhatsAppParams
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const interaktApiKey = process.env.INTERAKT_API_KEY || getSiteSetting("interakt_api_key", "");
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
  bookingDate?: string;
  timeSlot?: string;
  orderId?: string;
  templateName?: string;
  isReminder?: boolean;
}

/**
 * Dispatches a payment link / advance booking reminder to customer via WhatsApp.
 * Supports:
 * 1. 6-Variable Customer Booking Reminder Template (default/recommended):
 *    {{1}}: Customer Name
 *    {{2}}: Brand Name (e.g. "Havoc RC Fun Zone" or "Sim Podium")
 *    {{3}}: Date & Slot (e.g. "Nov 22 • 4PM-5PM")
 *    {{4}}: Activity / Passes Summary (e.g. "1x Participant, 1x Visitor")
 *    {{5}}: Amount Due (e.g. "1,534")
 *    {{6}}: Secure Payment Link URL
 * 2. Legacy 4-Variable Template (e.g. "havoc_payment_link"):
 *    {{1}}: Customer Name, {{2}}: Brand Name, {{3}}: Amount Due, {{4}}: Payment URL
 * 3. WhatsApp Cloud API fallback
 * 4. Direct wa.me link generation with full rich reminder formatting
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
    orderSummary,
    bookingDate,
    timeSlot,
    orderId,
    isReminder
  } = params;
  const { countryCode, phoneNumber } = parsePhoneAndCountryCode(rawCountryCode ? `${rawCountryCode}${customerPhone}` : customerPhone);
  const cleanCountryCode = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;

  const dateSlotStr = (bookingDate && timeSlot) 
    ? `${bookingDate} • ${timeSlot}` 
    : (bookingDate || timeSlot || "");

  let messageText: string;
  if (isReminder || dateSlotStr) {
    messageText = `Hi ${customerName || "Racer"}! 👋\n\nFriendly reminder for your upcoming session at ${brandName}!\n\n📅 Date & Slot: ${dateSlotStr || "Upcoming Session"}\n${orderSummary ? `🎟️ Activity: ${orderSummary}\n` : ""}💳 Amount Due: ₹${Number(totalAmount).toLocaleString("en-IN")}\n\nTo skip the check-in queue at the desk, tap the link below to pay online:\n🔗 ${paymentUrl}\n\nSee you on the track! 🏁`;
  } else {
    messageText = `Hi ${customerName || "Racer"}! 👋\n\nYour payment link for ${brandName} is ready:\n💳 Amount Due: ₹${Number(totalAmount).toLocaleString("en-IN")}\n${orderSummary ? `📋 Details: ${orderSummary}\n` : ""}🔗 Pay Now: ${paymentUrl}\n\nPlease tap the link above to complete your payment online. See you on the track! 🏁`;
  }

  const digitsOnlyCountry = cleanCountryCode.replace(/\D/g, "");
  const waMeUrl = `https://wa.me/${digitsOnlyCountry}${phoneNumber}?text=${encodeURIComponent(messageText)}`;

  const interaktApiKey = getSiteSetting("interakt_api_key", process.env.INTERAKT_API_KEY || "");
  const templateName = params.templateName || getSiteSetting("desk_payment_link_template", process.env.INTERAKT_PAYMENT_LINK_TEMPLATE || "havoc_payment_link");

  // If Interakt API key & template name are available, send via Interakt
  if (interaktApiKey && templateName) {
    try {
      let authHeader = interaktApiKey.trim();
      if (!authHeader.toLowerCase().startsWith("basic ")) {
        authHeader = `Basic ${authHeader}`;
      }

      const formattedAmount = Number(totalAmount).toLocaleString("en-IN");
      const cleanOrderId = (orderId || "").replace(/^#+/, "") || "BOOKING";
      const isFourVarLegacy = templateName.trim() === "havoc_payment_link";
      const isSevenVarAdvance = templateName.trim() === "havoc_advance_booking_reminder" || templateName.toLowerCase().includes("advance");

      // 7-variable approved template (havoc_advance_booking_reminder):
      // {{1}}: Name
      // {{2}}: Brand Name
      // {{3}}: Order ID (Template has "• Order ID: #{{3}}")
      // {{4}}: Experience
      // {{5}}: Date & Time
      // {{6}}: Amount Due (Template has "• Amount Due: ₹{{6}}")
      // {{7}}: Secure Payment Link
      const sevenVarBodyValues = [
        sanitizeWhatsAppTemplateVar(customerName || "Racer", 50),
        sanitizeWhatsAppTemplateVar(brandName || "Havoc RC Fun Zone", 50),
        sanitizeWhatsAppTemplateVar(cleanOrderId, 40),
        sanitizeWhatsAppTemplateVar(orderSummary || "RC Racing / Gaming Session", 120),
        sanitizeWhatsAppTemplateVar(dateSlotStr || "Scheduled Slot", 60),
        sanitizeWhatsAppTemplateVar(formattedAmount, 30),
        sanitizeWhatsAppTemplateVar(paymentUrl, 255),
      ];

      // 6-variable generic reminder template:
      const sixVarBodyValues = [
        sanitizeWhatsAppTemplateVar(customerName || "Racer", 50),
        sanitizeWhatsAppTemplateVar(brandName || "Havoc RC Fun Zone", 50),
        sanitizeWhatsAppTemplateVar(dateSlotStr || "Scheduled Session", 60),
        sanitizeWhatsAppTemplateVar(orderSummary || "Activity Pass", 120),
        sanitizeWhatsAppTemplateVar(formattedAmount, 30),
        sanitizeWhatsAppTemplateVar(paymentUrl, 255),
      ];

      // 4-variable legacy template (havoc_payment_link):
      const legacyBodyValues = [
        sanitizeWhatsAppTemplateVar(customerName || "Racer", 50),
        sanitizeWhatsAppTemplateVar(brandName || "Havoc RC Fun Zone", 50),
        sanitizeWhatsAppTemplateVar(formattedAmount, 30),
        sanitizeWhatsAppTemplateVar(paymentUrl, 255),
      ];

      // Determine initial values to send based on template name
      let initialValues = legacyBodyValues;
      if (isSevenVarAdvance) {
        initialValues = sevenVarBodyValues;
      } else if (!isFourVarLegacy) {
        initialValues = sixVarBodyValues;
      }

      let response = await fetch("https://api.interakt.ai/v1/public/message/", {
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
            bodyValues: initialValues,
          },
        }),
      });

      // If initial attempt failed with 4xx and we weren't already using legacy, retry with legacy 4-value structure
      if (!response.ok && initialValues !== legacyBodyValues) {
        const firstErr = await response.text();
        console.warn(`[Interakt Reminder First Try Failed] Status ${response.status}. Retrying with legacy 4-variable body values. Err: ${firstErr}`);

        response = await fetch("https://api.interakt.ai/v1/public/message/", {
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
              bodyValues: legacyBodyValues,
            },
          }),
        });
      }

      if (response.ok) {
        return {
          success: true,
          message: `Booking reminder & payment link sent via WhatsApp to ${cleanCountryCode} ${phoneNumber}`,
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

/**
 * Dispatches automated WhatsApp booking notification to configured admin phone numbers.
 * Reads admin phone numbers from database setting (admin_booking_alert_phones) or env (ADMIN_WHATSAPP_NUMBERS).
 */
export async function notifyAdminsBookingWhatsApp(
  params: BookingWhatsAppParams
): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  try {
    const isAlertEnabled = getSiteSetting("admin_booking_alert_enabled", "1") !== "0";
    const isInstantEnabled = getSiteSetting("admin_instant_alert_enabled", "1") !== "0";
    if (!isAlertEnabled || !isInstantEnabled) {
      return { success: true, sentCount: 0, errors: [] };
    }

    const rawPhones = getSiteSetting(
      "admin_booking_alert_phones",
      process.env.ADMIN_WHATSAPP_NUMBERS || ""
    );

    const adminPhones = rawPhones
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 7);

    if (adminPhones.length === 0) {
      return { success: true, sentCount: 0, errors: [] };
    }

    // Format customer name for admin's view with customer's phone if available
    const custPhone = params.customerPhone ? ` [${params.customerPhone}]` : "";
    const adminCustomerName = `[ADMIN] ${params.customerName || "Customer"}${custPhone}`;

    const errors: string[] = [];
    let sentCount = 0;

    await Promise.allSettled(
      adminPhones.map(async (adminPhone) => {
        try {
          const res = await sendBookingConfirmationWhatsApp({
            ...params,
            customerName: adminCustomerName.slice(0, 60),
            customerPhone: adminPhone,
          });
          if (res.success) {
            sentCount++;
          } else if (res.error) {
            errors.push(`${adminPhone}: ${res.error}`);
          }
        } catch (err: any) {
          errors.push(`${adminPhone}: ${err.message}`);
        }
      })
    );

    if (sentCount > 0) {
      console.log(`[Admin WhatsApp Alert] Dispatched booking alert to ${sentCount}/${adminPhones.length} admin numbers for Order ${params.orderId}`);
    }

    return {
      success: errors.length === 0,
      sentCount,
      errors,
    };
  } catch (err: any) {
    console.error("[Admin WhatsApp Alert Exception]", err);
    return { success: false, sentCount: 0, errors: [err.message] };
  }
}

export interface AdminUpcomingReminderParams {
  orderId: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paymentStatus: string;
  itemsSummary: string;
  timeSlot: string;
  bookingDate: string;
  adminPhone: string;
  brandName?: string;
  templateName?: string;
  rosterUrl?: string;
  isSlotSummary?: boolean;
}

/**
 * Sends a 30-minute prior upcoming booking reminder to an admin phone number using Interakt.
 * Supports:
 * 1. Clean 5-Variable Slot Summary Template (havoc_admin_slot_summary):
 *    {{1}}: Brand Name (e.g. "Havoc RC Fun Zone")
 *    {{2}}: Scheduled Slot (e.g. "05:00 PM - 06:00 PM • Today")
 *    {{3}}: Total Bookings (e.g. "3 Orders (6 Racers)")
 *    {{4}}: Payment Status (e.g. "Total: ₹3,200 (2 Paid, 1 Due)")
 *    {{5}}: Direct Slot Roster Link (e.g. "https://havocrcfunzone.in/roster?slot=...")
 * 2. Universal 7-Variable Single Booking Template (havoc_admin_booking_reminder)
 */
export async function sendAdminUpcomingReminderWhatsApp(
  params: AdminUpcomingReminderParams
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const interaktApiKey = process.env.INTERAKT_API_KEY || getSiteSetting("interakt_api_key", "");
    if (!interaktApiKey) {
      return { success: false, message: "INTERAKT_API_KEY is not configured" };
    }

    if (!params.adminPhone) {
      return { success: false, message: "Missing admin phone number" };
    }

    const { countryCode, phoneNumber } = parsePhoneAndCountryCode(params.adminPhone);
    if (!phoneNumber || phoneNumber.length < 7) {
      return { success: false, message: `Invalid phone number: ${params.adminPhone}` };
    }

    let authHeader = interaktApiKey.trim();
    if (!authHeader.toLowerCase().startsWith("basic ")) {
      authHeader = `Basic ${authHeader}`;
    }

    const brandName = params.brandName || getSiteSetting("admin_alert_brand_name", "Havoc RC Fun Zone");
    const templateName = params.templateName || getSiteSetting("admin_upcoming_template", "havoc_admin_booking_reminder");

    // {{1}}: Brand Name (No newlines, tabs, or multiple spaces)
    const var1Brand = sanitizeWhatsAppTemplateVar(brandName || "Havoc RC Fun Zone", 50);
    // {{2}}: Scheduled Slot (e.g. "05:00 PM - 06:00 PM • Today")
    const var2Slot = sanitizeWhatsAppTemplateVar(`${params.timeSlot} • ${params.bookingDate || 'Today'}`, 60);
    // {{3}}: Total Bookings / Customer Name (e.g. "3 Orders (6 Racers)")
    const var3Bookings = sanitizeWhatsAppTemplateVar(params.customerName || "1 Booking", 60);
    // {{4}}: Payment Status (e.g. "Total: ₹3,200 (2 Paid, 1 Due)")
    const var4Status = sanitizeWhatsAppTemplateVar(params.paymentStatus || `₹${Number(params.totalAmount).toLocaleString("en-IN")}`, 60);
    // {{5}}: View Slot Bookings Link / Passes Summary
    const var5Link = sanitizeWhatsAppTemplateVar(params.rosterUrl || params.itemsSummary || "https://havocrcfunzone.in", 255);

    // Dedicated 5-variable payload matching verified Interakt template 'havoc_admin_booking_reminder':
    // {{1}}: Venue Name
    // {{2}}: Scheduled Slot
    // {{3}}: Total Bookings
    // {{4}}: Payment Status
    // {{5}}: View Slot Bookings Link
    const fiveVarBodyValues = [
      var1Brand,
      var2Slot,
      var3Bookings,
      var4Status,
      var5Link,
    ];

    let response = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        countryCode: countryCode.startsWith("+") ? countryCode : `+${countryCode}`,
        phoneNumber: phoneNumber,
        type: "Template",
        template: {
          name: templateName,
          languageCode: "en",
          bodyValues: fiveVarBodyValues,
        },
      }),
    });

    // If custom template failed and wasn't the verified standard template, retry with havoc_admin_booking_reminder
    if (!response.ok && templateName !== "havoc_admin_booking_reminder") {
      const firstErr = await response.text();
      console.warn(`[Admin Reminder] Template '${templateName}' failed (${response.status}: ${firstErr}). Retrying with 'havoc_admin_booking_reminder'`);
      response = await fetch("https://api.interakt.ai/v1/public/message/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({
          countryCode: countryCode.startsWith("+") ? countryCode : `+${countryCode}`,
          phoneNumber: phoneNumber,
          type: "Template",
          template: {
            name: "havoc_admin_booking_reminder",
            languageCode: "en",
            bodyValues: fiveVarBodyValues,
          },
        }),
      });
    }

    if (response.ok) {
      console.log(`[Admin 30m Reminder] Sent to ${countryCode} ${phoneNumber} for Order ${params.orderId} via template ${templateName}`);
      return { success: true, message: `Upcoming reminder sent to ${countryCode} ${phoneNumber}` };
    } else {
      const errText = await response.text();
      console.error("[Admin 30m Reminder Error]", response.status, errText);
      return { success: false, message: `Interakt responded with status ${response.status}`, error: errText };
    }
  } catch (err: any) {
    console.error("[Admin 30m Reminder Exception]", err);
    return { success: false, message: err.message, error: err.message };
  }
}

/**
 * Dispatches the 30-minute prior upcoming booking alert to all registered admin phone numbers.
 */
export async function dispatchUpcomingBookingAlertsToAdmins(order: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paymentStatus: string;
  itemsSummary: string;
  rosterUrl?: string;
  timeSlot: string;
  bookingDate: string;
  brandName?: string;
  templateName?: string;
  isSlotSummary?: boolean;
}): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  const rawPhones = getSiteSetting(
    "admin_booking_alert_phones",
    process.env.ADMIN_WHATSAPP_NUMBERS || ""
  );

  const adminPhones = rawPhones
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 7);

  if (adminPhones.length === 0) {
    return { success: true, sentCount: 0, errors: ["No admin phone numbers configured"] };
  }

  const errors: string[] = [];
  let sentCount = 0;

  await Promise.allSettled(
    adminPhones.map(async (adminPhone) => {
      const res = await sendAdminUpcomingReminderWhatsApp({
        ...order,
        adminPhone,
      });
      if (res.success) {
        sentCount++;
      } else if (res.error) {
        errors.push(`${adminPhone}: ${res.error}`);
      }
    })
  );

  return {
    success: errors.length === 0,
    sentCount,
    errors,
  };
}
