import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

export type ScholarNavGroup = "Learn" | "Revise" | "Extra" | "More";
export type ScholarNavItem = {
  id: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  group: ScholarNavGroup;
  badge?: "NEW" | "PLUS";
  route?: string;
};

export const SCHOLAR_NAV_GROUPS: ScholarNavGroup[] = ["Learn", "Revise", "Extra", "More"];

export const SCHOLAR_NAV_ITEMS: ScholarNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid-outline", group: "Learn", route: "/(tabs)/home" },
  { id: "intelligence", label: "Scholar Intelligence", icon: "analytics-outline", group: "Learn", badge: "NEW" },
  { id: "chapter-command", label: "Chapter Command Center", icon: "apps-outline", group: "Learn", badge: "NEW" },
  { id: "nigtube", label: "NIGTUBE", icon: "play-circle-outline", group: "Learn", badge: "NEW" },
  { id: "levels", label: "Levels", icon: "trophy-outline", group: "Learn", badge: "PLUS" },
  { id: "lab", label: "Experiment Lab", icon: "flask-outline", group: "Learn", badge: "NEW" },
  { id: "ai-tutor", label: "AI Tutor", icon: "sparkles-outline", group: "Learn", route: "/(tabs)/lam" },
  { id: "ai-tools", label: "AI Tools", icon: "bulb-outline", group: "Learn" },
  { id: "notes", label: "Notes", icon: "document-text-outline", group: "Learn", route: "/(tabs)/library" },
  { id: "resources", label: "Resources", icon: "folder-open-outline", group: "Learn", route: "/(tabs)/library" },
  { id: "study", label: "Study", icon: "school-outline", group: "Learn", route: "/(tabs)/study" },
  { id: "ebook", label: "E-Book", icon: "book-outline", group: "Learn", badge: "NEW" },
  { id: "practice", label: "Question Practice", icon: "checkbox-outline", group: "Learn", badge: "NEW" },
  { id: "flashcards", label: "Flashcards", icon: "layers-outline", group: "Revise" },
  { id: "quiz", label: "Quiz", icon: "help-circle-outline", group: "Revise" },
  { id: "exam-prep", label: "Exam Prep", icon: "create-outline", group: "Revise", badge: "PLUS" },
  { id: "planner", label: "Planner", icon: "calendar-outline", group: "Revise" },
  { id: "focus", label: "Focus", icon: "timer-outline", group: "Revise" },
  { id: "music", label: "Study Music", icon: "musical-notes-outline", group: "Revise", badge: "NEW" },
  { id: "past-papers", label: "Past Papers", icon: "documents-outline", group: "Extra", badge: "NEW" },
  { id: "answer-lab", label: "Answer Lab", icon: "pencil-outline", group: "Extra", badge: "NEW" },
  { id: "revision-hub", label: "Revision Hub", icon: "refresh-outline", group: "Extra", badge: "NEW" },
  { id: "mock-exam", label: "Mock Exam", icon: "clipboard-outline", group: "Extra", badge: "NEW" },
  { id: "goal-center", label: "Goal Center", icon: "flag-outline", group: "Extra", badge: "NEW" },
  { id: "reminders", label: "Smart Reminders", icon: "notifications-outline", group: "Extra", badge: "NEW" },
  { id: "doubt-history", label: "Doubt History", icon: "time-outline", group: "Extra", badge: "NEW" },
  { id: "downloads", label: "Downloads", icon: "download-outline", group: "Extra", badge: "NEW" },
  { id: "assignments", label: "Assignments", icon: "list-outline", group: "Extra", badge: "PLUS" },
  { id: "workspace", label: "Study Workspace", icon: "albums-outline", group: "Extra", badge: "NEW" },
  { id: "canvas", label: "Canvas", icon: "brush-outline", group: "Extra" },
  { id: "toolbox", label: "Toolbox", icon: "construct-outline", group: "Extra" },
  { id: "practicals", label: "Practical Lab", icon: "beaker-outline", group: "Extra", badge: "PLUS" },
  { id: "python", label: "Python Workspace", icon: "code-slash-outline", group: "Extra", badge: "PLUS" },
  { id: "derivations", label: "Derivation Library", icon: "bookmarks-outline", group: "Extra", badge: "PLUS" },
  { id: "analytics", label: "Analytics", icon: "bar-chart-outline", group: "More" },
  { id: "achievements", label: "Achievements", icon: "medal-outline", group: "More", badge: "PLUS" },
  { id: "mindmap", label: "Mind Map", icon: "git-network-outline", group: "More", badge: "PLUS" },
  { id: "galaxy", label: "Concept Galaxy", icon: "planet-outline", group: "More", badge: "PLUS" },
  { id: "formulas", label: "Formula Explorer", icon: "calculator-outline", group: "More", badge: "PLUS" },
  { id: "community", label: "Community", icon: "people-outline", group: "More" },
  { id: "friends", label: "Friends", icon: "person-add-outline", group: "More" },
  { id: "store", label: "Store", icon: "cart-outline", group: "More" },
  { id: "files", label: "Files", icon: "folder-outline", group: "More" },
  { id: "settings", label: "Settings", icon: "settings-outline", group: "More", route: "/(tabs)/profile" },
];

export function routeForScholarItem(item: ScholarNavItem): string {
  return item.route ?? `/feature/${item.id}`;
}
