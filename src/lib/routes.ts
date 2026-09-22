// Client and server agree on the existing single-segment workspace routes.
export const SCHOLAR_ROUTES = [
  "dashboard", "intelligence", "chapter-command", "ai-tutor", "live-tutor", "ai-tools", "notes",
  "flashcards", "quiz", "planner", "focus", "resources", "analytics", "achievements",
  "community", "group-study", "files", "store", "exam-prep", "mindmap", "galaxy", "formulas", "study",
  "ebook", "practice", "settings", "friends", "nigtube", "lab", "levels", "past-papers",
  "answer-lab", "revision-hub", "mock-exam", "goal-center", "reminders", "doubt-history",
  "downloads", "assignments", "workspace", "music", "canvas", "toolbox", "practicals",
  "python", "derivations", "plus", "subscription-payment",
] as const;
export function isScholarRoute(path: string[]): boolean {
  return path.length === 1 && (SCHOLAR_ROUTES as readonly string[]).includes(path[0]);
}
