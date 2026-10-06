/** The approved artwork is displayed verbatim through crop windows, never redrawn.
 * Coordinates exclude the reference-sheet headings, captions and card borders.
 * Lossless crop derivatives let Next Image optimize only the visible artwork. */
export const LAM_STATES = ["idle", "attentive", "blink", "hover", "greeting", "listening", "thinking", "processing", "responding", "teaching", "reading", "scanning", "pointing", "searching", "waiting", "happy", "success", "celebrate", "encouraging", "curious", "confused", "helpful", "caution", "error", "sleepy", "sleeping", "wake", "goodbye", "wave", "look_around", "stretch", "rest", "hide", "peek_left", "peek_right", "peek_bottom", "peek_corner", "listening_music", "studying", "exam_focus", "analyzing", "writing", "planning", "quizzing", "reviewing", "lamtube_watching", "lamtube_noticed", "lamtube_look_back", "lamtube_eye_contact", "lamtube_shrug", "lamtube_what", "lamtube_return"] as const;
export type LamAvatarState = typeof LAM_STATES[number];
export type LamPlacement = "header" | "panel" | "tutor" | "chapter" | "lamtube" | "exam" | "gallery" | "ambient" | "music" | "reader";
export type LamMotionLanguage = "cosmic" | "mechanical" | "soft" | "guardian" | "crystal" | "ribbon" | "scholar" | "owl" | "lantern" | "book";
export interface LamMotionProfile { language: LamMotionLanguage; float: number; tilt: number; tempo: number; trail: number }
/** Individual ranges, not a generic bouncing loop. The source pose is never warped. */
const motionProfiles: Record<string, LamMotionProfile> = {
  aurora: { language: "cosmic", float: 2, tilt: 2, tempo: 8, trail: 160 },
  nexus: { language: "mechanical", float: .5, tilt: 4, tempo: 10, trail: 80 },
  orbit: { language: "cosmic", float: 1, tilt: 1, tempo: 11, trail: 200 },
  lume: { language: "soft", float: 1.5, tilt: 3, tempo: 9, trail: 130 },
  arc: { language: "guardian", float: .4, tilt: 1, tempo: 12, trail: 220 },
  "prism-faceted": { language: "crystal", float: .6, tilt: 2, tempo: 10, trail: 120 },
  kindle: { language: "ribbon", float: 1, tilt: 2.5, tempo: 9, trail: 230 },
  cosmos: { language: "cosmic", float: 1.6, tilt: 2, tempo: 10, trail: 240 },
  "study-buddy": { language: "scholar", float: .3, tilt: 3, tempo: 11, trail: 110 },
  icon: { language: "soft", float: 1, tilt: 2, tempo: 10, trail: 150 },
  orb: { language: "cosmic", float: 1.3, tilt: 1.5, tempo: 9, trail: 180 },
  glyph: { language: "crystal", float: .4, tilt: 1.5, tempo: 12, trail: 120 },
  guide: { language: "guardian", float: .3, tilt: 2, tempo: 12, trail: 180 },
  owl: { language: "owl", float: 0, tilt: 5, tempo: 10, trail: 110 },
  prism: { language: "crystal", float: .8, tilt: 2.5, tempo: 11, trail: 140 },
  ribbon: { language: "ribbon", float: 1.8, tilt: 2.5, tempo: 10, trail: 260 },
  atlas: { language: "mechanical", float: .8, tilt: 3, tempo: 11, trail: 90 },
  lantern: { language: "lantern", float: .5, tilt: 1, tempo: 12, trail: 210 },
  halo: { language: "guardian", float: 0, tilt: 2, tempo: 13, trail: 240 },
  lore: { language: "book", float: .3, tilt: 2.5, tempo: 11, trail: 180 },
  nova: { language: "soft", float: .7, tilt: 3, tempo: 9, trail: 120 },
  wisp: { language: "ribbon", float: 1.7, tilt: 2, tempo: 12, trail: 270 },
};
export type LamSignature = "orbit" | "faceted" | "mentor" | "companion" | "ribbon" | "warm";
export interface LamAvatarDefinition {
  id: string; name: string; description: string; asset: string; thumbnail: string; renderAsset: string;
  sourceWidth: number; sourceHeight: number; crop: readonly [number, number, number, number];
  signature: LamSignature; accent: string; defaultScale: number; defaultPosition: "center";
  motion: LamMotionProfile;
  placements: readonly LamPlacement[]; supportedStates: readonly LamAvatarState[]; fallback: string;
}
const placements: LamPlacement[] = ["header", "panel", "tutor", "chapter", "lamtube", "exam", "gallery", "ambient", "music", "reader"];
function avatar(id: string, name: string, description: string, sheet: "concepts" | "mascots", crop: LamAvatarDefinition["crop"], signature: LamSignature, accent = "#9daeff"): LamAvatarDefinition {
  const asset = `/lam/identity/${sheet}.png`;
  return { id, name, description, asset, thumbnail: asset, renderAsset: `/lam/identity/avatars/${id}.webp`, sourceWidth: 1448, sourceHeight: 1086, crop, signature, accent, motion: motionProfiles[id], defaultScale: 1, defaultPosition: "center", placements, supportedStates: LAM_STATES, fallback: "aurora" };
}
export const LAM_AVATARS: readonly LamAvatarDefinition[] = [
  avatar("aurora", "Aurora LAM", "Warm · supportive · radiant", "mascots", [25, 197, 256, 270], "orbit"),
  avatar("nexus", "Nexus LAM", "Intelligent · modern · dynamic", "mascots", [319, 192, 254, 280], "companion"),
  avatar("orbit", "Orbit LAM", "Calm · focused · balanced", "mascots", [601, 187, 249, 279], "orbit"),
  avatar("lume", "Lume LAM", "Curious · playful · creative", "mascots", [888, 196, 251, 276], "companion"),
  avatar("arc", "Arc LAM", "Elegant · wise · guiding", "mascots", [1175, 185, 252, 291], "mentor"),
  avatar("prism-faceted", "Prism LAM · Faceted", "Analytical · precise · insightful", "mascots", [30, 604, 251, 279], "faceted"),
  avatar("kindle", "Kindle LAM", "Friendly · adaptive · empathetic", "mascots", [317, 610, 253, 271], "ribbon"),
  avatar("cosmos", "Cosmos LAM", "Visionary · expansive · inspiring", "mascots", [601, 608, 247, 275], "orbit"),
  avatar("study-buddy", "Study Buddy LAM", "Focused · productive · motivating", "mascots", [890, 606, 251, 279], "companion"),
  avatar("icon", "Icon LAM", "Simple · recognizable · ever-present", "mascots", [1177, 628, 251, 249], "orbit"),
  avatar("orb", "Orb LAM", "Fluid · empathetic · adaptive", "concepts", [35, 130, 313, 204], "orbit"),
  avatar("glyph", "Glyph LAM", "Minimal · iconic · memorable", "concepts", [396, 113, 306, 215], "faceted", "#eed0a1"),
  avatar("guide", "Guide LAM", "Wise · supportive · holographic", "concepts", [782, 70, 290, 260], "mentor"),
  avatar("owl", "Owl LAM", "Playful · knowledgeable · trustworthy", "concepts", [1100, 116, 320, 215], "companion", "#eed0a1"),
  avatar("prism", "Prism LAM · Crystal", "Many perspectives · a brighter you", "concepts", [40, 416, 307, 221], "faceted"),
  avatar("ribbon", "Ribbon LAM", "Dynamic · creative · limitless", "concepts", [392, 440, 313, 198], "ribbon"),
  avatar("atlas", "Atlas LAM", "Curious · adventurous · always exploring", "concepts", [764, 432, 304, 206], "companion"),
  avatar("lantern", "Lantern LAM", "Warm · encouraging · always on", "concepts", [1105, 409, 307, 230], "warm", "#ffce84"),
  avatar("halo", "Halo LAM", "Elegant · mysterious · intelligent", "concepts", [41, 744, 305, 210], "mentor", "#eed0a1"),
  avatar("lore", "Lore LAM", "Magical · scholarly · expressive", "concepts", [395, 749, 310, 206], "warm", "#ffce84"),
  avatar("nova", "Nova LAM", "Friendly · energetic · always there", "concepts", [764, 735, 308, 222], "companion"),
  avatar("wisp", "Wisp LAM", "Abstract · cosmic · transcendent", "concepts", [1104, 746, 310, 211], "ribbon"),
];
export const DEFAULT_LAM_AVATAR = "aurora";
export function getLamAvatar(id?: string): LamAvatarDefinition {
  return LAM_AVATARS.find(a => a.id === id) ?? LAM_AVATARS[0];
}
export interface LamIdentityPreferences {
  avatarId: string; animations: boolean; intensity: "subtle" | "normal" | "expressive";
  ambient: boolean; peeks: boolean; celebrations: boolean; idleReactions: boolean;
  cursorAwareness: boolean; reducedMotion: boolean; presence: "quiet" | "balanced" | "lively";
}
export const DEFAULT_LAM_IDENTITY: LamIdentityPreferences = {
  avatarId: DEFAULT_LAM_AVATAR, animations: true, intensity: "subtle", ambient: true,
  peeks: true, celebrations: true, idleReactions: true,
  cursorAwareness: true, reducedMotion: false, presence: "balanced",
};
/** Version-tolerant, allowlisted migration. Never accepts arbitrary asset URLs. */
export function normalizeLamIdentity(value: unknown): LamIdentityPreferences {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const prefs = { ...DEFAULT_LAM_IDENTITY, avatarId: getLamAvatar(typeof input.avatarId === "string" ? input.avatarId : undefined).id };
  for (const key of ["animations", "ambient", "peeks", "celebrations", "idleReactions", "cursorAwareness", "reducedMotion"] as const) {
    if (typeof input[key] === "boolean") prefs[key] = input[key];
  }
  if (["subtle", "normal", "expressive"].includes(String(input.intensity))) prefs.intensity = input.intensity as LamIdentityPreferences["intensity"];
  if (["quiet", "balanced", "lively"].includes(String(input.presence))) prefs.presence = input.presence as LamIdentityPreferences["presence"];
  return prefs;
}
export function resolveLamState(state: string): LamAvatarState {
  const aliases: Record<string, LamAvatarState> = { speaking: "responding", answering: "responding", completed: "happy", complete: "happy", working: "reading", "performing-action": "reading", transcribing: "thinking", typing: "listening", explaining: "teaching", confused_helpful: "helpful", watching_video: "lamtube_watching", active_teaching: "teaching" };
  return aliases[state] ?? (LAM_STATES.includes(state as LamAvatarState) ? state as LamAvatarState : "idle");
}
