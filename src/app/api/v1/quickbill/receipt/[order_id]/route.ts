import { NextRequest, NextResponse } from "next/server";
import { verifyQuickbillRequest, withRateLimitHeaders } from "@/lib/quickbill-auth";
import { fetchQuickbillReceipt } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/quickbill/receipt/:order_id
 * Fetch formatted receipt for thermal printing & accounting
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ order_id: string }> }
) {
  const auth = verifyQuickbillRequest(req);
  if (!auth.success) {
    return withRateLimitHeaders(
      NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode || 401 }),
      auth
    );
  }

  try {
    const { order_id } = await context.params;
    if (!order_id) {
      return withRateLimitHeaders(
        NextResponse.json({ success: false, error: "Missing order_id parameter." }, { status: 400 }),
        auth
      );
    }

    const receipt = fetchQuickbillReceipt(order_id);
    if (!receipt) {
      return withRateLimitHeaders(
        NextResponse.json({ success: false, error: `Order #${order_id} not found.` }, { status: 404 }),
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
