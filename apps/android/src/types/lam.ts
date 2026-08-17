/**
 * LAM (Learning Assistant and Mentor) types — mirror the Scholar web contract
 * (src/lib/lam/types.ts + src/app/api/lam/chat/route.ts). Wired into the API
 * client now; the LAM chat screen ships in Phase 2.
 */

export const LAM_MODES = [
  "general",
  "tutor",
  "doubt-solver",
  "current-page",
  "question-coach",
  "study-planner",
  "revision-coach",
  "quiz-master",
  "focus-companion",
  "code-tutor",
  "ebook-companion",
  "experiment-guide",
] as const;

export type LamMode = (typeof LAM_MODES)[number];

/** Page context the app tells LAM about (mirrors LamPageContext on web). */
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
  visibleText?: string;
  activeFileId?: string;
  activeFileName?: string;
  activeSlideshowId?: string;
  activeQuizId?: string;
  weakTopics?: string[];
  recentQuizScore?: string;
}

export interface LamChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LamChatRequest {
  profileId: string;
  message: string;
  inputMode: "text" | "voice";
  assistantMode: LamMode;
  pageContext: LamPageContext;
  messages: LamChatMessage[];
  responseDetail?: "quick" | "balanced" | "detailed" | "step-by-step";
  reminderSummary?: string;
}

/** Server-sent event frames emitted by /api/lam/chat. */
export type LamStreamEvent =
  | { type: "start"; model?: string }
  | { type: "text-delta"; value: string }
  | { type: "source"; source: { label: string; route?: string } }
  | { type: "finish" }
  | { type: "error"; message: string };
