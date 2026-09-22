import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { liveTutorProviderStatus } from "@/lib/live-tutor/providers";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  return NextResponse.json({ ok: true, providers: liveTutorProviderStatus() });
}
