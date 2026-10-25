import { NextRequest, NextResponse } from "next/server";
import { sendGoogleReviewWhatsApp } from "@/lib/whatsapp";
import { checkSessionAction } from "@/app/login/actions";

export async function POST(req: NextRequest) {
  try {
    const session = await checkSessionAction();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { phone, customerName, countryCode, reviewUrl } = body || {};

    if (!phone) {
      return NextResponse.json({ success: false, error: "Phone number is required." }, { status: 400 });
    }

    const result = await sendGoogleReviewWhatsApp({
      customerPhone: String(phone).trim(),
      customerName: customerName ? String(customerName).trim() : undefined,
      countryCode: countryCode ? String(countryCode).trim() : undefined,
      reviewUrl: reviewUrl ? String(reviewUrl).trim() : undefined,
    });

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, error: result.message || "Failed to send review message." }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[Send Review API Error]", err);
    return NextResponse.json({ success: false, error: err.message || "Internal server error" }, { status: 500 });
  }
}
