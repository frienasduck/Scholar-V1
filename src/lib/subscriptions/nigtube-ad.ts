// ============================================================================
// Nigtube pre-roll ad — pure state machine (unit-testable, no React)
// Free users see a 10-second Scholar Plus promotion before the video starts.
// Plus users bypass it entirely. Skip is only enabled after the countdown.
// ============================================================================

export type NigtubeAdState =
  | "idle"
  | "checking"
  | "ad"
  | "ready"
  | "playing"
  | "error";

export interface NigtubeAdMachine {
  state: NigtubeAdState;
  /** Seconds remaining before Skip unlocks. */
  countdown: number;
  total: number;
  skipped: boolean;
}

export const NIGTUBE_AD_SECONDS = 10;

export function idleAdMachine(): NigtubeAdMachine {
  return { state: "idle", countdown: NIGTUBE_AD_SECONDS, total: NIGTUBE_AD_SECONDS, skipped: false };
}

/** Decide what happens when the student selects a video. */
export function beginPlayback(input: { adFree: boolean; loaded: boolean }): NigtubeAdMachine {
  if (!input.loaded) {
    // Entitlements still resolving — hold a brief checking state, never start
    // the video underneath a pending ad decision.
    return { state: "checking", countdown: NIGTUBE_AD_SECONDS, total: NIGTUBE_AD_SECONDS, skipped: false };
  }
  if (input.adFree) {
    return { state: "playing", countdown: 0, total: NIGTUBE_AD_SECONDS, skipped: false };
  }
  return { state: "ad", countdown: NIGTUBE_AD_SECONDS, total: NIGTUBE_AD_SECONDS, skipped: false };
}

/** Advance the countdown by one second. */
export function tickAd(machine: NigtubeAdMachine): NigtubeAdMachine {
  if (machine.state !== "ad") return machine;
  const next = Math.max(0, machine.countdown - 1);
  if (next === 0) return { ...machine, countdown: 0, state: "ready" };
  return { ...machine, countdown: next };
}

/** Only a fully-counted-down ad may be skipped. */
export function skipAd(machine: NigtubeAdMachine): NigtubeAdMachine {
  if (machine.state !== "ready") return machine;
  return { ...machine, state: "playing", skipped: true };
}

export function canSkip(machine: NigtubeAdMachine): boolean {
  return machine.state === "ready";
}

export function isPlaying(machine: NigtubeAdMachine): boolean {
  return machine.state === "playing";
}
