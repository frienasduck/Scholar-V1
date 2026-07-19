export const LAM_MODES = ["general", "tutor", "doubt-solver", "current-page", "question-coach", "study-planner", "revision-coach", "quiz-master", "focus-companion", "code-tutor", "ebook-companion", "experiment-guide"] as const;
export type LamMode = typeof LAM_MODES[number];

export interface LamPageContext {
  profileId: string;
  profileName: string;
  scholarClass: 9 | 11;
  currentView: string;
  currentRoute: string;
  subjectTitle?: string;
  chapterTitle?: string;
  ebookTitle?: string;
  sourcePageNumber?: number;
  selectedQuestionId?: string;
  selectedText?: string;
}

export interface LamMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  inputMode?: "text" | "voice";
  createdAt: string;
}

export interface LamConversation {
  id: string;
  profileId: string;
  title: string;
  mode: LamMode;
  messages: LamMessage[];
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
}

export interface LamPreferences {
  wakeWordEnabled: boolean;
  voiceRepliesEnabled: boolean;
  followUpListeningEnabled: boolean;
  followUpWindowMs: number;
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
  selectedVoice: string;
  autoOpenPanel: boolean;
  studyMemoryEnabled: boolean;
  proactiveMode: "off" | "important" | "normal";
  reduceTransparency: boolean;
  compactOrb: boolean;
  onboardingComplete: boolean;
}

export interface LamProfileState {
  version: 1;
  profileId: string;
  activeConversationId: string;
  conversations: LamConversation[];
  preferences: LamPreferences;
  memories: Array<{ id: string; text: string; createdAt: string }>;
  actionHistory: Array<{ id: string; action: string; result: "success" | "cancelled" | "failed"; at: string }>;
}

export const DEFAULT_LAM_PREFERENCES: LamPreferences = {
  wakeWordEnabled: false,
  voiceRepliesEnabled: false,
  followUpListeningEnabled: false,
  followUpWindowMs: 20_000,
  speechRate: 1,
  speechPitch: 1,
  speechVolume: 1,
  selectedVoice: "",
  autoOpenPanel: true,
  studyMemoryEnabled: true,
  proactiveMode: "important",
  reduceTransparency: false,
  compactOrb: false,
  onboardingComplete: false,
};
