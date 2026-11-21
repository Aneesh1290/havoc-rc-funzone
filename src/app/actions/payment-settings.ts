"use server";

import { getSiteSetting, setSiteSetting } from "@/lib/db";
import { checkSessionAction } from "@/app/login/actions";
import { hasUserPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export type GatewayProvider = "icici" | "razorpay" | "phonepe" | "cashfree";
export type GatewayEnvironment = "live" | "test";
export type DefaultPaymentMethod = "online" | "desk";

export interface PublicPaymentConfig {
  enableOnline: boolean;
  enableDesk: boolean;
  defaultMethod: DefaultPaymentMethod;
  activeGateway: GatewayProvider;
  gatewayName: string;
  gatewayEnv: GatewayEnvironment;
  razorpayKeyId?: string;
}

export interface AdminPaymentSettings {
  enableOnline: boolean;
  enableDesk: boolean;
  defaultMethod: DefaultPaymentMethod;
  activeGateway: GatewayProvider;
  gatewayEnv: GatewayEnvironment;

  // Provider credentials
  icici: {
    merchantId: string;
    aggregatorId: string;
    secretKey: string;
  };
  razorpay: {
    keyId: string;
    keySecret: string;
  };
  phonepe: {
    merchantId: string;
    saltKey: string;
    saltIndex: string;
  };
  cashfree: {
    appId: string;
    secretKey: string;
  };
}

const GATEWAY_NAMES: Record<GatewayProvider, string> = {
  icici: "ICICI Secure Gateway",
  razorpay: "Razorpay Payment Gateway",
  phonepe: "PhonePe Payment Gateway",
  cashfree: "Cashfree Payment Gateway",
};

/**
 * Public action for customer checkout page to know which payment methods & gateway are enabled
 */
export async function getPublicPaymentConfigAction(): Promise<PublicPaymentConfig> {
  const enableOnline = getSiteSetting("payment_enable_online", "1") !== "0";
  const enableDesk = getSiteSetting("payment_enable_desk", "1") !== "0";
  const defaultMethod = (getSiteSetting("payment_default_method", "online") as DefaultPaymentMethod) || "online";
  const activeGateway = (getSiteSetting("payment_active_gateway", "icici") as GatewayProvider) || "icici";
  const gatewayEnv = (getSiteSetting("payment_gateway_env", process.env.ICICI_ENV || "live") as GatewayEnvironment) || "live";

  let razorpayKeyId: string | undefined = undefined;
  if (activeGateway === "razorpay") {
    razorpayKeyId = getSiteSetting("razorpay_key_id", process.env.RAZORPAY_KEY_ID || "");
  }

  return {
    enableOnline,
    enableDesk,
    defaultMethod,
    activeGateway,
    gatewayName: GATEWAY_NAMES[activeGateway] || "Secure Online Gateway",
    gatewayEnv,
    razorpayKeyId: razorpayKeyId || undefined,
  };
}

/**
 * Protected action for admin settings page to view all payment gateway configurations & credentials
 */
export async function getAdminPaymentSettingsAction(): Promise<AdminPaymentSettings> {
  const session = await checkSessionAction();
  if (!session) {
    throw new Error("Unauthorized: Admin session required.");
  }

  const enableOnline = getSiteSetting("payment_enable_online", "1") !== "0";
  const enableDesk = getSiteSetting("payment_enable_desk", "1") !== "0";
  const defaultMethod = (getSiteSetting("payment_default_method", "online") as DefaultPaymentMethod) || "online";
  const activeGateway = (getSiteSetting("payment_active_gateway", "icici") as GatewayProvider) || "icici";
  const gatewayEnv = (getSiteSetting("payment_gateway_env", process.env.ICICI_ENV || "live") as GatewayEnvironment) || "live";

  const isUat = gatewayEnv === "test";
  const envMid = process.env.ICICI_MERCHANT_ID;
  const envAgg = process.env.ICICI_AGGREGATOR_ID;
  const envKey = process.env.ICICI_SECRET_KEY;

  const dbMid = getSiteSetting("icici_merchant_id", "");
  const dbAgg = getSiteSetting("icici_aggregator_id", "");
  const dbKey = getSiteSetting("icici_secret_key", "");

  const effectiveMid = envMid?.trim() || (dbMid && dbMid !== "100000000531583" ? dbMid : (isUat ? "100000000007164" : "100000000553470"));
  const effectiveAgg = envAgg?.trim() || (dbAgg && dbAgg !== "100000000531582" ? dbAgg : (isUat ? "A100000000007164" : "100000000553469"));
  const effectiveKey = envKey?.trim() || (dbKey && dbKey !== "9927ca2f-17bd-401d-8ae4-c34f5ea641bc" && dbKey !== "db06cca0-838b-4e01-8b20-6ac446ffb6bd" ? dbKey : (isUat ? "db06cca0-838b-4e01-8b20-6ac446ffb6bd" : "863edfb6-97c3-4944-b7d8-021fd7248037"));

  return {
    enableOnline,
    enableDesk,
    defaultMethod,
    activeGateway,
    gatewayEnv,
    icici: {
      merchantId: effectiveMid,
      aggregatorId: effectiveAgg,
      secretKey: effectiveKey,
    },
    razorpay: {
      keyId: getSiteSetting("razorpay_key_id", process.env.RAZORPAY_KEY_ID || ""),
      keySecret: getSiteSetting("razorpay_key_secret", process.env.RAZORPAY_KEY_SECRET || ""),
    },
    phonepe: {
      merchantId: getSiteSetting("phonepe_merchant_id", process.env.PHONEPE_MERCHANT_ID || ""),
      saltKey: getSiteSetting("phonepe_salt_key", process.env.PHONEPE_SALT_KEY || ""),
      saltIndex: getSiteSetting("phonepe_salt_index", process.env.PHONEPE_SALT_INDEX || "1"),
    },
    cashfree: {
      appId: getSiteSetting("cashfree_app_id", process.env.CASHFREE_APP_ID || ""),
      secretKey: getSiteSetting("cashfree_secret_key", process.env.CASHFREE_SECRET_KEY || ""),
    },
  };
}

/**
 * Protected action for admin to save payment gateway options and credentials
 */
export async function updateAdminPaymentSettingsAction(data: AdminPaymentSettings) {
  const session = await checkSessionAction();
  if (!session) {
    return { success: false, error: "Unauthorized: Admin session required." };
  }

  // Ensure at least one payment method is enabled
  if (!data.enableOnline && !data.enableDesk) {
    return { success: false, error: "You must enable at least one payment method (Online or Pay at Desk)." };
  }

  try {
    setSiteSetting("payment_enable_online", data.enableOnline ? "1" : "0", "Enable Online Payment at checkout");
    setSiteSetting("payment_enable_desk", data.enableDesk ? "1" : "0", "Enable Pay at Desk at checkout");
    setSiteSetting("payment_default_method", data.defaultMethod, "Default payment method selected at checkout");
    setSiteSetting("payment_active_gateway", data.activeGateway, "Active online payment gateway provider");
    setSiteSetting("payment_gateway_env", data.gatewayEnv, "Payment gateway environment (live or test)");

    // Save provider credentials
    if (data.icici) {
      setSiteSetting("icici_merchant_id", (data.icici.merchantId || "").trim(), "ICICI Merchant ID");
      setSiteSetting("icici_aggregator_id", (data.icici.aggregatorId || "").trim(), "ICICI Aggregator ID");
      setSiteSetting("icici_secret_key", (data.icici.secretKey || "").trim(), "ICICI Secret Key");
    }

    if (data.razorpay) {
      setSiteSetting("razorpay_key_id", (data.razorpay.keyId || "").trim(), "Razorpay Key ID");
      setSiteSetting("razorpay_key_secret", (data.razorpay.keySecret || "").trim(), "Razorpay Key Secret");
    }

    if (data.phonepe) {
      setSiteSetting("phonepe_merchant_id", (data.phonepe.merchantId || "").trim(), "PhonePe Merchant ID");
      setSiteSetting("phonepe_salt_key", (data.phonepe.saltKey || "").trim(), "PhonePe Salt Key");
      setSiteSetting("phonepe_salt_index", (data.phonepe.saltIndex || "1").trim(), "PhonePe Salt Index");
    }

    if (data.cashfree) {
      setSiteSetting("cashfree_app_id", (data.cashfree.appId || "").trim(), "Cashfree App ID");
      setSiteSetting("cashfree_secret_key", (data.cashfree.secretKey || "").trim(), "Cashfree Secret Key");
    }

    revalidatePath("/admin/settings");
    revalidatePath("/checkout");

    return { success: true };
  } catch (err: any) {
    console.error("Failed to update payment gateway settings:", err);
    return { success: false, error: err.message || "Failed to update settings" };
  }
}

export interface DeskPaymentLinkSettings {
  enabled: boolean;
  brandName: string;
  templateName: string;
}

export async function getDeskPaymentLinkSettingsAction(): Promise<DeskPaymentLinkSettings> {
  return {
    enabled: getSiteSetting("desk_payment_link_enabled", "1") !== "0",
    brandName: getSiteSetting("desk_payment_brand_name", "Havoc RC Fun Zone"),
    templateName: getSiteSetting("desk_payment_link_template", process.env.INTERAKT_PAYMENT_LINK_TEMPLATE || "havoc_payment_link"),
  };
}

export async function updateDeskPaymentLinkSettingsAction(settings: DeskPaymentLinkSettings) {
  try {
    const session = await checkSessionAction();
    const canManageSettings = session && (
      hasUserPermission(session, "settings") ||
      session.role === "super_admin" || 
      session.role === "Administrator" || 
      session.role?.toLowerCase()?.includes("admin") ||
      session.username?.toLowerCase() === "admin"
    );
    if (!session || !canManageSettings) {
      return { success: false, error: "Unauthorized: Only administrators can update settings." };
    }

    setSiteSetting("desk_payment_link_enabled", settings.enabled ? "1" : "0", "Enable sending payment links via WhatsApp at check-in desk");
    setSiteSetting("desk_payment_brand_name", (settings.brandName || "Havoc RC Fun Zone").trim(), "Brand name sent in payment link WhatsApp template (Variable 2)");
    setSiteSetting("desk_payment_link_template", (settings.templateName || "havoc_payment_link").trim(), "Interakt Template Name for Desk Payment Link");

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to update desk payment link settings:", err);
    return { success: false, error: err.message || "Failed to save payment link settings" };
  }
}

export interface AdvanceNotificationSettings {
  enabled: boolean;
  hoursBefore: number; // e.g. 24 hours or 2 hours
  brandName: string;
  templateName: string;
}

export async function getAdvanceNotificationSettingsAction(): Promise<AdvanceNotificationSettings> {
  return {
    enabled: getSiteSetting("advance_notify_enabled", "1") !== "0",
    hoursBefore: parseInt(getSiteSetting("advance_notify_hours_before", "24"), 10) || 24,
    brandName: getSiteSetting("advance_notify_brand_name", "Havoc RC Fun Zone"),
    templateName: getSiteSetting("advance_notify_template", process.env.INTERAKT_ADVANCE_NOTIFY_TEMPLATE || "havoc_payment_link"),
  };
}

export async function updateAdvanceNotificationSettingsAction(settings: AdvanceNotificationSettings) {
  try {
    const session = await checkSessionAction();
    const canManageSettings = session && (
      hasUserPermission(session, "settings") ||
      session.role === "super_admin" || 
      session.role === "Administrator" || 
      session.role?.toLowerCase()?.includes("admin") ||
      session.username?.toLowerCase() === "admin"
    );
    if (!session || !canManageSettings) {
      return { success: false, error: "Unauthorized: Only administrators can update settings." };
    }

    setSiteSetting("advance_notify_enabled", settings.enabled ? "1" : "0", "Enable advance booking notifications with payment links");
    setSiteSetting("advance_notify_hours_before", String(settings.hoursBefore || 24), "Target hours before booking to send advance notification");
    setSiteSetting("advance_notify_brand_name", (settings.brandName || "Havoc RC Fun Zone").trim(), "Brand name sent in advance notification WhatsApp message");
    setSiteSetting("advance_notify_template", (settings.templateName || "havoc_payment_link").trim(), "Interakt template name for advance booking notification");

    revalidatePath("/admin/settings");
    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to update advance notification settings:", err);
    return { success: false, error: err.message || "Failed to save advance notification settings" };
  }
}

export async function testAdvanceReminderWhatsAppAction(testPhone: string): Promise<{ success: boolean; message: string; waMeUrl?: string; error?: string }> {
  try {
    const session = await checkSessionAction();
    if (!session) {
      return { success: false, message: "Unauthorized: Admin session required.", error: "Unauthorized" };
    }

    if (!testPhone || testPhone.trim().length < 7) {
      return { success: false, message: "Please enter a valid phone number with country code (e.g. +91 9876543210).", error: "Invalid phone number" };
    }

    const brandName = getSiteSetting("advance_notify_brand_name", "Havoc RC Fun Zone");
    const templateName = getSiteSetting("advance_notify_template", "havoc_payment_link");

    const { sendPaymentLinkWhatsApp } = await import("@/lib/whatsapp");
    return await sendPaymentLinkWhatsApp({
      customerName: "Krupa (Test Guest)",
      customerPhone: testPhone.trim(),
      totalAmount: 1534,
      paymentUrl: "https://havocrcfunzone.in/pay/test_advance_reminder",
      brandName: brandName,
      orderSummary: "1x PARTICIPANT (4PM-5PM), 1x VISITOR (4PM-5PM)",
      bookingDate: "22-Nov-2026",
      timeSlot: "4PM-5PM",
      orderId: "#PAYDUE_FZ_54",
      templateName: templateName,
      isReminder: true,
    });
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to send test advance reminder", error: err.message };
  }
}

export interface GoogleReviewSettings {
  enabled: boolean;
  reviewUrl: string;
  templateName: string;
  interaktApiKey: string;
}

export async function getGoogleReviewSettingsAction(): Promise<GoogleReviewSettings> {
  return {
    enabled: getSiteSetting("google_review_enabled", "true") !== "false",
    reviewUrl: getSiteSetting(
      "google_review_url", 
      process.env.GOOGLE_REVIEW_URL || "https://maps.app.goo.gl/havoc-rc-funzone"
    ),
    templateName: getSiteSetting(
      "interakt_review_template", 
      process.env.INTERAKT_REVIEW_TEMPLATE || "havoc_google_review"
    ),
    interaktApiKey: getSiteSetting(
      "interakt_api_key", 
      process.env.INTERAKT_API_KEY || ""
    ),
  };
}

export async function updateGoogleReviewSettingsAction(settings: GoogleReviewSettings) {
  try {
    const session = await checkSessionAction();
    const canManageSettings = session && (
      hasUserPermission(session, "settings") ||
      session.role === "super_admin" || 
      session.role === "Administrator" || 
      session.role?.toLowerCase()?.includes("admin") ||
      session.username?.toLowerCase() === "admin"
    );
    if (!session || !canManageSettings) {
      return { success: false, error: "Unauthorized: Only administrators can update settings." };
    }

    setSiteSetting("google_review_enabled", settings.enabled ? "true" : "false", "Send Google Review WhatsApp message on OTP verification");
    setSiteSetting("google_review_url", (settings.reviewUrl || "").trim(), "Google Review Page URL");
    setSiteSetting("interakt_review_template", (settings.templateName || "").trim(), "Interakt Template Name for Google Review");
    if (settings.interaktApiKey !== undefined) {
      setSiteSetting("interakt_api_key", (settings.interaktApiKey || "").trim(), "Interakt API Key for WhatsApp messaging");
    }

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to update Google review settings:", err);
    return { success: false, error: err.message || "Failed to save review settings" };
  }
}

export interface AdminBookingAlertSettings {
  enabled: boolean;
  instantAlertsEnabled: boolean;
  upcomingAlertsEnabled: boolean;
  consolidateSlotAlerts: boolean;
  upcomingLeadMinutes: number;
  brandName: string;
  upcomingTemplateName: string;
  phoneNumbers: string[];
}

export async function getAdminBookingAlertSettingsAction(): Promise<AdminBookingAlertSettings> {
  const enabled = getSiteSetting("admin_booking_alert_enabled", "1") !== "0";
  const instantAlertsEnabled = getSiteSetting("admin_instant_alert_enabled", "1") !== "0";
  const upcomingAlertsEnabled = getSiteSetting("admin_upcoming_alert_enabled", "1") !== "0";
  const consolidateSlotAlerts = getSiteSetting("admin_consolidate_slot_alerts", "1") !== "0";
  const upcomingLeadMinutes = parseInt(getSiteSetting("admin_upcoming_lead_minutes", "30"), 10) || 30;
  const brandName = getSiteSetting("admin_alert_brand_name", "Havoc RC Fun Zone");
  const upcomingTemplateName = getSiteSetting("admin_upcoming_template", "havoc_admin_booking_reminder");
  const rawPhones = getSiteSetting("admin_booking_alert_phones", process.env.ADMIN_WHATSAPP_NUMBERS || "");
  const phoneNumbers = rawPhones
    .split(/[\n,;]+/)
    .map(p => p.trim())
    .filter(Boolean);

  return {
    enabled,
    instantAlertsEnabled,
    upcomingAlertsEnabled,
    consolidateSlotAlerts,
    upcomingLeadMinutes,
    brandName,
    upcomingTemplateName,
    phoneNumbers,
  };
}

export async function updateAdminBookingAlertSettingsAction(settings: AdminBookingAlertSettings) {
  try {
    const session = await checkSessionAction();
    const canManageSettings = session && (
      hasUserPermission(session, "settings") ||
      session.role === "super_admin" || 
      session.role === "Administrator" || 
      session.role?.toLowerCase()?.includes("admin") ||
      session.username?.toLowerCase() === "admin"
    );
    if (!session || !canManageSettings) {
      return { success: false, error: "Unauthorized: Only administrators can update settings." };
    }

    const cleanPhones = Array.isArray(settings.phoneNumbers)
      ? settings.phoneNumbers.map(p => p.trim()).filter(Boolean).join(", ")
      : "";

    setSiteSetting("admin_booking_alert_enabled", settings.enabled ? "1" : "0", "Master toggle for WhatsApp booking notifications to admins");
    setSiteSetting("admin_instant_alert_enabled", settings.instantAlertsEnabled ? "1" : "0", "Send instant alert when new booking is confirmed");
    setSiteSetting("admin_upcoming_alert_enabled", settings.upcomingAlertsEnabled ? "1" : "0", "Send upcoming reminder 30 mins before scheduled slot");
    setSiteSetting("admin_consolidate_slot_alerts", settings.consolidateSlotAlerts ? "1" : "0", "Group multiple bookings for same upcoming slot into 1 summary message");
    setSiteSetting("admin_upcoming_lead_minutes", String(settings.upcomingLeadMinutes || 30), "Lead time in minutes before slot to trigger reminder");
    setSiteSetting("admin_alert_brand_name", (settings.brandName || "Havoc RC Fun Zone").trim(), "Brand name sent in WhatsApp reminder (Variable {{1}})");
    setSiteSetting("admin_upcoming_template", (settings.upcomingTemplateName || "havoc_admin_booking_reminder").trim(), "Interakt template for upcoming booking reminder");
    setSiteSetting("admin_booking_alert_phones", cleanPhones, "Comma-separated list of admin phone numbers to receive WhatsApp booking alerts");

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to update admin booking alert settings:", err);
    return { success: false, error: err.message || "Failed to save admin alert settings" };
  }
}

export async function testAdminBookingAlertAction(testPhone: string, mode: "upcoming" | "instant" | "slot_summary" = "upcoming") {
  try {
    const session = await checkSessionAction();
    if (!session) {
      return { success: false, error: "Unauthorized: Admin session required." };
    }

    if (!testPhone || testPhone.trim().length < 7) {
      return { success: false, error: "Please enter a valid phone number with country code (e.g. +91 9876543210)." };
    }

    const brandName = getSiteSetting("admin_alert_brand_name", "Havoc RC Fun Zone");
    const templateName = getSiteSetting("admin_upcoming_template", "havoc_admin_booking_reminder");

    if (mode === "slot_summary") {
      const { sendAdminUpcomingReminderWhatsApp } = await import("@/lib/whatsapp");
      const testResult = await sendAdminUpcomingReminderWhatsApp({
        orderId: "3 Orders (05:00 PM - 06:00 PM)",
        customerName: "Slot Summary (3 Bookings • 6 Racers)",
        customerPhone: "2 Paid • 1 Due at Desk",
        totalAmount: 3200,
        paymentStatus: "Total: ₹3,200 (2 Paid, 1 Due)",
        itemsSummary: "1. #101 Rahul S. (..3210): 2x Pro Pass [Paid]\n2. #102 Priya P. (..5678): 1x Rookie Pass [Due ₹800]\n3. #103 Zia School (..9999): 3x Excavator [Paid]",
        timeSlot: "05:00 PM - 06:00 PM",
        bookingDate: "Today",
        adminPhone: testPhone.trim(),
        brandName,
        templateName,
      });
      return testResult;
    } else if (mode === "upcoming") {
      const { sendAdminUpcomingReminderWhatsApp } = await import("@/lib/whatsapp");
      const testResult = await sendAdminUpcomingReminderWhatsApp({
        orderId: "#TEST_FZ_" + Date.now().toString().slice(-4),
        customerName: "Aneesh Dhavade (Test Guest)",
        customerPhone: "+91 9876543210",
        totalAmount: 590,
        paymentStatus: "Paid Online (₹590.00)",
        itemsSummary: "2x Standard RC Fun Zone Pass",
        timeSlot: "04:30 PM - 05:00 PM",
        bookingDate: "Today",
        adminPhone: testPhone.trim(),
        brandName,
        templateName,
      });
      return testResult;
    } else {
      const { sendBookingConfirmationWhatsApp } = await import("@/lib/whatsapp");
      const testResult = await sendBookingConfirmationWhatsApp({
        orderId: "#TEST_FZ_" + Date.now().toString().slice(-4),
        customerName: "[TEST ALERT] Admin Setup",
        customerPhone: testPhone.trim(),
        totalAmount: 590,
        paymentStatus: "Paid",
        ticketName: "Test RC Fun Zone Booking",
        quantity: 1,
        date: new Date().toISOString().split("T")[0],
        timeSlot: "12:00 PM - 01:00 PM",
      });
      return testResult;
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to send test alert" };
  }
}

export async function triggerAdminUpcomingAlertsManualAction(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  dispatched?: number;
  orders?: any[];
  [key: string]: any;
}> {
  try {
    const session = await checkSessionAction();
    if (!session) {
      return { success: false, error: "Unauthorized: Admin session required." };
    }

    const { runUpcomingBookingAlertsCheck } = await import("@/lib/upcoming-alert-runner");
    return await runUpcomingBookingAlertsCheck();
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to trigger upcoming alerts check" };
  }
}

