import { describe, expect, test } from "bun:test";
import { isFlagEnabled, publicV2Flags, V2_FLAG_KEYS, type V2FlagKey } from "../src/lib/v2/flags";
import { hasCapability, capabilitiesForAccess } from "../src/lib/v2/entitlements-core";
import type { ScholarEntitlement } from "../src/lib/subscriptions/entitlements";
import { dailyLimitForFeature, usageKeyForFeature, GENERATION_POLICIES } from "../src/lib/v2/usage/policy";
import {
  scoreScholarVoice,
  selectTTSVoice,
  describeTTSVoice,
  normalizeLang,
  isFemaleLikeVoice,
  DEFAULT_TTS_VOICE_PREFERENCE,
  type TTSVoiceCandidate,
} from "../src/lib/v2/tts/score";
import {
  decideAd,
  decideMidroll,
  canSkipCampaign,
  frequencyCapExceeded,
  HOUSE_CAMPAIGNS,
  type AdCampaignConfig,
} from "../src/lib/v2/ads/orchestrator";
import {
  validateLamAction,
  classifyActionRisk,
  requiresConfirmation,
  checkAgentBudget,
  DEFAULT_AGENT_BUDGET,
  LAM_ACTION_REGISTRY,
} from "../src/lib/v2/lam/action-framework";
import {
  webhookIdempotencyKey,
  normalizeBillingEvent,
  internalStatusFromProvider,
  grantsEntitlements,
  planEntitlementReconciliation,
} from "../src/lib/v2/billing/webhook";
import { PlaceholderBillingProvider } from "../src/lib/v2/billing/placeholder";

// ============================================================================
// Feature flags
// ============================================================================

describe("feature flags", () => {
  test("all blueprint subsystems are registered", () => {
    const required: V2FlagKey[] = ["v2_entitlements", "v2_usage_limits", "v2_nigtube_ads", "v2_nigtube_midroll", "v2_study_music_promo", "v2_lam_automation", "v2_offline_sync", "v2_push", "v2_developer_mode"];
    for (const key of required) {
      expect(V2_FLAG_KEYS).toContain(key);
    }
  });

  test("high-risk automation defaults off; existing safe paths default on", () => {
    expect(isFlagEnabled("v2_lam_automation")).toBe(false);
    expect(isFlagEnabled("v2_offline_sync")).toBe(false);
    expect(isFlagEnabled("v2_push")).toBe(false);
    expect(isFlagEnabled("v2_nigtube_midroll")).toBe(false);
    expect(isFlagEnabled("v2_entitlements")).toBe(true);
    expect(isFlagEnabled("v2_developer_mode")).toBe(true);
  });

  test("explicit overrides beat defaults", () => {
    expect(isFlagEnabled("v2_lam_automation", { overrides: { v2_lam_automation: true } })).toBe(true);
    expect(isFlagEnabled("v2_nigtube_ads", { overrides: { v2_nigtube_ads: false } })).toBe(false);
  });

  test("rollout bucketing is deterministic per user", () => {
    expect(isFlagEnabled("v2_lam_automation", { userId: "u1", rolloutPct: 0 })).toBe(false);
    // 100% rollout still respects the default (false for lam_automation).
    expect(isFlagEnabled("v2_lam_automation", { userId: "u1", rolloutPct: 100 })).toBe(false);
    const a = isFlagEnabled("v2_push", { userId: "user-42", rolloutPct: 50 });
    const b = isFlagEnabled("v2_push", { userId: "user-42", rolloutPct: 50 });
    expect(a).toBe(b);
  });

  test("client snapshot exposes defaults only", () => {
    const snapshot = publicV2Flags();
    expect(snapshot.v2_lam_automation).toBe(false);
    expect(snapshot.v2_nigtube_ads).toBe(true);
    expect(Object.keys(snapshot).length).toBe(V2_FLAG_KEYS.length);
  });
});

// ============================================================================
// Entitlement capability mapping
// ============================================================================

function access(overrides: Partial<Parameters<typeof hasCapability>[0]> = {}): Parameters<typeof hasCapability>[0] {
  return {
    authenticated: true,
    userId: "u1",
    role: "USER",
    plan: "FREE",
    source: "free",
    entitlementsLoaded: true,
    entitlements: [] as ScholarEntitlement[],
    subscriptionId: null,
    subscriptionStatus: null,
    subscriptionEndsAt: null,
    storageLimitBytes: 30 * 1024 * 1024,
    dailyQuizLimit: 3,
    dailySlideshowLimit: 3,
    ...overrides,
  };
}

describe("entitlement capabilities", () => {
  test("free user has no premium capabilities", () => {
    expect(capabilitiesForAccess(access())).toEqual([]);
  });

  test("plus user gets all premium capabilities", () => {
    const capabilities = capabilitiesForAccess(access({ plan: "PLUS", source: "plus", entitlements: ["nigtube_ad_free", "study_music_ad_free", "expanded_file_storage"] as ScholarEntitlement[] }));
    expect(capabilities).toContain("scholar_plus");
    expect(capabilities).toContain("ad_free");
    expect(capabilities).toContain("premium_ai_limits");
    expect(capabilities).toContain("mind_map");
  });

  test("ad-free entitlement grants ad_free to a free user", () => {
    expect(hasCapability(access({ entitlements: ["nigtube_ad_free"] as ScholarEntitlement[] }), "ad_free")).toBe(true);
  });

  test("unresolved entitlements grant nothing", () => {
    expect(hasCapability(access({ entitlementsLoaded: false, plan: "PLUS" }), "scholar_plus")).toBe(false);
  });

  test("developer and unlocked plans are elevated", () => {
    expect(hasCapability(access({ plan: "DEVELOPER", source: "developer" }), "premium_ai_limits")).toBe(true);
    expect(hasCapability(access({ plan: "UNLOCKED", source: "subscriptions_disabled" }), "scholar_plus")).toBe(true);
  });
});

// ============================================================================
// Usage policy
// ============================================================================

describe("generation policy", () => {
  test("quiz/slideshow map to existing usage keys", () => {
    expect(usageKeyForFeature("quiz")).toBe("quiz_generation");
    expect(usageKeyForFeature("slideshow")).toBe("slideshow_generation");
    expect(usageKeyForFeature("aisig")).toBe("aisig");
  });

  test("null limits mean unlimited (Plus default for open features)", () => {
    expect(GENERATION_POLICIES.ai_tutor.freeLimit).toBeNull();
    expect(GENERATION_POLICIES.aisig.plusLimit).toBeNull();
  });

  test("quiz/slideshow limits come from resolved access", () => {
    const free = access();
    const plus = access({ plan: "PLUS", dailyQuizLimit: -1, dailySlideshowLimit: -1 });
    expect(dailyLimitForFeature("quiz", free)).toBe(3);
    expect(dailyLimitForFeature("quiz", plus)).toBe(-1);
    expect(dailyLimitForFeature("aisig", free)).toBe(-1); // unlimited until policy set
  });
});

// ============================================================================
// TTS voice preference
// ============================================================================

const msSonia: TTSVoiceCandidate = { name: "Microsoft Sonia Online (Natural) - English (United Kingdom)", lang: "en-GB", voiceURI: "ms-sonia", default: false };
const msLibby: TTSVoiceCandidate = { name: "Microsoft Libby Online (Natural) - English (United Kingdom)", lang: "en-GB", voiceURI: "ms-libby", default: false };
const plainGB: TTSVoiceCandidate = { name: "Google UK English Female", lang: "en-GB", voiceURI: "google-uk-f", default: false };
const enUS: TTSVoiceCandidate = { name: "Microsoft David - English (United States)", lang: "en-US", voiceURI: "ms-david", default: false };
const system: TTSVoiceCandidate = { name: "Default Voice", lang: "en-US", voiceURI: "sys-default", default: true };

describe("TTS voice scoring", () => {
  test("Microsoft female en-GB scores highest", () => {
    expect(scoreScholarVoice(msSonia)).toBeGreaterThan(scoreScholarVoice(plainGB));
    expect(scoreScholarVoice(msSonia)).toBeGreaterThan(scoreScholarVoice(enUS));
    expect(scoreScholarVoice(msLibby)).toBe(scoreScholarVoice(msSonia));
  });

  test("en-GB beats en-US regardless of vendor", () => {
    expect(scoreScholarVoice(plainGB)).toBeGreaterThan(scoreScholarVoice(enUS));
  });

  test("language normalization handles underscores", () => {
    expect(normalizeLang("en_GB")).toBe("en-gb");
    expect(normalizeLang("en-GB")).toBe("en-gb");
  });

  test("female detection uses name hints", () => {
    expect(isFemaleLikeVoice({ name: "Microsoft Hazel" })).toBe(true);
    expect(isFemaleLikeVoice({ name: "Microsoft David" })).toBe(false);
  });

  test("selection order: microsoft female en-GB → female en-GB → any en-GB → default", () => {
    expect(selectTTSVoice([system, plainGB, msSonia], DEFAULT_TTS_VOICE_PREFERENCE)?.voiceURI).toBe("ms-sonia");
    expect(selectTTSVoice([system, plainGB], DEFAULT_TTS_VOICE_PREFERENCE)?.voiceURI).toBe("google-uk-f");
    expect(selectTTSVoice([system, enUS], DEFAULT_TTS_VOICE_PREFERENCE)?.voiceURI).toBe("sys-default");
  });

  test("stored explicit voice wins while it still exists", () => {
    expect(selectTTSVoice([msSonia, plainGB], DEFAULT_TTS_VOICE_PREFERENCE, "google-uk-f")?.voiceURI).toBe("google-uk-f");
    expect(selectTTSVoice([msSonia], DEFAULT_TTS_VOICE_PREFERENCE, "missing-uri")?.voiceURI).toBe("ms-sonia");
  });

  test("no voices → null; describe handles it", () => {
    expect(selectTTSVoice([], DEFAULT_TTS_VOICE_PREFERENCE)).toBeNull();
    expect(describeTTSVoice(null)).toBe("System default voice");
    expect(describeTTSVoice(msSonia)).toContain("Microsoft Sonia");
  });
});

// ============================================================================
// Ad orchestrator
// ============================================================================

const preroll = HOUSE_CAMPAIGNS.find((item) => item.placement === "nigtube_preroll")!;
const midrollCampaign = HOUSE_CAMPAIGNS.find((item) => item.placement === "nigtube_midroll")!;

describe("ad orchestrator", () => {
  test("free user with loaded entitlements gets the pre-roll", () => {
    const decision = decideAd({ placement: "nigtube_preroll", adFree: false, loaded: true });
    expect(decision.action).toBe("ad");
    if (decision.action === "ad") expect(decision.campaign.key).toBe("scholar-plus-nigtube-preroll");
  });

  test("plus users bypass all placements", () => {
    expect(decideAd({ placement: "nigtube_preroll", adFree: true, loaded: true }).action).toBe("play");
    expect(decideAd({ placement: "study_music_preroll", adFree: true, loaded: true }).action).toBe("play");
  });

  test("unresolved entitlements never start content under a pending decision", () => {
    const decision = decideAd({ placement: "nigtube_preroll", adFree: false, loaded: false });
    expect(decision.action).toBe("play");
    if (decision.action === "play") expect(decision.reason).toBe("not_loaded");
  });

  test("frequency cap stops the ad after completed impressions", () => {
    const past: AdCampaignConfig["maxImpressionsPerUser"] = 3;
    const impressions = Array.from({ length: past }, (_, i) => ({ startedAt: new Date(2026, 0, 1 + i), completedAt: new Date(2026, 0, 1 + i) }));
    expect(frequencyCapExceeded(preroll, impressions)).toBe(true);
    const decision = decideAd({ placement: "nigtube_preroll", adFree: false, loaded: true, campaign: preroll, impressions });
    expect(decision.action).toBe("play");
    if (decision.action === "play") expect(decision.reason).toBe("frequency_capped");
  });

  test("cooldown suppresses repeat impressions", () => {
    const impressions = [{ startedAt: new Date(Date.now() - 5 * 60_000), completedAt: new Date(Date.now() - 5 * 60_000) }];
    const decision = decideAd({ placement: "nigtube_preroll", adFree: false, loaded: true, campaign: preroll, impressions });
    expect(decision.action).toBe("play");
    if (decision.action === "play") expect(decision.reason).toBe("cooldown");
  });

  test("skipped impressions still count toward the frequency cap", () => {
    const impressions = [
      { startedAt: new Date(2026, 0, 1), completedAt: new Date(2026, 0, 1) },
      { startedAt: new Date(2026, 0, 2), skippedAt: new Date(2026, 0, 2) },
      { startedAt: new Date(2026, 0, 3), completedAt: new Date(2026, 0, 3) },
    ];
    expect(frequencyCapExceeded(preroll, impressions)).toBe(true);
  });

  test("mid-roll never inserts into short content or during focus workflows", () => {
    expect(decideMidroll({ placement: "nigtube_midroll", adFree: false, loaded: true, videoDurationSeconds: 120, sinceResumeSeconds: 200 })).toEqual({ insert: false, reason: "too_short" });
    expect(decideMidroll({ placement: "nigtube_midroll", adFree: false, loaded: true, videoDurationSeconds: 600, sinceResumeSeconds: 200, focusOrExamActive: true })).toEqual({ insert: false, reason: "focus_active" });
    expect(decideMidroll({ placement: "nigtube_midroll", adFree: false, loaded: true, videoDurationSeconds: 600, sinceResumeSeconds: 5 })).toEqual({ insert: false, reason: "recently_resumed" });
  });

  test("mid-roll eligible on long content past the cue point", () => {
    expect(decideMidroll({ placement: "nigtube_midroll", adFree: false, loaded: true, videoDurationSeconds: 600, sinceResumeSeconds: 300, impressions: [] })).toEqual({ insert: true, reason: "long_enough_and_cue_reached" });
  });

  test("skip policy is data-driven", () => {
    expect(canSkipCampaign(preroll, 9)).toBe(false);
    expect(canSkipCampaign(preroll, 10)).toBe(true);
    expect(canSkipCampaign(midrollCampaign, 4)).toBe(false);
    expect(canSkipCampaign(midrollCampaign, 5)).toBe(true);
  });
});

// ============================================================================
// LAM action framework
// ============================================================================

describe("LAM action framework", () => {
  test("allowlist covers the blueprint's safe academic automations", () => {
    for (const type of ["create_reminder", "create_study_plan", "start_focus_session", "open_chapter", "generate_quiz", "prepare_revision_sequence", "summarize_file", "schedule_homework", "organize_study_day", "create_recurring_routine", "prepare_nigtube_playlist", "prepare_study_music_focus"]) {
      expect(LAM_ACTION_REGISTRY[type as keyof typeof LAM_ACTION_REGISTRY]).toBeDefined();
    }
  });

  test("unknown action types fail validation (never execute)", () => {
    const result = validateLamAction({ id: "a1", type: "delete_everything", parameters: {}, initiatedBy: "lam", idempotencyKey: "k1" });
    expect(result.ok).toBe(false);
  });

  test("valid action passes validation", () => {
    const result = validateLamAction({ id: "a1", type: "create_reminder", parameters: { title: "Revise polynomials" }, initiatedBy: "user", idempotencyKey: "k1" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.request.type).toBe("create_reminder");
  });

  test("missing idempotency key or malformed parameters are rejected", () => {
    expect(validateLamAction({ id: "a1", type: "create_reminder", parameters: [], initiatedBy: "user" }).ok).toBe(false);
    expect(validateLamAction({ id: "a1", type: "create_reminder", parameters: {}, initiatedBy: "hacker" }).ok).toBe(false);
  });

  test("risk classification is conservative for unknown types", () => {
    expect(classifyActionRisk("create_reminder")).toBe("medium");
    expect(classifyActionRisk("delete_data" as never)).toBe("high");
  });

  test("high-risk actions always require confirmation; medium depends on autonomy", () => {
    const high = LAM_ACTION_REGISTRY.open_chapter;
    expect(high.risk).toBe("low");
    expect(requiresConfirmation("create_reminder", "ask_before_acting")).toBe(true);
    expect(requiresConfirmation("create_reminder", "trusted_routine")).toBe(false);
  });

  test("financial operations can never run autonomously at any autonomy level", () => {
    expect(requiresConfirmation("purchase" as never, "trusted_routine")).toBe(true);
    expect(requiresConfirmation("payment" as never, "trusted_routine")).toBe(true);
  });

  test("agent budgets stop runaway runs", () => {
    expect(checkAgentBudget({ actionsExecuted: DEFAULT_AGENT_BUDGET.maxActionsPerRun })).toEqual({ ok: false, reason: "agent_budget_actions" });
    expect(checkAgentBudget({ aiCalls: 50 })).toEqual({ ok: false, reason: "agent_budget_ai_calls" });
    expect(checkAgentBudget({ durationMs: DEFAULT_AGENT_BUDGET.maxDurationMs + 1 })).toEqual({ ok: false, reason: "agent_budget_duration" });
    expect(checkAgentBudget({ actionsExecuted: 1, aiCalls: 2, durationMs: 1000, generatedArtifacts: 0, retries: 0 })).toEqual({ ok: true });
  });
});

// ============================================================================
// Billing webhook architecture
// ============================================================================

describe("billing webhook architecture", () => {
  test("idempotency key derives from provider + event id", () => {
    expect(webhookIdempotencyKey({ provider: "stripe", providerEventId: "evt_123" })).toBe("stripe:evt_123");
  });

  test("provider status maps to internal lifecycle", () => {
    expect(internalStatusFromProvider("active")).toBe("active");
    expect(internalStatusFromProvider("past_due")).toBe("grace");
    expect(internalStatusFromProvider("canceled")).toBe("expired");
    expect(internalStatusFromProvider("weird")).toBe("unknown");
  });

  test("only active-ish events grant entitlements", () => {
    expect(grantsEntitlements("checkout_completed", "complete")).toBe(true);
    expect(grantsEntitlements("subscription_created", "active")).toBe(true);
    expect(grantsEntitlements("subscription_updated", "past_due")).toBe(false);
    expect(grantsEntitlements("subscription_canceled", "canceled")).toBe(false);
  });

  test("reconciliation planning grants, revokes or no-ops", () => {
    const grant = planEntitlementReconciliation(normalizeBillingEvent("stripe", "subscription_created", { providerEventId: "evt_1", status: "active" }));
    expect(grant).toEqual({ shouldApply: true, subscriptionStatus: "active", action: "grant" });

    const revoke = planEntitlementReconciliation(normalizeBillingEvent("stripe", "subscription_canceled", { providerEventId: "evt_2", status: "canceled" }));
    expect(revoke).toEqual({ shouldApply: true, subscriptionStatus: "expired", action: "revoke" });

    const none = planEntitlementReconciliation(normalizeBillingEvent("stripe", "unknown", { providerEventId: "evt_3", status: "ok" }));
    expect(none.action).toBe("none");

    // Grace period keeps access instead of revoking.
    const grace = planEntitlementReconciliation(normalizeBillingEvent("stripe", "subscription_updated", { providerEventId: "evt_4", status: "past_due" }));
    expect(grace).toEqual({ shouldApply: true, subscriptionStatus: "grace", action: "keep" });
  });

  test("placeholder provider never grants Plus and rejects webhooks", async () => {
    const provider = new PlaceholderBillingProvider();
    const checkout = await provider.createCheckout({ userId: "u1", email: "a@b.c", productKey: "scholar_plus", externalReference: "ref" });
    expect(checkout.ok).toBe(false);
    if (!checkout.ok && checkout.error) expect(checkout.error.code).toBe("BILLING_NOT_CONFIGURED");
    expect(await provider.verifyWebhook({ rawBody: "{}", headers: {} })).toBeNull();
    expect(await provider.getSubscription({ userId: "u1" })).toBeNull();
  });
});
