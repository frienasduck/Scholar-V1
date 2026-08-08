/**
 * Pure capability mapping core — intentionally free of `server-only` imports
 * so the mapping is unit-testable. Server wrappers live in
 * `src/lib/v2/entitlements.ts`.
 */
import type { ResolvedEntitlements, ScholarEntitlement } from "@/lib/subscriptions/entitlements";

export const ENTITLEMENT_KEYS = [
  "scholar_plus",
  "ad_free",
  "premium_ai_limits",
  "advanced_lam",
  "advanced_reminders",
  "premium_nigtube",
  "premium_study_music",
  "mind_map",
  "concept_galaxy",
  "achievements",
  "premium_storage",
] as const;

export type ScholarEntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

function hasV1Entitlement(access: ResolvedEntitlements, entitlement: ScholarEntitlement): boolean {
  return access.entitlements.includes(entitlement);
}

function planElevated(access: ResolvedEntitlements): boolean {
  return access.plan === "PLUS" || access.plan === "DEVELOPER" || access.plan === "UNLOCKED";
}

/** Capability → concrete check. Reserved capabilities resolve from the plan
 *  so the entitlement model is ready before the features ship. */
export function hasCapability(access: ResolvedEntitlements, key: ScholarEntitlementKey): boolean {
  if (!access.entitlementsLoaded) return false;
  switch (key) {
    case "scholar_plus":
      return planElevated(access);
    case "ad_free":
      return planElevated(access)
        || hasV1Entitlement(access, "nigtube_ad_free")
        || hasV1Entitlement(access, "study_music_ad_free");
    case "premium_ai_limits":
      return planElevated(access);
    case "advanced_lam":
      return planElevated(access); // reserved — automation is flag-gated separately
    case "advanced_reminders":
      return planElevated(access); // reserved
    case "premium_nigtube":
      return planElevated(access) || hasV1Entitlement(access, "nigtube_ad_free");
    case "premium_study_music":
      return planElevated(access) || hasV1Entitlement(access, "study_music_ad_free");
    case "mind_map":
    case "concept_galaxy":
    case "achievements":
      return planElevated(access); // reserved — cards only, no feature yet
    case "premium_storage":
      return planElevated(access) || hasV1Entitlement(access, "expanded_file_storage");
    default:
      return false;
  }
}

export function capabilitiesForAccess(access: ResolvedEntitlements): ScholarEntitlementKey[] {
  return ENTITLEMENT_KEYS.filter((key) => hasCapability(access, key));
}
