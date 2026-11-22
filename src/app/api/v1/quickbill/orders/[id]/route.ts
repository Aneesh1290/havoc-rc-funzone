import { NextRequest, NextResponse } from "next/server";
import { verifyQuickbillRequest, withRateLimitHeaders } from "@/lib/quickbill-auth";
import { fetchQuickbillReceipt } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/quickbill/orders/:id
 * Alias to receipt/order detail endpoint
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = verifyQuickbillRequest(req);
  if (!auth.success) {
    return withRateLimitHeaders(
      NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode || 401 }),
      auth
    );
  }

  try {
    const { id } = await context.params;
    if (!id) {
      return withRateLimitHeaders(
        NextResponse.json({ success: false, error: "Missing order id parameter." }, { status: 400 }),
        auth
      );
    }

    const receipt = fetchQuickbillReceipt(id);
    if (!receipt) {
      return withRateLimitHeaders(
        NextResponse.json({ success: false, error: `Order #${id} not found.` }, { status: 404 }),
        auth
      );
    }

    return withRateLimitHeaders(
      NextResponse.json({
        success: true,
        order: receipt
      }),
      auth
    );
  } catch (err: any) {
    console.error("[Quickbill Orders ID Error]", err);
    return withRateLimitHeaders(
      NextResponse.json(
        { success: false, error: err.message || "Failed to fetch order." },
        { status: 500 }
      ),
      auth
    );
  }
}
