import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { getUserAISettings, sealUserAISettings, USER_AI_COOKIE, userAISettingsSchema } from "@/lib/ai/user-provider";
import { assertAuthMutation } from "@/lib/auth/request-security";
import { readBoundedBytes, RequestBodyError } from "@/lib/security/request-body";

export const runtime = "nodejs";

const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: 60 * 60 * 24 * 90 };
const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const saved = await getUserAISettings(user.id);
  return NextResponse.json({ configured: Boolean(saved), provider: saved?.provider, model: saved?.model, scopes: saved?.scopes ?? [] }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try { assertAuthMutation(request); } catch { return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 }); }
  try { await enforceRateLimit(user.id, "user-ai-settings", 8, 60 * 60_000); }
  catch (error) { return NextResponse.json({ error: error instanceof RateLimitError ? "RATE_LIMITED" : "ACCESS_CHECK_FAILED" }, { status: error instanceof RateLimitError ? 429 : 503 }); }
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder().decode(await readBoundedBytes(request, 2048))); }
  catch (error) { return NextResponse.json({ error: error instanceof RequestBodyError && error.status === 413 ? "REQUEST_TOO_LARGE" : "INVALID_AI_SETTINGS" }, { status: error instanceof RequestBodyError ? error.status : 400 }); }
  const parsed = userAISettingsSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_AI_SETTINGS" }, { status: 400 });
  const sealed = sealUserAISettings({ ...parsed.data, userId: user.id });
  const response = NextResponse.json({ configured: true, provider: parsed.data.provider, model: parsed.data.model, scopes: parsed.data.scopes }, { headers: noStore });
  response.cookies.set(USER_AI_COOKIE, sealed, cookieOptions);
  return response;
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try { assertAuthMutation(request); } catch { return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 }); }
  const response = NextResponse.json({ configured: false }, { headers: noStore });
  response.cookies.set(USER_AI_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
