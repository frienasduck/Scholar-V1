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

export const PERSONALITY_COPY: Record<LiveTutorPersonality, {
  label: string;
  shortLabel: string;
  description: string;
  idleHeading: string;
  idleSubcopy: string;
  prompt: string;
}> = {
  calm: {
    label: "Calm Tutor",
    shortLabel: "Calm",
    description: "Patient, clear and gently paced.",
    idleHeading: "Ready when you are.",
    idleSubcopy: "Talk naturally, type a question, or let LAM choose the next useful step in your learning.",
    prompt: "What would you like to understand?",
  },
  exam: {
    label: "Exam Coach",
    shortLabel: "Exam",
    description: "Focused, direct and exam-ready.",
    idleHeading: "Let’s make this count.",
    idleSubcopy: "Answer under pressure, expose weak spots, and turn mistakes into a precise revision plan.",
    prompt: "Tell LAM what you need to prepare for…",
  },
  curious: {
    label: "Curious Scientist",
    shortLabel: "Curious",
    description: "Conceptual, exploratory and visual.",
    idleHeading: "What shall we discover?",
    idleSubcopy: "Explore why ideas work, connect concepts, and build a deeper picture instead of memorising answers.",
    prompt: "What are you curious about?",
  },
};

export const PERSONALITY_BEHAVIOR: Record<LiveTutorPersonality, string> = {
  calm: "Teach patiently in small steps. Use gentle hints, low-pressure corrections, and a warm unhurried tone.",
  exam: "Act as a precise exam coach. Challenge weak answers, ask follow-ups, correct quickly, and do not reveal answers too early.",
  curious: "Teach like a curious scientist. Ask why, connect mechanisms across topics, and use visual or conceptual explanations when useful.",
};

export const LIVE_TUTOR_VIDEOS: Record<LiveTutorPersonality, { src: string; poster?: string; fit: "cover" | "fill" }> = {
  calm: {
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_124724_bc041163-d651-425f-aea3-2acc1efc2c96.mp4",
    fit: "cover",
  },
  exam: {
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260815_030633_1712fc71-4979-4e14-98f9-9f95702ab3da.mp4",
    fit: "cover",
  },
  curious: {
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_133255_956f653f-5d80-4b06-abd5-0f46c98b60fa.mp4",
    poster: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260831_223518_f11bfa03-4e65-47e1-a4a7-30e42a7a8c2f.png&w=1920&q=85",
    fit: "fill",
  },
};
