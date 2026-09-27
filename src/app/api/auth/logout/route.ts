import { NextResponse } from "next/server";
import { clearAuthSession } from "@/lib/auth/session";
import { assertAuthMutation } from "@/lib/auth/request-security";
import { authFlowErrorResponse } from "@/lib/auth/flow-errors";

export async function POST(request: Request) {
  try {
    assertAuthMutation(request);
    await clearAuthSession();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authFlowErrorResponse(error); }
}
