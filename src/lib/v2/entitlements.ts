import "server-only";
import { getSessionUser } from "@/lib/auth/session";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import {
  ENTITLEMENT_KEYS,
  hasCapability,
  capabilitiesForAccess,
  type ScholarEntitlementKey,
} from "@/lib/v2/entitlements-core";

export { ENTITLEMENT_KEYS, hasCapability, type ScholarEntitlementKey } from "@/lib/v2/entitlements-core";

/**
 * Scholar V2 capability-oriented entitlement service.
 *
 * V1 already resolves plans server-side (FREE | PLUS | DEVELOPER | UNLOCKED)
 * with an 18-key entitlement list. This layer exposes the V2 capability model
 * from the blueprint as a typed view over that single authority — it does NOT
 * introduce a second Plus system. Client state is a rendering convenience
 * only; every protected server action re-checks via `requireCapability`.
 */

export async function resolveCapabilities(userId: string | null) {
  const access = await resolveUserEntitlements(userId);
  return { access, capabilities: capabilitiesForAccess(access) };
}

export const entitlementService = {
  /**
   * Central capability API, conceptually:
   *   const access = await entitlementService.resolve({ userId, entitlement: "premium_ai_limits" });
   */
  resolve: async (input: { userId: string | null; entitlement: ScholarEntitlementKey }) => {
    const access = await resolveUserEntitlements(input.userId);
    return { granted: hasCapability(access, input.entitlement), access };
  },
  has: hasCapability,
  capabilitiesFor: async (userId: string | null) => resolveCapabilities(userId),
};

/** Server-authoritative guard for protected actions (mirrors V1 requireEntitlement). */
export async function requireCapability(entitlement: ScholarEntitlementKey) {
  const user = await getSessionUser();
  const access = await resolveUserEntitlements(user?.id ?? null);
  if (!user) {
    return { ok: false as const, response: Response.json({ error: "AUTH_REQUIRED" }, { status: 401 }) };
  }
  if (!access.entitlementsLoaded) {
    return { ok: false as const, response: Response.json({ error: "ENTITLEMENTS_UNAVAILABLE", message: "Scholar could not verify your plan right now. Please try again." }, { status: 503 }) };
  }
  if (!hasCapability(access, entitlement)) {
    await import("@/lib/subscriptions/audit").then(({ recordAudit }) =>
      recordAudit("UNAUTHORIZED_V2_CAPABILITY_BLOCKED", { actorUserId: user.id, targetUserId: user.id, metadata: { capability: entitlement } }),
    );
    return { ok: false as const, response: Response.json({ error: "PLUS_REQUIRED", feature: entitlement }, { status: 403 }) };
  }
  return { ok: true as const, user, access };
}
