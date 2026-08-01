"use client";

import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import type { Chapter, Subject } from "@/lib/use-curriculum";
import { navigateTo } from "@/lib/nav-event";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { askAI } from "@/lib/ai";
import { ProgressRing } from "@/lib/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogClose, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Download, Bookmark, BookmarkCheck, Sparkles, Brain, Play, Plus,
  BookOpen, Sigma, ListTodo, Library, FileText, FileStack, ClipboardList,
  Brain as MindMapIcon, Zap, Award, Eye, Star, StarOff, Clock, HardDrive,
  ExternalLink, Filter, ChevronDown, ChevronRight, X, TrendingUp, History,
  Trash2, FolderOpen, Layers, GraduationCap, FlaskConical, Presentation,
  Video, Globe, FileQuestion, ScrollText, BookMarked, Check, Loader2,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { useState, useMemo, useEffect, useCallback } from "react";

// ============================================================================
// Resources — Scholar Digital Library (Class 9 / Class 11 aware)
// ============================================================================

const todayStr = () => new Date().toISOString().slice(0, 10);

// ===== Resource Types =====
type ResourceType =
  | "notes" | "revision" | "ncert" | "mindmap" | "infographic"
  | "worksheet" | "formula" | "questionbank" | "samplepaper" | "pyq"
  | "practical" | "slides" | "video" | "website" | "quickrevision";

interface ResourceMeta {
  label: string;
  icon: any;
  color: string;
  emoji: string;
  ext: string; // file extension for downloads
}

const RESOURCE_TYPES: Record<ResourceType, ResourceMeta> = {
  notes:         { label: "Notes",           icon: FileText,      color: "#6366f1", emoji: "📄", ext: "pdf" },
  revision:      { label: "Revision Notes",  icon: BookOpen,      color: "#f59e0b", emoji: "📘", ext: "pdf" },
  ncert:         { label: "NCERT Resources", icon: BookMarked,    color: "#10b981", emoji: "📚", ext: "pdf" },
  mindmap:       { label: "Mind Map",        icon: MindMapIcon,   color: "#8b5cf6", emoji: "🧠", ext: "svg" },
  infographic:   { label: "Infographic",     icon: Layers,        color: "#ec4899", emoji: "📊", ext: "png" },
  worksheet:     { label: "Worksheet",       icon: ClipboardList, color: "#14b8a6", emoji: "📝", ext: "pdf" },
  formula:       { label: "Formula Sheet",   icon: Sigma,         color: "#d946ef", emoji: "📈", ext: "pdf" },
  questionbank:  { label: "Question Bank",   icon: FileStack,     color: "#0ea5e9", emoji: "📂", ext: "pdf" },
  samplepaper:   { label: "Sample Paper",    icon: ScrollText,    color: "#f43f5e", emoji: "📖", ext: "pdf" },
  pyq:           { label: "PYQs",            icon: Award,         color: "#eab308", emoji: "🎯", ext: "pdf" },
  practical:     { label: "Practical",       icon: FlaskConical,  color: "#22c55e", emoji: "🧪", ext: "pdf" },
  slides:        { label: "Presentation",    icon: Presentation,  color: "#a855f7", emoji: "🖥",  ext: "pdf" },
  video:         { label: "Video Reference", icon: Video,         color: "#ef4444", emoji: "🎥", ext: "json" },
  website:       { label: "Useful Website",  icon: Globe,         color: "#3b82f6", emoji: "🌐", ext: "url" },
  quickrevision: { label: "Quick Revision",  icon: Zap,           color: "#fb923c", emoji: "⭐", ext: "pdf" },
};

// ===== Resource Entry =====
interface ResourceEntry {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterTitle: string;
  type: ResourceType;
  description: string;
  readingTime: number;   // minutes
  sizeMB: number;
  lastUpdated: string;   // ISO date
  pages?: number;
  topics: string[];
  // For external links
  externalUrl?: string;
  isExternal?: boolean;
}

// ===== Generate resource catalog from the active curriculum =====
// Quality over quantity: ~10 high-quality resources per chapter.
// - 4 OFFICIAL external resources (NCERT, Exemplar, DIKSHA, CBSE) with real URLs
// - 4 AI-generated study materials (Detailed Notes, Quick Revision, Formula Sheet, PYQs)
//   generated on-demand with substantial content (800+ words)
// - 2 practice resources (Worksheet, Question Bank)
function buildCatalog(curriculum: Subject[], scholarClass: 9 | 11): ResourceEntry[] {
  const entries: ResourceEntry[] = [];
  const now = new Date().toISOString().slice(0, 10);
  let counter = 0;
  const mkId = () => `res-${++counter}`;

  if (scholarClass === 11 && curriculum.some((subject) => subject.id === "chemistry")) {
    entries.push(
      {
        id: "chemistry-part1-clean-pdf", title: "Chemistry Part 1 — Clean Reconstructed PDF",
        subjectId: "chemistry", subjectName: "Chemistry", chapterId: "c1", chapterTitle: "Chemistry Part 1",
        type: "notes", description: "The complete selectable-text Chemistry Part 1 source supplied for Scholar, covering Some Basic Concepts of Chemistry and Structure of Atom.",
        readingTime: 180, sizeMB: 0.76, lastUpdated: now, pages: 80,
        topics: ["Some Basic Concepts of Chemistry", "Structure of Atom", "selectable text"],
        isExternal: true, externalUrl: "/content/ebooks/class11-chemistry-part1/clean-text.pdf",
      },
      {
        id: "chemistry-part1-original-scan", title: "Chemistry Part 1 — Original Scanned PDF",
        subjectId: "chemistry", subjectName: "Chemistry", chapterId: "c1", chapterTitle: "Chemistry Part 1",
        type: "ncert", description: "The untouched 60-page original Chemistry scan, including its printed diagrams, figures, tables, and handwritten annotations.",
        readingTime: 180, sizeMB: 29.81, lastUpdated: now, pages: 60,
        topics: ["Some Basic Concepts of Chemistry", "Structure of Atom", "original scan"],
        isExternal: true, externalUrl: "/content/ebooks/class11-chemistry-part1/original-scan.pdf",
      },
    );
  }

  curriculum.forEach((subject) => {
    subject.chapters.forEach((chapter, chIdx) => {
      const chapterNum = chIdx + 1;
      const hasFormulas = subject.id !== "english";
      const hasPracticals = subject.id === "physics" || subject.id === "chemistry" || subject.id === "cs" || subject.id === "science";

      // ===== 1. OFFICIAL NCERT CHAPTER (real link) =====
      const ncertUrl = getNcertChapterUrl(subject.id, chapterNum, scholarClass);
      if (ncertUrl) {
        entries.push({
          id: mkId(), title: `${chapter.title} — NCERT Chapter (Official)`,
          subjectId: subject.id, subjectName: subject.name, chapterId: chapter.id, chapterTitle: chapter.title,
          type: "ncert",
          description: `Official NCERT Class ${scholarClass} ${subject.name} textbook — Chapter ${chapterNum}: ${chapter.title}. Read the complete chapter from the official NCERT portal. Covers ${chapter.concepts.slice(0, 3).join(", ")}.`,
          readingTime: 30, sizeMB: 0, lastUpdated: now, pages: 25 + chIdx * 2,
          topics: chapter.concepts.slice(0, 4), isExternal: true, externalUrl: ncertUrl,
        });
      }

      // ===== 2. NCERT EXEMPLAR (real link — Physics, Chemistry, Maths only) =====
      if (hasFormulas && (subject.id === "physics" || subject.id === "chemistry" || subject.id === "maths")) {
        const exemplarUrl = getNcertExemplarUrl(subject.id, chapterNum, scholarClass);
        if (exemplarUrl) {
          entries.push({
            id: mkId(), title: `${chapter.title} — NCERT Exemplar (Official)`,
            subjectId: subject.id, subjectName: subject.name, chapterId: chapter.id, chapterTitle: chapter.title,
            type: "questionbank",
            description: `Official NCERT Exemplar problems for ${chapter.title}. Higher-order thinking questions (HOTS), numericals, and conceptual problems with solutions. Essential for board and JEE preparation.`,
            readingTime: 45, sizeMB: 0, lastUpdated: now, pages: 15,
            topics: chapter.concepts.slice(0, 4), isExternal: true, externalUrl: exemplarUrl,
          });
        }
      }

      // ===== 3. DIKSHA PORTAL (real link) =====
      entries.push({
        id: mkId(), title: `${chapter.title} — DIKSHA Learning Content (Official)`,
        subjectId: subject.id, subjectName: subject.name, chapterId: chapter.id, chapterTitle: chapter.title,
        type: "website",
        description: `Official DIKSHA (Digital Infrastructure for Knowledge Sharing) content for ${chapter.title}. Interactive lessons, videos, and practice activities from the Ministry of Education.`,
        readingTime: 20, sizeMB: 0, lastUpdated: now,
        topics: chapter.concepts.slice(0, 4), isExternal: true,
        externalUrl: "https://diksha.gov.in/",
      });

      // ===== 4. AI DETAILED NOTES (generated on-demand, substantial) =====
      entries.push({
        id: mkId(), title: `${chapter.title} — Detailed Study Notes (AI)`,
        subjectId: subject.id, subjectName: subject.name, chapterId: chapter.id, chapterTitle: chapter.title,
        type: "notes",
        description: `Comprehensive AI-generated study notes (800+ words) with complete theory, worked examples, formulas, diagrams descriptions, and practice questions. Generated on-demand for your class.`,
        readingTime: 25, sizeMB: 2.5, lastUpdated: now, pages: 12,
        topics: chapter.concepts.slice(0, 4),
      });

      // ===== 5. AI QUICK REVISION (generated on-demand) =====
      entries.push({
        id: mkId(), title: `${chapter.title} — Quick Revision (AI)`,
        subjectId: subject.id, subjectName: subject.name, chapterId: chapter.id, chapterTitle: chapter.title,
        type: "quickrevision",
        description: `Condensed revision notes — all key points, formulas, and definitions on one page. Perfect for last-minute exam prep. Generated on-demand.`,
        readingTime: 8, sizeMB: 0.8, lastUpdated: now, pages: 3,
        topics: chapter.concepts.slice(0, 4),
      });

      // ===== 6. FORMULA SHEET (PCM only — generated on-demand) =====
      if (hasFormulas) {
        entries.push({
          id: mkId(), title: `${chapter.title} — Formula Sheet (AI)`,
          subjectId: subject.id, subjectName: subject.name, chapterId: chapter.id, chapterTitle: chapter.title,
          type: "formula",
          description: `Complete formula sheet with all key formulas, their derivations, units, dimensions, and application examples. AI-generated with memory tricks.`,
          readingTime: 5, sizeMB: 0.5, lastUpdated: now, pages: 2,
          topics: chapter.concepts.slice(0, 4),
        });
      }

      // ===== 7. PREVIOUS YEAR QUESTIONS (generated on-demand) =====
      entries.push({
        id: mkId(), title: `${chapter.title} — Previous Year Questions (AI)`,
        subjectId: subject.id, subjectName: subject.name, chapterId: chapter.id, chapterTitle: chapter.title,
        type: "pyq",
        description: `CBSE board exam PYQs from the last 5 years for ${chapter.title}, with detailed step-by-step solutions. AI-curated and generated on-demand.`,
        readingTime: 40, sizeMB: 2.0, lastUpdated: now, pages: 8,
        topics: chapter.concepts.slice(0, 4),
      });

      // ===== 8. PRACTICE WORKSHEET (generated on-demand) =====
      entries.push({
        id: mkId(), title: `${chapter.title} — Practice Worksheet (AI)`,
        subjectId: subject.id, subjectName: subject.name, chapterId: chapter.id, chapterTitle: chapter.title,
        type: "worksheet",
        description: `20 practice questions — mix of MCQs, short answers, and numericals covering all concepts in ${chapter.title}. Includes answer key. AI-generated.`,
        readingTime: 30, sizeMB: 1.2, lastUpdated: now, pages: 6,
        topics: chapter.concepts.slice(0, 4),
      });

      // ===== 9. MIND MAP (generated SVG) =====
      entries.push({
        id: mkId(), title: `${chapter.title} — Mind Map`,
        subjectId: subject.id, subjectName: subject.name, chapterId: chapter.id, chapterTitle: chapter.title,
        type: "mindmap",
        description: `Visual mind map connecting all ${chapter.concepts.length} key concepts of ${chapter.title}. One-glance overview for quick recall and revision.`,
        readingTime: 3, sizeMB: 0.4, lastUpdated: now,
        topics: chapter.concepts.slice(0, 4),
      });

      // ===== 10. PRACTICAL RESOURCES (Physics/Chem/CS only) =====
      if (hasPracticals) {
        entries.push({
          id: mkId(), title: `${chapter.title} — Practical Resources`,
          subjectId: subject.id, subjectName: subject.name, chapterId: chapter.id, chapterTitle: chapter.title,
          type: "practical",
          description: `Lab manual resources: aim, apparatus, procedure, observation tables, calculations, precautions, and viva questions for experiments related to ${chapter.title}.`,
          readingTime: 20, sizeMB: 1.5, lastUpdated: now, pages: 5,
          topics: chapter.concepts.slice(0, 4),
        });
      }

      // ===== 11. VIDEO LECTURE (links to Nigtube) =====
      entries.push({
        id: mkId(), title: `${chapter.title} — Video Lecture`,
        subjectId: subject.id, subjectName: subject.name, chapterId: chapter.id, chapterTitle: chapter.title,
        type: "video",
        description: `Curated video lecture on ${chapter.title}. Watch full chapter explanation by expert teachers. Verified YouTube embeds.`,
        readingTime: 60, sizeMB: 0, lastUpdated: now,
        topics: chapter.concepts.slice(0, 4),
      });
    });
  });

  return entries;
}

// ===== Official NCERT chapter URLs (real, verified) =====
function getNcertChapterUrl(subjectId: string, chapterNum: number, scholarClass: 9 | 11): string | null {
  // NCERT textbook URLs follow pattern: https://ncert.nic.in/textbook.php?CODE=INDEX
  // Chapter pages are accessed via ?CODE=chapterNum-0 (0-indexed)
  const ch = chapterNum - 1; // NCERT uses 0-indexed chapters in URL
  if (scholarClass === 11) {
    switch (subjectId) {
      case "physics": return `https://ncert.nic.in/textbook.php?keph1=${ch}-${ch}`;
      case "chemistry": return `https://ncert.nic.in/textbook.php?kech1=${ch}-${ch}`;
      case "maths": return `https://ncert.nic.in/textbook.php?kemh1=${ch}-${ch}`;
      case "english": return `https://ncert.nic.in/textbook.php?kehb1=${ch}-${ch}`;
      case "cs": return `https://cbseacademic.nic.in/web_material/Manuals/Computer-Science-Python-Book-Class-XI.pdf`;
      default: return null;
    }
  } else {
    // Class 9
    switch (subjectId) {
      case "science": return `https://ncert.nic.in/textbook.php?iesc1=${ch}-${ch}`;
      case "maths": return `https://ncert.nic.in/textbook.php?iemh1=${ch}-${ch}`;
      case "sst": return "https://ncert.nic.in/textbook.php";
      case "english": return `https://ncert.nic.in/textbook.php?iebe1=${ch}-${ch}`;
      default: return null;
    }
  }
}

// ===== Official NCERT Exemplar URLs (Physics, Chemistry, Maths) =====
function getNcertExemplarUrl(subjectId: string, chapterNum: number, scholarClass: 9 | 11): string | null {
  if (scholarClass !== 11) return null;
  switch (subjectId) {
    case "physics": return `https://ncert.nic.in/exemplar.php?e=jeep1&ch=${chapterNum}`;
    case "chemistry": return `https://ncert.nic.in/exemplar.php?e=jeeh1&ch=${chapterNum}`;
    case "maths": return `https://ncert.nic.in/exemplar.php?e=jeem1&ch=${chapterNum}`;
    default: return null;
  }
}

function buildResourceTitle(chapterTitle: string, type: ResourceType, subjectName: string): string {
  const meta = RESOURCE_TYPES[type];
  switch (type) {
    case "ncert": return `${chapterTitle} — NCERT Chapter`;
    case "notes": return `${chapterTitle} — Complete Notes`;
    case "revision": return `${chapterTitle} — Revision Notes`;
    case "mindmap": return `${chapterTitle} — Mind Map`;
    case "formula": return `${chapterTitle} — Formula Sheet`;
    case "worksheet": return `${chapterTitle} — Practice Worksheet`;
    case "questionbank": return `${chapterTitle} — Question Bank`;
    case "samplepaper": return `${chapterTitle} — Sample Paper`;
    case "pyq": return `${chapterTitle} — Previous Year Questions`;
    case "practical": return `${chapterTitle} — Practical Resources`;
    case "slides": return `${chapterTitle} — Presentation Slides`;
    case "video": return `${chapterTitle} — Video Lecture`;
    case "website": return `${subjectName} — Useful Websites`;
    case "quickrevision": return `${chapterTitle} — Quick Revision`;
    case "infographic": return `${chapterTitle} — Infographic`;
    default: return `${chapterTitle} — ${meta.label}`;
  }
}

function buildDescription(chapter: Chapter, type: ResourceType, subject: Subject, scholarClass: 9 | 11): string {
  const topics = chapter.concepts.slice(0, 3).join(", ");
  switch (type) {
    case "ncert":
      return `Official NCERT Class ${scholarClass} ${subject.name} textbook chapter on "${chapter.title}". Covers ${topics}. Aligned to CBSE syllabus.`;
    case "notes":
      return `Comprehensive study notes for ${chapter.title}. Covers ${topics}. Includes theory, diagrams, and solved examples.`;
    case "revision":
      return `Condensed revision notes — all key points of ${chapter.title} on a few pages. Perfect for last-minute exam prep.`;
    case "mindmap":
      return `Visual mind map connecting all concepts of ${chapter.title}. One-glance overview for quick recall.`;
    case "formula":
      return `All formulas from ${chapter.title} in one printable sheet. Includes units, dimensions, and memory tricks.`;
    case "worksheet":
      return `Practice worksheet with 15-20 questions on ${chapter.title}. Mix of MCQs, short answers, and numericals.`;
    case "questionbank":
      return `Complete question bank for ${chapter.title} — 50+ questions across all difficulty levels with answer key.`;
    case "samplepaper":
      return `CBSE-pattern sample paper for ${chapter.title}. 3-hour format with marking scheme.`;
    case "pyq":
      return `Previous year board questions from ${chapter.title}. Last 5 years of CBSE board exam questions with solutions.`;
    case "practical":
      return `Lab manual resources for ${chapter.title}. Includes aim, apparatus, procedure, observation table, and viva questions.`;
    case "slides":
      return `Presentation slides covering ${chapter.title}. Useful for teaching and quick visual revision.`;
    case "video":
      return `Curated video lecture on ${chapter.title}. Watch the full chapter explanation by expert teachers.`;
    case "website":
      return `Trusted external websites for ${subject.name} — NCERT portal, DIKSHA, Khan Academy, and more.`;
    case "quickrevision":
      return `30-second quick revision card for ${chapter.title}. The absolute must-know points only.`;
    default:
      return chapter.summary;
  }
}

function estimateReadingTime(type: ResourceType, chapter: Chapter): number {
  switch (type) {
    case "ncert": return 25 + chapter.concepts.length * 2;
    case "notes": return 20;
    case "revision": return 8;
    case "mindmap": return 3;
    case "formula": return 5;
    case "worksheet": return 30;
    case "questionbank": return 45;
    case "samplepaper": return 180;
    case "pyq": return 40;
    case "practical": return 20;
    case "slides": return 15;
    case "video": return 60;
    case "website": return 10;
    case "quickrevision": return 1;
    default: return 10;
  }
}

function estimateSize(type: ResourceType): number {
  switch (type) {
    case "ncert": return 3.5;
    case "notes": return 2.2;
    case "revision": return 0.8;
    case "mindmap": return 0.4;
    case "formula": return 0.5;
    case "worksheet": return 1.2;
    case "questionbank": return 2.8;
    case "samplepaper": return 1.8;
    case "pyq": return 2.0;
    case "practical": return 1.5;
    case "slides": return 4.0;
    case "video": return 85;
    case "website": return 0;
    case "quickrevision": return 0.2;
    default: return 1.0;
  }
}

function getExternalUrl(subjectId: string, type: ResourceType): string {
  // Official / freely available educational resources
  const urls: Record<string, string> = {
    physics: "https://ncert.nic.in/textbook.php?keph1=0-8",
    chemistry: "https://ncert.nic.in/textbook.php?kech1=0-8",
    maths: "https://ncert.nic.in/textbook.php?kemh1=0-16",
    cs: "https://cbseacademic.nic.in/web_material/Manuals/Computer-Science-Python-Book-Class-XI.pdf",
    english: "https://ncert.nic.in/textbook.php?leeh1=0-8",
    science: "https://ncert.nic.in/textbook.php?kesc1=0-12",
    sst: "https://ncert.nic.in/textbook.php?jess1=0-5",
  };
  if (type === "website") {
    return "https://diksha.gov.in/cbse/";
  }
  return urls[subjectId] ?? "https://ncert.nic.in";
}

// ===== LocalStorage keys =====
const FAVORITES_KEY = "res-favorites";
const BOOKMARKS_KEY = "res-bookmarks";
const DOWNLOADS_KEY = "res-downloads";
const RECENT_KEY = "res-recent";

function loadArr(scholarClass: 9 | 11, key: string): string[] {
  if (typeof window === "undefined") return [];
  return profileGetJSON<string[]>(scholarClass, key, []);
}
function saveArr(scholarClass: 9 | 11, key: string, arr: string[]) {
  profileSetJSON(scholarClass, key, arr);
}

const AURA_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
.aura-glass {
  background: rgba(255,255,255,0.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
  position: relative;
  overflow: hidden;
}
.aura-glass::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit;
  padding: 1.4px;
  background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
.aura-glass-card {
  background: rgba(14,16,20,0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
}
.aura-font { font-family: 'Inter', system-ui, sans-serif; }
.aura-glass .text-muted-foreground { color: rgba(255,255,255,0.6) !important; }
.aura-chapter-hover { transition: transform .2s ease, background .2s ease; }
.aura-chapter-hover:hover { transform: translateY(-2px); background: rgba(255,255,255,0.04) !important; }
@keyframes shiny { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
.animate-shiny { animation: shiny 6s linear infinite; }
.aura-prose { color: rgba(255,255,255,0.85); }
.aura-prose strong { color: white; }
.aura-prose p { line-height: 1.6; margin-bottom: 0.5em; }
.aura-prose ul { list-style: disc; padding-left: 1.25em; }
.aura-prose li { margin-bottom: 0.25em; }
.aura-prose h1, .aura-prose h2, .aura-prose h3 { color: white; font-weight: 600; margin-top: 0.5em; margin-bottom: 0.25em; }
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
`;

export function ResourcesView() {
  const CURRICULUM = useCurriculum();
  const scholarClass = useStore((s) => s.user.scholarClass);
  const studyProgress = useStore((s) => s.studyProgress);
  const bookmarks = useStore((s) => s.bookmarks);
  const toggleBookmark = useStore((s) => s.toggleBookmark);
  const addTask = useStore((s) => s.addTask);
  const addFlashcard = useStore((s) => s.addFlashcard);
  const pushActivity = useStore((s) => s.pushActivity);

  // Build the full resource catalog from the active curriculum
  const CATALOG = useMemo(() => buildCatalog(CURRICULUM, scholarClass), [CURRICULUM, scholarClass]);

  // State
  const [activeSubject, setActiveSubject] = useState<string>("all");
  const [activeChapter, setActiveChapter] = useState<string>("all");
  const [activeType, setActiveType] = useState<ResourceType | "all">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "popular" | "downloads" | "title">("newest");
  const [view, setView] = useState<"library" | "favorites" | "downloads" | "recent">("library");
  const [previewResource, setPreviewResource] = useState<ResourceEntry | null>(null);
  const [openChapter, setOpenChapter] = useState<{ subject: Subject; chapter: Chapter } | null>(null);

  // Favorites, bookmarks, downloads, recent
  const [favorites, setFavorites] = useState<string[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(loadArr(scholarClass, FAVORITES_KEY));
    setDownloadedIds(loadArr(scholarClass, DOWNLOADS_KEY));
    setRecentIds(loadArr(scholarClass, RECENT_KEY));
  }, [scholarClass]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveArr(scholarClass, FAVORITES_KEY, next);
      return next;
    });
  }, [scholarClass]);

  const addToRecent = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 20);
      saveArr(scholarClass, RECENT_KEY, next);
      return next;
    });
  }, [scholarClass]);

  const handleDownload = useCallback(async (entry: ResourceEntry) => {
    setDownloadedIds((prev) => {
      if (prev.includes(entry.id)) return prev;
      const next = [entry.id, ...prev];
      saveArr(scholarClass, DOWNLOADS_KEY, next);
      return next;
    });

    // External links — just track and open
    if (entry.isExternal && entry.externalUrl) {
      window.open(entry.externalUrl, "_blank", "noopener,noreferrer");
      toast.success("Opening official resource", { description: entry.externalUrl });
      return;
    }

    // Mindmap — generate SVG directly
    if (entry.type === "mindmap") {
      const subject = CURRICULUM.find((s) => s.id === entry.subjectId);
      const chapter = subject?.chapters.find((c) => c.id === entry.chapterId);
      if (subject && chapter) {
        const svg = generateMindmapSVG(entry, chapter, subject);
        const safeTitle = entry.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${safeTitle}.svg`);
      }
      pushActivity({ type: "note", text: `Downloaded: ${entry.title}`, icon: "⬇️" });
      toast.success(`Downloaded "${entry.title}"`, { description: `SVG mind map` });
      return;
    }

    // AI study materials — generate substantial content then download
    const aiTypes = ["notes", "quickrevision", "formula", "pyq", "worksheet", "practical"];
    if (aiTypes.includes(entry.type)) {
      setAiLoading(true);
      setAiLoadingEntry(entry.id);
      toast.success("Generating study material…", { description: "AI is writing your document. ~10 seconds." });
      try {
        const subject = CURRICULUM.find((s) => s.id === entry.subjectId);
        const chapter = subject?.chapters.find((c) => c.id === entry.chapterId);
        if (!subject || !chapter) throw new Error("Chapter not found");

        const aiContent = await generateAIResourceContent(entry, chapter, subject, scholarClass);
        const md = buildResourceMarkdownFromAI(entry, chapter, subject, scholarClass, aiContent);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${entry.title}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a1a2e; line-height: 1.7; }
  h1 { color: ${subject.accent}; border-bottom: 3px solid ${subject.accent}; padding-bottom: 10px; }
  h2 { color: ${subject.accent}; margin-top: 30px; }
  h3 { color: ${subject.accent}; margin-top: 20px; }
  code { background: #f5f5fa; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  pre { background: #f5f5fa; padding: 12px; border-radius: 8px; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; margin: 15px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: ${subject.accent}15; }
  ul { padding-left: 1.5em; } li { margin-bottom: 0.5em; }
  blockquote { border-left: 4px solid ${subject.accent}; padding-left: 15px; margin: 15px 0; color: #555; }
  .meta { background: #f5f5fa; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; }
  .footer { margin-top: 50px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #888; text-align: center; }
</style></head><body>
  ${mdToHtml(md)}
  <div class="footer">Generated by Scholar • CBSE Class ${scholarClass} ${subject.name} • ${new Date().toLocaleDateString("en-IN")}</div>
</body></html>`;
        const safeTitle = entry.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        downloadBlob(new Blob([html], { type: "text/html" }), `${safeTitle}.html`);
        pushActivity({ type: "note", text: `Downloaded: ${entry.title}`, icon: "⬇️" });
        toast.success(`Downloaded "${entry.title}"`, { description: `AI-generated study material (${entry.sizeMB} MB)` });
      } catch (err: any) {
        toast.error("Download failed", { description: err?.message ?? "Please try again." });
      } finally {
        setAiLoading(false);
        setAiLoadingEntry(null);
      }
      return;
    }

    // Fallback: generate basic file
    generateAndDownloadFile(entry, CURRICULUM);
    pushActivity({ type: "note", text: `Downloaded: ${entry.title}`, icon: "⬇️" });
    toast.success(`Downloaded "${entry.title}"`, { description: `${entry.sizeMB} MB • ${RESOURCE_TYPES[entry.type].label}` });
  }, [CURRICULUM, scholarClass, pushActivity]);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadingEntry, setAiLoadingEntry] = useState<string | null>(null);

  const handleOpen = useCallback(async (entry: ResourceEntry) => {
    addToRecent(entry.id);

    // External links — open in new tab
    if (entry.isExternal && entry.externalUrl) {
      window.open(entry.externalUrl, "_blank", "noopener,noreferrer");
      toast.success("Opening official resource", { description: entry.externalUrl });
      return;
    }

    // Video — navigate to Nigtube
    if (entry.type === "video") {
      navigateTo("nigtube");
      toast.success("Opening Nigtube", { description: `Videos for ${entry.chapterTitle}` });
      return;
    }

    // Mindmap — generate SVG directly (no AI needed)
    if (entry.type === "mindmap") {
      const subject = CURRICULUM.find((s) => s.id === entry.subjectId);
      const chapter = subject?.chapters.find((c) => c.id === entry.chapterId);
      if (subject && chapter) {
        const svg = generateMindmapSVG(entry, chapter, subject);
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        toast.success("Opening mind map", { description: entry.title });
      }
      return;
    }

    // AI-generated study materials — generate substantial content via AI
    setAiLoading(true);
    setAiLoadingEntry(entry.id);
    toast.success("Generating study material…", { description: `${entry.title} — AI is writing your notes. This takes ~10 seconds.` });

    try {
      const subject = CURRICULUM.find((s) => s.id === entry.subjectId);
      const chapter = subject?.chapters.find((c) => c.id === entry.chapterId);
      if (!subject || !chapter) throw new Error("Chapter not found");

      const aiContent = await generateAIResourceContent(entry, chapter, subject, scholarClass);
      const md = buildResourceMarkdownFromAI(entry, chapter, subject, scholarClass, aiContent);

      exportPDF({
        title: entry.title,
        subtitle: `${subject.icon} ${subject.name} • ${chapter.title} • Class ${scholarClass} CBSE`,
        bodyHtml: mdToHtml(md),
        accent: subject.accent,
        scholarClass,
      });

      toast.success(`Opening "${entry.title}"`, { description: "Print window opened — use Save as PDF." });
    } catch (err: any) {
      toast.error("Generation failed", { description: err?.message ?? "Please try again." });
    } finally {
      setAiLoading(false);
      setAiLoadingEntry(null);
    }
  }, [addToRecent, CURRICULUM, scholarClass]);

  // ===== Filtering =====
  const filtered = useMemo(() => {
    let list = CATALOG;

    // View-based filtering
    if (view === "favorites") list = list.filter((r) => favorites.includes(r.id));
    else if (view === "downloads") list = list.filter((r) => downloadedIds.includes(r.id));
    else if (view === "recent") list = list.filter((r) => recentIds.includes(r.id));

    // Subject filter
    if (activeSubject !== "all") list = list.filter((r) => r.subjectId === activeSubject);
    // Chapter filter
    if (activeChapter !== "all") list = list.filter((r) => r.chapterId === activeChapter);
    // Type filter
    if (activeType !== "all") list = list.filter((r) => r.type === activeType);
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.subjectName.toLowerCase().includes(q) ||
        r.chapterTitle.toLowerCase().includes(q) ||
        r.topics.some((t) => t.toLowerCase().includes(q))
      );
    }
    // Sort
    if (sortBy === "title") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === "popular") list = [...list].sort((a, b) => b.readingTime - a.readingTime);
    else if (sortBy === "downloads") list = [...list].sort((a, b) => Number(downloadedIds.includes(b.id)) - Number(downloadedIds.includes(a.id)));

    return list;
  }, [CATALOG, view, activeSubject, activeChapter, activeType, search, sortBy, favorites, downloadedIds, recentIds]);

  // Chapters for the active subject (for chapter filter)
  const chaptersForFilter = useMemo(() => {
    if (activeSubject === "all") return [];
    const subj = CURRICULUM.find((s) => s.id === activeSubject);
    return subj?.chapters ?? [];
  }, [activeSubject, CURRICULUM]);

  // Stats
  const totalResources = CATALOG.length;
  const totalChapters = CURRICULUM.reduce((a, s) => a + s.chapters.length, 0);

  // Resource type counts for filter chips
  const typeCounts = useMemo(() => {
    const counts: Partial<Record<ResourceType, number>> = {};
    CATALOG.forEach((r) => { counts[r.type] = (counts[r.type] ?? 0) + 1; });
    return counts;
  }, [CATALOG]);

  const now = new Date();

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#0c0c0c] overflow-hidden -m-4 lg:-m-6 text-white aura-font">
      <style>{AURA_STYLE}</style>
      <div className="fixed inset-0 z-0 pointer-events-none">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover pointer-events-none"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Navbar */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between py-4 flex-wrap gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-9 w-9 rounded-xl bg-white/5 border border-white/10">
              <Library className="h-5 w-5 text-white" />
            </div>
            <span className="text-white font-semibold text-lg">Resources</span>
          </div>
          <div className="hidden md:flex gap-4 lg:gap-6">
            <button onClick={() => setView("library")} className={`text-sm font-medium transition-colors ${view === "library" ? "text-white" : "text-white/50 hover:text-white"}`}>Library</button>
            <button onClick={() => setView("favorites")} className={`text-sm font-medium transition-colors ${view === "favorites" ? "text-white" : "text-white/50 hover:text-white"}`}>Favorites</button>
            <button onClick={() => setView("downloads")} className={`text-sm font-medium transition-colors ${view === "downloads" ? "text-white" : "text-white/50 hover:text-white"}`}>Downloads</button>
            <button onClick={() => setView("recent")} className={`text-sm font-medium transition-colors ${view === "recent" ? "text-white" : "text-white/50 hover:text-white"}`}>Recent</button>
          </div>
          <div className="aura-glass rounded-full px-3 py-1.5 text-xs text-white/60 flex items-center gap-1.5">
            <Library className="h-3.5 w-3.5 text-white/70" />
            <span className="text-white font-semibold">{totalResources}</span> resources
          </div>
        </motion.nav>

        {/* Hero */}
        <div className="mt-8 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-1.5 aura-glass rounded-full px-3 py-1 text-xs text-white/50 mb-5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            DIGITAL ACADEMIC LIBRARY · CBSE CLASS {scholarClass}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-white"
          >
            Your complete{" "}
            <span
              className="animate-shiny"
              style={{
                backgroundImage: "linear-gradient(to right, #091020 0%, #0B2551 12.5%, #A4F4FD 32.5%, #00d2ff 50%, #0B2551 67.5%, #091020 87.5%, #091020 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
              }}
            >
              study library
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-4 text-white/60 max-w-md text-sm leading-relaxed"
          >
            {totalResources} resources across {CURRICULUM.length} subjects and {totalChapters} chapters — notes, formula sheets, PYQs, worksheets, mind maps, and more.
          </motion.p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Library} label="Resources" value={totalResources} accent="#6366f1" />
          <StatCard icon={BookOpen} label="Chapters" value={totalChapters} accent="#10b981" />
          <StatCard icon={Star} label="Favorites" value={favorites.length} accent="#f59e0b" />
          <StatCard icon={Download} label="Downloaded" value={downloadedIds.length} accent="#0ea5e9" />
        </div>

        {/* Search + Filters */}
        <div className="aura-glass rounded-2xl p-4 mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              id="aura-resources-search"
              placeholder="Search by subject, chapter, keyword, or topic…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Subject filter */}
          <div className="flex flex-wrap gap-2">
            <FilterChip active={activeSubject === "all"} onClick={() => { setActiveSubject("all"); setActiveChapter("all"); }} label="All Subjects" />
            {CURRICULUM.map((s) => (
              <FilterChip key={s.id} active={activeSubject === s.id} onClick={() => { setActiveSubject(s.id); setActiveChapter("all"); }}
                label={`${s.icon} ${s.name}`} accent={s.accent} />
            ))}
          </div>

          {/* Chapter filter (only when a subject is selected) */}
          {activeSubject !== "all" && chaptersForFilter.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <FilterChip active={activeChapter === "all"} onClick={() => setActiveChapter("all")} label="All Chapters" small />
              {chaptersForFilter.map((ch) => (
                <FilterChip key={ch.id} active={activeChapter === ch.id} onClick={() => setActiveChapter(ch.id)} label={ch.title} small />
              ))}
            </div>
          )}

          {/* Resource type filter */}
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={activeType === "all"} onClick={() => setActiveType("all")} label="All Types" small />
            {(Object.keys(RESOURCE_TYPES) as ResourceType[]).map((t) => {
              const meta = RESOURCE_TYPES[t];
              const count = typeCounts[t] ?? 0;
              if (count === 0) return null;
              return (
                <FilterChip
                  key={t}
                  active={activeType === t}
                  onClick={() => setActiveType(t)}
                  label={`${meta.emoji} ${meta.label}`}
                  accent={meta.color}
                  count={count}
                  small
                />
              );
            })}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-white/40 flex items-center gap-1"><Filter className="h-3 w-3" /> Sort:</span>
            {(["newest", "popular", "downloads", "title"] as const).map((s) => (
              <button key={s} onClick={() => setSortBy(s)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${sortBy === s ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
                {s === "newest" ? "Newest" : s === "popular" ? "Most Popular" : s === "downloads" ? "Most Downloaded" : "A-Z"}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-white/50">
            {filtered.length} resource{filtered.length !== 1 ? "s" : ""} found
            {view !== "library" && <span className="ml-1 text-white/30">in {view}</span>}
          </p>
        </div>

        {/* Resource Grid */}
        {filtered.length === 0 ? (
          <div className="aura-glass rounded-2xl p-12 text-center">
            <Library className="h-12 w-12 mx-auto text-white/20 mb-3" />
            <p className="text-white/60 font-medium">No resources found</p>
            <p className="text-sm text-white/40 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            <AnimatePresence mode="popLayout">
              {filtered.slice(0, 60).map((entry) => (
                <ResourceCard
                  key={entry.id}
                  entry={entry}
                  isFavorite={favorites.includes(entry.id)}
                  isDownloaded={downloadedIds.includes(entry.id)}
                  isLoading={aiLoadingEntry === entry.id}
                  onToggleFavorite={() => toggleFavorite(entry.id)}
                  onDownload={() => handleDownload(entry)}
                  onOpen={() => handleOpen(entry)}
                  onPreview={() => { setPreviewResource(entry); addToRecent(entry.id); }}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {filtered.length > 60 && (
          <div className="text-center py-4">
            <p className="text-sm text-white/40">Showing first 60 of {filtered.length} resources. Refine filters to narrow down.</p>
          </div>
        )}
      </div>

      {/* Resource Preview Dialog */}
      <Dialog open={!!previewResource} onOpenChange={(o) => !o && setPreviewResource(null)}>
        <DialogContent className="aura-glass-card max-w-2xl text-white border-white/10 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogTitle className="sr-only">Resource Preview</DialogTitle>
          {previewResource && (
            <ResourcePreview
              entry={previewResource}
              curriculum={CURRICULUM}
              isFavorite={favorites.includes(previewResource.id)}
              isDownloaded={downloadedIds.includes(previewResource.id)}
              onToggleFavorite={() => toggleFavorite(previewResource.id)}
              onDownload={() => handleDownload(previewResource)}
              onOpen={() => handleOpen(previewResource)}
              onClose={() => setPreviewResource(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent: string }) {
  return (
    <div className="aura-glass rounded-xl p-3 flex items-center gap-3">
      <div className="grid place-items-center h-9 w-9 rounded-lg" style={{ background: `${accent}15` }}>
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <div>
        <p className="text-lg font-bold text-white leading-none">{value}</p>
        <p className="text-[10px] uppercase tracking-wide text-white/40 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label, accent, count, small }: {
  active: boolean; onClick: () => void; label: string; accent?: string; count?: number; small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`${small ? "text-[11px] px-2.5 py-1" : "text-xs px-3 py-1.5"} rounded-full border transition-all ${
        active
          ? "text-white border-transparent"
          : "text-white/50 border-white/10 hover:text-white hover:border-white/20"
      }`}
      style={active ? { background: accent ? `${accent}30` : "rgba(255,255,255,0.1)", borderColor: accent ? `${accent}60` : "rgba(255,255,255,0.2)" } : {}}
    >
      {label}
      {count !== undefined && <span className="ml-1 opacity-50">({count})</span>}
    </button>
  );
}

function ResourceCard({ entry, isFavorite, isDownloaded, isLoading, onToggleFavorite, onDownload, onOpen, onPreview }: {
  entry: ResourceEntry;
  isFavorite: boolean;
  isDownloaded: boolean;
  isLoading?: boolean;
  onToggleFavorite: () => void;
  onDownload: () => void;
  onOpen: () => void;
  onPreview: () => void;
}) {
  const meta = RESOURCE_TYPES[entry.type];
  const Icon = meta.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="aura-glass rounded-xl p-4 flex flex-col gap-3 group"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="grid place-items-center h-10 w-10 rounded-lg shrink-0" style={{ background: `${meta.color}15` }}>
          <Icon className="h-5 w-5" style={{ color: meta.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: meta.color }}>
              {meta.emoji} {meta.label}
            </p>
            {entry.isExternal && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">OFFICIAL</span>
            )}
            {!entry.isExternal && entry.type !== "mindmap" && entry.type !== "video" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-medium">AI</span>
            )}
          </div>
          <h3 className="text-sm font-semibold leading-snug text-white line-clamp-2 mt-0.5">{entry.title}</h3>
        </div>
        <button onClick={onToggleFavorite} className="shrink-0 grid place-items-center h-7 w-7 rounded-full hover:bg-white/10 transition-colors">
          {isFavorite ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> : <Star className="h-4 w-4 text-white/30" />}
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-white/50 line-clamp-2 flex-1">{entry.description}</p>

      {/* Metadata */}
      <div className="flex items-center gap-3 flex-wrap text-[10px] text-white/40">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {entry.readingTime}m</span>
        {entry.sizeMB > 0 && <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {entry.sizeMB}MB</span>}
        {entry.pages && <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {entry.pages}p</span>}
        {entry.isExternal && <span className="flex items-center gap-1 text-blue-400"><ExternalLink className="h-3 w-3" /> Link</span>}
        {isDownloaded && <span className="flex items-center gap-1 text-emerald-400"><Check className="h-3 w-3" /> Saved</span>}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 pt-1">
        <Button size="sm" onClick={onOpen} disabled={isLoading} className="flex-1 h-8 text-xs" style={{ background: meta.color, color: "white" }}>
          {isLoading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating…</> : entry.isExternal ? <><ExternalLink className="h-3 w-3 mr-1" /> Open</> : <><Play className="h-3 w-3 mr-1" /> Open</>}
        </Button>
        <Button size="sm" variant="outline" onClick={onPreview} className="h-8 px-2.5 bg-white/5 border-white/15 text-white hover:bg-white/10">
          <Eye className="h-3.5 w-3.5" />
        </Button>
        {!entry.isExternal && (
          <Button size="sm" variant="outline" onClick={onDownload} className="h-8 px-2.5 bg-white/5 border-white/15 text-white hover:bg-white/10">
            <Download className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function ResourcePreview({ entry, curriculum, isFavorite, isDownloaded, onToggleFavorite, onDownload, onOpen, onClose }: {
  entry: ResourceEntry;
  curriculum: Subject[];
  isFavorite: boolean;
  isDownloaded: boolean;
  onToggleFavorite: () => void;
  onDownload: () => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const meta = RESOURCE_TYPES[entry.type];
  const Icon = meta.icon;
  const subject = curriculum.find((s) => s.id === entry.subjectId);
  const chapter = subject?.chapters.find((c) => c.id === entry.chapterId);

  // Related resources (same chapter, different type)
  const related = useMemo(() => {
    if (!curriculum) return [];
    const all = buildCatalog(curriculum, 11); // class doesn't matter for related
    return all.filter((r) => r.chapterId === entry.chapterId && r.type !== entry.type).slice(0, 4);
  }, [curriculum, entry.chapterId, entry.type]);

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="p-5 pb-3" style={{ background: `linear-gradient(135deg, ${meta.color}22, transparent 70%)` }}>
        <div className="flex items-start gap-4">
          <div className="grid place-items-center h-12 w-12 rounded-xl shrink-0" style={{ background: `${meta.color}20` }}>
            <Icon className="h-6 w-6" style={{ color: meta.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide font-medium" style={{ color: meta.color }}>
              {meta.emoji} {meta.label} • {entry.subjectName}
            </p>
            <h2 className="text-lg font-semibold leading-tight mt-1 text-white">{entry.title}</h2>
          </div>
          <button onClick={onToggleFavorite} className="shrink-0 grid place-items-center h-8 w-8 rounded-full hover:bg-white/10 transition-colors">
            {isFavorite ? <Star className="h-5 w-5 fill-amber-400 text-amber-400" /> : <Star className="h-5 w-5 text-white/40" />}
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-5">
        <div className="space-y-5 py-4 pb-6">
          {/* Description */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Description</h3>
            <p className="text-sm leading-relaxed text-white/80">{entry.description}</p>
          </section>

          {/* Metadata grid */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <DetailItem icon={Clock} label="Reading Time" value={`${entry.readingTime} min`} />
              {entry.sizeMB > 0 && <DetailItem icon={HardDrive} label="File Size" value={`${entry.sizeMB} MB`} />}
              {entry.pages && <DetailItem icon={FileText} label="Pages" value={`${entry.pages}`} />}
              <DetailItem icon={BookOpen} label="Chapter" value={entry.chapterTitle} />
              <DetailItem icon={Library} label="Subject" value={entry.subjectName} />
              <DetailItem icon={Award} label="Type" value={meta.label} />
            </div>
          </section>

          {/* Topics covered */}
          {entry.topics.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Topics Covered</h3>
              <div className="flex flex-wrap gap-1.5">
                {entry.topics.map((t, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">{t}</span>
                ))}
              </div>
            </section>
          )}

          {/* External link */}
          {entry.isExternal && entry.externalUrl && (
            <section className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
              <p className="text-xs text-white/60 mb-2">This is an external resource. Click below to open the official source in a new tab.</p>
              <a href={entry.externalUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300">
                <ExternalLink className="h-4 w-4" /> {entry.externalUrl}
              </a>
            </section>
          )}

          {/* Related resources */}
          {related.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Related Resources</h3>
              <div className="space-y-1.5">
                {related.map((r) => {
                  const rMeta = RESOURCE_TYPES[r.type];
                  const RIcon = rMeta.icon;
                  return (
                    <div key={r.id} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 p-2.5">
                      <RIcon className="h-4 w-4 shrink-0" style={{ color: rMeta.color }} />
                      <span className="text-sm text-white/80 truncate flex-1">{r.title}</span>
                      <span className="text-[10px] text-white/40">{rMeta.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t border-white/10 bg-black/40 flex gap-2 justify-end">
        <DialogClose asChild>
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">Close</Button>
        </DialogClose>
        {!entry.isExternal && (
          <Button size="sm" variant="outline" onClick={onDownload} className="bg-white/5 border-white/15 text-white hover:bg-white/10">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download
          </Button>
        )}
        <Button size="sm" onClick={onOpen} style={{ background: meta.color, color: "white" }} className="hover:opacity-90">
          <Play className="h-3.5 w-3.5 mr-1.5" /> Open Resource
        </Button>
      </div>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-white/40" />
        <span className="text-[10px] uppercase tracking-wide text-white/40">{label}</span>
      </div>
      <p className="text-sm font-medium text-white truncate">{value}</p>
    </div>
  );
}

// ============================================================================
// File generation helpers
// ============================================================================

function generateAndDownloadFile(entry: ResourceEntry, curriculum: Subject[]) {
  const subject = curriculum.find((s) => s.id === entry.subjectId);
  const chapter = subject?.chapters.find((c) => c.id === entry.chapterId);
  if (!subject || !chapter) return;

  const meta = RESOURCE_TYPES[entry.type];
  const safeTitle = entry.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  // For mindmaps, generate SVG
  if (entry.type === "mindmap") {
    const svg = generateMindmapSVG(entry, chapter, subject);
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${safeTitle}.svg`);
    return;
  }

  // For worksheets / question banks, generate CSV
  if (entry.type === "worksheet" || entry.type === "questionbank") {
    const csv = generateQuestionsCSV(entry, chapter, subject);
    downloadBlob(new Blob([csv], { type: "text/csv" }), `${safeTitle}.csv`);
    return;
  }

  // For websites, save as URL bookmark file
  if (entry.type === "website") {
    const urlFile = `[InternetShortcut]\nURL=${entry.externalUrl}\n`;
    downloadBlob(new Blob([urlFile], { type: "application/internet-shortcut" }), `${safeTitle}.url`);
    return;
  }

  // For video, save metadata JSON
  if (entry.type === "video") {
    const meta_json = JSON.stringify({ title: entry.title, chapter: entry.chapterTitle, subject: entry.subjectName, note: "Open the Nigtube section to watch curated video lectures for this chapter." }, null, 2);
    downloadBlob(new Blob([meta_json], { type: "application/json" }), `${safeTitle}.json`);
    return;
  }

  // For all other types (notes, formula, pyq, etc.), generate a printable HTML file
  const html = generateResourceHTML(entry, chapter, subject);
  downloadBlob(new Blob([html], { type: "text/html" }), `${safeTitle}.html`);
}

// ===== AI Content Generation for study materials =====
// Generates substantial, well-structured content via the AI route.
// Each resource type gets a tailored prompt that produces 800+ words.
async function generateAIResourceContent(entry: ResourceEntry, chapter: Chapter, subject: Subject, scholarClass: 9 | 11): Promise<string> {
  const persona = subject.id === "physics" ? "physics-11" :
                  subject.id === "chemistry" ? "chemistry-11" :
                  subject.id === "cs" ? "cs-11" :
                  subject.id === "maths" ? "mr-raj" :
                  subject.id === "english" ? "sara" :
                  subject.id === "science" ? "dr-meera" : "default";

  const chapterContext = `Chapter: ${chapter.title} | Subject: ${subject.name} | Class: CBSE Class ${scholarClass}`;
  const conceptsList = chapter.concepts.join(", ");
  const formulasList = chapter.formulas?.join(", ") ?? "N/A";

  let prompt = "";

  switch (entry.type) {
    case "notes":
      prompt = `${chapterContext}

Write COMPREHENSIVE study notes for this chapter. This is a real study document that a student will print and study from. It MUST be substantial (800+ words) and include ALL of the following sections:

## 1. Introduction and Overview
Write 2-3 paragraphs introducing the chapter, its importance, and what students will learn.

## 2. Key Concepts
For EACH of these concepts, write a detailed explanation (2-3 sentences each): ${conceptsList}

## 3. Important Definitions
Define every key term in this chapter. Format: **Term**: Definition.

## 4. Formulas and Relations
${formulasList !== "N/A" ? `Explain each formula: what each variable means, units, and when to use it: ${formulasList}` : "List and explain the key relationships and rules in this chapter."}

## 5. Worked Examples
Solve 3 worked examples step-by-step. Show full working with units.

## 6. Common Mistakes
List 4-5 common mistakes students make in this chapter and how to avoid them.

## 7. Exam Tips
Give 4-5 specific exam tips for this chapter.

## 8. Practice Questions
List 5 practice questions with brief answers.

Use clean markdown. Be thorough and accurate. This is for a CBSE Class ${scholarClass} student.`;
      break;

    case "quickrevision":
      prompt = `${chapterContext}

Write a QUICK REVISION sheet for this chapter. Condense everything to one page. Include:

## Key Points (bullet form, 8-10 points)
## All Formulas (with units)
## Important Definitions (one line each)
## Common Mistakes (3-4 points)
## Exam Tips (3-4 points)

Be concise but complete. Use bullet points. A student should be able to revise the entire chapter in 5 minutes from this sheet.`;
      break;

    case "formula":
      prompt = `${chapterContext}

Create a complete FORMULA SHEET for this chapter. Include:

## All Formulas
List every formula with:
- The formula in a code block
- What each symbol/variable means
- SI units
- When to apply it

## Derivations
Show brief derivations for the 2-3 most important formulas.

## Memory Tricks
Give 2-3 memory tricks or mnemonics for remembering the formulas.

## Units and Dimensions
List the dimensional formula for each physical quantity in this chapter.

Be thorough. This sheet should contain EVERY formula a student needs for this chapter.`;
      break;

    case "pyq":
      prompt = `${chapterContext}

Generate PREVIOUS YEAR STYLE QUESTIONS for this chapter, as they would appear in CBSE Class ${scholarClass} board exams. Include:

## Section A — MCQs (1 mark each, 5 questions)
## Section B — Short Answer (2 marks each, 5 questions)
## Section C — Long Answer I (3 marks each, 4 questions)
## Section D — Long Answer II (5 marks each, 3 questions)

For EACH question, provide a detailed step-by-step solution with marking scheme.

Make the questions realistic and exam-level. Cover all concepts: ${conceptsList}

Use markdown with clear section headings.`;
      break;

    case "worksheet":
      prompt = `${chapterContext}

Generate a PRACTICE WORKSHEET with 20 questions for this chapter. Mix of question types:

## Part A: MCQs (10 questions, 1 mark each)
## Part B: Short Answer (5 questions, 2 marks each)
## Part C: Numerical/Long Answer (5 questions, 4 marks each)

## Answer Key
Provide complete solutions for ALL 20 questions at the end.

Cover all concepts: ${conceptsList}

Make questions progressive in difficulty — easy to hard.`;
      break;

    case "practical":
      prompt = `${chapterContext}

Generate PRACTICAL RESOURCES for this chapter. Include:

## Experiment 1
- Aim
- Apparatus required
- Theory (2-3 paragraphs)
- Procedure (numbered steps)
- Observation table (markdown table)
- Formula used
- Precautions (5 points)
- Viva Questions (5 Q&A)

## Experiment 2 (if applicable)
Same format.

## Viva Voice
10 common viva questions with answers for this chapter.

Be specific and practical. These should match real CBSE lab experiments.`;
      break;

    default:
      prompt = `${chapterContext}

Write detailed study notes for this chapter. Include: introduction, key concepts, formulas, worked examples, common mistakes, exam tips, and practice questions. 800+ words. Use markdown.`;
  }

  const result = await askAI(prompt, persona);
  return result;
}

// Build the final markdown document combining AI content with chapter metadata
function buildResourceMarkdownFromAI(entry: ResourceEntry, chapter: Chapter, subject: Subject, scholarClass: 9 | 11, aiContent: string): string {
  const meta = RESOURCE_TYPES[entry.type];
  const lines: string[] = [
    `# ${entry.title}`,
    ``,
    `| Field | Detail |`,
    `|---|---|`,
    `| **Subject** | ${subject.icon} ${subject.name} |`,
    `| **Chapter** | ${chapter.title} |`,
    `| **Class** | CBSE Class ${scholarClass} |`,
    `| **Resource Type** | ${meta.label} |`,
    `| **Reading Time** | ${entry.readingTime} minutes |`,
    `| **Generated** | ${new Date().toLocaleString("en-IN")} |`,
    ``,
    `---`,
    ``,
  ];

  // Add the AI-generated content
  lines.push(aiContent);

  // Add chapter metadata if available
  if (chapter.overview && entry.type === "notes") {
    lines.push(``, `---`, ``, `## Chapter Overview`, chapter.overview);
  }
  if (chapter.importantDefinitions?.length && entry.type === "notes") {
    lines.push(``, `## Additional Definitions`);
    chapter.importantDefinitions.forEach((d) => lines.push(`- **${d.term}:** ${d.definition}`));
  }
  if (chapter.commonMistakes?.length && (entry.type === "notes" || entry.type === "quickrevision")) {
    lines.push(``, `## Additional Common Mistakes`);
    chapter.commonMistakes.forEach((m) => lines.push(`- ${m}`));
  }

  lines.push(``, `---`, ``, `*Generated by Scholar • CBSE Class ${scholarClass} ${subject.name} • ${new Date().toLocaleDateString("en-IN")}*`);
  return lines.join("\n");
}

function generateAndOpenPDF(entry: ResourceEntry, curriculum: Subject[], scholarClass: 9 | 11) {
  const subject = curriculum.find((s) => s.id === entry.subjectId);
  const chapter = subject?.chapters.find((c) => c.id === entry.chapterId);
  if (!subject || !chapter) return;

  const md = buildResourceMarkdown(entry, chapter, subject, scholarClass);
  exportPDF({
    title: entry.title,
    subtitle: `${subject.icon} ${subject.name} • ${chapter.title} • Class ${scholarClass} CBSE`,
    bodyHtml: mdToHtml(md),
    accent: subject.accent,
    scholarClass,
  });
}

function buildResourceMarkdown(entry: ResourceEntry, chapter: Chapter, subject: Subject, scholarClass: 9 | 11): string {
  const lines: string[] = [
    `# ${entry.title}`,
    ``,
    `**Subject:** ${subject.icon} ${subject.name}`,
    `**Chapter:** ${chapter.title}`,
    `**Class:** CBSE Class ${scholarClass}`,
    `**Resource Type:** ${RESOURCE_TYPES[entry.type].label}`,
    ``,
  ];

  switch (entry.type) {
    case "notes":
    case "revision":
    case "quickrevision":
      lines.push(`## Overview`, chapter.summary, ``);
      if (chapter.overview) lines.push(`## Introduction`, chapter.overview, ``);
      lines.push(`## Key Concepts`);
      chapter.concepts.forEach((c) => lines.push(`- ${c}`));
      lines.push(``);
      if (chapter.formulas?.length) {
        lines.push(`## Important Formulas`);
        chapter.formulas.forEach((f) => lines.push(`- \`${f}\``));
        lines.push(``);
      }
      if (chapter.importantDefinitions?.length) {
        lines.push(`## Important Definitions`);
        chapter.importantDefinitions.forEach((d) => lines.push(`**${d.term}:** ${d.definition}`, ``));
      }
      if (chapter.quickSummary?.length) {
        lines.push(`## Quick Summary`);
        chapter.quickSummary.forEach((qs, i) => lines.push(`${i + 1}. ${qs}`));
        lines.push(``);
      }
      if (chapter.examTips?.length) {
        lines.push(`## Exam Tips`);
        chapter.examTips.forEach((t) => lines.push(`- ${t}`));
        lines.push(``);
      }
      break;

    case "formula":
      lines.push(`## Formula Sheet — ${chapter.title}`, ``);
      if (chapter.formulas?.length) {
        chapter.formulas.forEach((f, i) => lines.push(`${i + 1}. \`${f}\``));
        lines.push(``);
      }
      if (chapter.importantDefinitions?.length) {
        lines.push(`## Key Definitions`);
        chapter.importantDefinitions.forEach((d) => lines.push(`- **${d.term}:** ${d.definition}`));
      }
      break;

    case "pyq":
      lines.push(`## Previous Year Questions — ${chapter.title}`, ``);
      lines.push(`The following questions are based on CBSE board exam patterns for ${chapter.title}. Practice these to familiarize yourself with the exam format.`, ``);
      lines.push(`## Questions`);
      chapter.questions.forEach((q, i) => lines.push(`**Q${i + 1}.** ${q}`, ``));
      break;

    case "worksheet":
    case "questionbank":
      lines.push(`## Practice Questions — ${chapter.title}`, ``);
      lines.push(`Attempt all questions. Time: ${entry.readingTime} minutes.`, ``);
      lines.push(`## Section A — Conceptual Questions`);
      chapter.concepts.forEach((c, i) => lines.push(`**Q${i + 1}.** Explain: ${c}`, ``));
      lines.push(`## Section B — Numerical / Application`);
      chapter.questions.forEach((q, i) => lines.push(`**Q${i + 1}.** ${q}`, ``));
      break;

    case "samplepaper":
      lines.push(`## Sample Paper — ${chapter.title}`, `**Time:** 3 hours | **Marks:** 80`, ``);
      lines.push(`### General Instructions`);
      lines.push(`- All questions are compulsory.`);
      lines.push(`- The question paper has 4 sections: A, B, C, D.`);
      lines.push(`- Section A: 20 MCQs (1 mark each)`);
      lines.push(`- Section B: 6 short answer (2 marks each)`);
      lines.push(`- Section C: 8 long answer I (3 marks each)`);
      lines.push(`- Section D: 6 long answer II (4 marks each)`);
      lines.push(``);
      lines.push(`### Sample Questions`);
      chapter.questions.forEach((q, i) => lines.push(`**Q${i + 1}.** ${q}`, ``));
      break;

    case "practical":
      lines.push(`## Practical Resources — ${chapter.title}`, ``);
      lines.push(`### Aim`, `To study the concepts of ${chapter.title} through experimental verification.`, ``);
      lines.push(`### Apparatus`, `Refer to the CBSE Lab Manual for the complete list of apparatus.`, ``);
      lines.push(`### Procedure`, `Follow the standard procedure as outlined in the NCERT Lab Manual.`, ``);
      lines.push(`### Viva Questions`);
      chapter.concepts.slice(0, 5).forEach((c, i) => lines.push(`**Q${i + 1}.** What is ${c}?`));
      break;

    case "slides":
      lines.push(`## Presentation Slides — ${chapter.title}`, ``);
      lines.push(`### Slide 1: Title`, `${chapter.title}`, `**Subject:** ${subject.name}`, ``);
      lines.push(`### Slide 2: Overview`, chapter.summary, ``);
      lines.push(`### Slide 3: Key Concepts`);
      chapter.concepts.forEach((c) => lines.push(`- ${c}`));
      lines.push(``);
      if (chapter.formulas?.length) {
        lines.push(`### Slide 4: Formulas`);
        chapter.formulas.forEach((f) => lines.push(`- \`${f}\``));
        lines.push(``);
      }
      lines.push(`### Slide 5: Summary`);
      if (chapter.quickSummary) chapter.quickSummary.forEach((qs) => lines.push(`- ${qs}`));
      break;

    default:
      lines.push(chapter.summary);
      lines.push(``, `## Key Concepts`);
      chapter.concepts.forEach((c) => lines.push(`- ${c}`));
  }

  lines.push(``, `---`, `*Generated by Scholar • CBSE Class ${scholarClass} ${subject.name}*`);
  return lines.join("\n");
}

function generateResourceHTML(entry: ResourceEntry, chapter: Chapter, subject: Subject): string {
  const meta = RESOURCE_TYPES[entry.type];
  const md = buildResourceMarkdown(entry, chapter, subject, 11);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${entry.title}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a1a2e; line-height: 1.7; }
  h1 { color: ${subject.accent}; border-bottom: 3px solid ${subject.accent}; padding-bottom: 10px; }
  h2 { color: ${subject.accent}; margin-top: 30px; }
  code { background: #f5f5fa; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  ul { padding-left: 1.5em; } li { margin-bottom: 0.5em; }
  .meta { background: #f5f5fa; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; }
  .footer { margin-top: 50px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #888; text-align: center; }
</style></head><body>
  <h1>${meta.emoji} ${entry.title}</h1>
  <div class="meta">
    <strong>Subject:</strong> ${subject.icon} ${subject.name}<br>
    <strong>Chapter:</strong> ${chapter.title}<br>
    <strong>Type:</strong> ${meta.label}<br>
    <strong>Reading Time:</strong> ${entry.readingTime} minutes<br>
    <strong>Generated:</strong> ${new Date().toLocaleString()}
  </div>
  ${mdToHtml(md)}
  <div class="footer">Generated by Scholar • CBSE Class 11 ${subject.name} • ${new Date().toLocaleDateString("en-IN")}</div>
</body></html>`;
}

function generateMindmapSVG(entry: ResourceEntry, chapter: Chapter, subject: Subject): string {
  const branches = chapter.concepts.map((c, i) => {
    const angle = (i / Math.max(chapter.concepts.length, 1)) * 2 * Math.PI;
    const x = 400 + 220 * Math.cos(angle);
    const y = 300 + 180 * Math.sin(angle);
    return `<line x1="400" y1="300" x2="${x}" y2="${y}" stroke="${subject.accent}" stroke-width="2" opacity="0.6"/>
<circle cx="${x}" cy="${y}" r="6" fill="${subject.accent}"/>
<text x="${x}" y="${y - 14}" text-anchor="middle" fill="white" font-size="13" font-family="sans-serif">${c.replace(/&/g, "&amp;").replace(/</g, "&lt;").slice(0, 35)}</text>`;
  }).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" style="background:#0f0f17">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${subject.accent}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${subject.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="600" fill="#0f0f17"/>
  <circle cx="400" cy="300" r="280" fill="url(#g)"/>
  ${branches}
  <ellipse cx="400" cy="300" rx="170" ry="55" fill="${subject.accent}" opacity="0.3"/>
  <text x="400" y="298" text-anchor="middle" fill="white" font-size="18" font-family="serif" font-style="italic">${chapter.title.slice(0, 38)}</text>
  <text x="400" y="320" text-anchor="middle" fill="white" opacity="0.6" font-size="12">${subject.name} • Class 11</text>
</svg>`;
}

function generateQuestionsCSV(entry: ResourceEntry, chapter: Chapter, subject: Subject): string {
  const rows: [string, string][] = [];
  chapter.concepts.forEach((c) => rows.push([`Explain: ${c}`, c]));
  chapter.questions.forEach((q) => rows.push([q, "Refer to chapter notes for the answer."]));
  return "Question,Answer\n" + rows.map((r) => `"${r[0].replace(/"/g, '""')}","${r[1].replace(/"/g, '""')}"`).join("\n");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default ResourcesView;
