import { NextRequest, NextResponse } from "next/server";
import { finishDrive } from "@/lib/connections/google-drive";
import { getSessionUser } from "@/lib/auth/session";
import { authBaseUrl } from "@/lib/auth/config";
export async function GET(request: NextRequest) {
  let result = "failed";
  try { const user = await getSessionUser(); const state = request.nextUrl.searchParams.get("state") ?? "", code = request.nextUrl.searchParams.get("code") ?? ""; if (user && !request.nextUrl.searchParams.has("error") && code.length <= 4096) { await finishDrive(user.id, state, code); result = "connected"; } } catch { /* Never return provider secrets or raw OAuth errors. */ }
  return NextResponse.redirect(`${authBaseUrl()}/settings?drive=${result}#plugins-connections`);
}
