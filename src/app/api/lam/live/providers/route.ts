import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { liveTutorProviderStatus } from "@/lib/live-tutor/providers";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { getUserAISettings } from "@/lib/ai/user-provider";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  const [access, custom] = await Promise.all([resolveUserEntitlements(user.id), getUserAISettings(user.id)]);
  const providers = liveTutorProviderStatus().map((item) => {
    if (item.id === "auto") return item;
    if (custom?.scopes.includes("lam") && custom.provider === item.id) return { ...item, available: true, model: custom.model, models: [custom.model], note: "Your API key" };
    if (access.plan === "FREE" && item.id !== "groq") return { ...item, available: false, models: [], note: "Scholar Plus or your own API key" };
    if (access.plan === "FREE" && item.id === "groq") return { ...item, models: item.model ? [item.model] : [] };
    return item;
  });
  providers[0] = { ...providers[0], available: providers.slice(1).some((item) => item.available) };
  return NextResponse.json({ ok: true, providers }, { headers: { "Cache-Control": "private, no-store" } });
}
