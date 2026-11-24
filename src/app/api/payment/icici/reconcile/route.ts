import { NextRequest, NextResponse } from "next/server";
import { reconcilePendingHold } from "@/lib/order-reconciliation";
import { db } from "@/lib/db";

// POST /api/payment/icici/reconcile
// Can be called:
// 1. By frontend poll (if customer is waiting or returns to checkout)
// 2. By background cron or staff dashboard to automatically check in-flight holds
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const txnId = body.txn_id || body.merchantTxnNo || req.nextUrl.searchParams.get("txn_id");

    if (txnId) {
      const result = await reconcilePendingHold(String(txnId).trim());
      return NextResponse.json(result);
    }

    // If no specific txnId provided, scan all recent in-flight holds (created within last 30 mins)
    const recentHolds = db.prepare(`
      SELECT txn_id, customer_name, amount, created_at 
      FROM online_checkout_holds 
      ORDER BY id DESC 
      LIMIT 10
    `).all() as any[];

    const results = [];
    for (const hold of recentHolds) {
      try {
        const res = await reconcilePendingHold(hold.txn_id);
        results.push({
          txn_id: hold.txn_id,
          reconciled: res.success,
          orderId: res.orderId,
          alreadyProcessed: res.alreadyProcessed
        });
      } catch (err: any) {
        results.push({
          txn_id: hold.txn_id,
          error: err.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      scanned: recentHolds.length,
      results
    });
  } catch (error: any) {
    console.error("[ICICI Reconcile API Error]", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to reconcile transactions"
    }, { status: 500 });
  }
}

// GET /api/payment/icici/reconcile?txn_id=TXN_RC_...
export async function GET(req: NextRequest) {
  const txnId = req.nextUrl.searchParams.get("txn_id");
  if (!txnId) {
    return NextResponse.json({ error: "Missing txn_id parameter" }, { status: 400 });
  }

  const result = await reconcilePendingHold(txnId.trim());
  return NextResponse.json(result);
}
