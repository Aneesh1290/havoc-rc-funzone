import { NextRequest, NextResponse } from "next/server";
import {
  normalizePhone,
  generate4DigitOtp,
  saveDeskOtp,
  sendWhatsAppOtp,
} from "@/lib/deskOtpStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = body?.phone;

    if (!rawPhone || typeof rawPhone !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid phone number." },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhone(rawPhone);
    if (cleanPhone.length !== 10) {
      return NextResponse.json(
        { success: false, error: "Phone number must be exactly 10 digits." },
        { status: 400 }
      );
    }

    // Generate 4-digit code
    const otp = generate4DigitOtp();

    // Save in 10-minute expiry store
    saveDeskOtp(cleanPhone, otp, 10 * 60 * 1000);

    // Send WhatsApp notification
    const result = await sendWhatsAppOtp(cleanPhone, otp);

    if (!result.sent) {
      const statusCode = result.error === "MISSING_WHATSAPP_API_KEY" ? 400 : 502;
      return NextResponse.json(
        { 
          success: false, 
          error: result.message || "Failed to send WhatsApp OTP. Please check API keys.",
          details: result.error,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      phone: cleanPhone,
      sent: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error("[Desk Generate OTP Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate OTP." },
      { status: 500 }
    );
  }
}
