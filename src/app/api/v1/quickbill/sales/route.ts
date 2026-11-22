import { NextRequest, NextResponse } from "next/server";
import { verifyQuickbillRequest, withRateLimitHeaders } from "@/lib/quickbill-auth";
import { 
  getQuickbillSyncState, 
  updateQuickbillSyncState, 
  resetQuickbillSyncCursor, 
  fetchQuickbillSalesOrders 
} from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/quickbill/sales
 * Batch pull sales transactions for Quickbill POS / ERP
 */
export async function GET(req: NextRequest) {
  // 1. Authenticate Request
  const auth = verifyQuickbillRequest(req);
  if (!auth.success) {
    return withRateLimitHeaders(
      NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode || 401 }),
      auth
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;

    // Optional Reset Cursor Flag
    const shouldResetCursor = searchParams.get("reset_cursor") === "true";
    if (shouldResetCursor) {
      resetQuickbillSyncCursor();
    }

    // Read current cursor state
    let syncState = getQuickbillSyncState();

    // Query parameters
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const sinceIdParam = searchParams.get("since_id");
    const sinceTime = searchParams.get("since_time") || undefined;
    const status = searchParams.get("status") || "Confirmed";
    const includeCancelled = searchParams.get("include_cancelled") === "true";
    const autoAdvance = searchParams.get("auto_advance") !== "false"; // Default true

    // Effective cursor
    const effectiveSinceId = sinceIdParam !== null && sinceIdParam !== undefined && !isNaN(Number(sinceIdParam))
      ? Number(sinceIdParam)
      : syncState.last_synced_id;

    // Fetch batch from DB
    const result = fetchQuickbillSalesOrders({
      limit,
      sinceId: effectiveSinceId,
      sinceTime,
      status,
      includeCancelled
    });

    let cursorAdvanced = false;
    // Auto-advance cursor if enabled and orders were returned
    if (autoAdvance && result.orders.length > 0 && result.lastOrderId !== null) {
      if (result.lastOrderId > syncState.last_synced_id) {
        syncState = updateQuickbillSyncState(result.lastOrderId, result.orders.length);
        cursorAdvanced = true;
      }
    }

    return withRateLimitHeaders(
      NextResponse.json({
        success: true,
        meta: {
          count: result.orders.length,
          limit,
          since_id: effectiveSinceId,
          last_order_id: result.lastOrderId,
          has_more: result.hasMore,
          cursor_advanced: cursorAdvanced,
          sync_state: {
            last_synced_id: syncState.last_synced_id,
            total_synced_count: syncState.total_synced_count,
            last_synced_at: syncState.last_synced_at
          }
        },
        orders: result.orders
      }),
      auth
    );
  } catch (err: any) {
    console.error("[Quickbill Sales Pull Error]", err);
    return withRateLimitHeaders(
      NextResponse.json(
        { success: false, error: err.message || "Failed to fetch sales orders." },
        { status: 500 }
      ),
      auth
    );
  }
}
