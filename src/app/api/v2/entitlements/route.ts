import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { resolveCapabilities } from "@/lib/v2/entitlements";

/**
 * Server-authoritative entitlement snapshot. The client renders from this;
 * it can never be used to grant access server-side (every protected action
 * re-resolves on the server).
 */
export async function GET() {
  const user = await getSessionUser();
  const { access, capabilities } = await resolveCapabilities(user?.id ?? null);
  return NextResponse.json({
    authenticated: access.authenticated,
    plan: access.plan,
    source: access.source,
    entitlementsLoaded: access.entitlementsLoaded,
    entitlements: access.entitlements,
    capabilities,
    storageLimitBytes: access.storageLimitBytes,
    dailyQuizLimit: access.dailyQuizLimit,
    dailySlideshowLimit: access.dailySlideshowLimit,
    subscriptionId: access.subscriptionId,
    subscriptionStatus: access.subscriptionStatus,
    subscriptionEndsAt: access.subscriptionEndsAt,
  });
}
