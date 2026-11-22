import { NextRequest, NextResponse } from "next/server";
import { verifyQuickbillRequest, withRateLimitHeaders } from "@/lib/quickbill-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/quickbill/ping
 * Health check & credential verification endpoint for Quickbill POS
 */
export async function GET(req: NextRequest) {
  const auth = verifyQuickbillRequest(req);
  if (!auth.success) {
    return withRateLimitHeaders(
      NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode || 401 }),
      auth
    );
  }

  return withRateLimitHeaders(
    NextResponse.json({
      success: true,
      status: "healthy",
      arena: "Havoc RC Fun Zone",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    }),
    auth
  );
}
