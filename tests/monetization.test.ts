import { describe, expect, test } from "bun:test";
import {
  beginPlayback,
  idleAdMachine,
  skipAd,
  tickAd,
  canSkip,
  isPlaying,
  NIGTUBE_AD_SECONDS,
  type NigtubeAdMachine,
} from "../src/lib/subscriptions/nigtube-ad";
import {
  resolvePlusEligibility,
  shouldRunMusicPromo,
  shouldShowTutorPlusCard,
  MUSIC_PROMO_WINDOW_MS,
} from "../src/lib/subscriptions/promo";
import { usageDay } from "../src/lib/subscriptions/usage-day";
import { evaluateQuota, isUnlimited } from "../src/lib/subscriptions/quota";
import { NAV_ITEMS } from "../src/lib/nav";

describe("Nigtube pre-roll ad", () => {
  test("free user receives the ad with a 10-second countdown", () => {
    const machine = beginPlayback({ adFree: false, loaded: true });
    expect(machine.state).toBe("ad");
    expect(machine.countdown).toBe(NIGTUBE_AD_SECONDS);
    expect(NIGTUBE_AD_SECONDS).toBe(10);
    expect(canSkip(machine)).toBe(false);
    expect(isPlaying(machine)).toBe(false);
  });

  test("plus user bypasses the ad entirely", () => {
    const machine = beginPlayback({ adFree: true, loaded: true });
    expect(machine.state).toBe("playing");
    expect(isPlaying(machine)).toBe(true);
  });

  test("entitlements still loading holds a checking state (never starts video)", () => {
    const machine = beginPlayback({ adFree: false, loaded: false });
    expect(machine.state).toBe("checking");
    expect(isPlaying(machine)).toBe(false);
  });

  test("skip stays disabled until the countdown reaches zero", () => {
    let machine = beginPlayback({ adFree: false, loaded: true });
    for (let i = 0; i < 9; i++) {
      machine = tickAd(machine);
      expect(machine.state).toBe("ad");
      expect(canSkip(machine)).toBe(false);
    }
    machine = tickAd(machine); // 10th tick
    expect(machine.state).toBe("ready");
    expect(canSkip(machine)).toBe(true);
    expect(machine.countdown).toBe(0);
  });

  test("skip only works once the ad is ready, then video starts", () => {
    let machine = beginPlayback({ adFree: false, loaded: true });
    // Trying to skip mid-ad is a no-op.
    expect(skipAd(machine).state).toBe("ad");
    for (let i = 0; i < NIGTUBE_AD_SECONDS; i++) machine = tickAd(machine);
    const after = skipAd(machine);
    expect(after.state).toBe("playing");
    expect(after.skipped).toBe(true);
  });

  test("countdown stops on a non-ad state (leaving the player)", () => {
    const machine: NigtubeAdMachine = { state: "ready", countdown: 0, total: 10, skipped: false };
    expect(tickAd(machine)).toBe(machine); // unchanged reference, no drift
    const playing: NigtubeAdMachine = { state: "playing", countdown: 3, total: 10, skipped: false };
    expect(tickAd(playing)).toBe(playing);
    expect(idleAdMachine().state).toBe("idle");
  });
});

describe("Plus eligibility resolution", () => {
  test("plus / developer / unlocked tiers are ad-free", () => {
    expect(resolvePlusEligibility({ loaded: true, entitlements: [], plan: "PLUS" }).adFree).toBe(true);
    expect(resolvePlusEligibility({ loaded: true, entitlements: [], plan: "DEVELOPER" }).adFree).toBe(true);
    expect(resolvePlusEligibility({ loaded: true, entitlements: [], plan: "UNLOCKED" }).adFree).toBe(true);
  });

  test("free users with the ad-free entitlement bypass ads", () => {
    const value = resolvePlusEligibility({ loaded: true, entitlements: ["nigtube_ad_free"], plan: "FREE" });
    expect(value.tier).toBe("free");
    expect(value.adFree).toBe(true);
  });

  test("plain free users are not ad-free", () => {
    const value = resolvePlusEligibility({ loaded: true, entitlements: [], plan: "FREE" });
    expect(value.adFree).toBe(false);
    expect(value.loaded).toBe(true);
  });
});

describe("Study Music spoken promotion gating", () => {
  test("free user who has not seen the promo gets it", () => {
    expect(shouldRunMusicPromo({ adFree: false, loaded: true, alreadyShown: false })).toBe(true);
  });

  test("promo is shown only once per session", () => {
    expect(shouldRunMusicPromo({ adFree: false, loaded: true, alreadyShown: true })).toBe(false);
  });

  test("plus users and unresolved entitlements never hear the promo", () => {
    expect(shouldRunMusicPromo({ adFree: true, loaded: true, alreadyShown: false })).toBe(false);
    expect(shouldRunMusicPromo({ adFree: false, loaded: false, alreadyShown: false })).toBe(false);
  });

  test("promo window is approximately 10 seconds", () => {
    expect(MUSIC_PROMO_WINDOW_MS).toBe(10_000);
  });
});

describe("Scholar Plus feature cards (Achievements / Mind Map / Concept Galaxy)", () => {
  const plusItems = NAV_ITEMS.filter((item) => item.plus);

  test("the three legacy 'Soon' items are now Plus cards", () => {
    expect(plusItems.map((item) => item.id).sort()).toEqual(["achievements", "galaxy", "mindmap"]);
  });

  test("no nav item still claims 'comingSoon' for these features", () => {
    for (const item of plusItems) {
      expect(item.comingSoon).toBeUndefined();
    }
    expect(NAV_ITEMS.some((item) => item.comingSoon)).toBe(false);
  });

  test("Plus cards keep their labels and groups", () => {
    const byId = new Map(plusItems.map((item) => [item.id, item]));
    expect(byId.get("achievements")?.label).toBe("Achievements");
    expect(byId.get("mindmap")?.label).toBe("Mind Map");
    expect(byId.get("galaxy")?.label).toBe("Concept Galaxy");
  });
});

describe("AI Tutor first-response Plus card", () => {
  test("free user sees the card only with the first assistant answer", () => {
    expect(shouldShowTutorPlusCard({ loaded: true, isPlus: false, isFirstAssistantMessage: true, alreadyShownForThread: false })).toBe(true);
    expect(shouldShowTutorPlusCard({ loaded: true, isPlus: false, isFirstAssistantMessage: false, alreadyShownForThread: false })).toBe(false);
  });

  test("card never repeats within the same conversation", () => {
    expect(shouldShowTutorPlusCard({ loaded: true, isPlus: false, isFirstAssistantMessage: true, alreadyShownForThread: true })).toBe(false);
  });

  test("Plus users never see the card", () => {
    expect(shouldShowTutorPlusCard({ loaded: true, isPlus: true, isFirstAssistantMessage: true, alreadyShownForThread: false })).toBe(false);
  });

  test("card never flashes before entitlements resolve", () => {
    expect(shouldShowTutorPlusCard({ loaded: false, isPlus: false, isFirstAssistantMessage: true, alreadyShownForThread: false })).toBe(false);
  });
});

describe("Generation usage daily boundary (usageDay)", () => {
  test("same UTC instant is a different day in a different timezone", () => {
    // 2026-08-07T20:00:00Z is already Aug 8 in Asia/Kolkata (+05:30) but still Aug 7 in Pacific/Honolulu (-10:00).
    const instant = new Date("2026-08-07T20:00:00.000Z");
    expect(usageDay("Asia/Kolkata", instant)).toBe("2026-08-08");
    expect(usageDay("Pacific/Honolulu", instant)).toBe("2026-08-07");
  });

  test("counters roll over at local midnight, not UTC midnight", () => {
    // 2026-08-07T23:30:00Z is already Aug 8 in Asia/Kolkata.
    const instant = new Date("2026-08-07T23:30:00.000Z");
    expect(usageDay("UTC", instant)).toBe("2026-08-07");
    expect(usageDay("Asia/Kolkata", instant)).toBe("2026-08-08");
  });

  test("invalid timezone falls back to the UTC day", () => {
    expect(usageDay("Not/AZone", new Date("2026-08-07T12:00:00.000Z"))).toBe("2026-08-07");
  });
});

describe("Generation quota math (free vs Plus limits)", () => {
  test("free default limits are small finite quotas", () => {
    expect(evaluateQuota(3, 0)).toEqual({ kind: "ok", used: 0, limit: 3, remaining: 3 });
    expect(evaluateQuota(3, 2)).toEqual({ kind: "ok", used: 2, limit: 3, remaining: 1 });
  });

  test("reaching the free limit exhausts the quota and blocks generation", () => {
    expect(evaluateQuota(3, 3)).toEqual({ kind: "exhausted", used: 3, limit: 3 });
    expect(evaluateQuota(3, 5)).toEqual({ kind: "exhausted", used: 5, limit: 3 });
  });

  test("Plus default limits are unlimited (-1) and never exhaust", () => {
    expect(isUnlimited(-1)).toBe(true);
    expect(evaluateQuota(-1, 99)).toEqual({ kind: "unlimited", remaining: -1 });
  });

  test("remaining never goes negative for finite quotas", () => {
    const unused = evaluateQuota(3, 0);
    const partial = evaluateQuota(3, 2);
    if (unused.kind === "ok") expect(unused.remaining).toBeGreaterThanOrEqual(0);
    if (partial.kind === "ok") expect(partial.remaining).toBe(1);
  });
});
