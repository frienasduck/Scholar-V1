import type { LamAvatarState, LamIdentityPreferences } from "./identity";

export type LamFocusTarget = "none" | "input" | "content" | "formula" | "question" | "resource" | "screen";
export type LamUrgency = "calm" | "focused" | "urgent" | "emergency";
export interface LamPresence {
  state: LamAvatarState; busy: boolean; blocked: boolean; hidden: boolean; reduced: boolean; enabled: boolean;
  target: LamFocusTarget; context: string; urgency: LamUrgency; sessionMuted: boolean;
  activities: Readonly<Record<string, LamAvatarState>>;
  reaction: Readonly<{ owner: string; state: LamAvatarState; phase: string; variant: number }> | null;
}
interface Activity { state: LamAvatarState; busy: boolean; blocked: boolean; target: LamFocusTarget; urgency: LamUrgency; deadline?: number; since: number }
interface ReactionStep { at: number; state: LamAvatarState; phase: string }
interface Reaction { owner: string; started: number; steps: readonly ReactionStep[]; duration: number; variant: number; priority: number }
const initial: LamPresence = { state: "idle", busy: false, blocked: false, hidden: false, reduced: false, enabled: true, target: "none", context: "home", urgency: "calm", sessionMuted: false, activities: {}, reaction: null };
let snapshot = initial;
const listeners = new Set<() => void>();
const owners = new Map<string, Activity>();
let sequence: Reaction | null = null;
let boundaryTimer: ReturnType<typeof setTimeout> | null = null;
let runtimeAttached = false;
let lastActivity = 0, lastLamInteraction = 0, lastPeek = 0, peekCount = 0, greeted = false;
let preferences: Pick<LamIdentityPreferences, "presence" | "ambient" | "idleReactions" | "celebrations"> = { presence: "balanced", ambient: true, idleReactions: true, celebrations: true };
export const LAM_SLEEP_THRESHOLDS = { rest: 90_000, sleepy: 240_000, sleeping: 480_000 } as const;
export const LAM_PEEK_COOLDOWN = 5 * 60_000;
export const LAM_REACTION_COOLDOWN = 12_000;

/** Ephemeral presentation only. No chat, account content, audio or AI requests. */
export function lamStatePriority(s: LamAvatarState): number {
  if (s === "error" || s === "caution") return 100;
  if (["teaching", "responding"].includes(s)) return 90;
  if (["thinking", "processing", "analyzing", "scanning", "reading", "searching", "planning"].includes(s)) return 80;
  if (s === "listening") return 70;
  if (["attentive", "hover", "quizzing", "exam_focus", "studying", "reviewing", "writing", "pointing"].includes(s)) return 55;
  if (["happy", "success", "celebrate", "encouraging", "helpful", "confused", "greeting", "wake"].includes(s)) return 45;
  if (s.startsWith("lamtube_") || s === "listening_music" || s === "waiting") return 30;
  return s === "idle" ? 10 : 5;
}
const transientDuration = (s: LamAvatarState) => s === "error" || s === "caution" ? 2400 : ["happy", "success", "celebrate", "greeting", "wake", "helpful", "confused", "encouraging"].includes(s) ? 2200 : 0;
export function subscribeLamPresence(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getLamPresence() { return snapshot; }
export function serverLamPresence() { return initial; }
function update(patch: Partial<LamPresence>) {
  const next = { ...snapshot, ...patch };
  if (Object.keys(next).every(k => next[k as keyof LamPresence] === snapshot[k as keyof LamPresence])) return;
  snapshot = next; listeners.forEach(l => l());
}
export function setLamEnvironment(patch: Partial<Pick<LamPresence, "hidden" | "reduced" | "enabled" | "sessionMuted">>) {
  update(patch);
  if (snapshot.hidden || snapshot.reduced || !snapshot.enabled || snapshot.sessionMuted) cancelLamReaction();
}
export function configureLamBehavior(prefs: typeof preferences) { preferences = prefs; recompute(); }
export function setLamContext(page: string) { update({ context: page }); }
export function examLamUrgency(millisecondsLeft: number): LamUrgency { return millisecondsLeft <= 15 * 60_000 ? "emergency" : millisecondsLeft <= 2 * 60 * 60_000 ? "urgent" : millisecondsLeft <= 24 * 60 * 60_000 ? "focused" : "calm"; }
export function setLamPresence(owner: string, state: LamAvatarState, busy = false, blocked = false, options: { target?: LamFocusTarget; urgency?: LamUrgency; deadline?: number } = {}, now = Date.now()) {
  const previous = owners.get(owner);
  owners.set(owner, { state, busy, blocked, target: options.target ?? "none", urgency: options.urgency ?? "calm", deadline: options.deadline, since: previous?.state === state ? previous.since : now });
  if (busy || state === "listening") lastLamInteraction = now;
  recompute(now); scheduleBoundary(now);
}
export function releaseLamPresence(owner: string) { owners.delete(owner); if (sequence?.owner === owner) cancelLamReaction(owner); recompute(); scheduleBoundary(); }
export function lamOwnerState(owner: string, requested: LamAvatarState, now = Date.now()): LamAvatarState {
  const entry = owners.get(owner);
  if (requested === "idle") return snapshot.state;
  return entry?.state === requested && transientDuration(requested) && now - entry.since >= transientDuration(requested) ? "attentive" : requested;
}
export function lamInactivityState(quietFor: number): LamAvatarState { return quietFor >= LAM_SLEEP_THRESHOLDS.sleeping ? "sleeping" : quietFor >= LAM_SLEEP_THRESHOLDS.sleepy ? "sleepy" : quietFor >= LAM_SLEEP_THRESHOLDS.rest ? "rest" : "idle"; }
export function noteLamInteraction(now = Date.now(), direct = false) {
  const wasSleeping = ["rest", "sleepy", "sleeping"].includes(snapshot.state);
  lastActivity = now; if (direct) lastLamInteraction = now;
  if (wasSleeping && !snapshot.busy && !snapshot.hidden && !snapshot.reduced && !sequence) reactLam("session-wake", "wake", "micro", now);
  else recompute(now);
}
export function startLamSession(now = Date.now()) {
  runtimeAttached = true; if (!lastActivity) lastActivity = now;
  if (!greeted) { greeted = true; reactLam("session-greeting", "greeting", "micro", now); }
  scheduleBoundary(now);
}
export function stopLamSession() { runtimeAttached = false; if (boundaryTimer) clearTimeout(boundaryTimer); boundaryTimer = null; sequence = null; update({ reaction: null }); }
function recompute(now = Date.now()) {
  const values = [...owners.values()];
  const ranked = [...owners.entries()].map(([owner, v]) => ({ ...v, owner, state: transientDuration(v.state) && now - v.since >= transientDuration(v.state) ? "attentive" as const : v.state })).sort((a, b) => lamStatePriority(b.state) - lamStatePriority(a.state));
  const active = ranked[0];
  const activityStates = Object.fromEntries(ranked.map(v => [v.owner, v.state]));
  const sameActivities = Object.keys(activityStates).length === Object.keys(snapshot.activities).length && Object.entries(activityStates).every(([id, state]) => snapshot.activities[id] === state);
  const busy = values.some(v => v.busy), blocked = values.some(v => v.blocked);
  let state = active?.state ?? "idle", target = active?.target ?? "none";
  // A new teaching/error/input activity interrupts ambient stories immediately.
  if (sequence && sequence.priority < 40 && (busy || lamStatePriority(state) >= 70)) sequence = null;
  if (sequence) {
    const elapsed = now - sequence.started;
    if (elapsed >= sequence.duration) sequence = null;
    else if (sequence.priority >= lamStatePriority(state)) state = ([...sequence.steps].reverse().find(s => elapsed >= s.at) ?? sequence.steps[0]).state;
  }
  if (state === "idle" && !busy && !blocked && preferences.idleReactions && !snapshot.sessionMuted) {
    state = lamInactivityState(now - (lastActivity || now));
    if (state === "idle" && now - lastLamInteraction < 25_000) state = "attentive";
  }
  if (state === "listening") target = "input";
  const urgency = values.map(v => v.deadline === undefined ? v.urgency : examLamUrgency(v.deadline - now)).sort((a, b) => ["calm", "focused", "urgent", "emergency"].indexOf(b) - ["calm", "focused", "urgent", "emergency"].indexOf(a))[0] ?? "calm";
  const step = sequence && [...sequence.steps].reverse().find(s => now - sequence!.started >= s.at);
  const reaction = sequence && step ? { owner: sequence.owner, state: step.state, phase: step.phase, variant: sequence.variant } : null;
  const sameReaction = JSON.stringify(snapshot.reaction) === JSON.stringify(reaction);
  update({ state, target, busy, blocked, urgency, activities: sameActivities ? snapshot.activities : activityStates, reaction: sameReaction ? snapshot.reaction : reaction });
}
/** One boundary timeout for all transient reactions; no timers in feature pages. */
function scheduleBoundary(now = Date.now()) {
  if (boundaryTimer) clearTimeout(boundaryTimer); boundaryTimer = null;
  if (!runtimeAttached || snapshot.hidden) return;
  const boundaries: number[] = [];
  if (sequence) boundaries.push(sequence.started + sequence.duration, ...sequence.steps.map(s => sequence!.started + s.at));
  for (const a of owners.values()) if (transientDuration(a.state)) boundaries.push(a.since + transientDuration(a.state));
  const next = boundaries.filter(t => t > now).sort((a, b) => a - b)[0];
  if (next !== undefined) boundaryTimer = setTimeout(() => { recompute(); scheduleBoundary(); }, Math.max(16, next - now));
}
export function tickLamBehavior(now = Date.now()) { recompute(now); scheduleBoundary(now); }
export function cancelLamReaction(owner?: string) { if (owner && sequence?.owner !== owner) return; sequence = null; update({ reaction: null }); recompute(); scheduleBoundary(); }
export function reactLam(owner: string, state: LamAvatarState, level: "micro" | "normal" | "major" = "micro", now = Date.now()): boolean {
  if (sequence || snapshot.hidden || !snapshot.enabled || snapshot.sessionMuted) return false;
  if (["success", "happy", "celebrate"].includes(state) && !preferences.celebrations) return false;
  const duration = level === "major" ? 2400 : level === "normal" ? 1900 : 1400;
  sequence = { owner, started: now, duration, variant: level === "major" ? 2 : level === "normal" ? 1 : 0, priority: 45, steps: [{ at: 0, state, phase: level }] };
  recompute(now); scheduleBoundary(now); return true;
}
export const LAMTUBE_STORY: readonly ReactionStep[] = [
  { at: 0, state: "lamtube_noticed", phase: "notice" },
  { at: 260, state: "lamtube_look_back", phase: "look-back" },
  { at: 1020, state: "lamtube_eye_contact", phase: "eye-contact" },
  { at: 1500, state: "lamtube_shrug", phase: "shrug" },
  { at: 2120, state: "lamtube_what", phase: "what" },
  { at: 2580, state: "lamtube_return", phase: "return" },
];
export function lamTubeStoryAt(elapsed: number, variant = 0): ReactionStep {
  const steps: readonly ReactionStep[] = variant ? [{ at: 0, state: "lamtube_noticed", phase: "notice" }, { at: 260, state: "lamtube_look_back", phase: "look-back" }, { at: 950, state: variant === 2 ? "wave" : "curious", phase: variant === 2 ? "wave" : "double-take" }, { at: 1800, state: "lamtube_return", phase: "return" }] : LAMTUBE_STORY;
  return [...steps].reverse().find(s => elapsed >= s.at) ?? steps[0];
}
export function beginLamTubeReaction(owner: string, variant = 0, now = Date.now()): boolean {
  if (sequence || snapshot.busy || lamStatePriority(snapshot.state) >= 70 || snapshot.hidden || snapshot.reduced || snapshot.sessionMuted || !snapshot.enabled) return false;
  const alternate: ReactionStep[] = [lamTubeStoryAt(0, variant), { ...lamTubeStoryAt(260, variant), at: 260 }, { ...lamTubeStoryAt(950, variant), at: 950 }, { at: 1800, state: "lamtube_return", phase: "return" }];
  sequence = { owner, started: now, steps: variant ? alternate : LAMTUBE_STORY, duration: variant ? 2500 : 3360, variant, priority: 35 };
  lastLamInteraction = now; recompute(now); scheduleBoundary(now); return true;
}
export interface PeekContext { enabled: boolean; hidden: boolean; reduced: boolean; busy: boolean; blocked: boolean; typing: boolean; dialog: boolean; fullscreen: boolean; width: number; height: number; page: string; quietFor: number; sincePeek: number; count?: number; presence?: LamIdentityPreferences["presence"]; urgency?: LamUrgency }
export function canLamPeek(c: PeekContext): boolean {
  const max = c.presence === "quiet" ? 0 : c.presence === "lively" ? 4 : 3;
  return c.enabled && !c.hidden && !c.reduced && !c.busy && !c.blocked && !c.typing && !c.dialog && !c.fullscreen && (c.count ?? 0) < max && (!c.urgency || c.urgency === "calm") && c.width >= 1100 && c.height >= 650 && c.quietFor >= 20_000 && c.sincePeek >= LAM_PEEK_COOLDOWN && ["home", "dashboard", "subjects", "resources", "settings", "store"].includes(c.page);
}
export function recordLamPeek(now = Date.now()) { lastPeek = now; peekCount++; }
export function getLamSession() { return { lastActivity, lastLamInteraction, lastPeek, peekCount, greeted }; }
export function canLamReact(now: number, last: number, active: boolean) { return !active && now - last >= LAM_REACTION_COOLDOWN; }
/** Test isolation only, never called by a feature page. */
export function resetLamBehaviorForTests() { stopLamSession(); owners.clear(); lastActivity = 0; lastLamInteraction = 0; lastPeek = 0; peekCount = 0; greeted = false; preferences = { presence: "balanced", ambient: true, idleReactions: true, celebrations: true }; snapshot = initial; }
