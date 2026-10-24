/**
 * Desk OTP Store & WhatsApp Verification for Havoc RC Fun Zone
 * Provides in-memory 10-minute expiry cache, OTP generation/validation,
 * and WhatsApp notification dispatch (Interakt API / WhatsApp Cloud API) with dev fallback.
 */

interface DeskOtpEntry {
  otp: string;
  expiresAt: number;
  phone: string;
  createdAt: number;
}

// In Next.js dev mode, preserve store across module reloads
declare global {
  var __deskOtpStore: Map<string, DeskOtpEntry> | undefined;
}

const otpStore: Map<string, DeskOtpEntry> = globalThis.__deskOtpStore || new Map<string, DeskOtpEntry>();
if (process.env.NODE_ENV !== "production") {
  globalThis.__deskOtpStore = otpStore;
}

/**
 * Normalizes phone number digits
 */
export function normalizePhone(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

/**
 * Creates unique store key incorporating country code and phone digits
 */
export function getOtpStoreKey(phone: string, countryCode: string = "+91"): string {
  const cleanPhone = normalizePhone(phone);
  const cleanCode = (countryCode || "+91").replace(/\D/g, "");
  return `${cleanCode}_${cleanPhone}`;
}

/**
 * Generates a random 4-digit numeric OTP (1000 - 9999)
 */
export function generate4DigitOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Saves OTP to store with 10-minute TTL
 */
export function saveDeskOtp(
  phone: string,
  otp: string,
  ttlMs: number = 10 * 60 * 1000,
  countryCode: string = "+91"
): void {
  const clean = normalizePhone(phone);
  if (!clean || clean.length < 5 || clean.length > 15) return;

  const entry: DeskOtpEntry = {
    otp: otp.trim(),
    expiresAt: Date.now() + ttlMs,
    phone: clean,
    createdAt: Date.now(),
  };

  const key = getOtpStoreKey(clean, countryCode);
  otpStore.set(key, entry);
  // Also store under clean phone directly as fallback
  otpStore.set(clean, entry);
}

/**
 * Verifies OTP for phone & countryCode
 */
export function verifyDeskOtp(phone: string, inputOtp: string, countryCode: string = "+91"): boolean {
  const clean = normalizePhone(phone);
  const key = getOtpStoreKey(clean, countryCode);
  const entry = otpStore.get(key) || otpStore.get(clean);
  if (!entry) return false;

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    otpStore.delete(clean);
    return false;
  }

  return entry.otp === inputOtp.trim();
}

/**
 * Deletes OTP entry from store
 */
export function deleteDeskOtp(phone: string, countryCode: string = "+91"): void {
  const clean = normalizePhone(phone);
  const key = getOtpStoreKey(clean, countryCode);
  otpStore.delete(key);
  otpStore.delete(clean);
}

/**
 * Checks if phone currently has an active OTP
 */
export function getActiveDeskOtp(phone: string): DeskOtpEntry | undefined {
  const clean = normalizePhone(phone);
  const entry = otpStore.get(clean);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(clean);
    return undefined;
  }
  return entry;
}

/**
 * Helper to check if a booking date matches TODAY (using local and IST Asia/Kolkata date)
 */
export function isBookingForToday(dateStr?: string | null): boolean {
  if (!dateStr || dateStr.trim() === "" || dateStr === "UNASSIGNED") return false;

  const clean = dateStr.trim();

  // Get current date parts in local time and Asia/Kolkata time
  const datesToCheck: { year: number; month: number; day: number }[] = [];

  const localNow = new Date();
  datesToCheck.push({
    year: localNow.getFullYear(),
    month: localNow.getMonth(),
    day: localNow.getDate(),
  });

  try {
    const istString = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istNow = new Date(istString);
    datesToCheck.push({
      year: istNow.getFullYear(),
      month: istNow.getMonth(),
      day: istNow.getDate(),
    });
  } catch (e) {
    // ignore
  }

  const MONTH_MAP: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  for (const today of datesToCheck) {
    // Format 1: ISO "2026-10-24"
    const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const yr = parseInt(isoMatch[1], 10);
      const mo = parseInt(isoMatch[2], 10) - 1;
      const da = parseInt(isoMatch[3], 10);
      if (yr === today.year && mo === today.month && da === today.day) return true;
    }

    // Format 2: "Oct 24", "October 24", "Oct 24, 2026"
    const wordMatch = clean.match(/^([A-Za-z]+)\s*(\d{1,2})(?:[,\s]+(\d{4}))?$/i);
    if (wordMatch) {
      const mStr = wordMatch[1].toLowerCase().slice(0, 3);
      const da = parseInt(wordMatch[2], 10);
      const yr = wordMatch[3] ? parseInt(wordMatch[3], 10) : today.year;
      const mo = MONTH_MAP[mStr];
      if (mo !== undefined && yr === today.year && mo === today.month && da === today.day) {
        return true;
      }
    }

    // Format 3: "24/10/2026" or "24-10-2026"
    const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/);
    if (dmyMatch) {
      const da = parseInt(dmyMatch[1], 10);
      const mo = parseInt(dmyMatch[2], 10) - 1;
      const yr = dmyMatch[3] ? parseInt(dmyMatch[3], 10) : today.year;
      if (yr === today.year && mo === today.month && da === today.day) return true;
    }

    // Fallback: Standard Date parse
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      const yr = parsed.getFullYear() < 2020 ? today.year : parsed.getFullYear();
      if (yr === today.year && parsed.getMonth() === today.month && parsed.getDate() === today.day) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Sends WhatsApp OTP using Interakt API or WhatsApp Cloud API with international countryCode.
 */
export async function sendWhatsAppOtp(
  phone: string, 
  otp: string, 
  countryCode: string = "+91"
): Promise<{ sent: boolean; message: string; error?: string }> {
  const cleanPhone = normalizePhone(phone);
  const cleanCountryCode = countryCode.startsWith("+") ? countryCode.trim() : `+${countryCode.replace(/\D/g, "")}`;
  const interaktApiKey = process.env.INTERAKT_API_KEY;
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_KEY;
  const whatsappPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Interakt API Integration
  if (interaktApiKey) {
    try {
      let authHeader = interaktApiKey.trim();
      if (!authHeader.toLowerCase().startsWith("basic ")) {
        authHeader = `Basic ${authHeader}`;
      }

      const templateName = process.env.INTERAKT_OTP_TEMPLATE || "desk_checkin_otp";

      const response = await fetch("https://api.interakt.ai/v1/public/message/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({
          countryCode: cleanCountryCode,
          phoneNumber: cleanPhone,
          type: "Template",
          template: {
            name: templateName,
            languageCode: "en",
            bodyValues: [otp],
            buttonValues: {
              "0": [otp],
            },
          },
        }),
      });

      if (response.ok) {
        return { sent: true, message: `OTP sent successfully to ${cleanCountryCode} ${cleanPhone} via WhatsApp.` };
      } else {
        const errText = await response.text();
        console.error("[Desk OTP Interakt Error]", response.status, errText);
        let detail = errText;
        try {
          const parsed = JSON.parse(errText);
          detail = parsed.message || parsed.error || JSON.stringify(parsed);
        } catch (_) {}
        return { 
          sent: false, 
          message: `Interakt (${response.status}): ${detail}`, 
          error: errText 
        };
      }
    } catch (err: any) {
      console.error("[Desk OTP Interakt Exception]", err);
      return { sent: false, message: `Network error connecting to Interakt: ${err.message}`, error: err.message };
    }
  }

  // WhatsApp Cloud API Integration
  if (whatsappToken && whatsappPhoneId) {
    try {
      const templateName = process.env.WHATSAPP_OTP_TEMPLATE || "desk_checkin_otp";
      const fullRecipient = `${cleanCountryCode.replace(/\D/g, "")}${cleanPhone}`;
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
            name: templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: otp }],
              },
            ],
          },
        }),
      });

      if (response.ok) {
        return { sent: true, message: `OTP sent to ${cleanCountryCode} ${cleanPhone} via WhatsApp Cloud.` };
      } else {
        const errText = await response.text();
        console.error("[Desk OTP WhatsApp Cloud Error]", response.status, errText);
        let detail = errText;
        try {
          const parsed = JSON.parse(errText);
          detail = parsed.error?.message || errText;
        } catch (_) {}
        return { 
          sent: false, 
          message: `WhatsApp Cloud (${response.status}): ${detail}`, 
          error: errText 
        };
      }
    } catch (err: any) {
      console.error("[Desk OTP WhatsApp Exception]", err);
      return { sent: false, message: `Network error connecting to WhatsApp Cloud API: ${err.message}`, error: err.message };
    }
  }

  return {
    sent: false,
    message: "INTERAKT_API_KEY is not configured in Render. Please add INTERAKT_API_KEY in Render environment settings and redeploy.",
    error: "MISSING_WHATSAPP_API_KEY",
  };
}
