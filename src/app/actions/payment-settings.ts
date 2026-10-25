"use server";

import { getSiteSetting, setSiteSetting } from "@/lib/db";
import { checkSessionAction } from "@/app/login/actions";
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

  return {
    enableOnline,
    enableDesk,
    defaultMethod,
    activeGateway,
    gatewayEnv,
    icici: {
      merchantId: getSiteSetting("icici_merchant_id", process.env.ICICI_MERCHANT_ID || "100000000531583"),
      aggregatorId: getSiteSetting("icici_aggregator_id", process.env.ICICI_AGGREGATOR_ID || "100000000531582"),
      secretKey: getSiteSetting("icici_secret_key", process.env.ICICI_SECRET_KEY || "9927ca2f-17bd-401d-8ae4-c34f5ea641bc"),
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
    if (!session || session.role !== "Administrator") {
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

