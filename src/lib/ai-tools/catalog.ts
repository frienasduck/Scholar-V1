import {
  AlertTriangle, Brain, Camera, FileText, Hammer, Image as ImageIcon, LifeBuoy,
  Presentation, Sunrise, Target, Users, type LucideIcon,
} from "lucide-react";

export interface ToolMeta {
  id: string;
  name: string;
  blurb: string;
  icon: LucideIcon;
  accent: string;
  gradient: string;
  highlight?: boolean;
  badge?: string;
}

/** The real AI tools shipped with Scholar. Shared by AI Tools and LAM AI plugins. */
export const TOOLS: ToolMeta[] = [
  { id: "ai-pdf-studio", name: "AI PDF Studio", blurb: "Turn a single prompt into a stunning, publication-ready PDF — Canva + Notion + AI for students.", icon: FileText, accent: "#f43f5e", gradient: "from-rose-500 to-orange-500", highlight: true, badge: "FLAGSHIP" },
  { id: "mistake-analyzer", name: "Mistake Analyzer", blurb: "Paste wrong answers — find the root cause.", icon: AlertTriangle, accent: "#f59e0b", gradient: "from-amber-500 to-orange-500" },
  { id: "memory-predictor", name: "Memory Predictor", blurb: "See what you're about to forget.", icon: Brain, accent: "#8b5cf6", gradient: "from-violet-500 to-fuchsia-500" },
  { id: "academic-coach", name: "Academic Coach", blurb: "Personalised improvement plan.", icon: Target, accent: "#6366f1", gradient: "from-indigo-500 to-blue-500" },
  { id: "one-night-exam", name: "One-Night Exam Mode", blurb: "Cram plan for tomorrow's exam.", icon: Sunrise, accent: "#ec4899", gradient: "from-pink-500 to-rose-500" },
  { id: "homework-scanner", name: "Homework Scanner", blurb: "Snap a question, get a hint + solution.", icon: Camera, accent: "#14b8a6", gradient: "from-teal-500 to-emerald-500" },
  { id: "daily-briefing", name: "Daily Briefing", blurb: "Your 4-part morning study brief.", icon: Sunrise, accent: "#f97316", gradient: "from-orange-500 to-amber-500" },
  { id: "chapter-builder", name: "Chapter Builder", blurb: "Generate a full study unit, export to PDF.", icon: Hammer, accent: "#10b981", gradient: "from-emerald-500 to-teal-500" },
  { id: "life-saver", name: "Life Saver Button", blurb: "Panicking? Tap once, get calm + a plan.", icon: LifeBuoy, accent: "#ef4444", gradient: "from-red-500 to-rose-500" },
  { id: "study-companion", name: "Study Companion", blurb: "Casual mini-chat with a friendly AI.", icon: Users, accent: "#06b6d4", gradient: "from-cyan-500 to-sky-500" },
  { id: "aisig", name: "AISIG", blurb: "AI Study Image Generator — turn ideas into educational images.", icon: ImageIcon, accent: "#7c3aed", gradient: "from-violet-500 to-purple-500" },
  { id: "slideshow-maker", name: "AI Slideshow Maker", blurb: "Turn topics, notes, or chapters into beautiful editable slide decks. Included with Scholar Plus.", icon: Presentation, accent: "#06b6d4", gradient: "from-cyan-500 to-violet-500", highlight: true, badge: "PLUS" },
];

export function toolById(id: string): ToolMeta | undefined {
  return TOOLS.find((tool) => tool.id === id);
}
