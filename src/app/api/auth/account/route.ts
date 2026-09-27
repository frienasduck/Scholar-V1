import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { publicAuthConfig } from "@/lib/auth/config";
import { AuthFlowError, authFlowErrorResponse } from "@/lib/auth/flow-errors";
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthFlowError("SIGN_IN_REQUIRED", "Sign in to manage your account.", 401);
    const account = await db.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true, oauthAccounts: { select: { provider: true } } } });
    return NextResponse.json({ ...publicAuthConfig(), emailVerified: Boolean(account?.emailVerifiedAt), googleConnected: account?.oauthAccounts.some((item) => item.provider === "google") ?? false }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authFlowErrorResponse(error); }
}
