export const LAM_MODES = ["general", "tutor", "doubt-solver", "current-page", "question-coach", "study-planner", "revision-coach", "quiz-master", "focus-companion", "code-tutor", "ebook-companion", "experiment-guide"] as const;
export type LamMode = typeof LAM_MODES[number];

export type LamVisualState =
  | "closed" | "invoking" | "idle" | "listening" | "transcribing"
  | "thinking" | "answering" | "action-preview" | "performing-action"
  | "completed" | "error" | "history";

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

export interface LamPluginQuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface LamPluginNcertQuestion {
  type: string;
  marks: number;
  question: string;
  options?: string[];
  answer?: string;
  solution: string;
}

export interface LamPluginNcertSetData {
  title: string;
  subject?: string;
  chapter?: string;
  items: LamPluginNcertQuestion[];
}

export interface LamPluginFlashcard {
  front: string;
  back: string;
  tip?: string;
  topic?: string;
}

export interface LamPluginSlide {
  title: string;
  type?: string;
  content?: string;
  bullets: string[];
  formula?: string;
  takeaway: string;
  note?: string;
}

export interface LamPluginSlideshowData {
  title: string;
  subtitle?: string;
  subject?: string;
  chapter?: string;
  slides: LamPluginSlide[];
}

export interface LamPluginFormula {
  name: string;
  formula: string;
  units: string;
  condition?: string;
}

export interface LamPluginImageData {
  url: string;
  artifactId?: string;
  prompt: string;
  enhancedPrompt?: string;
  aspectRatio?: string;
  style?: string;
}

export interface LamPluginHomeworkData {
  fileName?: string;
  imageArtifactId?: string;
  ocrText: string;
  confidence?: number | null;
  hint: string;
  solution: string;
}

export interface LamPluginEvaluatorData {
  score: number;
  maxScore: number;
  correctConcepts?: string[];
  missingConcepts?: string[];
  formulaFeedback?: string;
  unitsFeedback?: string;
  stepFeedback?: string;
  markingBreakdown?: Array<{
    criterion: string;
    marksAwarded: number;
    maxMarks: number;
    feedback: string;
  }>;
  strengths: string[];
  gaps: string[];
  modelAnswer: string;
}

export interface LamPluginPlannerData {
  planTitle: string;
  subtitle?: string;
  summaryMarkdown?: string;
  tasks: Array<{
    title: string;
    subject: string;
    date: string;
    time?: string;
    durationMinutes?: number;
    priority: "low" | "medium" | "high";
  }>;
}

export interface LamPluginFlowchartData {
  title: string;
  steps: Array<{
    stepNumber: number;
    title: string;
    description: string;
    keyRule?: string;
  }>;
}

export interface LamPluginAnalyticsData {
  title: string;
  metricLabel: string;
  metricValue: string;
  honestyNote?: string;
  summaryMetrics?: Array<{ label: string; value: string }>;
  items: Array<{
    label: string;
    value: string | number;
    detail?: string;
    level?: "good" | "warning" | "danger";
  }>;
  diagnosisMarkdown?: string;
  recommendation: string;
}

export interface LamPluginPyqData {
  question: string;
  yearExam: string;
  totalMarks: number;
  markingSteps: Array<{
    stepNumber: number;
    title: string;
    content: string;
    marks: string;
  }>;
  finalAnswer?: string;
  examinerTip: string;
  commonPitfall: string;
}

export interface LamPluginPdfData {
  title: string;
  subtitle: string;
  scholarClass?: 9 | 11;
  fullMarkdown: string;
  sections: Array<{ heading: string; body: string }>;
}

export interface LamPluginExplainerData {
  concept: string;
  intuition: string;
  definition: string;
  derivation?: string;
  workedExample?: string;
  mistakes: string[];
}

export interface LamPluginCompanionData {
  title: string;
  metrics?: Array<{ label: string; value: string }>;
  markdown: string;
  suggestedFocusMinutes?: number;
  canReadAloud?: boolean;
}

export interface LamPluginUserInteraction {
  quizPicks?: Record<number, string>;
  quizSaved?: boolean;
  savedCardIndices?: number[];
  knownCardIndices?: number[];
  addedTaskIndices?: number[];
  allTasksAdded?: boolean;
  revealedSolutions?: Record<number, boolean>;
  homeworkSolutionRevealed?: boolean;
  savedToResources?: boolean;
  savedToFiles?: boolean;
  savedToNotes?: boolean;
  slideshowSavedId?: string;
}

export type LamPluginExecutionStatus =
  | "idle"
  | "queued"
  | "preparing"
  | "running"
  | "generating"
  | "waiting_input"
  | "ready"
  | "completed"
  | "failed"
  | "cancelled"
  | "locked";

export type LamPluginOutputType =
  | "quiz"
  | "ncert-set"
  | "flashcards"
  | "slideshow"
  | "formula-sheet"
  | "pdf"
  | "explainer"
  | "image"
  | "homework"
  | "evaluator"
  | "planner"
  | "flowchart"
  | "analytics"
  | "pyq"
  | "companion"
  | "generic";

export interface LamPluginExecution {
  executionId?: string;
  pluginId: string;
  pluginName: string;
  category?: string;
  rawPrompt?: string;
  scholarClass?: 9 | 11;
  isPlus?: boolean;
  status: LamPluginExecutionStatus;
  progressStage?: string;
  currentStep?: number;
  totalSteps?: number;
  error?: string;
  errorCode?: string;
  startedAt?: string;
  completedAt?: string;
  waitingInputPrompt?: string;
  waitingInputSuggestions?: string[];
  requiresImage?: boolean;
  attachmentNames?: string[];
  outputType: LamPluginOutputType;
  quiz?: LamPluginQuizQuestion[];
  ncertData?: LamPluginNcertSetData;
  flashcards?: LamPluginFlashcard[];
  slides?: LamPluginSlide[];
  slideshowData?: LamPluginSlideshowData;
  formulas?: LamPluginFormula[];
  pdfData?: LamPluginPdfData;
  explainerData?: LamPluginExplainerData;
  imageData?: LamPluginImageData;
  homeworkData?: LamPluginHomeworkData;
  evaluatorData?: LamPluginEvaluatorData;
  plannerData?: LamPluginPlannerData;
  flowchartData?: LamPluginFlowchartData;
  analyticsData?: LamPluginAnalyticsData;
  pyqData?: LamPluginPyqData;
  companionData?: LamPluginCompanionData;
  userInteraction?: LamPluginUserInteraction;
}

export interface LamMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  inputMode?: "text" | "voice";
  createdAt: string;
  sources?: Array<{ label: string; route?: string }>;
  pluginExecution?: LamPluginExecution;
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
  personalizationStamp?: string;
  assistantEnabled: boolean;
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
  currentScreenContext: boolean;
  studyHistoryEnabled: boolean;
  quizHistoryEnabled: boolean;
  saveConversations: boolean;
  voiceInputEnabled: boolean;
  animationIntensity: "minimal" | "balanced" | "expressive";
  responseDetail: "quick" | "balanced" | "detailed" | "step-by-step";
  keyboardShortcut: "ctrl-space" | "alt-space" | "ctrl-shift-l";
  voiceLanguage: "en-IN" | "en-US" | "en-GB";
  liveTutorPersonality: "calm" | "exam" | "curious";
  liveTutorProvider: "auto" | "groq" | "gemini" | "nvidia";
  liveTutorMode: "tutor" | "examiner" | "rapid-revision" | "mission";
  liveTutorAutoSpeak: boolean;
  liveTutorCaptions: boolean;
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
  assistantEnabled: true,
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
  currentScreenContext: true,
  studyHistoryEnabled: true,
  quizHistoryEnabled: true,
  saveConversations: true,
  voiceInputEnabled: true,
  animationIntensity: "balanced",
  responseDetail: "balanced",
  keyboardShortcut: "ctrl-space",
  voiceLanguage: "en-GB",
  liveTutorPersonality: "calm",
  liveTutorProvider: "auto",
  liveTutorMode: "tutor",
  liveTutorAutoSpeak: true,
  liveTutorCaptions: true,
};
