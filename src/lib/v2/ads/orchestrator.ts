/**
 * AdOrchestrator (pure, unit-testable — no React, no timers).
 *
 * Decides WHERE ads appear and WHETHER one runs, with data-driven campaigns.
 * The countdown/UI state remains in the existing `nigtube-ad` machine; this
 * layer is the policy authority: placements, Plus bypass, skip policy,
 * frequency caps, cooldowns and mid-roll eligibility.
 *
 * V2 initially supports Scholar's own first-party Plus house ads. An
 * external VAST/IMA adapter plugs in behind `provider: "external"` only
 * after privacy/age/legal review — never because an SDK merely exists.
 */

export type AdPlacement =
  | "nigtube_preroll"
  | "nigtube_midroll"
  | "nigtube_postroll"
  | "study_music_preroll"
  | "plus_house_banner";

export const AD_PLACEMENTS: AdPlacement[] = [
  "nigtube_preroll", "nigtube_midroll", "nigtube_postroll",
  "study_music_preroll", "plus_house_banner",
];

export interface AdCampaignConfig {
  key: string;
  placement: AdPlacement;
  provider: "scholar_house" | "external";
  enabled: boolean;
  /** Seconds before skip unlocks (data-driven, never hardcoded in players). */
  skipAfterSeconds: number;
  /** Frequency cap: max impressions per user per campaign. */
  maxImpressionsPerUser: number;
  /** Min gap since this user's last impression of the campaign. */
  cooldownMinutes: number;
  /** Mid-roll only: do not insert into content shorter than this (seconds). */
  minVideoSeconds?: number;
  /** Mid-roll only: min seconds of content before an eligible cue. */
  minCueAfterSeconds?: number;
}

/** Data-driven house campaigns (V1 keeps a 10s / skip-after-countdown Plus ad). */
export const HOUSE_CAMPAIGNS: AdCampaignConfig[] = [
  {
    key: "scholar-plus-nigtube-preroll",
    placement: "nigtube_preroll",
    provider: "scholar_house",
    enabled: true,
    skipAfterSeconds: 10,
    maxImpressionsPerUser: 3,
    cooldownMinutes: 20,
  },
  {
    key: "scholar-plus-study-music",
    placement: "study_music_preroll",
    provider: "scholar_house",
    enabled: true,
    skipAfterSeconds: 10,
    maxImpressionsPerUser: 1,
    cooldownMinutes: 60,
  },
  {
    key: "scholar-plus-midroll",
    placement: "nigtube_midroll",
    provider: "scholar_house",
    enabled: true,
    skipAfterSeconds: 5,
    maxImpressionsPerUser: 2,
    cooldownMinutes: 15,
    minVideoSeconds: 240,
    minCueAfterSeconds: 90,
  },
];

export interface AdDecisionInput {
  placement: AdPlacement;
  /** Resolved ad-free entitlement (Plus or ad-free capability). */
  adFree: boolean;
  /** True only after entitlements finished resolving. */
  loaded: boolean;
  campaign?: AdCampaignConfig;
  /** This user's prior impressions of the campaign (for frequency caps). */
  impressions?: { startedAt: Date; completedAt?: Date | null }[];
  now?: Date;
  /** Playback context (mid-roll only). */
  videoDurationSeconds?: number;
  /** Time since playback resumed. */
  sinceResumeSeconds?: number;
  /** True when an exam / focus workflow is active (mid-roll suppression). */
  focusOrExamActive?: boolean;
}

export type AdDecision =
  | { action: "play"; reason: "ad_free" | "not_loaded" | "no_campaign" | "campaign_disabled" | "frequency_capped" | "cooldown" | "midroll_not_eligible" }
  | { action: "ad"; campaign: AdCampaignConfig; reason: "eligible" };

/** Decide whether an ad runs for a playback request. */
export function decideAd(input: AdDecisionInput): AdDecision {
  if (!input.loaded) return { action: "play", reason: "not_loaded" }; // never start content under a pending decision
  if (input.adFree) return { action: "play", reason: "ad_free" };

  const campaign = input.campaign ?? HOUSE_CAMPAIGNS.find((item) => item.placement === input.placement);
  if (!campaign) return { action: "play", reason: "no_campaign" };
  if (!campaign.enabled) return { action: "play", reason: "campaign_disabled" };

  if (frequencyCapExceeded(campaign, input.impressions ?? [])) return { action: "play", reason: "frequency_capped" };

  const now = input.now ?? new Date();
  const last = lastImpressionAt(input.impressions ?? []);
  if (last && campaign.cooldownMinutes > 0) {
    const elapsedMinutes = (now.getTime() - last.getTime()) / 60_000;
    if (elapsedMinutes < campaign.cooldownMinutes) return { action: "play", reason: "cooldown" };
  }

  if (input.placement === "nigtube_midroll") {
    const midroll = decideMidroll(input, campaign);
    if (!midroll.insert) return { action: "play", reason: "midroll_not_eligible" };
  }

  return { action: "ad", campaign, reason: "eligible" };
}

export interface MidrollDecision {
  insert: boolean;
  reason: "long_enough_and_cue_reached" | "too_short" | "no_cue_yet" | "recently_resumed" | "focus_active" | "capped";
}

/** Mid-roll eligibility: duration, cue point, resume, focus workflow, cap. */
export function decideMidroll(input: AdDecisionInput, campaign?: AdCampaignConfig): MidrollDecision {
  if (input.focusOrExamActive) return { insert: false, reason: "focus_active" };
  const cfg = campaign ?? HOUSE_CAMPAIGNS.find((item) => item.placement === "nigtube_midroll");
  const minVideo = cfg?.minVideoSeconds ?? 240;
  const minCue = cfg?.minCueAfterSeconds ?? 90;
  const duration = input.videoDurationSeconds ?? 0;
  if (duration < minVideo) return { insert: false, reason: "too_short" }; // never insert into short content
  if ((input.sinceResumeSeconds ?? Infinity) < 15) return { insert: false, reason: "recently_resumed" };
  if ((input.sinceResumeSeconds ?? 0) < minCue) return { insert: false, reason: "no_cue_yet" };
  if (cfg && frequencyCapExceeded(cfg, input.impressions ?? [])) return { insert: false, reason: "capped" };
  return { insert: true, reason: "long_enough_and_cue_reached" };
}

export interface AdImpressionRecord {
  startedAt: Date;
  completedAt?: Date | null;
  skippedAt?: Date | null;
}

/**
 * Frequency cap counts impressions the user actually SEEN — completed OR
 * skipped OR played through the skip window — so heavy skippers still get
 * capped instead of seeing an ad before every single video.
 */
export function frequencyCapExceeded(
  campaign: AdCampaignConfig,
  impressions: AdImpressionRecord[],
  now: Date = new Date(),
): boolean {
  if (campaign.maxImpressionsPerUser <= 0) return false; // 0/negative = uncapped
  const minSeenMs = campaign.skipAfterSeconds * 1000;
  const seen = impressions.filter(
    (item) => item.completedAt || item.skippedAt || now.getTime() - item.startedAt.getTime() >= minSeenMs,
  ).length;
  return seen >= campaign.maxImpressionsPerUser;
}

export function lastImpressionAt(impressions: { startedAt: Date }[]): Date | null {
  if (!impressions.length) return null;
  return impressions.reduce((latest, item) => (item.startedAt > latest ? item.startedAt : latest), impressions[0].startedAt);
}

/** Skip policy: skip unlocks after the campaign's countdown (data-driven). */
export function canSkipCampaign(campaign: AdCampaignConfig, elapsedSeconds: number): boolean {
  return elapsedSeconds >= campaign.skipAfterSeconds;
}

/**
 * Create an impression record input (persist via the AdImpression table
 * later). NOTE: the table's `campaignId` FK references AdCampaign.id (a cuid)
 * — when persisting, resolve the row by `campaignKey` first; never write the
 * key into the FK column.
 */
export function newImpression(campaign: AdCampaignConfig, userId: string | null, now = new Date()): AdImpressionRecord & { campaignKey: string; placement: AdPlacement; userId: string | null } {
  return { campaignKey: campaign.key, placement: campaign.placement, userId, startedAt: now, completedAt: null, skippedAt: null };
}
