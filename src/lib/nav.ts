import {
  LayoutDashboard, Sparkles, NotebookPen, Layers, FileQuestion, CalendarDays, Timer,
  BookOpen, BarChart3, Trophy, Users, FolderOpen, ShoppingCart, GraduationCap,
  PenLine, Sigma, Lightbulb, Settings as SettingsIcon, UserPlus, Lock, PlayCircle,
  FlaskConical, Music, Pencil, Wrench,
  FileStack, PenTool, RefreshCw, ClipboardCheck, Flag, BellRing, History,
  Download, ClipboardList, LayoutGrid, FlaskRound, Code2, BookMarked, Calculator,
  ListChecks, Network, Orbit, BrainCircuit, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  group: "Learn" | "Revise" | "More" | "Extra";
  badge?: string;
  comingSoon?: boolean;
  /** Incomplete product previews are discoverable only in Developer Mode. */
  preview?: boolean;
  /** Scholar Plus benefit — clicking opens Scholar Plus instead of the view. */
  plus?: boolean;
  highlight?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Learn" },
  { id: "intelligence", label: "Scholar Intelligence", icon: BrainCircuit, group: "Learn" },
  { id: "chapter-command", label: "Chapter Command Center", icon: LayoutGrid, group: "Learn" },
  { id: "nigtube", label: "NIGTUBE", icon: PlayCircle, group: "Learn" },
  { id: "levels", label: "Levels", icon: Trophy, group: "Learn" },
  { id: "lab", label: "Experiment Lab", icon: FlaskConical, group: "Learn" },
  { id: "ai-tutor", label: "AI Tutor", icon: Sparkles, group: "Learn" },
  { id: "ai-tools", label: "AI Tools", icon: Lightbulb, group: "Learn" },
  { id: "notes", label: "Notes", icon: NotebookPen, group: "Learn" },
  { id: "resources", label: "Resources", icon: BookOpen, group: "Learn" },
  { id: "study", label: "Study", icon: GraduationCap, group: "Learn" },
  { id: "ebook", label: "E-Book", icon: BookOpen, group: "Learn" },
  { id: "practice", label: "Question Practice", icon: ListChecks, group: "Learn" },

  { id: "flashcards", label: "Flashcards", icon: Layers, group: "Revise" },
  { id: "quiz", label: "Quiz", icon: FileQuestion, group: "Revise" },
  { id: "exam-prep", label: "Exam Prep", icon: PenLine, group: "Revise" },
  { id: "planner", label: "Planner", icon: CalendarDays, group: "Revise" },
  { id: "focus", label: "Focus", icon: Timer, group: "Revise" },
  { id: "music", label: "Study Music", icon: Music, group: "Revise" },

  { id: "past-papers", label: "Past Papers", icon: FileStack, group: "Extra" },
  { id: "answer-lab", label: "Answer Lab", icon: PenTool, group: "Extra" },
  { id: "revision-hub", label: "Revision Hub", icon: RefreshCw, group: "Extra" },
  { id: "mock-exam", label: "Mock Exam", icon: ClipboardCheck, group: "Extra" },
  { id: "goal-center", label: "Goal Center", icon: Flag, group: "Extra" },
  { id: "reminders", label: "Smart Reminders", icon: BellRing, group: "Extra" },
  { id: "doubt-history", label: "Doubt History", icon: History, group: "Extra" },
  { id: "downloads", label: "Downloads", icon: Download, group: "Extra" },
  { id: "assignments", label: "Assignments", icon: ClipboardList, group: "Extra" },
  { id: "workspace", label: "Study Workspace", icon: LayoutGrid, group: "Extra" },
  { id: "canvas", label: "Canvas", icon: Pencil, group: "Extra" },
  { id: "toolbox", label: "Toolbox", icon: Wrench, group: "Extra" },
  { id: "practicals", label: "Practical Lab", icon: FlaskRound, group: "Extra" },
  { id: "python", label: "Python Workspace", icon: Code2, group: "Extra" },
  { id: "derivations", label: "Derivation Library", icon: BookMarked, group: "Extra" },

  { id: "analytics", label: "Analytics", icon: BarChart3, group: "More" },
  { id: "achievements", preview: true, label: "Achievements", icon: Trophy, group: "More", plus: true },
  { id: "mindmap", preview: true, label: "Mind Map", icon: Network, group: "More", plus: true },
  { id: "galaxy", preview: true, label: "Concept Galaxy", icon: Orbit, group: "More", plus: true },
  { id: "formulas", label: "Formula Explorer", icon: Sigma, group: "More" },
  { id: "community", preview: true, label: "Community", icon: Users, group: "More" },
  { id: "friends", preview: true, label: "Friends", icon: UserPlus, group: "More" },
  { id: "store", preview: true, label: "Store", icon: ShoppingCart, group: "More" },
  { id: "files", label: "Files", icon: FolderOpen, group: "More" },
  { id: "settings", label: "Settings", icon: SettingsIcon, group: "More" },
];

export const NAV_GROUPS: NavItem["group"][] = ["Learn", "Revise", "Extra", "More"];
