import {
  LayoutDashboard, NotebookPen, Layers, CalendarDays, Timer,
  BookOpen, BarChart3, Trophy, Users, FolderOpen, ShoppingCart, GraduationCap,
  PenLine, Sigma, Settings as SettingsIcon, UserPlus, PlayCircle,
  FlaskConical, Pencil, Wrench,
  RefreshCw, ClipboardCheck, Flag, BellRing,
  ClipboardList, LayoutGrid, Code2, BookMarked,
  ListChecks, Network, Orbit, BrainCircuit, MessagesSquare, type LucideIcon,
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

/**
 * Primary navigation only lists the merged destinations. Legacy ids still
 * resolve through src/lib/shrinking-scholar.ts for old links and saved state.
 */
export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Learn" },
  { id: "group-study", label: "Group Study", icon: Users, group: "Learn", badge: "BETA" },
  { id: "chapter-command", label: "Chapter Command Center", icon: LayoutGrid, group: "Learn" },
  { id: "study-media", label: "Study Media", icon: PlayCircle, group: "Learn" },
  { id: "levels", label: "Levels", icon: Trophy, group: "Learn" },
  { id: "experiment-lab", label: "Experiment Lab", icon: FlaskConical, group: "Learn" },
  { id: "lam-ai", label: "LAM AI", icon: BrainCircuit, group: "Learn" },
  { id: "notes", label: "Notes", icon: NotebookPen, group: "Learn" },
  { id: "resources", label: "Resources", icon: BookOpen, group: "Learn" },
  { id: "study", label: "Study", icon: GraduationCap, group: "Learn" },
  { id: "ebook", label: "E-Book", icon: BookOpen, group: "Learn" },
  { id: "question-practice", label: "Question Practice", icon: ListChecks, group: "Learn" },
  { id: "doubt-lab", label: "Doubt Lab", icon: MessagesSquare, group: "Learn" },

  { id: "flashcards", label: "Flashcards", icon: Layers, group: "Revise" },
  { id: "exam-prep", label: "Scholar Exam Ready", icon: PenLine, group: "Revise", badge: "EARLY BETA" },
  { id: "planner", label: "Planner", icon: CalendarDays, group: "Revise" },
  { id: "focus", label: "Focus", icon: Timer, group: "Revise" },

  { id: "revision-hub", label: "Revision Hub", icon: RefreshCw, group: "Extra" },
  { id: "mock-exam", label: "Mock Exam", icon: ClipboardCheck, group: "Extra" },
  { id: "goal-center", label: "Goal Center", icon: Flag, group: "Extra" },
  { id: "reminders", label: "Smart Reminders", icon: BellRing, group: "Extra" },
  { id: "assignments", label: "Assignments", icon: ClipboardList, group: "Extra" },
  { id: "workspace", label: "Study Workspace", icon: LayoutGrid, group: "Extra" },
  { id: "canvas", label: "Canvas", icon: Pencil, group: "Extra", badge: "EARLY BETA" },
  { id: "toolbox", label: "Toolbox", icon: Wrench, group: "Extra" },
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
