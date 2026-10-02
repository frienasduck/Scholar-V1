import type { ResolvedEntitlements } from "@/lib/subscriptions/entitlements";
export function aiVideoMonthlyLimit(access: ResolvedEntitlements) {
  if (!access.authenticated) return 0;
  return access.entitlementsLoaded &&
    ["PLUS", "DEVELOPER", "UNLOCKED"].includes(access.plan)
    ? Infinity
    : 10;
}
