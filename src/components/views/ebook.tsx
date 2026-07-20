"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { askAI } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ChemistryEbookSystem,
  MathsEbookSystem,
} from "@/components/views/maths-ebook-system";
import { BookModeReader } from "@/components/ebook/book-mode-reader";
import { ElamAssistant } from "@/components/ebook/elam-assistant";
import { setLamPageContext } from "@/lib/lam-context";
import {
  BookOpen,
  Search,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Zap,
  FileText,
  Sparkles,
  Loader2,
  X,
  ListChecks,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  PenLine,
  Tag,
  CheckCircle2,
  Eye,
  Upload,
  BookMarked,
  RefreshCw,
  FileStack,
  AlertCircle,
  Loader,
  ArrowRight,
  Save,
} from "lucide-react";

// ============================================================================
// E-Book — Page-Based Scanned Textbook Reader (Class 11 Physics)
// ============================================================================

const TOTAL_PAGES = 96; // Default for physics
const EB_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.eb-glass { background: rgba(255,255,255,0.02); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }
.eb-glass-strong { background: rgba(14,16,20,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; }
.eb-font { font-family: 'Inter', system-ui, sans-serif; }
.eb-scroll::-webkit-scrollbar { width: 6px; }
.eb-scroll::-webkit-scrollbar-track { background: transparent; }
.eb-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
@keyframes shiny { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
.eb-shiny { animation: shiny 6s linear infinite; }
`;

interface ChapterMapping {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
  color: string;
}

interface EbookBook {
  id: string;
  title: string;
  subject: string;
  totalPages: number;
  pageDir: string; // e.g. "ebook-pages" or "ebook-pages-maths"
  chapters: ChapterMapping[];
}

interface PageNote {
  page: number;
  text: string;
  tags: string[];
  createdAt: number;
}

interface PageBookmark {
  id: string;
  page: number;
  title: string;
  chapterId?: string;
  createdAt: number;
  note?: string;
}

const BOOKS: EbookBook[] = [
  {
    id: "physics-pt1",
    title: "Physics Part 1",
    subject: "Physics",
    totalPages: 96,
    pageDir: "ebook-pages",
    chapters: [
      {
        id: "ch1",
        title: "Units and Measurement",
        startPage: 1,
        endPage: 45,
        color: "#3b82f6",
      },
      {
        id: "ch2",
        title: "Motion in a Straight Line",
        startPage: 46,
        endPage: 90,
        color: "#10b981",
      },
    ],
  },
  {
    id: "maths-pt1",
    title: "Mathematics Part 1",
    subject: "Mathematics",
    totalPages: 37,
    pageDir: "ebook-pages-maths",
    chapters: [
      { id: "m1", title: "Sets", startPage: 1, endPage: 22, color: "#6366f1" },
      {
        id: "m2",
        title: "Relations and Functions",
        startPage: 23,
        endPage: 37,
        color: "#a855f7",
      },
    ],
  },
  {
    id: "chemistry-pt1",
    title: "Chemistry Part 1",
    subject: "Chemistry",
    totalPages: 60,
    pageDir: "ebook-pages-chemistry",
    chapters: [
      {
        id: "c1",
        title: "Some Basic Concepts of Chemistry",
        startPage: 1,
        endPage: 26,
        color: "#f43f5e",
      },
      {
        id: "c2",
        title: "Structure of Atom",
        startPage: 27,
        endPage: 60,
        color: "#f59e0b",
      },
    ],
  },
];

const PAGE_TAGS = [
  "Theory",
  "Formula",
  "Example",
  "Solved Question",
  "Homework",
  "Exercise",
  "Important",
  "Difficult",
  "Revision",
  "Doubt",
  "Diagram",
  "Derivation",
];

const STORAGE_KEY = "eb-reader-data";

function loadData() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveData(data: any) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function pageImage(page: number, pageDir: string = "ebook-pages") {
  return `/${pageDir}/page-${String(page).padStart(3, "0")}.png`;
}

export function EBookView() {
  const addXP = useStore((s) => s.addXP);
  const pushActivity = useStore((s) => s.pushActivity);
  const addNote = useStore((s) => s.addNote);

  // State
  const [view, setView] = useState<"home" | "reader">("home");
  const [activeBookId, setActiveBookId] = useState<string>("physics-pt1");
  const [activePage, setActivePage] = useState(1);

  useEffect(() => {
    const ebookTitle =
      activeBookId === "maths-pt1"
        ? "Mathematics Part 1"
        : activeBookId === "chemistry-pt1"
          ? "Chemistry Part 1"
          : "Physics Part 1";
    setLamPageContext({ ebookTitle, sourcePageNumber: activePage });
    return () => setLamPageContext({});
  }, [activeBookId, activePage]);
  const [notes, setNotes] = useState<Record<number, PageNote>>({});
  const [bookmarks, setBookmarks] = useState<PageBookmark[]>([]);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [bookModeOpen, setBookModeOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [readerMode, setReaderMode] = useState<"single" | "continuous">(
    "single",
  );
  const [search, setSearch] = useState("");
  const [mapperOpen, setMapperOpen] = useState(false);
  const [noteModal, setPageNoteModal] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [ocrModal, setOcrModal] = useState<number | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrReviewed, setOcrReviewed] = useState<Record<number, string>>({});
  const [aiExplainPage, setAiExplainPage] = useState<number | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    try {
      const pending = JSON.parse(
        sessionStorage.getItem("scholar:ebook:target") ?? "null",
      ) as { bookId?: string; page?: number } | null;
      if (
        pending?.bookId === "maths-pt1" ||
        pending?.bookId === "chemistry-pt1"
      ) {
        setActiveBookId(pending.bookId);
        if (pending.page) setActivePage(pending.page);
        setView("reader");
        localStorage.setItem("scholar:ebook:last-book", pending.bookId);
      } else if (
        ["physics-pt1", "maths-pt1", "chemistry-pt1"].includes(
          localStorage.getItem("scholar:ebook:last-book") ?? "",
        )
      ) {
        // Remember the selected card, but always open the E-Book route on its
        // library menu. Only an explicit deep link may enter a reader directly.
        setActiveBookId(localStorage.getItem("scholar:ebook:last-book")!);
      }
    } catch {
      /* use the normal library entry point */
    }
  }, []);

  // Derived: active book
  const activeBook = BOOKS.find((b) => b.id === activeBookId) ?? BOOKS[0];
  const chapters = activeBook.chapters;
  const totalPages = activeBook.totalPages;
  const pageDir = activeBook.pageDir;

  // Load persisted data
  useEffect(() => {
    const data = loadData();
    if (data) {
      if (data.notes) setNotes(data.notes);
      if (data.bookmarks) setBookmarks(data.bookmarks);
      if (data.ocrReviewed) setOcrReviewed(data.ocrReviewed);
      if (data.lastPage) setActivePage(data.lastPage);
    }
  }, []);

  // Persist
  const persist = useCallback(
    (
      updates: Partial<{
        notes: Record<number, PageNote>;
        bookmarks: PageBookmark[];
        ocrReviewed: Record<number, string>;
        lastPage: number;
      }>,
    ) => {
      const data = loadData() ?? {};
      const merged = { ...data, ...updates };
      saveData(merged);
      if (updates.notes) setNotes(updates.notes);
      if (updates.bookmarks) setBookmarks(updates.bookmarks);
      if (updates.ocrReviewed) setOcrReviewed(updates.ocrReviewed);
      if (updates.lastPage !== undefined) setActivePage(updates.lastPage);
    },
    [],
  );

  // Navigation
  const goNext = useCallback(() => {
    if (activePage < totalPages) {
      const next = activePage + 1;
      setActivePage(next);
      persist({ lastPage: next });
    }
  }, [activePage, persist]);

  const goPrev = useCallback(() => {
    if (activePage > 1) {
      const prev = activePage - 1;
      setActivePage(prev);
      persist({ lastPage: prev });
    }
  }, [activePage, persist]);

  const jumpTo = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setActivePage(page);
        persist({ lastPage: page });
      }
    },
    [persist],
  );

  // Bookmark toggle
  const toggleBookmark = useCallback(
    (page: number) => {
      const existing = bookmarks.find((b) => b.page === page);
      if (existing) {
        persist({ bookmarks: bookmarks.filter((b) => b.id !== existing.id) });
        toast.success("Bookmark removed");
      } else {
        const ch = chapters.find(
          (c) => page >= c.startPage && page <= c.endPage,
        );
        const bm: PageBookmark = {
          id: `bm-${Date.now()}`,
          page,
          title: `Pg ${page}`,
          chapterId: ch?.id,
          createdAt: Date.now(),
        };
        persist({ bookmarks: [bm, ...bookmarks] });
        toast.success("Bookmarked");
        addXP(1);
      }
    },
    [bookmarks, chapters, persist, addXP],
  );

  // Save note
  const saveNote = useCallback(() => {
    if (noteModal === null) return;
    const note: PageNote = {
      page: noteModal,
      text: noteText,
      tags: noteTags,
      createdAt: Date.now(),
    };
    persist({ notes: { ...notes, [noteModal]: note } });
    toast.success("Note saved");
    setPageNoteModal(null);
    setNoteText("");
    setNoteTags([]);
    addXP(2);
  }, [noteModal, noteText, noteTags, notes, persist, addXP]);

  // OCR extract
  const runOCR = useCallback(async (page: number) => {
    setOcrLoading(true);
    setOcrText("");
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, bookId: activeBookId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OCR failed");
      setOcrText(data.text || "(No text extracted)");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "OCR failed. Try again.";
      toast.error("OCR failed", { description: message });
      setOcrText(`OCR error: ${message}`);
    } finally {
      setOcrLoading(false);
    }
  }, []);

  // Save reviewed OCR
  const saveOCR = useCallback(() => {
    if (ocrModal === null) return;
    persist({ ocrReviewed: { ...ocrReviewed, [ocrModal]: ocrText } });
    toast.success("OCR text saved for this page");
    setOcrModal(null);
    setOcrText("");
  }, [ocrModal, ocrText, ocrReviewed, persist]);

  const resolveElamPageText = useCallback(async () => {
    const saved = ocrReviewed[activePage];
    if (saved?.trim()) return saved;
    const response = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: activePage, bookId: "physics-pt1" }),
    });
    const result = await response.json();
    if (!response.ok || !result.text) throw new Error(result.error || "ELAM could not read this page");
    const next = { ...ocrReviewed, [activePage]: result.text as string };
    persist({ ocrReviewed: next });
    return result.text as string;
  }, [activePage, ocrReviewed, persist]);

  // AI Explain
  const handleAIExplain = useCallback(
    async (page: number) => {
      setAiExplainPage(page);
      setAiExplanation(null);
      setAiLoading(true);
      try {
        const ocrContent = ocrReviewed[page];
        const prompt = ocrContent
          ? `Explain this CBSE Class 11 Physics textbook page content in simple terms:\n\n${ocrContent}\n\nKeep it under 200 words. Use markdown.`
          : `The user is reading page ${page} of their Class 11 Physics textbook (Chapter: ${chapters.find((c) => page >= c.startPage && page <= c.endPage)?.title ?? "Unknown"}). Give a brief overview of what this page likely covers and key concepts to focus on. Keep it under 150 words.`;
        const result = await askAI(prompt, "physics-11");
        setAiExplanation(result);
      } catch {
        toast.error("Could not generate explanation");
      } finally {
        setAiLoading(false);
      }
    },
    [ocrReviewed, chapters],
  );

  // Search
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const results: {
      type: string;
      label: string;
      page: number;
      snippet: string;
    }[] = [];
    // Search bookmarks
    bookmarks.forEach((bm) => {
      if (bm.title.toLowerCase().includes(q) || `pg ${bm.page}`.includes(q)) {
        results.push({
          type: "bookmark",
          label: bm.title,
          page: bm.page,
          snippet: `Bookmark on Pg ${bm.page}`,
        });
      }
    });
    // Search notes
    Object.values(notes).forEach((note) => {
      if (
        note.text.toLowerCase().includes(q) ||
        note.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        results.push({
          type: "note",
          label: `Pg ${note.page} note`,
          page: note.page,
          snippet: note.text.slice(0, 80),
        });
      }
    });
    // Search reviewed OCR
    Object.entries(ocrReviewed).forEach(([pageStr, text]) => {
      if (text.toLowerCase().includes(q)) {
        const page = parseInt(pageStr);
        const idx = text.toLowerCase().indexOf(q);
        results.push({
          type: "ocr",
          label: `Pg ${page} (OCR)`,
          page,
          snippet: text.substring(Math.max(0, idx - 30), idx + q.length + 30),
        });
      }
    });
    return results.slice(0, 20);
  }, [search, bookmarks, notes, ocrReviewed]);

  // Stats
  const totalNotes = Object.keys(notes).length;
  const totalBookmarks = bookmarks.length;
  const totalOcrReviewed = Object.keys(ocrReviewed).length;

  // Get chapter for page
  const getChapter = (page: number) =>
    chapters.find((c) => page >= c.startPage && page <= c.endPage);

  // Reading progress
  const progress = Math.round((activePage / totalPages) * 100);

  // ===== HOME VIEW =====
  if (view === "home") {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] bg-[#0a0a0f] overflow-hidden -m-4 lg:-m-6 text-white eb-font">
        <style>{EB_STYLE}</style>
        <div className="fixed inset-0 z-0 pointer-events-none">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-20"
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4"
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Nav */}
          <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between py-4"
          >
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-white/5 border border-white/10">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <span className="text-white font-semibold text-lg">E-Book</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMapperOpen(true)}
              className="bg-white/5 border-white/15 text-white hover:bg-white/10"
            >
              <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Chapter Mapper
            </Button>
          </motion.nav>

          {/* Hero */}
          <div className="mt-8 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-1.5 eb-glass rounded-full px-3 py-1 text-xs text-white/50 mb-5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SCANNED TEXTBOOK READER · CBSE CLASS 11 · {totalPages} PAGES
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-white"
            >
              {activeBook.subject}{" "}
              <span
                className="eb-shiny"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #091020, #0B2551 12.5%, #A4F4FD 32.5%, #00d2ff 50%, #0B2551 67.5%, #091020 87.5%, #091020)",
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  WebkitTextFillColor: "transparent",
                }}
              >
                E-Book
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 text-white/60 max-w-md text-sm leading-relaxed"
            >
              Select a chapter from {activeBook.title}, continue from your saved
              page, or open its complete reader. Bookmarks, notes, and progress
              stay saved to this profile.
            </motion.p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              {
                icon: FileStack,
                label: "Pages",
                value: totalPages,
                accent: "#6366f1",
              },
              {
                icon: BookOpen,
                label: "Chapters",
                value: chapters.length,
                accent: "#10b981",
              },
              {
                icon: Bookmark,
                label: "Bookmarks",
                value: totalBookmarks,
                accent: "#f59e0b",
              },
              {
                icon: PenLine,
                label: "Notes",
                value: totalNotes,
                accent: "#0ea5e9",
              },
              {
                icon: Eye,
                label: "OCR Reviewed",
                value: totalOcrReviewed,
                accent: "#a855f7",
              },
            ].map((s, i) => (
              <div
                key={i}
                className="eb-glass rounded-xl p-3 flex items-center gap-3"
              >
                <div
                  className="grid place-items-center h-9 w-9 rounded-lg"
                  style={{ background: `${s.accent}15` }}
                >
                  <s.icon className="h-4 w-4" style={{ color: s.accent }} />
                </div>
                <div>
                  <p className="text-lg font-bold text-white leading-none">
                    {s.value}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-white/40 mt-0.5">
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Continue Reading */}
          <div
            className="eb-glass rounded-2xl p-4 mb-6 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setView("reader")}
          >
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-white/10">
                <BookOpen className="h-6 w-6 text-indigo-300" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-white/40">
                  Continue Reading
                </p>
                <p className="text-sm font-semibold text-white">
                  Pg {activePage} —{" "}
                  {getChapter(activePage)?.title ?? "Unassigned"}
                </p>
                <p className="text-xs text-white/50">
                  {progress}% through book
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/30" />
          </div>

          {/* Search */}
          <div className="eb-glass rounded-2xl p-4 mb-6">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Search bookmarks, notes, and reviewed OCR text..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <p className="text-[10px] text-white/30 mb-2">
              Search works on manually added bookmarks, notes, tags, and
              reviewed OCR only. Unreviewed pages are not searched.
            </p>
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto eb-scroll">
                {searchResults.map((r, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-xs cursor-pointer hover:bg-white/10"
                    onClick={() => {
                      jumpTo(r.page);
                      setView("reader");
                    }}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge
                        className="text-[9px] px-1.5 py-0"
                        variant="secondary"
                      >
                        {r.type}
                      </Badge>
                      <span className="text-white/80 font-medium">
                        {r.label}
                      </span>
                    </div>
                    <p className="text-white/50">{r.snippet}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Book Selector */}
          <p className="text-sm text-white/50 mb-3">Select Book</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {BOOKS.map((book) => (
              <button
                key={book.id}
                onClick={() => {
                  setActiveBookId(book.id);
                  setActivePage(1);
                  localStorage.setItem("scholar:ebook:last-book", book.id);
                }}
                className={`p-4 rounded-xl border transition-all text-left ${activeBookId === book.id ? "border-violet-500/40 bg-violet-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/5"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen
                    className="h-4 w-4"
                    style={{ color: book.chapters[0]?.color ?? "#888" }}
                  />
                  <span className="text-sm font-semibold text-white">
                    {book.title}
                  </span>
                </div>
                <p className="text-[11px] text-white/40">
                  {book.subject} · {book.totalPages} pages ·{" "}
                  {book.chapters.length} chapters
                </p>
              </button>
            ))}
          </div>

          {/* Chapters */}
          <p className="text-sm text-white/50 mb-3">
            Chapters — {activeBook.title}
          </p>
          <div className="grid grid-cols-1 gap-3 mb-8">
            {chapters.map((ch, i) => {
              const chPages = ch.endPage - ch.startPage + 1;
              const chBookmarks = bookmarks.filter(
                (b) => b.page >= ch.startPage && b.page <= ch.endPage,
              ).length;
              const chNotes = Object.values(notes).filter(
                (n) => n.page >= ch.startPage && n.page <= ch.endPage,
              ).length;
              const chOcr = Object.keys(ocrReviewed)
                .map(Number)
                .filter((p) => p >= ch.startPage && p <= ch.endPage).length;
              return (
                <motion.div
                  key={ch.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="eb-glass rounded-2xl p-5 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => {
                    jumpTo(ch.startPage);
                    setView("reader");
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p
                        className="text-[11px] uppercase tracking-wide font-medium mb-1"
                        style={{ color: ch.color }}
                      >
                        Chapter {i + 1}
                      </p>
                      <h3 className="text-lg font-semibold text-white">
                        {ch.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Pg {ch.startPage}–
                          {ch.endPage} ({chPages} pages)
                        </span>
                        <span className="flex items-center gap-1">
                          <Bookmark className="h-3 w-3" /> {chBookmarks}{" "}
                          bookmarks
                        </span>
                        <span className="flex items-center gap-1">
                          <PenLine className="h-3 w-3" /> {chNotes} notes
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {chOcr} OCR'd
                        </span>
                      </div>
                    </div>
                    <div
                      className="grid place-items-center h-12 w-12 rounded-xl border border-white/10 shrink-0"
                      style={{ background: `${ch.color}15` }}
                    >
                      <BookOpen
                        className="h-6 w-6"
                        style={{ color: ch.color }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Source info */}
          <div className="eb-glass rounded-xl p-3 flex items-center gap-3 text-xs text-white/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Source:{" "}
              <strong className="text-white/70">{activeBook.title}</strong> ·{" "}
              {totalPages} scanned pages · Rendered as page images · OCR
              optional
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Mathematics Part 1 has its own synchronized scan + clean-text system.
  // Physics and the existing Class 9 experience continue through the legacy
  // scanned reader below.
  if (activeBookId === "maths-pt1") {
    return <MathsEbookSystem onBack={() => setView("home")} />;
  }
  if (activeBookId === "chemistry-pt1") {
    return <ChemistryEbookSystem onBack={() => setView("home")} />;
  }

  // ===== READER VIEW =====
  const currentChapter = getChapter(activePage);
  const isBookmarked = bookmarks.some((b) => b.page === activePage);
  const pageNote = notes[activePage];
  const hasOCR = ocrReviewed[activePage] !== undefined;

  return (
    <div
      className={`relative ${fullscreen ? "fixed inset-0 z-50" : "min-h-[calc(100vh-4rem)]"} bg-[#0a0a0f] overflow-hidden ${fullscreen ? "" : "-m-4 lg:-m-6"} text-white eb-font flex`}
    >
      <style>{EB_STYLE}</style>

      {/* Left Sidebar */}
      {showSidebar && !fullscreen && (
        <aside className="hidden lg:flex flex-col w-64 border-r border-white/10 bg-black/40 backdrop-blur-xl shrink-0 h-[calc(100vh-4rem)] sticky top-0">
          <div className="p-4 border-b border-white/10">
            <button
              onClick={() => setView("home")}
              className="flex items-center gap-2 text-sm text-white/60 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" /> Library
            </button>
          </div>
          <ScrollArea className="flex-1 px-2">
            {/* Chapters */}
            <p className="text-[10px] uppercase tracking-wide text-white/40 px-2 py-2">
              Chapters
            </p>
            {chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => jumpTo(ch.startPage)}
                className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors mb-1 ${currentChapter?.id === ch.id ? "bg-indigo-500/20 text-indigo-300" : "text-white/50 hover:bg-white/5"}`}
              >
                <span className="block truncate">{ch.title}</span>
                <span className="text-[10px] text-white/30">
                  Pg {ch.startPage}–{ch.endPage}
                </span>
              </button>
            ))}
            {/* Page grid */}
            <p className="text-[10px] uppercase tracking-wide text-white/40 px-2 py-2 mt-3">
              Pages
            </p>
            <div className="grid grid-cols-5 gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
                const ch = getChapter(pg);
                const hasNote = !!notes[pg];
                const hasBm = bookmarks.some((b) => b.page === pg);
                const hasOcr = ocrReviewed[pg] !== undefined;
                return (
                  <button
                    key={pg}
                    onClick={() => jumpTo(pg)}
                    className={`relative text-[10px] py-1.5 rounded transition-colors ${pg === activePage ? "bg-indigo-500/30 text-indigo-300 font-bold" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
                    style={
                      ch && pg !== activePage
                        ? { borderBottom: `2px solid ${ch.color}40` }
                        : {}
                    }
                  >
                    {pg}
                    {hasBm && (
                      <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                    {hasNote && (
                      <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-sky-400" />
                    )}
                    {hasOcr && (
                      <span className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-purple-400" />
                    )}
                  </button>
                );
              })}
            </div>
            {/* Bookmarks */}
            {bookmarks.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wide text-white/40 px-2 py-2 mt-3">
                  Bookmarks
                </p>
                {bookmarks.slice(0, 10).map((bm) => (
                  <div
                    key={bm.id}
                    className="text-xs text-white/50 px-3 py-1.5 rounded hover:bg-white/5 cursor-pointer flex items-center gap-1.5"
                    onClick={() => jumpTo(bm.page)}
                  >
                    <Bookmark className="h-3 w-3 text-amber-400" /> {bm.title}
                  </div>
                ))}
              </>
            )}
          </ScrollArea>
          <button
            onClick={() => setShowSidebar(false)}
            className="p-3 border-t border-white/10 text-xs text-white/40 hover:text-white flex items-center gap-1"
          >
            <PanelLeftClose className="h-3.5 w-3.5" /> Hide sidebar
          </button>
        </aside>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-black/60 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {!showSidebar && !fullscreen && (
              <button
                onClick={() => setShowSidebar(true)}
                className="text-white/50 hover:text-white"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <span className="text-xs text-white/50">Pg {activePage}</span>
            {currentChapter && (
              <Badge
                className="text-[9px] px-2 py-0"
                style={{
                  background: `${currentChapter.color}20`,
                  color: currentChapter.color,
                  border: `1px solid ${currentChapter.color}40`,
                }}
              >
                {currentChapter.title}
              </Badge>
            )}
            {pageNote && (
              <Badge className="text-[9px] px-2 py-0 bg-sky-500/20 text-sky-300">
                Has note
              </Badge>
            )}
            {hasOCR && (
              <Badge className="text-[9px] px-2 py-0 bg-purple-500/20 text-purple-300">
                OCR'd
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs text-white/40 w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(3, zoom + 0.1))}
              className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button
              onClick={() => setRotation((rotation + 90) % 360)}
              className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setBookModeOpen(true)}
              className="text-white/80 hover:text-white p-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30"
              aria-label="Enter Book Mode"
              title="Enter Book Mode"
            >
              <BookOpen className="h-4 w-4" />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button
              onClick={() => toggleBookmark(activePage)}
              className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
            >
              {isBookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-amber-400" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => {
                setPageNoteModal(activePage);
                setNoteText(pageNote?.text ?? "");
                setNoteTags(pageNote?.tags ?? []);
              }}
              className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
            >
              <PenLine className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setOcrModal(activePage);
                setOcrText(ocrReviewed[activePage] ?? "");
              }}
              className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleAIExplain(activePage)}
              className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Page Display */}
        <div className="flex-1 overflow-auto eb-scroll flex flex-col items-center p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center"
            >
              {/* Page Label */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-white/80">
                  Pg {activePage}
                </span>
                {currentChapter && (
                  <span className="text-xs text-white/40">
                    — {currentChapter.title}
                  </span>
                )}
              </div>
              {/* Page Image */}
              <div
                className="relative eb-glass rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  maxWidth: `${zoom * 100}%`,
                  transition: "max-width 0.2s",
                }}
              >
                <img
                  src={pageImage(activePage, pageDir)}
                  alt={`Page ${activePage}`}
                  className="w-full h-auto block"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: "transform 0.3s",
                  }}
                  loading="lazy"
                />
              </div>
              {/* Page Actions */}
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleBookmark(activePage)}
                  className="bg-white/5 border-white/15 text-white hover:bg-white/10 text-xs"
                >
                  {isBookmarked ? (
                    <>
                      <BookmarkCheck className="h-3.5 w-3.5 mr-1.5 text-amber-400" />{" "}
                      Bookmarked
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-3.5 w-3.5 mr-1.5" /> Bookmark
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPageNoteModal(activePage);
                    setNoteText(pageNote?.text ?? "");
                    setNoteTags(pageNote?.tags ?? []);
                  }}
                  className="bg-white/5 border-white/15 text-white hover:bg-white/10 text-xs"
                >
                  <PenLine className="h-3.5 w-3.5 mr-1.5" />{" "}
                  {pageNote ? "Edit Note" : "Add Note"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOcrModal(activePage);
                    setOcrText(ocrReviewed[activePage] ?? "");
                  }}
                  className="bg-white/5 border-white/15 text-white hover:bg-white/10 text-xs"
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" />{" "}
                  {hasOCR ? "View OCR" : "Extract Text (OCR)"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAIExplain(activePage)}
                  className="bg-white/5 border-white/15 text-white hover:bg-white/10 text-xs"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Explain
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    addNote({
                      title: `Physics E-Book Pg ${activePage}`,
                      content: `Page ${activePage} of Physics textbook. Chapter: ${currentChapter?.title ?? "Unknown"}. ${pageNote?.text ?? ""}`,
                      folder: "E-Book",
                      color: "indigo",
                      tags: ["ebook", "physics", `pg-${activePage}`],
                    });
                    toast.success("Saved to Notes");
                  }}
                  className="bg-white/5 border-white/15 text-white hover:bg-white/10 text-xs"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Save to Notes
                </Button>
              </div>
              {/* AI Explanation */}
              {aiExplainPage === activePage && (aiLoading || aiExplanation) && (
                <div className="mt-4 max-w-2xl w-full eb-glass rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wide text-violet-400 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" /> AI Explanation
                    {aiLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  </p>
                  {aiExplanation && (
                    <div
                      className="text-sm text-white/80 whitespace-pre-wrap"
                      style={{ lineHeight: 1.6 }}
                    >
                      {aiExplanation}
                    </div>
                  )}
                </div>
              )}
              {/* Page Note Preview */}
              {pageNote && (
                <div className="mt-4 max-w-2xl w-full eb-glass rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wide text-sky-400 font-semibold mb-2 flex items-center gap-1.5">
                    <PenLine className="h-3 w-3" /> Your Note
                  </p>
                  <p className="text-sm text-white/70 whitespace-pre-wrap">
                    {pageNote.text}
                  </p>
                  {pageNote.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {pageNote.tags.map((t) => (
                        <Badge
                          key={t}
                          className="text-[9px] px-1.5 py-0 bg-white/10 text-white/60"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom nav */}
        <div className="sticky bottom-0 bg-black/60 backdrop-blur-xl border-t border-white/10 px-4 py-2 flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={goPrev}
            disabled={activePage === 1}
            className="text-white/60 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={activePage}
              onChange={(e) => jumpTo(parseInt(e.target.value) || 1)}
              className="w-14 text-center text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white"
            />
            <span className="text-xs text-white/40">/ {totalPages}</span>
            <div className="w-24 h-1 rounded-full bg-white/10 overflow-hidden ml-2">
              <div
                className="h-full bg-indigo-400 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-white/40">{progress}%</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={goNext}
            disabled={activePage === totalPages}
            className="text-white/60 hover:text-white"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      <ElamAssistant
        bookId={activeBook.id}
        bookTitle={activeBook.title}
        subject={activeBook.subject}
        page={activePage}
        chapter={currentChapter?.title}
        pageText={ocrReviewed[activePage] ?? ""}
        resolvePageText={resolveElamPageText}
      />

      <BookModeReader
        open={bookModeOpen}
        title={activeBook.title}
        subject={activeBook.subject}
        source="scan"
        currentPage={activePage}
        totalPages={totalPages}
        imageUrl={(number) => pageImage(number, pageDir)}
        chapters={chapters.map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          scanPage: chapter.startPage,
          textPage: chapter.startPage,
        }))}
        searchPages={Array.from({ length: totalPages }, (_, index) => ({
          page: index + 1,
          title: getChapter(index + 1)?.title ?? `Page ${index + 1}`,
          text: ocrReviewed[index + 1] ?? "",
        }))}
        bookmarks={bookmarks.map((bookmark) => ({
          id: bookmark.id,
          page: bookmark.page,
          note: bookmark.note,
          createdAt: new Date(bookmark.createdAt).toISOString(),
        }))}
        onClose={() => setBookModeOpen(false)}
        onPageChange={jumpTo}
        onToggleBookmark={toggleBookmark}
        onBookmarkNote={(page, note) => {
          const next = bookmarks.map((bookmark) =>
            bookmark.page === page ? { ...bookmark, note } : bookmark,
          );
          setBookmarks(next);
          persist({ bookmarks: next });
        }}
      />

      {/* Note Modal */}
      <Dialog
        open={noteModal !== null}
        onOpenChange={(o) => !o && setPageNoteModal(null)}
      >
        <DialogContent className="eb-glass-strong max-w-lg text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              Note for Pg {noteModal}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Add personal notes, important points, doubts, or homework
              reminders for this page.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={5}
            placeholder="Write your note..."
            className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 resize-none"
          />
          <div>
            <p className="text-xs text-white/40 mb-2">Tags:</p>
            <div className="flex flex-wrap gap-1.5">
              {PAGE_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setNoteTags((prev) =>
                      prev.includes(tag)
                        ? prev.filter((t) => t !== tag)
                        : [...prev, tag],
                    )
                  }
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${noteTags.includes(tag) ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" : "bg-white/5 text-white/40 border-white/10 hover:text-white/60"}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={saveNote}
              className="bg-indigo-500 text-white hover:bg-indigo-600"
            >
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OCR Modal */}
      <Dialog
        open={ocrModal !== null}
        onOpenChange={(o) => !o && setOcrModal(null)}
      >
        <DialogContent className="eb-glass-strong max-w-4xl text-white border-white/10 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">
              OCR Text Extraction — Pg {ocrModal}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Extract text from this scanned page. You can review and edit the
              result before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
            {/* Original scan */}
            <div className="rounded-xl overflow-hidden border border-white/10 max-h-[50vh] overflow-y-auto eb-scroll">
              {ocrModal && (
                <img
                  src={pageImage(ocrModal, pageDir)}
                  alt={`Page ${ocrModal}`}
                  className="w-full"
                />
              )}
            </div>
            {/* Extracted text */}
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={() => ocrModal && runOCR(ocrModal)}
                disabled={ocrLoading}
                className="bg-purple-500 text-white hover:bg-purple-600"
              >
                {ocrLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{" "}
                    Running OCR...
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> Run OCR
                  </>
                )}
              </Button>
              <textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                rows={15}
                placeholder="Click 'Run OCR' to extract text, then edit as needed..."
                className="w-full flex-1 p-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 resize-none eb-scroll"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
              >
                Close
              </Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={saveOCR}
              disabled={!ocrText}
              className="bg-emerald-500 text-white hover:bg-emerald-600"
            >
              Save Reviewed Text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Chapter Mapper Component =====
function ChapterMapper({
  open,
  onOpenChange,
  chapters,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  chapters: ChapterMapping[];
  onSave: (chapters: ChapterMapping[]) => void;
}) {
  const [local, setLocal] = useState<ChapterMapping[]>(chapters);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLocal(chapters);
    });
    return () => {
      cancelled = true;
    };
  }, [chapters, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="eb-glass-strong max-w-lg text-white border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Chapter Page Mapper</DialogTitle>
          <DialogDescription className="text-white/50">
            Assign page ranges to chapters. Unassigned pages will be hidden.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {local.map((ch, i) => (
            <div key={ch.id} className="eb-glass rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ background: ch.color }}
                />
                <Input
                  value={ch.title}
                  onChange={(e) =>
                    setLocal((prev) =>
                      prev.map((c, j) =>
                        j === i ? { ...c, title: e.target.value } : c,
                      ),
                    )
                  }
                  className="bg-white/5 border-white/10 text-white text-sm flex-1"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-white/60">
                <span>Start:</span>
                <Input
                  type="number"
                  min={1}
                  max={TOTAL_PAGES}
                  value={ch.startPage}
                  onChange={(e) =>
                    setLocal((prev) =>
                      prev.map((c, j) =>
                        j === i
                          ? { ...c, startPage: parseInt(e.target.value) || 1 }
                          : c,
                      ),
                    )
                  }
                  className="w-16 bg-white/5 border-white/10 text-white text-center"
                />
                <span>End:</span>
                <Input
                  type="number"
                  min={1}
                  max={TOTAL_PAGES}
                  value={ch.endPage}
                  onChange={(e) =>
                    setLocal((prev) =>
                      prev.map((c, j) =>
                        j === i
                          ? { ...c, endPage: parseInt(e.target.value) || 1 }
                          : c,
                      ),
                    )
                  }
                  className="w-16 bg-white/5 border-white/10 text-white text-center"
                />
                <span className="text-white/40">
                  ({ch.endPage - ch.startPage + 1} pages)
                </span>
              </div>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setLocal([
                ...local,
                {
                  id: `ch${local.length + 1}`,
                  title: `Chapter ${local.length + 1}`,
                  startPage: 1,
                  endPage: 10,
                  color: "#6366f1",
                },
              ])
            }
            className="bg-white/5 border-white/15 text-white hover:bg-white/10 w-full"
          >
            + Add Chapter
          </Button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            onClick={() => onSave(local)}
            className="bg-indigo-500 text-white hover:bg-indigo-600"
          >
            Save Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EBookView;
