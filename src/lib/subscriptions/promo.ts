"use client";

// ============================================================================
// Centralized Scholar Plus routing + promotion helpers
// Every "Upgrade to Scholar Plus" surface routes through openScholarPlus so
// analytics and later improvements stay in one place. No hardcoded routes.
// ============================================================================

export type PlusPromoSource =
  | "nigtube-ad"
  | "study-music-ad"
  | "ai-tutor"
  | "achievements"
  | "mind-map"
  | "concept-galaxy"
  | "generation-limit"
  | "nav";

export interface OpenPlusOptions {
  source: PlusPromoSource;
  /** Optional feature hint carried in the navigation payload. */
  feature?: string;
}

/**
 * Navigate the student to the Scholar Plus section. Purely client-side — it
 * never grants entitlements by itself; server-side checks stay authoritative.
 */
export function openScholarPlus({ source, feature }: OpenPlusOptions): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("neha-scholar:navigate", {
      detail: { viewId: "plus", payload: { source, feature } },
    }),
  );
  try {
    window.dispatchEvent(
      new CustomEvent("scholar:plus-cta", {
        detail: { source, feature, at: Date.now() },
      }),
    );
  } catch {
    // Analytics hook is best-effort and must never break navigation.
  }
}

// ============================================================================
// Pure eligibility helpers (unit-testable, shared by ads & promotions)
// ============================================================================

export type PlusTier = "free" | "plus" | "developer" | "unlocked";

export interface PlusEligibility {
  /** entitlements resolved yet? (avoids flashing an ad before session loads) */
  loaded: boolean;
  tier: PlusTier;
  /** True when the user should bypass ads/promos. */
  adFree: boolean;
}

export function resolvePlusEligibility(input: {
  loaded: boolean;
  entitlements: string[];
  plan?: string;
}): PlusEligibility {
  const tier: PlusTier =
    input.plan === "DEVELOPER"
      ? "developer"
      : input.plan === "UNLOCKED"
        ? "unlocked"
        : input.plan === "PLUS"
          ? "plus"
          : "free";
  const adFree =
    tier === "plus" ||
    tier === "developer" ||
    tier === "unlocked" ||
    (input.loaded && input.entitlements.includes("nigtube_ad_free"));
  return { loaded: input.loaded, tier, adFree };
}

/**
 * Decide whether the Study Music spoken promotion must run for a track.
 * Free users hear it once per session (not on every track change).
 */
export function shouldRunMusicPromo(input: {
  adFree: boolean;
  loaded: boolean;
  alreadyShown: boolean;
}): boolean {
  if (!input.loaded || input.adFree) return false;
  return !input.alreadyShown;
}

/** Approximate spoken promotion window, in milliseconds. */
export const MUSIC_PROMO_WINDOW_MS = 10_000;

export const MUSIC_PROMO_MESSAGE =
  "Enjoying Scholar Study Music? Upgrade to Scholar Plus for an ad-free experience, higher AI limits, and even more powerful study tools.";

/**
 * Decide whether the AI Tutor shows its compact Scholar Plus card. Rendered
 * by the UI layer (never injected into the model prompt), shown only with the
 * FIRST assistant answer of a conversation, and only for free users.
 */
export function shouldShowTutorPlusCard(input: {
  /** Entitlements resolved yet? Keeps the card from flashing before the session loads. */
  loaded: boolean;
  /** True only for an actual paid (or developer) plan, never a Free plan. */
  isPlus: boolean;
  /** True when this message is the first assistant reply in the conversation. */
  isFirstAssistantMessage: boolean;
  /** True once the one-time card has already been shown for this thread. */
  alreadyShownForThread: boolean;
}): boolean {
  if (!input.loaded || input.isPlus) return false;
  return input.isFirstAssistantMessage && !input.alreadyShownForThread;
}
