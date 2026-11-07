export const LIVE_TUTOR_PERSONALITIES = ["calm", "exam", "curious"] as const;
export type LiveTutorPersonality = typeof LIVE_TUTOR_PERSONALITIES[number];

export const LIVE_TUTOR_PROVIDERS = ["auto", "groq", "gemini", "nvidia"] as const;
export type LiveTutorProvider = typeof LIVE_TUTOR_PROVIDERS[number];

export const LIVE_TUTOR_MODES = ["tutor", "examiner", "rapid-revision", "mission"] as const;
export type LiveTutorMode = typeof LIVE_TUTOR_MODES[number];

export const LIVE_TUTOR_STATES = [
  "idle", "preparing", "recalling", "listening", "transcribing", "thinking",
  "using-tool", "waiting-confirmation", "speaking", "paused", "complete", "error",
] as const;
export type LiveTutorState = typeof LIVE_TUTOR_STATES[number];

export type LiveTutorMemoryKind = "learning" | "preference" | "progress" | "task" | "user_confirmed";

export interface LiveTutorMemoryRecord {
  id: string;
  kind: LiveTutorMemoryKind;
  content: string;
  subject?: string | null;
  topic?: string | null;
  sourceType: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LiveTutorProviderStatus {
  id: LiveTutorProvider;
  label: string;
  available: boolean;
  model?: string;
  models?: string[];
  note?: string;
}

export interface LiveTutorMissionStep {
  id: string;
  label: string;
  state: "complete" | "active" | "upcoming" | "paused";
}

export interface LiveTutorMission {
  id: string;
  title: string;
  durationMinutes: number;
  steps: LiveTutorMissionStep[];
  status: "active" | "paused" | "complete" | "cancelled";
}

export interface LamWallpaper {
  id: string;
  name: string;
  description: string;
  src: string;
}

export const LAM_WALLPAPERS: LamWallpaper[] = [
  {
    id: "particles",
    name: "Cinematic Particles",
    description: "Deep obsidian with ambient floating luminescence",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260619_191346_9d19d66e-86a4-47f7-8dc6-712c1788c3b2.mp4",
  },
  {
    id: "nebula",
    name: "Cosmic Nebula",
    description: "Deep space stellar dust and cosmic gradients",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4",
  },
  {
    id: "bioluminescence",
    name: "Aquatic Bioluminescence",
    description: "Serene deep underwater skylight and floating aquatic aura",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4",
  },
  {
    id: "aurora",
    name: "Aurora Glow",
    description: "Vibrant emerald and cyan atmospheric light streams",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4",
  },
  {
    id: "rings",
    name: "Celestial Rings",
    description: "Orbital celestial geometry and planetary horizon",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4",
  },
  {
    id: "midnight",
    name: "Midnight Aura",
    description: "Subtle dark slate study ambience with slow-shifting caustics",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_124724_bc041163-d651-425f-aea3-2acc1efc2c96.mp4",
  },
  {
    id: "solar",
    name: "Solar Flare",
    description: "High-energy coronal plasma loops and stellar radiance",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260815_030633_1712fc71-4979-4e14-98f9-9f95702ab3da.mp4",
  },
  {
    id: "focus",
    name: "Emerald Stream",
    description: "Deep viridian flow tailored for prolonged reading focus",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4",
  },
];

export const DEFAULT_LAM_WALLPAPER = LAM_WALLPAPERS[0];

export const UNIFIED_LAM_COPY = {
  label: "LAM AI",
  shortLabel: "LAM AI",
  description: "Your intelligent personal academic companion.",
  idleHeading: "Ready when you are.",
  idleSubcopy: "Ask any academic question, work through problems step by step, or type @ to run any Scholar plugin.",
  prompt: "Ask LAM AI anything… (type @ for plugins)",
};

export const PERSONALITY_COPY: Record<LiveTutorPersonality, {
  label: string;
  shortLabel: string;
  description: string;
  idleHeading: string;
  idleSubcopy: string;
  prompt: string;
}> = {
  calm: {
    label: "LAM AI",
    shortLabel: "LAM AI",
    description: "Your intelligent personal academic companion.",
    idleHeading: "Ready when you are.",
    idleSubcopy: "Ask any academic question, work through problems step by step, or type @ to run any Scholar plugin.",
    prompt: "Ask LAM AI anything… (type @ for plugins)",
  },
  exam: {
    label: "LAM AI",
    shortLabel: "LAM AI",
    description: "Your intelligent personal academic companion.",
    idleHeading: "Ready when you are.",
    idleSubcopy: "Ask any academic question, work through problems step by step, or type @ to run any Scholar plugin.",
    prompt: "Ask LAM AI anything… (type @ for plugins)",
  },
  curious: {
    label: "LAM AI",
    shortLabel: "LAM AI",
    description: "Your intelligent personal academic companion.",
    idleHeading: "Ready when you are.",
    idleSubcopy: "Ask any academic question, work through problems step by step, or type @ to run any Scholar plugin.",
    prompt: "Ask LAM AI anything… (type @ for plugins)",
  },
};

export const PERSONALITY_BEHAVIOR: Record<LiveTutorPersonality, string> = {
  calm: "Act as LAM AI, the student's personal intelligent academic tutor. Explain concepts clearly and concisely, solve problems step-by-step, verify understanding, and suggest relevant plugins or practice when helpful.",
  exam: "Act as LAM AI, the student's personal intelligent academic tutor. Explain concepts clearly and concisely, solve problems step-by-step, verify understanding, and suggest relevant plugins or practice when helpful.",
  curious: "Act as LAM AI, the student's personal intelligent academic tutor. Explain concepts clearly and concisely, solve problems step-by-step, verify understanding, and suggest relevant plugins or practice when helpful.",
};

export const LIVE_TUTOR_VIDEOS: Record<LiveTutorPersonality, { src: string; poster?: string; fit: "cover" | "fill" }> = {
  calm: {
    src: DEFAULT_LAM_WALLPAPER.src,
    fit: "cover",
  },
  exam: {
    src: DEFAULT_LAM_WALLPAPER.src,
    fit: "cover",
  },
  curious: {
    src: DEFAULT_LAM_WALLPAPER.src,
    fit: "cover",
  },
};
