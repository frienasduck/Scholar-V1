import type { LamAvatarState, LamPlacement } from "./identity";
import type { LamFocusTarget, LamPresence } from "./presence";

export function selectLamActivity(p: LamPresence, owner: string, requested: LamAvatarState): LamAvatarState {
  return requested === "idle" ? p.state : p.activities[owner] ?? requested;
}

/** Flat, shallow-comparable values only; other owners don't invalidate art. */
export function selectLamAvatar(p: LamPresence, state: LamAvatarState | undefined, placement: LamPlacement, animate: boolean, target?: LamFocusTarget) {
  const effective = state === undefined || state === "idle" && placement !== "gallery" && animate ? p.state : state;
  return {
    state: effective, target: target ?? (animate ? p.target : "none"), enabled: p.enabled,
    hidden: animate && p.hidden, reduced: animate && p.reduced,
    sessionMuted: animate && p.sessionMuted, urgency: animate ? p.urgency : "calm",
    reactionLevel: animate && p.reaction?.state === effective ? p.reaction.variant : undefined,
  };
}
