import { NextResponse } from "next/server";
import { checkSessionAction } from "@/app/login/actions";

export async function GET() {
  try {
    const session = await checkSessionAction();
    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({
      user: {
        userId: session.userId,
        username: session.username,
        role: session.role,
        permissions: session.permissions,
        mustChangePassword: session.mustChangePassword
      }
    });
  } catch (err: any) {
    return NextResponse.json({ user: null, error: err.message }, { status: 500 });
  }
}
