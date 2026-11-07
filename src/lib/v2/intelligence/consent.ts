/**
 * Scholar Intelligence consent.
 *
 * Consent is explicit and profile-scoped. Until the student chooses "Enable",
 * Scholar Intelligence must not derive evidence, compute mastery, build a
 * revision queue or sync anything to the server. A declined choice is stored
 * too, so Scholar never asks again unless the student opens the controls and
 * enables it deliberately.
 */

import { profileGetItem, profileRemoveItem, profileSetItem } from "@/lib/profile-storage";

export type IntelligenceConsent = "granted" | "declined";

export const INTELLIGENCE_CONSENT_KEY = "intelligence-consent";
export const INTELLIGENCE_CONSENT_EVENT = "scholar:intelligence-consent";

/**
 * Intelligence-only storage. Raw Scholar activity (quiz attempts, revision
 * history, notes, exams) is not touched when the intelligence profile is
 * cleared — only the derived analytical state belongs here.
 */
export const INTELLIGENCE_PROFILE_KEYS = [
  "intelligence-evidence-synced",
  "intelligence-resolved-mistakes",
  "intelligence-revision-schedules",
  "intelligence-revision-order",
  "intelligence-week-baseline",
  "intelligence-sync-state",
  "intelligence-review-events",
] as const;

export function loadIntelligenceConsent(scholarClass: 9 | 11): IntelligenceConsent | null {
  const value = profileGetItem(scholarClass, INTELLIGENCE_CONSENT_KEY);
  return value === "granted" || value === "declined" ? value : null;
}

export function isIntelligenceEnabled(scholarClass: 9 | 11): boolean {
  return loadIntelligenceConsent(scholarClass) === "granted";
}

function emitConsentChange(scholarClass: 9 | 11, consent: IntelligenceConsent | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(INTELLIGENCE_CONSENT_EVENT, { detail: { scholarClass, consent } }),
  );
}

export function setIntelligenceConsent(
  scholarClass: 9 | 11,
  consent: IntelligenceConsent | null,
): void {
  if (consent === null) profileRemoveItem(scholarClass, INTELLIGENCE_CONSENT_KEY);
  else profileSetItem(scholarClass, INTELLIGENCE_CONSENT_KEY, consent);
  emitConsentChange(scholarClass, consent);
}

export function grantIntelligenceConsent(scholarClass: 9 | 11): void {
  setIntelligenceConsent(scholarClass, "granted");
}

export function declineIntelligenceConsent(scholarClass: 9 | 11): void {
  setIntelligenceConsent(scholarClass, "declined");
}

/**
 * Remove the derived intelligence profile and forget the consent choice, so
 * the student is asked once again before any new analysis runs.
 */
export function clearIntelligenceProfile(scholarClass: 9 | 11): void {
  for (const key of INTELLIGENCE_PROFILE_KEYS) profileRemoveItem(scholarClass, key);
  profileRemoveItem(scholarClass, INTELLIGENCE_CONSENT_KEY);
  emitConsentChange(scholarClass, null);
}
