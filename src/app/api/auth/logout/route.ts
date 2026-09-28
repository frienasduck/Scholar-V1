import { NextResponse } from "next/server";
import { clearAuthSession } from "@/lib/auth/session";
import { assertAuthMutation } from "@/lib/auth/request-security";
import { authFlowErrorResponse } from "@/lib/auth/flow-errors";
import { cookies } from "next/headers";
import { USER_AI_COOKIE } from "@/lib/ai/user-provider";

export async function POST(request: Request) {
  try {
    assertAuthMutation(request);
    await clearAuthSession();
    (await cookies()).delete(USER_AI_COOKIE);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authFlowErrorResponse(error); }
}
