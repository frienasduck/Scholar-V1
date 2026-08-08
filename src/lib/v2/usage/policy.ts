/**
 * Pure generation-policy core — free of `server-only` imports so policy
 * math is unit-testable. DB-backed reservation logic lives in
 * `src/lib/v2/usage/ledger.ts`.
 */
import type { ResolvedEntitlements } from "@/lib/subscriptions/entitlements";

export type GenerationFeature =
  | "quiz"
  | "slideshow"
  | "aisig"
  | "homework_scan"
  | "ai_tutor"
  | "mind_map"
  | "concept_galaxy"
  | "lam_generation"
  | "other";

export const GENERATION_FEATURES: GenerationFeature[] = [
  "quiz", "slideshow", "aisig", "homework_scan", "ai_tutor",
  "mind_map", "concept_galaxy", "lam_generation", "other",
];

/** Existing UsageCounter keys these features map onto. */
export function usageKeyForFeature(feature: GenerationFeature): string {
  switch (feature) {
    case "quiz": return "quiz_generation";
    case "slideshow": return "slideshow_generation";
    default: return feature;
  }
}

export interface GenerationPolicy {
  feature: GenerationFeature;
  period: "hour" | "day" | "month";
  /** null = unlimited (documented single semantic). */
  freeLimit: number | null;
  plusLimit: number | null;
}

export const GENERATION_POLICIES: Record<GenerationFeature, GenerationPolicy> = {
  quiz: { feature: "quiz", period: "day", freeLimit: null, plusLimit: null }, // resolved from config
  slideshow: { feature: "slideshow", period: "day", freeLimit: null, plusLimit: null },
  aisig: { feature: "aisig", period: "day", freeLimit: null, plusLimit: null },
  homework_scan: { feature: "homework_scan", period: "day", freeLimit: null, plusLimit: null },
  ai_tutor: { feature: "ai_tutor", period: "day", freeLimit: null, plusLimit: null },
  mind_map: { feature: "mind_map", period: "day", freeLimit: null, plusLimit: null },
  concept_galaxy: { feature: "concept_galaxy", period: "day", freeLimit: null, plusLimit: null },
  lam_generation: { feature: "lam_generation", period: "day", freeLimit: null, plusLimit: null },
  other: { feature: "other", period: "day", freeLimit: null, plusLimit: null },
};

/** Resolve the effective daily limit for a feature under the given access.
 *  quiz/slideshow keep their V1 config limits; everything else defaults to
 *  unlimited until a concrete policy is set (documented behavior). */
export function dailyLimitForFeature(feature: GenerationFeature, access: ResolvedEntitlements): number {
  if (feature === "quiz") return access.dailyQuizLimit;
  if (feature === "slideshow") return access.dailySlideshowLimit;
  const policy = GENERATION_POLICIES[feature];
  return access.plan === "PLUS" || access.plan === "DEVELOPER" || access.plan === "UNLOCKED"
    ? policy.plusLimit ?? -1
    : policy.freeLimit ?? -1;
}
