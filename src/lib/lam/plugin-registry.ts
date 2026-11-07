import {
  AlertTriangle,
  BookOpen,
  Brain,
  CalendarDays,
  Camera,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Hammer,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  LifeBuoy,
  Lightbulb,
  Presentation,
  Quote,
  Sparkles,
  Sunrise,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * LAM AI plugin registry.
 *
 * This is the single source of truth for the `@` composer selector, the plugin
 * browser and legacy AI Tools deep links. A plugin is only marked "available"
 * when it maps to an existing, real Scholar tool implementation. Ideas without
 * an implementation are marked "planned" and are never clickable or executed.
 */

export type PluginCategory =
  | "Learning"
  | "Practice"
  | "Revision"
  | "Documents"
  | "Productivity"
  | "Advanced";

export type PluginAvailability = "available" | "planned";

export type PluginEntitlement = "aisig" | "homework_scanner";

export interface LamPlugin {
  /** Stable plugin id used by `@`, search and deep links. */
  id: string;
  /** Existing ToolContent adapter. Absent for planned plugins. */
  toolId?: string;
  name: string;
  description: string;
  category: PluginCategory;
  icon: LucideIcon;
  aliases: string[];
  availability: PluginAvailability;
  /** Authoritative gate — the server still enforces the entitlement. */
  entitlement?: PluginEntitlement;
  /** Informational Plus marker for quota-limited tools. */
  plus?: boolean;
  attachments: "none" | "optional" | "required";
  attachmentHint?: string;
}

export const PLUGIN_CATEGORIES: PluginCategory[] = [
  "Learning",
  "Practice",
  "Revision",
  "Documents",
  "Productivity",
  "Advanced",
];

/**
 * Every available entry below has a real ToolContent implementation in
 * src/components/views/ai-tools.tsx or src/components/views/lam-academic-plugins.tsx.
 */
export const LAM_PLUGINS: LamPlugin[] = [
  {
    id: "ai-pdf-studio",
    toolId: "ai-pdf-studio",
    name: "PDF Generator",
    description: "Turn a prompt or your notes into a real, downloadable PDF study document.",
    category: "Documents",
    icon: FileText,
    aliases: ["ai pdf studio", "pdf", "pdf generator", "pdf studio", "study notes pdf", "worksheet pdf", "revision guide pdf"],
    availability: "available",
    attachments: "optional",
    attachmentHint: "Optional: attach text or a PDF to ground the document.",
  },
  {
    id: "mistake-analyzer",
    toolId: "mistake-analyzer",
    name: "Mistake Analyzer",
    description: "Find error patterns, weak concepts and the next practice to try.",
    category: "Practice",
    icon: AlertTriangle,
    aliases: ["mistake", "mistake analyzer", "wrong answers", "error analysis", "mistake analysis"],
    availability: "available",
    attachments: "optional",
    attachmentHint: "Optional: attach your worked answers for a more specific analysis.",
  },
  {
    id: "memory-predictor",
    toolId: "memory-predictor",
    name: "Memory Predictor",
    description: "See which topics are close to being forgotten and when to revisit them.",
    category: "Revision",
    icon: Brain,
    aliases: ["memory", "forgetting curve", "retention", "spaced repetition"],
    availability: "available",
    attachments: "none",
  },
  {
    id: "academic-coach",
    toolId: "academic-coach",
    name: "Academic Coach",
    description: "Build a realistic improvement plan around your goals, subjects and time.",
    category: "Productivity",
    icon: Target,
    aliases: ["coach", "academic coach", "improvement plan", "study coach"],
    availability: "available",
    attachments: "optional",
    attachmentHint: "Optional: attach a timetable or notes for a more grounded plan.",
  },
  {
    id: "one-night-exam",
    toolId: "one-night-exam",
    name: "One-Night Exam Prep",
    description: "A prioritised last-minute revision plan. No guaranteed marks, just a clear plan.",
    category: "Productivity",
    icon: Sunrise,
    aliases: ["one night exam", "one night exam prep", "one-night exam mode", "cram", "exam tomorrow", "last minute revision"],
    availability: "available",
    attachments: "optional",
    attachmentHint: "Optional: attach the syllabus or chapter list.",
  },
  {
    id: "homework-scanner",
    toolId: "homework-scanner",
    name: "Image Analysis",
    description: "Scan a question image or homework sheet, extract text and receive guided hints and solutions.",
    category: "Advanced",
    icon: Camera,
    aliases: ["image analysis", "homework scanner", "homework", "scanner", "homework scan", "photo question", "image question"],
    availability: "available",
    entitlement: "homework_scanner",
    attachments: "required",
    attachmentHint: "Required: a clear photo of the question. Scholar Plus.",
  },
  {
    id: "daily-briefing",
    toolId: "daily-briefing",
    name: "Daily Briefing",
    description: "A short morning brief built from your real planner, revision and practice state.",
    category: "Productivity",
    icon: Sunrise,
    aliases: ["daily briefing", "morning brief", "today"],
    availability: "available",
    attachments: "none",
  },
  {
    id: "chapter-builder",
    toolId: "chapter-builder",
    name: "Chapter Builder",
    description: "Generate a complete study unit for a chapter and export it as a PDF.",
    category: "Learning",
    icon: Hammer,
    aliases: ["chapter builder", "study unit", "chapter pack", "chapter notes"],
    availability: "available",
    attachments: "optional",
    attachmentHint: "Optional: attach the chapter text.",
  },
  {
    id: "life-saver",
    toolId: "life-saver",
    name: "Life Saver Button",
    description: "When you feel overwhelmed, get a calm, concrete next step instead of a lecture.",
    category: "Productivity",
    icon: LifeBuoy,
    aliases: ["panic", "overwhelmed", "life saver", "calm"],
    availability: "available",
    attachments: "none",
  },
  {
    id: "study-companion",
    toolId: "study-companion",
    name: "Study Companion",
    description: "A lighter companion chat for motivation, reflection and study momentum.",
    category: "Learning",
    icon: Users,
    aliases: ["companion", "study buddy", "friendly chat"],
    availability: "available",
    attachments: "none",
  },
  {
    id: "aisig",
    toolId: "aisig",
    name: "AISIG",
    description: "AI Study Image Generator — create an educational image from a carefully enhanced prompt.",
    category: "Advanced",
    icon: ImageIcon,
    aliases: ["aisig", "study image", "image generator", "educational image"],
    availability: "available",
    entitlement: "aisig",
    attachments: "none",
  },
  {
    id: "slideshow-maker",
    toolId: "slideshow-maker",
    name: "Slideshow Generator",
    description: "Turn a topic, chapter or notes into an editable slide deck.",
    category: "Advanced",
    icon: Presentation,
    aliases: ["slideshow", "slideshow maker", "slideshow generator", "ai slideshow maker", "presentation", "slides", "deck"],
    availability: "available",
    plus: true,
    attachments: "optional",
    attachmentHint: "Optional: attach notes to build the deck from.",
  },
  {
    id: "concept-explainer",
    toolId: "concept-explainer",
    name: "Concept Explainer",
    description: "Break down any concept with intuition, CBSE exam definitions, derivations and worked examples.",
    category: "Learning",
    icon: Lightbulb,
    aliases: ["concept explainer", "explain concept", "intuition", "derivation explainer"],
    availability: "available",
    attachments: "optional",
    attachmentHint: "Optional: attach notes or textbook excerpts.",
  },
  {
    id: "chapter-summarizer",
    toolId: "chapter-summarizer",
    name: "Chapter Summarizer",
    description: "Distil any CBSE chapter or attached notes into key definitions, formulas and a revision checklist.",
    category: "Documents",
    icon: BookOpen,
    aliases: ["chapter summarizer", "document summarizer", "summarise chapter", "chapter summary", "summary"],
    availability: "available",
    attachments: "optional",
    attachmentHint: "Optional: attach chapter text or notes to summarize.",
  },
  {
    id: "flashcard-maker",
    toolId: "flashcard-maker",
    name: "Flashcard Maker",
    description: "Turn a chapter or your notes into active-recall flashcards and save them directly to your deck.",
    category: "Revision",
    icon: Layers,
    aliases: ["flashcard maker", "flashcards", "card generator", "make flashcards"],
    availability: "available",
    attachments: "optional",
    attachmentHint: "Optional: attach study notes to convert into flashcards.",
  },
  {
    id: "formula-sheet-generator",
    toolId: "formula-sheet-generator",
    name: "Formula Sheet Generator",
    description: "Compile a structured chapter formula sheet with SI units, conditions and downloadable PDF export.",
    category: "Revision",
    icon: FileSpreadsheet,
    aliases: ["formula sheet", "formula sheet generator", "formulas", "equation sheet"],
    availability: "available",
    attachments: "optional",
  },
  {
    id: "notes-to-quiz",
    toolId: "notes-to-quiz",
    name: "Notes-to-Quiz",
    description: "Convert your pasted or attached study notes into an interactive 5-question MCQ check.",
    category: "Practice",
    icon: HelpCircle,
    aliases: ["notes to quiz", "notes-to-quiz", "quiz from notes", "generate quiz"],
    availability: "available",
    attachments: "optional",
    attachmentHint: "Optional: attach notes or a PDF to generate questions from.",
  },
  {
    id: "answer-evaluator",
    toolId: "answer-evaluator",
    name: "Answer Evaluator",
    description: "Grade a descriptive answer against CBSE step-wise marking criteria with model improvements.",
    category: "Practice",
    icon: ClipboardCheck,
    aliases: ["answer evaluator", "evaluate answer", "rubric grading", "check my answer"],
    availability: "available",
    attachments: "optional",
  },
  {
    id: "revision-planner",
    toolId: "revision-planner",
    name: "Revision & Study Planner",
    description: "Schedule daily revision blocks around your syllabus and add them directly to Scholar Planner.",
    category: "Revision",
    icon: CalendarDays,
    aliases: ["revision planner", "study planner", "revision plan", "study schedule", "timetable"],
    availability: "available",
    attachments: "optional",
  },
  {
    id: "diagram-flowchart-builder",
    toolId: "diagram-flowchart-builder",
    name: "Diagram & Flowchart Builder",
    description: "Map any scientific process, derivation or chapter workflow into a step-by-step visual flowchart.",
    category: "Learning",
    icon: GitBranch,
    aliases: ["diagram builder", "flowchart builder", "diagram and flowchart builder", "concept map", "process flow"],
    availability: "available",
    attachments: "optional",
  },
  {
    id: "pyq-solver",
    toolId: "pyq-solver",
    name: "PYQ Solver",
    description: "Solve previous-year board and exam questions step-by-step with CBSE marking scheme breakdown.",
    category: "Practice",
    icon: Target,
    aliases: ["pyq solver", "previous year question solver", "solve pyq", "board question solver"],
    availability: "available",
    attachments: "optional",
  },
  {
    id: "ncert-question-generator",
    toolId: "ncert-question-generator",
    name: "NCERT Question Generator",
    description: "Generate NCERT-aligned MCQs, Assertion-Reason, Short and Long Answer questions with solutions.",
    category: "Practice",
    icon: Sparkles,
    aliases: ["ncert question generator", "ncert questions", "exemplar generator", "cbse question generator"],
    availability: "available",
    attachments: "optional",
  },
  {
    id: "mistake-pattern-tracker",
    toolId: "mistake-pattern-tracker",
    name: "Mistake Pattern Tracker",
    description: "Scan your recorded quiz mistakes, past-paper errors and open doubts to diagnose recurring patterns.",
    category: "Practice",
    icon: TrendingUp,
    aliases: ["mistake pattern tracker", "pattern tracker", "error patterns", "track mistakes"],
    availability: "available",
    attachments: "none",
  },

  // Planned entries stay visible so the library is honest about future roadmap items,
  // but they render disabled and can never be executed.
  {
    id: "weekly-review",
    name: "Weekly Review",
    description: "A reflective weekly review of sessions, accuracy, consistency and next priorities.",
    category: "Productivity",
    icon: ClipboardList,
    aliases: ["weekly review", "week summary", "progress review"],
    availability: "planned",
    attachments: "none",
  },
  {
    id: "citation-helper",
    name: "Citation Helper",
    description: "Format a source citation and keep the original link with the study note.",
    category: "Documents",
    icon: Quote,
    aliases: ["citation", "citation helper", "reference", "bibliography"],
    availability: "planned",
    attachments: "optional",
  },
];

export function pluginById(id: string | undefined): LamPlugin | undefined {
  if (!id) return undefined;
  return LAM_PLUGINS.find((plugin) => plugin.id === id || plugin.toolId === id);
}

export function availablePlugins(): LamPlugin[] {
  return LAM_PLUGINS.filter((plugin) => plugin.availability === "available");
}

export function plannedPlugins(): LamPlugin[] {
  return LAM_PLUGINS.filter((plugin) => plugin.availability === "planned");
}

export function pluginsByCategory(category: PluginCategory, list = LAM_PLUGINS): LamPlugin[] {
  return list.filter((plugin) => plugin.category === category);
}

function haystack(plugin: LamPlugin): string {
  return [plugin.name, plugin.description, plugin.category, plugin.availability, ...plugin.aliases]
    .join(" ")
    .toLowerCase();
}

/** Search available plugins for `@` autocomplete and the plugin browser. */
export function searchLamPlugins(query: string, list: LamPlugin[] = availablePlugins()): LamPlugin[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const scored = list
    .filter((plugin) => haystack(plugin).includes(q))
    .map((plugin) => {
      const name = plugin.name.toLowerCase();
      let score = 30;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (plugin.aliases.some((alias) => alias === q)) score = 90;
      else if (plugin.aliases.some((alias) => alias.startsWith(q))) score = 70;
      else if (name.includes(q)) score = 60;
      return { plugin, score };
    })
    .sort((a, b) => b.score - a.score || a.plugin.name.localeCompare(b.plugin.name));
  return scored.map((entry) => entry.plugin);
}

export function pluginCategoryLabel(category: PluginCategory): string {
  return `${category}`;
}
