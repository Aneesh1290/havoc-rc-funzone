import { NextRequest, NextResponse } from "next/server";
import { verifyQuickbillRequest, withRateLimitHeaders } from "@/lib/quickbill-auth";
import { fetchQuickbillReceipt } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/quickbill/receipt?order_id=...
 * Query-parameter fallback for fetching receipt
 */
export async function GET(req: NextRequest) {
  const auth = verifyQuickbillRequest(req);
  if (!auth.success) {
    return withRateLimitHeaders(
      NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode || 401 }),
      auth
    );
  }

  try {
    const orderId = req.nextUrl.searchParams.get("order_id") || req.nextUrl.searchParams.get("id");
    if (!orderId) {
      return withRateLimitHeaders(
        NextResponse.json({ success: false, error: "Missing order_id query parameter." }, { status: 400 }),
        auth
      );
    }

    const receipt = fetchQuickbillReceipt(orderId);
    if (!receipt) {
      return withRateLimitHeaders(
        NextResponse.json({ success: false, error: `Order #${orderId} not found.` }, { status: 404 }),
        auth
      );
    }

    return withRateLimitHeaders(
      NextResponse.json({
        success: true,
        receipt
      }),
      auth
    );
  } catch (err: any) {
    console.error("[Quickbill Receipt Error]", err);
    return withRateLimitHeaders(
      NextResponse.json(
        { success: false, error: err.message || "Failed to fetch receipt." },
        { status: 500 }
      ),
      auth
    );
  }
}
