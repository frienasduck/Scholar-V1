// Client and server agree on the existing single-segment workspace routes.
export const SCHOLAR_ROUTES = [
  // Canonical merged destinations.
  "question-practice", "doubt-lab", "experiment-lab", "study-media", "lam-ai", "resources",
  "dashboard", "chapter-command", "notes", "flashcards", "planner", "focus", "analytics",
  "achievements", "community", "group-study", "files", "store", "exam-prep", "mindmap",
  "galaxy", "formulas", "study", "ebook", "settings", "friends", "levels", "revision-hub",
  "mock-exam", "goal-center", "reminders", "assignments", "workspace", "canvas", "toolbox",
  "python", "derivations", "plus", "subscription-payment",
  // Legacy single-segment URLs remain valid and render the merged workspace.
  "intelligence", "ai-tutor", "live-tutor", "ai-tools", "quiz", "practice", "nigtube",
  "lamtube", "lab", "past-papers", "answer-lab", "doubt-history", "downloads", "music",
  "practicals",
] as const;
export function isScholarRoute(path: string[]): boolean {
  return path.length === 1 && (SCHOLAR_ROUTES as readonly string[]).includes(path[0]);
}
