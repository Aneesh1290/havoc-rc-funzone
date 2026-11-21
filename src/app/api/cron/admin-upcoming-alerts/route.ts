import { NextRequest, NextResponse } from "next/server";
import { runUpcomingBookingAlertsCheck } from "@/lib/upcoming-alert-runner";

export const dynamic = "force-dynamic";

/**
 * Scheduled / Cron endpoint to check upcoming bookings and dispatch
 * 30-minute prior WhatsApp reminders to configured admin numbers.
 *
 * Can be pinged every 5 to 10 minutes by an external cron (e.g. cron-job.org,
 * Render cron, EasyCron) or by an internal background poller.
 */
export async function GET(req: NextRequest) {
  try {
    const result = await runUpcomingBookingAlertsCheck();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[Admin Upcoming Alerts Cron Error]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process upcoming alerts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
