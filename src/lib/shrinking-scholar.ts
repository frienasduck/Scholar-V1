/**
 * Project Shrinking Scholar — one canonical destination registry.
 *
 * The app used to expose several near-duplicate destinations. This module is
 * the single source of truth for:
 *   • canonical workspace ids and their modes,
 *   • legacy route/search aliases (old URLs keep working),
 *   • deep-link targets for the merged workspaces,
 *   • search labels that always show destination + mode.
 */

export type ScholarWorkspaceId =
  | "question-practice"
  | "doubt-lab"
  | "experiment-lab"
  | "study-media"
  | "lam-ai"
  | "resources";

export interface WorkspaceMode {
  id: string;
  label: string;
  description: string;
  legacyIds: string[];
  keywords: string[];
}

export interface ScholarWorkspace {
  id: ScholarWorkspaceId;
  label: string;
  tagline: string;
  defaultMode: string;
  modes: WorkspaceMode[];
  keywords: string[];
}

export const SCHOLAR_WORKSPACES: Record<ScholarWorkspaceId, ScholarWorkspace> = {
  "question-practice": {
    id: "question-practice",
    label: "Question Practice",
    tagline: "Practice, quizzes and past papers in one place.",
    defaultMode: "practice",
    keywords: ["question practice", "practice", "questions", "quiz", "quizzes", "past papers", "pyq", "previous year", "question bank", "mcq", "test"],
    modes: [
      { id: "practice", label: "Practice", description: "Chapter-wise questions with worked feedback.", legacyIds: ["practice"], keywords: ["practice", "chapter questions", "solve", "question practice"] },
      { id: "quiz", label: "Quizzes", description: "Timed chapter quizzes and mistake review.", legacyIds: ["quiz"], keywords: ["quiz", "quizzes", "mcq", "test", "timed test"] },
      { id: "past-papers", label: "Past Papers", description: "Previous-year questions, timed practice and the mistake tracker.", legacyIds: ["past-papers"], keywords: ["past papers", "pyq", "previous year questions", "question bank", "sample paper", "board paper"] },
    ],
  },
  "doubt-lab": {
    id: "doubt-lab",
    label: "Doubt Lab",
    tagline: "Every doubt you have asked, and every answer you want to write.",
    defaultMode: "history",
    keywords: ["doubt lab", "doubts", "my doubts", "doubt history", "answer lab", "solve a doubt"],
    modes: [
      { id: "history", label: "My Doubts", description: "A searchable index of doubts from AI, community and your own notes.", legacyIds: ["doubt-history"], keywords: ["doubt history", "my doubts", "doubts", "questions", "doubt lab"] },
      { id: "solve", label: "Solve a Doubt", description: "Write a full answer and get rubric-based feedback.", legacyIds: ["answer-lab"], keywords: ["answer lab", "solve a doubt", "write answer", "descriptive answer", "evaluation", "marks"] },
    ],
  },
  "experiment-lab": {
    id: "experiment-lab",
    label: "Experiment Lab",
    tagline: "Interactive experiments and complete practical records.",
    defaultMode: "experiments",
    keywords: ["experiment lab", "experiments", "practical lab", "experimental lab", "experimental lab plus", "lab", "practicals"],
    modes: [
      { id: "experiments", label: "Experiments", description: "Interactive simulations and guided lab exploration.", legacyIds: ["lab"], keywords: ["experiment", "experiments", "simulation", "lab", "interactive lab"] },
      { id: "practicals", label: "Practicals", description: "CBSE practical procedures, viva prep and lab records.", legacyIds: ["practicals"], keywords: ["practical lab", "practicals", "experimental lab", "experimental lab plus", "viva", "lab record"] },
    ],
  },
  "study-media": {
    id: "study-media",
    label: "Study Media",
    tagline: "LAMTube and Study Music, together while both services are paused.",
    defaultMode: "lamtube",
    keywords: ["study media", "lamtube", "study music", "videos", "music", "media"],
    modes: [
      { id: "lamtube", label: "LAMTube", description: "Video study sessions. Temporarily paused for licensing.", legacyIds: ["nigtube", "lamtube"], keywords: ["lamtube", "videos", "video", "lectures"] },
      { id: "music", label: "Study Music", description: "Study soundtracks and ambience. Temporarily paused for licensing.", legacyIds: ["music"], keywords: ["study music", "music", "soundtrack", "ambience"] },
    ],
  },
  "lam-ai": {
    id: "lam-ai",
    label: "LAM AI",
    tagline: "One assistant for chat, tutoring and real Scholar plugins.",
    defaultMode: "chat",
    keywords: ["lam ai", "lam", "ai tutor", "ai tools", "assistant", "plugins", "tutor", "chat"],
    modes: [
      { id: "chat", label: "Chat", description: "Live conversation with memory, voice and your study context.", legacyIds: ["live-tutor"], keywords: ["lam ai", "live tutor", "chat", "assistant"] },
      { id: "tutor", label: "Tutor", description: "Choose a teacher persona and work through a topic.", legacyIds: ["ai-tutor"], keywords: ["ai tutor", "tutor", "teacher", "persona", "explain"] },
      { id: "plugins", label: "Plugins", description: "Run the real Scholar AI tools from one plugin workspace.", legacyIds: ["ai-tools"], keywords: ["ai tools", "plugins", "plugin", "tools", "pdf studio", "homework scanner", "slideshow"] },
    ],
  },
  resources: {
    id: "resources",
    label: "Resources",
    tagline: "Your resource library and offline downloads.",
    defaultMode: "library",
    keywords: ["resources", "library", "downloads", "my downloads", "saved files"],
    modes: [
      { id: "library", label: "Library", description: "Curated books, notes, papers and websites.", legacyIds: [], keywords: ["library", "resources", "books", "notes"] },
      { id: "downloads", label: "Downloads", description: "Files saved for offline study.", legacyIds: ["downloads"], keywords: ["downloads", "my downloads", "saved files", "offline"] },
    ],
  },
};

/** Old view ids → canonical view + mode. */
export const LEGACY_VIEW_MAP: Record<string, { viewId: string; mode?: string; settingsCategory?: string }> = {
  practice: { viewId: "question-practice", mode: "practice" },
  quiz: { viewId: "question-practice", mode: "quiz" },
  "past-papers": { viewId: "question-practice", mode: "past-papers" },
  "answer-lab": { viewId: "doubt-lab", mode: "solve" },
  "doubt-history": { viewId: "doubt-lab", mode: "history" },
  lab: { viewId: "experiment-lab", mode: "experiments" },
  practicals: { viewId: "experiment-lab", mode: "practicals" },
  nigtube: { viewId: "study-media", mode: "lamtube" },
  lamtube: { viewId: "study-media", mode: "lamtube" },
  music: { viewId: "study-media", mode: "music" },
  "live-tutor": { viewId: "lam-ai", mode: "chat" },
  "ai-tutor": { viewId: "lam-ai", mode: "tutor" },
  "ai-tools": { viewId: "lam-ai", mode: "plugins" },
  downloads: { viewId: "resources", mode: "downloads" },
  intelligence: { viewId: "settings", settingsCategory: "intelligence" },
};

export interface ResolvedScholarView {
  viewId: string;
  mode?: string;
  settingsCategory?: string;
  legacy: boolean;
}

export function isWorkspaceId(value: string): value is ScholarWorkspaceId {
  return Object.hasOwn(SCHOLAR_WORKSPACES, value);
}

/** Resolve canonical view ids and legacy aliases to one destination. */
export function resolveScholarView(viewId: string): ResolvedScholarView {
  const legacy = LEGACY_VIEW_MAP[viewId];
  if (legacy) return { ...legacy, legacy: true };
  if (isWorkspaceId(viewId)) return { viewId, legacy: false };
  return { viewId, legacy: false };
}

/** Tool names used by older deep links map onto real plugin ids. */
const LEGACY_TOOL_ALIASES: Record<string, string> = {
  slideshow: "slideshow-maker",
  "slideshow-generator": "slideshow-maker",
  pdf: "ai-pdf-studio",
  "pdf-studio": "ai-pdf-studio",
  "pdf-generator": "ai-pdf-studio",
  homework: "homework-scanner",
  scanner: "homework-scanner",
  "image-analysis": "homework-scanner",
  aisig: "aisig",
  "study-planner": "revision-planner",
  "document-summarizer": "chapter-summarizer",
};

export function resolvePluginId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return LEGACY_TOOL_ALIASES[value] ?? value;
}

export interface ScholarDestinationInput {
  viewId: string;
  mode?: string;
  settingsCategory?: string;
  pluginId?: string;
  prompt?: string;
}

export interface ScholarDestination extends ScholarDestinationInput {
  viewId: string;
  legacy: boolean;
}

/**
 * One destination resolver shared by navigation, popstate and search.
 * Plugin deep links imply the Plugins mode; Settings deep links imply the
 * Settings category hash.
 */
export function resolveScholarDestination(input: ScholarDestinationInput): ScholarDestination {
  const resolved = resolveScholarView(input.viewId);
  let viewId = resolved.viewId;
  let mode = input.mode ?? resolved.mode;
  let settingsCategory = input.settingsCategory ?? resolved.settingsCategory;
  const pluginId = resolvePluginId(input.pluginId);
  if (pluginId && viewId === "lam-ai") mode = "plugins";
  if (viewId === "settings" && !settingsCategory) settingsCategory = "account";
  if (mode && !isWorkspaceMode(viewId, mode)) mode = undefined;
  return { viewId, mode, settingsCategory, pluginId, prompt: input.prompt, legacy: resolved.legacy };
}

/** Default route for a destination. Legacy ids always resolve to the merged URL. */
export function pathForDestination(destination: { viewId: string; settingsCategory?: string }): string {
  if (destination.viewId === "dashboard") return "/";
  if (destination.viewId === "settings") return `/settings${destination.settingsCategory ? `#${destination.settingsCategory}` : ""}`;
  return `/${destination.viewId}`;
}

export function workspaceForView(viewId: string): ScholarWorkspace | null {
  return isWorkspaceId(viewId) ? SCHOLAR_WORKSPACES[viewId] : null;
}

export function isWorkspaceMode(viewId: string, mode: string | undefined): mode is string {
  if (!mode) return false;
  return Boolean(workspaceForView(viewId)?.modes.some((item) => item.id === mode));
}

export function modeLabel(viewId: string, mode?: string): string | null {
  const workspace = workspaceForView(viewId);
  if (!workspace) return null;
  return workspace.modes.find((item) => item.id === mode)?.label ?? null;
}

export function destinationDetail(viewId: string, mode?: string): string {
  if (viewId === "settings") return "Settings · Scholar Intelligence";
  const workspace = workspaceForView(viewId);
  if (!workspace) return "Scholar section";
  const label = modeLabel(viewId, mode);
  return label ? `${workspace.label} · ${label}` : workspace.label;
}

const WORKSPACE_MODE_PREFIX = "scholar:workspace-mode:";
const SETTINGS_TARGET_KEY = "scholar:settings:target";
const LAM_PLUGIN_TARGET_KEY = "scholar:lam-ai:plugin-target";
export const WORKSPACE_MODE_EVENT = "scholar:workspace-mode-change";

export function setWorkspaceMode(viewId: string, mode?: string): void {
  if (typeof window === "undefined" || !mode) return;
  try {
    sessionStorage.setItem(`${WORKSPACE_MODE_PREFIX}${viewId}`, mode);
  } catch { /* session storage can be unavailable */ }
  window.dispatchEvent(new CustomEvent(WORKSPACE_MODE_EVENT, { detail: { viewId, mode } }));
}

/** Read a deep-linked mode exactly once so normal navigation can default. */
export function consumeWorkspaceMode(viewId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const key = `${WORKSPACE_MODE_PREFIX}${viewId}`;
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value ?? undefined;
  } catch {
    return undefined;
  }
}

export function peekWorkspaceMode(viewId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return sessionStorage.getItem(`${WORKSPACE_MODE_PREFIX}${viewId}`) ?? undefined;
  } catch {
    return undefined;
  }
}

export const SETTINGS_TARGET_EVENT = "scholar:settings-target";

export function setSettingsTarget(category: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SETTINGS_TARGET_KEY, category);
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(SETTINGS_TARGET_EVENT, { detail: { category } }));
}

export function consumeSettingsTarget(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(SETTINGS_TARGET_KEY);
    sessionStorage.removeItem(SETTINGS_TARGET_KEY);
    return value;
  } catch {
    return null;
  }
}

export function peekSettingsTarget(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SETTINGS_TARGET_KEY);
  } catch {
    return null;
  }
}

export const LAM_PLUGIN_TARGET_EVENT = "scholar:lam-ai:plugin-target";

export function setLamPluginTarget(pluginId: string, prompt?: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LAM_PLUGIN_TARGET_KEY, JSON.stringify({ pluginId, prompt: prompt ?? "" }));
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(LAM_PLUGIN_TARGET_EVENT, { detail: { pluginId, prompt: prompt ?? "" } }));
}

export function peekLamPluginTarget(): { pluginId: string; prompt: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LAM_PLUGIN_TARGET_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { pluginId?: unknown; prompt?: unknown };
    if (typeof value?.pluginId !== "string") return null;
    return { pluginId: value.pluginId, prompt: typeof value.prompt === "string" ? value.prompt : "" };
  } catch {
    return null;
  }
}

export function consumeLamPluginTarget(): { pluginId: string; prompt: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const value = peekLamPluginTarget();
    sessionStorage.removeItem(LAM_PLUGIN_TARGET_KEY);
    return value;
  } catch {
    return null;
  }
}

export interface ScholarSearchAlias {
  id: string;
  label: string;
  detail: string;
  viewId: string;
  mode?: string;
  settingsCategory?: string;
  pluginId?: string;
  keywords: string[];
}

const PLUGIN_ALIASES: Array<{ id: string; label: string; keywords: string[] }> = [
  { id: "ai-pdf-studio", label: "PDF Generator", keywords: ["pdf", "pdf generator", "ai pdf studio", "document", "study pdf", "notes pdf"] },
  { id: "mistake-analyzer", label: "Mistake Analyzer", keywords: ["mistake", "wrong answer", "error analysis"] },
  { id: "memory-predictor", label: "Memory Predictor", keywords: ["memory", "forgetting", "retention", "revision"] },
  { id: "academic-coach", label: "Academic Coach", keywords: ["coach", "improvement", "plan", "academic"] },
  { id: "one-night-exam", label: "One-Night Exam Prep", keywords: ["one night exam prep", "one-night exam mode", "exam tomorrow", "cram", "one night", "exam mode", "last minute revision"] },
  { id: "homework-scanner", label: "Image Analysis", keywords: ["image analysis", "homework scanner", "homework", "scanner", "homework scan"] },
  { id: "daily-briefing", label: "Daily Briefing", keywords: ["daily briefing", "morning", "brief"] },
  { id: "chapter-builder", label: "Chapter Builder", keywords: ["chapter builder", "study unit", "chapter notes"] },
  { id: "life-saver", label: "Life Saver Button", keywords: ["panic", "life saver", "overwhelmed"] },
  { id: "study-companion", label: "Study Companion", keywords: ["companion", "friendly chat", "study buddy"] },
  { id: "aisig", label: "AISIG", keywords: ["aisig", "study image", "image generator"] },
  { id: "slideshow-maker", label: "Slideshow Generator", keywords: ["slideshow", "slideshow generator", "ai slideshow maker", "presentation", "slides", "deck"] },
  { id: "concept-explainer", label: "Concept Explainer", keywords: ["concept explainer", "explain concept", "intuition"] },
  { id: "chapter-summarizer", label: "Chapter Summarizer", keywords: ["chapter summarizer", "document summarizer", "chapter summary", "summarise"] },
  { id: "flashcard-maker", label: "Flashcard Maker", keywords: ["flashcard maker", "card generator", "make flashcards"] },
  { id: "formula-sheet-generator", label: "Formula Sheet Generator", keywords: ["formula sheet", "formula sheet generator", "equation sheet"] },
  { id: "notes-to-quiz", label: "Notes-to-Quiz", keywords: ["notes to quiz", "notes-to-quiz", "quiz from notes"] },
  { id: "answer-evaluator", label: "Answer Evaluator", keywords: ["answer evaluator", "evaluate answer", "rubric grading"] },
  { id: "revision-planner", label: "Revision & Study Planner", keywords: ["revision planner", "study planner", "revision schedule"] },
  { id: "diagram-flowchart-builder", label: "Diagram & Flowchart Builder", keywords: ["diagram builder", "flowchart builder", "diagram and flowchart builder"] },
  { id: "pyq-solver", label: "PYQ Solver", keywords: ["pyq solver", "previous year question solver", "solve pyq"] },
  { id: "ncert-question-generator", label: "NCERT Question Generator", keywords: ["ncert question generator", "ncert questions", "exemplar generator"] },
  { id: "mistake-pattern-tracker", label: "Mistake Pattern Tracker", keywords: ["mistake pattern tracker", "pattern tracker", "error patterns"] },
];

function modeAlias(
  workspaceId: ScholarWorkspaceId,
  modeId: string,
  extra: Array<{ label: string; keywords: string[] }> = [],
): ScholarSearchAlias[] {
  const workspace = SCHOLAR_WORKSPACES[workspaceId];
  const mode = workspace.modes.find((item) => item.id === modeId);
  if (!mode) return [];
  const base: ScholarSearchAlias = {
    id: `${workspaceId}:${mode.id}`,
    label: mode.label,
    detail: destinationDetail(workspaceId, mode.id),
    viewId: workspaceId,
    mode: mode.id,
    keywords: [mode.label, ...mode.keywords, ...workspace.keywords],
  };
  return [
    base,
    ...extra.map((alias) => ({
      ...base,
      id: `${workspaceId}:${mode.id}:${alias.label}`,
      label: alias.label,
      keywords: [...base.keywords, ...alias.keywords],
    })),
  ];
}

/**
 * Search aliases preserve the old product language while always pointing at a
 * single merged destination. Display labels keep the mode visible.
 */
export const SCHOLAR_SEARCH_ALIASES: ScholarSearchAlias[] = [
  ...modeAlias("question-practice", "practice", [
    { label: "Practice Questions", keywords: ["practice questions"] },
    { label: "Question Practice", keywords: ["question practice"] },
  ]),
  ...modeAlias("question-practice", "quiz", [
    { label: "Quiz", keywords: ["quiz"] },
    { label: "Quizzes", keywords: ["quizzes"] },
  ]),
  ...modeAlias("question-practice", "past-papers", [
    { label: "Past Papers", keywords: ["past papers"] },
    { label: "PYQ", keywords: ["pyq"] },
    { label: "Previous Year Questions", keywords: ["previous year questions"] },
    { label: "Question Bank", keywords: ["question bank"] },
  ]),
  ...modeAlias("doubt-lab", "history", [
    { label: "Doubt History", keywords: ["doubt history"] },
    { label: "Doubt Lab", keywords: ["doubt lab"] },
    { label: "My Doubts", keywords: ["my doubts"] },
  ]),
  ...modeAlias("doubt-lab", "solve", [
    { label: "Answer Lab", keywords: ["answer lab"] },
    { label: "Solve a Doubt", keywords: ["solve a doubt"] },
    { label: "Write an Answer", keywords: ["write answer"] },
  ]),
  ...modeAlias("experiment-lab", "experiments", [
    { label: "Experiment Lab", keywords: ["experiment lab"] },
    { label: "Lab", keywords: ["lab"] },
  ]),
  ...modeAlias("experiment-lab", "practicals", [
    { label: "Practical Lab", keywords: ["practical lab"] },
    { label: "Experimental Lab", keywords: ["experimental lab"] },
    { label: "Experimental Lab Plus", keywords: ["experimental lab plus"] },
  ]),
  ...modeAlias("study-media", "lamtube", [
    { label: "LAMTube", keywords: ["lamtube"] },
    { label: "Study Media", keywords: ["study media"] },
  ]),
  ...modeAlias("study-media", "music", [
    { label: "Study Music", keywords: ["study music"] },
  ]),
  ...modeAlias("lam-ai", "chat", [
    { label: "LAM AI", keywords: ["lam ai"] },
    { label: "AI Chat", keywords: ["ai chat"] },
  ]),
  ...modeAlias("lam-ai", "tutor", [
    { label: "AI Tutor", keywords: ["ai tutor"] },
  ]),
  ...modeAlias("lam-ai", "plugins", PLUGIN_ALIASES.map((plugin) => ({ label: plugin.label, keywords: plugin.keywords }))),
  ...modeAlias("resources", "library", [
    { label: "Resources", keywords: ["resources"] },
    { label: "Library", keywords: ["library"] },
  ]),
  ...modeAlias("resources", "downloads", [
    { label: "Downloads", keywords: ["downloads"] },
    { label: "My Downloads", keywords: ["my downloads"] },
    { label: "Saved Files", keywords: ["saved files"] },
  ]),
  {
    id: "settings:intelligence",
    label: "Scholar Intelligence",
    detail: "Settings · Scholar Intelligence",
    viewId: "settings",
    settingsCategory: "intelligence",
    keywords: ["scholar intelligence", "personalization", "learning intelligence", "mastery", "weak topics", "revision queue"],
  },
  {
    id: "settings:downloads",
    label: "Download settings",
    detail: "Settings · Downloads",
    viewId: "settings",
    settingsCategory: "downloads",
    keywords: ["download settings", "storage", "offline"],
  },
  {
    id: "settings:root",
    label: "Settings",
    detail: "Scholar settings",
    viewId: "settings",
    keywords: ["settings", "preferences"],
  },
  {
    id: "nav:dashboard",
    label: "Dashboard",
    detail: "Scholar home",
    viewId: "dashboard",
    keywords: ["dashboard", "home"],
  },
  {
    id: "nav:study",
    label: "Study",
    detail: "Study workspace",
    viewId: "study",
    keywords: ["study", "chapters"],
  },
  {
    id: "nav:notebook",
    label: "Notes",
    detail: "Notes",
    viewId: "notes",
    keywords: ["notes", "notebook"],
  },
  {
    id: "nav:flashcards",
    label: "Flashcards",
    detail: "Flashcards",
    viewId: "flashcards",
    keywords: ["flashcards", "cards", "revision"],
  },
  {
    id: "nav:planner",
    label: "Planner",
    detail: "Planner",
    viewId: "planner",
    keywords: ["planner", "tasks", "schedule"],
  },
  {
    id: "nav:focus",
    label: "Focus",
    detail: "Focus timer",
    viewId: "focus",
    keywords: ["focus", "timer", "pomodoro"],
  },
  {
    id: "nav:analytics",
    label: "Analytics",
    detail: "Analytics",
    viewId: "analytics",
    keywords: ["analytics", "progress", "stats"],
  },
];

// Attach plugin ids to plugin aliases so search can deep-open a real tool.
for (const alias of SCHOLAR_SEARCH_ALIASES) {
  if (!alias.viewId.startsWith("lam-ai")) continue;
  const plugin = PLUGIN_ALIASES.find((item) => item.label === alias.label);
  if (plugin) alias.pluginId = plugin.id;
}

export interface SearchAliasMatch extends ScholarSearchAlias {
  score: number;
}

export function searchScholarAliases(query: string, limit = 8): SearchAliasMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches: SearchAliasMatch[] = [];
  const seen = new Set<string>();
  for (const alias of SCHOLAR_SEARCH_ALIASES) {
    const haystack = [alias.label, alias.detail, ...alias.keywords].join(" ").toLowerCase();
    if (!haystack.includes(q)) continue;
    const key = `${alias.viewId}:${alias.mode ?? ""}:${alias.settingsCategory ?? ""}:${alias.pluginId ?? ""}:${alias.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = alias.label.toLowerCase();
    const score = label === q ? 100 : label.startsWith(q) ? 80 : label.includes(q) ? 60 : 40;
    matches.push({ ...alias, score });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}
