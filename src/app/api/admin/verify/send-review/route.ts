import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Google Review link sending is permanently disabled." },
    { status: 410 }
  );
}
