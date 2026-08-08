"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/lib/notifications/notification-api";
import {
  LayoutGrid, ChevronRight, ChevronLeft, Search, Play, Pause, Square,
  BookOpen, Calculator, FlaskConical, ListChecks, FileText, Video,
  Brain, AlertTriangle, RefreshCw, Bell, MessageSquare, Sparkles,
  Clock, Target, TrendingUp, Award, CheckCircle2, Circle, ArrowRight,
  Layers, Zap, Mic, X, Plus, Timer, Lightbulb, Atom, Download,
  ExternalLink, BookMarked, GraduationCap, Gauge, Maximize2, Minimize2,
} from "lucide-react";

import { useStore } from "@/lib/store";
import { useCurriculum, type Subject, type Chapter } from "@/lib/use-curriculum";
import { askAI, askAIJSON } from "@/lib/ai";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import {
  getChapterCommandData, getChapterChecklist, getChecklistProgress,
  getChapterStatus, STATUS_META, type ChapterCommandData, type ChecklistItem,
  type ChapterStatus,
} from "@/lib/chapter-command";
import { navigateTo } from "@/lib/nav-event";
import { useReminderStore, useReminderProfile, REMINDERS_CHANGED_EVENT } from "@/lib/reminders/store";
import { getFlashcardCountByChapter } from "@/lib/flashcards-class11-meta";
import { getQuizCountByChapter } from "@/lib/quizzes-class11-meta";
import { cn } from "@/lib/utils";
import { openMathsEbook } from "@/lib/ebook-navigation";

// ============================================================================
// Main view
// ============================================================================

export function ChapterCommandCenter() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const jeeMode = useStore((s) => s.user.jeeMode);
  const curriculum = useCurriculum();
  const mastery = useStore((s) => s.mastery);
  const studyProgress = useStore((s) => s.studyProgress);
  const addXP = useStore((s) => s.addXP);
  const pushActivity = useStore((s) => s.pushActivity);

  const [subjectId, setSubjectId] = useState<string>("physics");
  const [chapterId, setChapterId] = useState<string>("p2");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ChapterStatus>("all");
  const [showSessionBuilder, setShowSessionBuilder] = useState(false);

  // Auto-pick first available chapter if current selection doesn't exist
  useEffect(() => {
    let cancelled = false;
    const subject = curriculum.find((s) => s.id === subjectId);
    const nextSubjectId = subject?.id ?? curriculum[0]?.id ?? "physics";
    const effectiveSubject = subject ?? curriculum[0];
    const nextChapterId = effectiveSubject?.chapters.some((chapter) => chapter.id === chapterId)
      ? chapterId
      : effectiveSubject?.chapters[0]?.id ?? "";
    queueMicrotask(() => {
      if (cancelled) return;
      if (subjectId !== nextSubjectId) setSubjectId(nextSubjectId);
      if (chapterId !== nextChapterId) setChapterId(nextChapterId);
    });
    return () => { cancelled = true; };
  }, [curriculum, subjectId, chapterId]);

  const selectedSubject = curriculum.find((s) => s.id === subjectId);
  const selectedChapter = selectedSubject?.chapters.find((c) => c.id === chapterId);

  // Compute status for each chapter (for the filter)
  const chapterStatuses = useMemo(() => {
    if (!selectedSubject) return new Map<string, ChapterStatus>();
    const map = new Map<string, ChapterStatus>();
    for (const ch of selectedSubject.chapters) {
      const sp = studyProgress[ch.id] ?? 0;
      const sm = mastery[subjectId] ?? 0;
      // Lightweight status — skip full data computation for the list
      let status: ChapterStatus = "not-started";
      if (sp >= 80) status = "mastered";
      else if (sp >= 60) status = "test-ready";
      else if (sp >= 30) status = "learning";
      else if (sp > 0) status = "started";
      map.set(ch.id, status);
    }
    return map;
  }, [selectedSubject, studyProgress, mastery, subjectId]);

  // Filtered chapters
  const filteredChapters = useMemo(() => {
    if (!selectedSubject) return [];
    return selectedSubject.chapters.filter((ch) => {
      if (search && !ch.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && chapterStatuses.get(ch.id) !== statusFilter) return false;
      return true;
    });
  }, [selectedSubject, search, statusFilter, chapterStatuses]);

  // Build full command data for the selected chapter
  const data = useMemo(() => {
    if (!selectedChapter) return null;
    const sp = studyProgress[chapterId] ?? 0;
    const sm = mastery[subjectId] ?? 0;
    return getChapterCommandData({
      scholarClass,
      jeeMode,
      subjectId,
      chapterId,
      studyProgressPct: sp,
      subjectMasteryPct: sm,
    });
  }, [scholarClass, jeeMode, subjectId, chapterId, selectedChapter, studyProgress, mastery]);

  if (!data || !selectedSubject || !selectedChapter) {
    return (
      <div className="min-h-[60vh] grid place-items-center p-8">
        <div className="text-center space-y-3">
          <LayoutGrid className="h-12 w-12 mx-auto text-white/20" />
          <p className="text-white/60 font-medium">Select a chapter to begin</p>
        </div>
      </div>
    );
  }

  const status = getChapterStatus({
    studyProgressPct: data.studyProgressPct,
    masteryPct: data.masteryPct,
    questionStats: data.questions,
  });
  const checklist = getChapterChecklist(data);
  const checklistProgress = getChecklistProgress(checklist);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#0a0a0f] overflow-hidden -m-4 lg:-m-6 text-white">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20" style={{ background: data.subjectAccent }} />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[100px] opacity-10" style={{ background: "#a855f7" }} />
      </div>

      <div className="chapter-command-grid relative z-10 flex flex-col lg:flex-row gap-4 p-3 sm:p-4 lg:p-6 max-w-[1600px] mx-auto">
        {/* Left: Chapter selector */}
        <aside className="w-full lg:w-72 shrink-0 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-3 space-y-3 lg:sticky lg:top-4">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-violet-300" />
              <h3 className="text-sm font-semibold text-white">Chapter Selector</h3>
            </div>

            {/* Subject selector */}
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1 block">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  const subj = curriculum.find((s) => s.id === e.target.value);
                  setChapterId(subj?.chapters[0]?.id ?? "");
                }}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                {curriculum.map((s) => (
                  <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chapters…"
                className="w-full rounded-lg bg-white/5 border border-white/10 pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>

            {/* Status filter */}
            <div className="flex flex-wrap gap-1">
              {(["all", "not-started", "started", "learning", "revision-due", "mastered"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    "text-[9px] px-2 py-1 rounded-full border transition-colors",
                    statusFilter === f
                      ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                  )}
                >
                  {f === "all" ? "All" : STATUS_META[f].label}
                </button>
              ))}
            </div>

            {/* Chapter list */}
            <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
              {filteredChapters.length === 0 && (
                <p className="text-[11px] text-white/40 text-center py-4">No chapters match.</p>
              )}
              {filteredChapters.map((ch, i) => {
                const isActive = ch.id === chapterId;
                const chStatus = chapterStatuses.get(ch.id) ?? "not-started";
                const sp = studyProgress[ch.id] ?? 0;
                const meta = STATUS_META[chStatus];
                return (
                  <button
                    key={ch.id}
                    onClick={() => setChapterId(ch.id)}
                    className={cn(
                      "w-full text-left p-2 rounded-lg border transition-all",
                      isActive
                        ? "bg-violet-500/15 border-violet-500/40"
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/15"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-white/30 shrink-0">#{i + 1}</span>
                      <span className={cn("text-xs font-medium truncate flex-1", isActive ? "text-white" : "text-white/70")}>{ch.title}</span>
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                    </div>
                    {sp > 0 && (
                      <div className="mt-1.5 h-0.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${sp}%`, background: meta.color }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center: Command center */}
        <main className="flex-1 min-w-0 space-y-4">
          <HeroSection data={data} status={status} checklistProgress={checklistProgress} jeeMode={jeeMode} onStartSession={() => setShowSessionBuilder(true)} />

          <QuickActions data={data} />

          <CompletionChecklist items={checklist} progress={checklistProgress} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <OverviewPanel data={data} />
            <FormulaPanel data={data} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PracticePanel data={data} />
            <QuizPanel data={data} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VideoPanel data={data} />
            <EbookPanel data={data} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DerivationPanel data={data} />
            <ExperimentPanel data={data} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ResourcesPanel data={data} />
            <MistakePanel data={data} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FlashcardPanel data={data} />
            <RevisionPanel data={data} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AssignmentPanel data={data} />
            <PastPaperPanel data={data} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RemindersPanel data={data} />
            <DoubtPanel data={data} />
          </div>
        </main>

        {/* Right: AI assistant + activity */}
        <aside className="w-full lg:w-80 shrink-0 space-y-3">
          <AIAssistantPanel data={data} />
          <RecentActivityPanel data={data} />
        </aside>
      </div>

      {/* Study session builder */}
      <AnimatePresence>
        {showSessionBuilder && (
          <StudySessionBuilder
            data={data}
            onExit={() => setShowSessionBuilder(false)}
            onComplete={(duration) => {
              addXP(Math.round(duration / 5));
              pushActivity({ type: "study", text: `Completed ${duration}-min study session: ${data.chapterTitle.slice(0, 30)}`, icon: "⏱️" });
              toast.success(`Study session complete! · +${Math.round(duration / 5)} XP`);
              setShowSessionBuilder(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Hero section
// ============================================================================

function HeroSection({ data, status, checklistProgress, jeeMode, onStartSession }: {
  data: ChapterCommandData;
  status: ChapterStatus;
  checklistProgress: { completed: number; total: number; pct: number };
  jeeMode: boolean;
  onStartSession: () => void;
}) {
  const statusMeta = STATUS_META[status];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] backdrop-blur-xl p-5 lg:p-6 relative overflow-hidden"
    >
      <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl opacity-30" style={{ background: data.subjectAccent }} />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${data.subjectAccent}25`, color: data.subjectAccent }}>
                {data.subjectIcon} {data.subjectName}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                Chapter {data.chapterNumber}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                Class {data.classProfile} CBSE
              </span>
              {data.classProfile === 11 && jeeMode && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                  JEE Mode
                </span>
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                {statusMeta.label}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight">{data.chapterTitle}</h1>
            {data.overview && <p className="text-sm text-white/60 mt-2 leading-relaxed line-clamp-2">{data.overview}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Mastery ring */}
            <ProgressRing value={data.masteryPct} label="Mastery" color={data.subjectAccent} size={72} />
            <ProgressRing value={data.studyProgressPct} label="Reading" color="#60a5fa" size={72} />
            <ProgressRing value={checklistProgress.pct} label="Checklist" color="#a78bfa" size={72} />
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatChip icon={ListChecks} label="Questions" value={String(data.questions.total)} />
          <StatChip icon={Calculator} label="Formulas" value={String(data.formulas.length)} />
          <StatChip icon={Video} label="Videos" value={String(data.videos.length)} />
          <StatChip icon={BookOpen} label="E-Book" value={data.ebook.available ? `${data.ebook.totalPages}p` : "—"} />
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigateTo("study")}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold hover:from-violet-600 hover:to-fuchsia-600 shadow-lg shadow-violet-500/25 transition-all"
          >
            <Play className="h-3.5 w-3.5" /> Continue Chapter
          </button>
          <button
            onClick={onStartSession}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-white hover:bg-white/10 transition-colors"
          >
            <Timer className="h-3.5 w-3.5" /> Start Study Session
          </button>
          <button
            onClick={() => navigateTo("practice")}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-white hover:bg-white/10 transition-colors"
          >
            <ListChecks className="h-3.5 w-3.5" /> Open Practice
          </button>
          <button
            onClick={() => navigateTo("past-papers")}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-white hover:bg-white/10 transition-colors"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Revise Mistakes
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// (jeeModeBadge helper removed — JEE Mode badge now rendered inline in HeroSection)

// ============================================================================
// Progress ring
// ============================================================================

function ProgressRing({ value, label, color, size = 64 }: { value: number; label: string; color: string; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-xs font-bold text-white">{value}%</span>
        </div>
      </div>
      <span className="text-[9px] text-white/50 uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ============================================================================
// Stat chip
// ============================================================================

function StatChip({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-white/40 shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] text-white/40 uppercase tracking-wider">{label}</p>
        <p className="text-xs font-semibold text-white truncate">{value}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Section card wrapper
// ============================================================================

function SectionCard({ title, icon: Icon, accent, onOpenAll, children, empty }: {
  title: string;
  icon: any;
  accent?: string;
  onOpenAll?: () => void;
  children?: React.ReactNode;
  empty?: { title: string; description: string };
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="grid place-items-center h-7 w-7 rounded-lg shrink-0" style={{ background: `${accent || "#a78bfa"}20` }}>
            <Icon className="h-3.5 w-3.5" style={{ color: accent || "#a78bfa" }} />
          </div>
          <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
        </div>
        {onOpenAll && (
          <button
            onClick={onOpenAll}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            Open <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      {empty && !children ? (
        <div className="py-6 text-center">
          <Icon className="h-8 w-8 mx-auto text-white/15 mb-2" />
          <p className="text-xs text-white/50 font-medium">{empty.title}</p>
          <p className="text-[10px] text-white/30 mt-1">{empty.description}</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ============================================================================
// Quick actions
// ============================================================================

function QuickActions({ data }: { data: ChapterCommandData }) {
  const actions = [
    { label: "Continue Reading", icon: BookOpen, view: "ebook", accent: "#3b82f6" },
    { label: "Start Practice", icon: ListChecks, view: "practice", accent: "#a78bfa" },
    { label: "Review Flashcards", icon: Brain, view: "flashcards", accent: "#10b981" },
    { label: "Watch Videos", icon: Video, view: "nigtube", accent: "#f43f5e" },
    { label: "Open Notes", icon: FileText, view: "notes", accent: "#fbbf24" },
    { label: "Revise Mistakes", icon: AlertTriangle, view: "past-papers", accent: "#fb923c" },
    { label: "Start Quiz", icon: Zap, view: "quiz", accent: "#06b6d4" },
    { label: "View Formulas", icon: Calculator, view: "formulas", accent: "#a855f7" },
    { label: "Open Resources", icon: Download, view: "resources", accent: "#22d3ee" },
    { label: "Ask AI", icon: Sparkles, view: "ai-tutor", accent: "#d946ef" },
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={() => navigateTo(a.view)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Icon className="h-3.5 w-3.5" style={{ color: a.accent }} />
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Completion checklist
// ============================================================================

function CompletionChecklist({ items, progress }: {
  items: ChecklistItem[];
  progress: { completed: number; total: number; pct: number };
}) {
  return (
    <SectionCard
      title={`Completion Checklist (${progress.completed}/${progress.total})`}
      icon={CheckCircle2}
      accent="#10b981"
    >
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress.pct}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => navigateTo(item.targetView)}
            className={cn(
              "flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all",
              item.completed
                ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15"
                : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/15"
            )}
          >
            {item.completed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn("text-xs font-medium", item.completed ? "text-emerald-200" : "text-white/80")}>{item.label}</p>
              <p className="text-[10px] text-white/40 truncate">{item.description}</p>
              {item.progress !== undefined && item.progress > 0 && !item.completed && (
                <div className="mt-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-white/30" style={{ width: `${Math.min(100, item.progress)}%` }} />
                </div>
              )}
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-white/30 shrink-0 mt-1" />
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Overview panel
// ============================================================================

function OverviewPanel({ data }: { data: ChapterCommandData }) {
  return (
    <SectionCard title="Chapter Overview" icon={BookOpen} accent="#3b82f6">
      <div className="space-y-3 text-xs">
        {data.overview && <p className="text-white/70 leading-relaxed">{data.overview}</p>}
        {data.learningObjectives?.length ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">Learning Objectives</p>
            <ul className="space-y-1">
              {data.learningObjectives.slice(0, 4).map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-white/70">
                  <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-blue-400" />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {data.estimatedTime && <MetaChip icon={Clock} label="Est. time" value={data.estimatedTime} />}
          {data.difficulty && <MetaChip icon={Gauge} label="Difficulty" value={data.difficulty} />}
          {data.boardWeightage && <MetaChip icon={GraduationCap} label="Board" value={data.boardWeightage} />}
          {data.jeeWeightage && <MetaChip icon={Target} label="JEE" value={data.jeeWeightage} />}
        </div>
        {data.prerequisites?.length ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">Prerequisites</p>
            <div className="flex flex-wrap gap-1">
              {data.prerequisites.slice(0, 4).map((p, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">{p}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function MetaChip({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[9px] text-white/40 uppercase tracking-wider mb-0.5">
        <Icon className="h-2.5 w-2.5" /> {label}
      </div>
      <p className="text-[11px] font-medium text-white/80">{value}</p>
    </div>
  );
}

// ============================================================================
// Formula panel
// ============================================================================

function FormulaPanel({ data }: { data: ChapterCommandData }) {
  if (!data.formulas.length) {
    return <SectionCard title="Formula Sheet" icon={Calculator} accent="#a855f7" empty={{ title: "No formulas for this chapter yet", description: "Formulas will appear here once added to the curriculum." }} onOpenAll={() => navigateTo("formulas")} />;
  }
  return (
    <SectionCard title={`Formula Sheet (${data.formulas.length})`} icon={Calculator} accent="#a855f7" onOpenAll={() => navigateTo("formulas")}>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {data.formulas.map((f) => (
          <div key={f.key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-mono font-semibold text-purple-200">{f.formula}</p>
            <p className="text-[10px] text-white/40 mt-1">{f.chapterTitle}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Practice panel
// ============================================================================

function PracticePanel({ data }: { data: ChapterCommandData }) {
  const q = data.questions;
  return (
    <SectionCard title={`Practice Center (${q.total} questions)`} icon={ListChecks} accent="#a78bfa" onOpenAll={() => navigateTo("practice")}>
      {q.total === 0 ? (
        <div className="py-4 text-center">
          <ListChecks className="h-7 w-7 mx-auto text-white/15 mb-1.5" />
          <p className="text-xs text-white/50">No practice questions for this chapter yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/[0.03] border border-white/10 p-2 text-center">
              <p className="text-lg font-bold text-white">{q.mcq}</p>
              <p className="text-[9px] text-white/40 uppercase">MCQ</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-white/10 p-2 text-center">
              <p className="text-lg font-bold text-white">{q.subjective}</p>
              <p className="text-[9px] text-white/40 uppercase">Subjective</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigateTo("practice")} className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-200 hover:bg-violet-500/25 transition-colors">
              <Play className="h-3.5 w-3.5" /> Start Practice
            </button>
            <button onClick={() => navigateTo("past-papers")} className="flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors">
              <AlertTriangle className="h-3.5 w-3.5" /> Retry Mistakes
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ============================================================================
// Quiz panel
// ============================================================================

function QuizPanel({ data }: { data: ChapterCommandData }) {
  const quizCount = useMemo(() => {
    try {
      return getQuizCountByChapter(data.chapterId);
    } catch { return 0; }
  }, [data.chapterId]);

  return (
    <SectionCard title={`Chapter Quizzes (${quizCount} questions)`} icon={Zap} accent="#06b6d4" onOpenAll={() => navigateTo("quiz")}>
      {quizCount > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] text-white/60 leading-relaxed">
            {quizCount} MCQ questions available for {data.chapterTitle}. Test your knowledge with chapter-wise quizzes.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: "Quick Quiz", q: Math.min(5, quizCount), diff: "Easy" },
              { name: "Concept Quiz", q: Math.min(8, quizCount), diff: "Medium" },
              { name: "Formula Quiz", q: Math.min(6, quizCount), diff: "Medium" },
              { name: "Mixed Quiz", q: Math.min(10, quizCount), diff: "Hard" },
            ].map((quiz) => (
              <button key={quiz.name} onClick={() => navigateTo("quiz")} className="text-left p-2.5 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-cyan-500/30 transition-all">
                <p className="text-xs font-semibold text-white">{quiz.name}</p>
                <p className="text-[10px] text-white/40">{quiz.q} questions · {quiz.diff}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-4 text-center">
          <Zap className="h-7 w-7 mx-auto text-white/15 mb-1.5" />
          <p className="text-xs text-white/50">No quiz questions for this chapter yet.</p>
          <button onClick={() => navigateTo("quiz")} className="mt-2 text-[10px] px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white">Open Quiz</button>
        </div>
      )}
    </SectionCard>
  );
}

// ============================================================================
// Video panel
// ============================================================================

function VideoPanel({ data }: { data: ChapterCommandData }) {
  if (!data.videos.length) {
    return <SectionCard title="Nightube Videos" icon={Video} accent="#f43f5e" empty={{ title: "No videos available yet", description: "Videos will appear here when added." }} onOpenAll={() => navigateTo("nigtube")} />;
  }
  return (
    <SectionCard title={`Nightube Videos (${data.videos.length})`} icon={Video} accent="#f43f5e" onOpenAll={() => navigateTo("nigtube")}>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {data.videos.map((v) => (
          <button
            key={v.id}
            onClick={() => navigateTo("nigtube")}
            className="w-full text-left flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-rose-500/30 transition-all"
          >
            <div className="relative h-12 w-20 rounded-md overflow-hidden shrink-0 bg-zinc-800">
              <img
                src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                alt={v.title}
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 grid place-items-center bg-black/30">
                <Play className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">{v.title}</p>
              <p className="text-[10px] text-white/40">{v.channel}{v.duration ? ` · ${v.duration}` : ""}</p>
            </div>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Ebook panel
// ============================================================================

function EbookPanel({ data }: { data: ChapterCommandData }) {
  if (!data.ebook.available) {
    return <SectionCard title="E-Book" icon={BookOpen} accent="#3b82f6" empty={{ title: "No E-Book pages mapped for this chapter yet", description: "E-Book content will appear here when pages are mapped." }} onOpenAll={() => navigateTo("ebook")} />;
  }
  if (data.classProfile === 11 && data.subjectId === "maths" && (data.chapterId === "m1" || data.chapterId === "m2")) {
    const sets = data.chapterId === "m1";
    const printedQuestions = sets ? 61 : 79;
    return (
      <SectionCard title="Mathematics Part 1 · E-Book" icon={BookOpen} accent="#6366f1" onOpenAll={() => openMathsEbook("Reader")}>
        <div className="space-y-3">
          <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/[0.08] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white">{data.chapterTitle}</p>
                <p className="mt-0.5 text-[10px] text-white/45">Original scan pages {data.ebook.startPage}–{data.ebook.endPage} · synchronized clean text</p>
              </div>
              <span className="rounded-full bg-indigo-500/20 px-2 py-1 text-[10px] text-indigo-200">{printedQuestions} printed questions</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px] text-white/55">
              {["Section map", "Definitions & formulae", "Examples", "Highlights & notes", "Incorrect questions", "Page quizzes", "Book flashcards", "Weak-section plan"].map((item) => <span key={item} className="rounded-lg bg-white/[0.04] px-2 py-1.5">{item}</span>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => openMathsEbook("Reader")} className="rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-3 py-2 text-xs text-indigo-100 hover:bg-indigo-500/25"><BookOpen className="mr-1 inline h-3.5 w-3.5" /> Open Clean Text</button>
            <button onClick={() => openMathsEbook("Reader")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><FileText className="mr-1 inline h-3.5 w-3.5" /> Original Scan</button>
            <button onClick={() => openMathsEbook("Questions")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><ListChecks className="mr-1 inline h-3.5 w-3.5" /> Practice book</button>
            <button onClick={() => openMathsEbook("AI Study")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><Sparkles className="mr-1 inline h-3.5 w-3.5" /> Study chapter</button>
          </div>
        </div>
      </SectionCard>
    );
  }
  return (
    <SectionCard title="E-Book Integration" icon={BookOpen} accent="#3b82f6" onOpenAll={() => navigateTo("ebook")}>
      <div className="space-y-2">
        <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
          <p className="text-xs font-medium text-white">{data.ebook.title}</p>
          <p className="text-[10px] text-white/40 mt-0.5">Pages {data.ebook.startPage}–{data.ebook.endPage} · {data.ebook.totalPages} pages</p>
          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-blue-400" style={{ width: `${data.studyProgressPct}%` }} />
          </div>
        </div>
        <button onClick={() => navigateTo("ebook")} className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-200 hover:bg-blue-500/25 transition-colors">
          <BookOpen className="h-3.5 w-3.5" /> Continue Reading
        </button>
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Derivation panel
// ============================================================================

function DerivationPanel({ data }: { data: ChapterCommandData }) {
  return (
    <SectionCard title="Derivations" icon={Layers} accent="#fbbf24" onOpenAll={() => navigateTo("derivations")}>
      <div className="space-y-2">
        <p className="text-[11px] text-white/60 leading-relaxed">
          Open the Derivation Library to view step-by-step proofs for this chapter's key equations.
        </p>
        <button onClick={() => navigateTo("derivations")} className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500/25 transition-colors">
          <Layers className="h-3.5 w-3.5" /> Open Derivation Library
        </button>
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Experiment panel
// ============================================================================

function ExperimentPanel({ data }: { data: ChapterCommandData }) {
  const experiments = data.chapterId === "p2"
    ? ["Vernier Calipers", "Screw Gauge", "Measurement Error Activities"]
    : data.chapterId === "p3"
    ? ["Motion Graph Simulation", "Free Fall Simulation", "Velocity-Time Graph Activity"]
    : [];
  if (!experiments.length) {
    return <SectionCard title="Experiment Lab" icon={FlaskConical} accent="#10b981" empty={{ title: "No experiment connected yet", description: "Experiments will appear here when linked." }} onOpenAll={() => navigateTo("lab")} />;
  }
  return (
    <SectionCard title="Experiment Lab" icon={FlaskConical} accent="#10b981" onOpenAll={() => navigateTo("lab")}>
      <div className="space-y-1.5">
        {experiments.map((exp) => (
          <button
            key={exp}
            onClick={() => navigateTo("lab")}
            className="w-full text-left flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-emerald-500/30 transition-all"
          >
            <FlaskConical className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs text-white/80 truncate flex-1">{exp}</span>
            <ChevronRight className="h-3 w-3 text-white/30 shrink-0" />
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Resources panel
// ============================================================================

function ResourcesPanel({ data }: { data: ChapterCommandData }) {
  return (
    <SectionCard title="Chapter Resources" icon={Download} accent="#22d3ee" onOpenAll={() => navigateTo("resources")}>
      <div className="grid grid-cols-2 gap-2">
        {["Notes", "Worksheets", "Question Banks", "Formula Sheets", "Mind Maps", "PDFs"].map((r) => (
          <button
            key={r}
            onClick={() => navigateTo("resources")}
            className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-cyan-500/30 transition-all text-left"
          >
            <FileText className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px] text-white/80">{r}</span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Mistake panel
// ============================================================================

function MistakePanel({ data }: { data: ChapterCommandData }) {
  // Load mistakes from localStorage
  const [mistakes, setMistakes] = useState<any[]>([]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("pp-mistakes") || "[]");
      const filtered = Array.isArray(stored)
        ? stored.filter((m: any) => m && m.chapter && m.chapter.toLowerCase().includes(data.chapterTitle.toLowerCase().split(" ")[0]))
        : [];
      setMistakes(filtered);
    } catch { setMistakes([]); }
  }, [data.chapterId, data.chapterTitle]);

  return (
    <SectionCard title={`Mistake Notebook (${mistakes.length})`} icon={AlertTriangle} accent="#fb923c" onOpenAll={() => navigateTo("past-papers")}>
      {mistakes.length === 0 ? (
        <div className="py-4 text-center">
          <CheckCircle2 className="h-7 w-7 mx-auto text-emerald-400/50 mb-1.5" />
          <p className="text-xs text-white/60 font-medium">Great. No saved mistakes for this chapter yet.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {mistakes.slice(0, 5).map((m, i) => (
            <div key={i} className="rounded-lg bg-white/[0.03] border border-white/10 p-2">
              <p className="text-[11px] text-white/80 truncate">{m.question}</p>
              <p className="text-[9px] text-white/40 mt-0.5">{m.subjectName} · {new Date(m.at || Date.now()).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ============================================================================
// Flashcard panel
// ============================================================================

function FlashcardPanel({ data }: { data: ChapterCommandData }) {
  const flashcardCount = useMemo(() => {
    try {
      return getFlashcardCountByChapter(data.chapterId);
    } catch { return 0; }
  }, [data.chapterId]);

  return (
    <SectionCard title={`Flashcards (${flashcardCount})`} icon={Brain} accent="#10b981" onOpenAll={() => navigateTo("flashcards")}>
      <div className="space-y-2">
        {flashcardCount > 0 ? (
          <>
            <p className="text-[11px] text-white/60 leading-relaxed">
              {flashcardCount} flashcards available for {data.chapterTitle}. Review definitions, formulas, concepts, and common mistakes.
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => navigateTo("flashcards")} className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/25 transition-colors">
                <Brain className="h-3.5 w-3.5" /> Start Review
              </button>
            </div>
          </>
        ) : (
          <div className="py-4 text-center">
            <Brain className="h-7 w-7 mx-auto text-white/15 mb-1.5" />
            <p className="text-xs text-white/50">No flashcards for this chapter yet.</p>
            <button onClick={() => navigateTo("flashcards")} className="mt-2 text-[10px] px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white">
              Generate with AI
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Revision panel
// ============================================================================

function RevisionPanel({ data }: { data: ChapterCommandData }) {
  return (
    <SectionCard title="Revision Hub" icon={RefreshCw} accent="#818cf8" onOpenAll={() => navigateTo("revision-hub")}>
      <div className="grid grid-cols-2 gap-2">
        {[
          { name: "5-min revision", time: "5 min" },
          { name: "15-min revision", time: "15 min" },
          { name: "Formula revision", time: "Quick" },
          { name: "Mistake revision", time: "Focused" },
        ].map((r) => (
          <button
            key={r.name}
            onClick={() => navigateTo("revision-hub")}
            className="text-left p-2 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-indigo-500/30 transition-all"
          >
            <p className="text-[11px] font-medium text-white">{r.name}</p>
            <p className="text-[9px] text-white/40">{r.time}</p>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Assignment panel
// ============================================================================

function AssignmentPanel({ data }: { data: ChapterCommandData }) {
  return (
    <SectionCard title="Assignments" icon={FileText} accent="#fbbf24" onOpenAll={() => navigateTo("assignments")}>
      <div className="py-4 text-center">
        <FileText className="h-7 w-7 mx-auto text-white/15 mb-1.5" />
        <p className="text-xs text-white/50">No assignments for this chapter yet.</p>
        <button onClick={() => navigateTo("assignments")} className="mt-2 text-[10px] px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white">
          Open Assignments
        </button>
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Past paper panel
// ============================================================================

function PastPaperPanel({ data }: { data: ChapterCommandData }) {
  return (
    <SectionCard title={`Past Papers (${data.pastPapers.total})`} icon={FileText} accent="#f59e0b" onOpenAll={() => navigateTo("past-papers")}>
      {data.pastPapers.total === 0 ? (
        <div className="py-4 text-center">
          <FileText className="h-7 w-7 mx-auto text-white/15 mb-1.5" />
          <p className="text-xs text-white/50">No past-paper questions for this chapter yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-white/60">{data.pastPapers.total} board-style questions available</p>
          <button onClick={() => navigateTo("past-papers")} className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500/25 transition-colors">
            <FileText className="h-3.5 w-3.5" /> Open Past Papers
          </button>
        </div>
      )}
    </SectionCard>
  );
}

// ============================================================================
// Reminders panel
// ============================================================================

function RemindersPanel({ data }: { data: ChapterCommandData }) {
  // Smart Reminders 2.0 — unified per-profile store (shared with Smart Reminders, LAM, dashboard).
  const scholarClass = useStore((s) => s.user.scholarClass);
  const profile = useReminderProfile(scholarClass);
  const reminderStore = useReminderStore.getState();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(REMINDERS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(REMINDERS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const chapterKeyword = data.chapterTitle.toLowerCase().split(" ")[0];
  const chapterReminders = profile.reminders
    .filter((r) => r.status === "scheduled" || r.status === "active")
    .filter((r) => r.chapter === data.chapterId || r.subject === data.subjectId || r.title.toLowerCase().includes(chapterKeyword))
    .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
    .slice(0, 3);

  const addReminder = () => {
    const due = new Date();
    due.setDate(due.getDate() + 1);
    due.setHours(18, 0, 0, 0);
    const created = reminderStore.createReminder(scholarClass, {
      title: `Revise ${data.chapterTitle}`,
      type: "revision",
      subject: data.subjectId,
      chapter: data.chapterId,
      dueAt: due.toISOString(),
      durationMin: 30,
      priority: "medium",
      alerts: [{ id: `al-${Date.now()}`, offsetMinutes: 10, label: "10 minutes before" }],
    }, { source: "manual" });
    void tick;
    toast.success(`Reminder created · ${created.title}`, { description: "Due tomorrow at 6:00 PM · view it in Smart Reminders" });
  };

  return (
    <SectionCard title="Smart Reminders" icon={Bell} accent="#fb7185" onOpenAll={() => navigateTo("reminders")}>
      <div className="space-y-2">
        {chapterReminders.length === 0 ? (
          <p className="text-[11px] text-white/50 text-center py-2">No reminders for this chapter yet. Add a revision reminder — it appears in Smart Reminders too.</p>
        ) : (
          chapterReminders.map((r) => (
            <button key={r.id} onClick={() => navigateTo("reminders", { openReminder: r.id })}
              className="w-full text-left rounded-lg bg-white/[0.03] border border-white/10 p-2 hover:bg-white/[0.06] transition-colors">
              <p className="text-[11px] text-white/80 truncate">{r.title}</p>
              <p className="text-[9px] text-white/40 mt-0.5">
                {new Date(r.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {new Date(r.dueAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                {r.talkEnabled ? " · 🔊 talk" : ""}
              </p>
            </button>
          ))
        )}
        <button onClick={addReminder} className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 hover:bg-rose-500/25 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add revision reminder
        </button>
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Doubt panel
// ============================================================================

function DoubtPanel({ data }: { data: ChapterCommandData }) {
  return (
    <SectionCard title="Doubt History" icon={MessageSquare} accent="#06b6d4" onOpenAll={() => navigateTo("doubt-history")}>
      <div className="space-y-2">
        <p className="text-[11px] text-white/60 leading-relaxed">
          Ask questions about this chapter and Scholar's AI will explain.
        </p>
        <button onClick={() => navigateTo("doubt-history")} className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/25 transition-colors">
          <MessageSquare className="h-3.5 w-3.5" /> Ask a Doubt
        </button>
      </div>
    </SectionCard>
  );
}

// ============================================================================
// AI Assistant panel
// ============================================================================

function AIAssistantPanel({ data }: { data: ChapterCommandData }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [expanded]);

  const prompts = [
    "Explain this chapter",
    "Give me a study plan",
    "Quiz me",
    "Explain formulas",
    "10 numericals",
    "Revise in 15 min",
    "What should I do next?",
  ];

  const sendPrompt = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user" as const, content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const fullPrompt = `You are a chapter-specific AI tutor. The student is studying Class ${data.classProfile} ${data.subjectName} — Chapter ${data.chapterNumber}: "${data.chapterTitle}".

${data.overview ? `Chapter overview: ${data.overview}` : ""}

Key concepts: ${data.concepts.join(", ")}

Available materials: ${data.formulas.length} formulas, ${data.questions.total} practice questions, ${data.videos.length} videos, ${data.pastPapers.total} past-paper questions.

Student progress: ${data.studyProgressPct}% reading, ${data.masteryPct}% mastery.

Student question: ${text}

Answer concisely and helpfully. Use markdown. Never reveal you are an AI.`;
      const res = await askAI(fullPrompt, data.subjectId === "physics" ? "physics-11" : "default");
      setMessages((m) => [...m, { role: "assistant", content: res }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I couldn't respond right now. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "rounded-2xl border border-violet-500/30 bg-[#090a13]/92 bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.04] p-4 backdrop-blur-xl",
      expanded ? "fixed inset-3 z-[80] flex flex-col space-y-4 overflow-hidden sm:inset-8 lg:inset-14" : "space-y-3 lg:sticky lg:top-4",
    )}>
      <div className="flex items-center gap-2">
        <div className="grid place-items-center h-7 w-7 rounded-lg bg-violet-500/20">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">AI Chapter Assistant</h3>
          <p className="text-[10px] text-white/40">Knows your chapter & progress</p>
        </div>
        <button type="button" onClick={() => setExpanded((value) => !value)} className="ml-auto grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white" aria-label={expanded ? "Collapse AI Chapter Assistant" : "Expand AI Chapter Assistant"} title={expanded ? "Collapse" : "Expand"}>
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div className={cn("space-y-2 overflow-y-auto", expanded ? "min-h-0 flex-1" : "max-h-48")}>
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg p-2 text-xs",
                m.role === "user"
                  ? "bg-violet-500/15 text-violet-100 ml-4"
                  : "bg-white/5 text-white/80 mr-4"
              )}
            >
              {m.role === "assistant" ? <ScholarAIContent content={m.content} mode="compact" /> : <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>}
            </div>
          ))}
          {loading && (
            <div className="rounded-lg p-2 text-xs bg-white/5 text-white/40 ml-4">
              <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}>
                Thinking…
              </motion.span>
            </div>
          )}
        </div>
      )}

      {/* Quick prompts */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => sendPrompt(p)}
              className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 hover:bg-violet-500/15 hover:border-violet-500/30 hover:text-violet-200 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendPrompt(input); }}
          placeholder="Ask about this chapter…"
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
        <button
          onClick={() => sendPrompt(input)}
          disabled={!input.trim() || loading}
          className="p-2 rounded-lg bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 disabled:opacity-40 transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Recent activity panel
// ============================================================================

function RecentActivityPanel({ data }: { data: ChapterCommandData }) {
  const activities = useStore((s) => s.activity);
  const chapterActivities = useMemo(() => {
    if (!activities || !Array.isArray(activities)) return [];
    const chapterKeyword = data.chapterTitle.toLowerCase().split(" ")[0];
    return activities
      .filter((a: any) => a && a.text && a.text.toLowerCase().includes(chapterKeyword))
      .slice(0, 8);
  }, [activities, data.chapterTitle]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
      </div>
      {chapterActivities.length === 0 ? (
        <div className="py-4 text-center">
          <TrendingUp className="h-6 w-6 mx-auto text-white/15 mb-1.5" />
          <p className="text-[11px] text-white/50">No activity for this chapter yet.</p>
          <p className="text-[10px] text-white/30 mt-0.5">Start studying to see your progress here.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {chapterActivities.map((a: any, i: number) => (
            <div key={i} className="flex items-start gap-2 p-1.5 rounded-lg bg-white/[0.02]">
              <span className="text-sm shrink-0">{a.icon || "•"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-white/80 truncate">{a.text}</p>
                <p className="text-[9px] text-white/30">{new Date(a.at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Study session builder
// ============================================================================

function StudySessionBuilder({ data, onExit, onComplete }: {
  data: ChapterCommandData;
  onExit: () => void;
  onComplete: (durationMin: number) => void;
}) {
  const [duration, setDuration] = useState(30);
  const [active, setActive] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0);

  const tasks = useMemo(() => {
    const base = [
      { name: "E-Book reading", view: "ebook", min: Math.round(duration * 0.25) },
      { name: "Notes review", view: "study", min: Math.round(duration * 0.2) },
      { name: "Formula revision", view: "formulas", min: Math.round(duration * 0.2) },
      { name: "Practice questions", view: "practice", min: Math.round(duration * 0.25) },
      { name: "Recap", view: "revision-hub", min: Math.round(duration * 0.1) },
    ];
    return base;
  }, [duration]);

  useEffect(() => {
    if (!active) return;
    const totalSec = duration * 60;
    const taskSec = Math.floor(totalSec / tasks.length);
    let taskIdx = 0;
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          setActive(false);
          onComplete(duration);
          return 0;
        }
        const elapsed = totalSec - r + 1;
        const newTaskIdx = Math.min(tasks.length - 1, Math.floor(elapsed / taskSec));
        if (newTaskIdx !== taskIdx) {
          taskIdx = newTaskIdx;
          setCurrentTaskIdx(newTaskIdx);
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [active, duration, tasks, onComplete]);

  const startSession = () => {
    setRemaining(duration * 60);
    setCurrentTaskIdx(0);
    setActive(true);
  };

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const totalSec = duration * 60;
  const progress = totalSec > 0 ? ((totalSec - remaining) / totalSec) * 100 : 0;

  const content = (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={onExit}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950/95 backdrop-blur-xl p-6"
      >
        {!active ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-violet-500/20">
                <Timer className="h-4 w-4 text-violet-300" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Start Study Session</h3>
                <p className="text-[11px] text-white/50">{data.chapterTitle}</p>
              </div>
            </div>

            <p className="text-[11px] font-medium uppercase tracking-wider text-white/40 mb-2">Duration</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[15, 30, 45, 60].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={cn(
                    "py-2 rounded-lg text-xs font-semibold border transition-colors",
                    duration === d
                      ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                      : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                  )}
                >
                  {d}m
                </button>
              ))}
            </div>

            <p className="text-[11px] font-medium uppercase tracking-wider text-white/40 mb-2">Session plan</p>
            <div className="space-y-1.5 mb-4">
              {tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                  <span className="text-white/80 flex-1">{t.name}</span>
                  <span className="text-white/40">{t.min} min</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={onExit} className="flex-1 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-white/60 hover:text-white">
                Cancel
              </button>
            <button onClick={startSession} className="flex-1 py-2 rounded-lg text-xs bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold hover:from-violet-600 hover:to-fuchsia-600">
                Start Session
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Time remaining</p>
              <p className="text-4xl font-mono font-bold text-white">{mm}:{ss}</p>
            </div>

            <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-4">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <div className="rounded-lg bg-white/5 border border-white/10 p-3 mb-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Current task ({currentTaskIdx + 1}/{tasks.length})</p>
              <p className="text-sm font-medium text-white">{tasks[currentTaskIdx].name}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{tasks[currentTaskIdx].min} min</p>
            </div>

            {currentTaskIdx + 1 < tasks.length && (
              <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2 mb-4">
                <p className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Up next</p>
                <p className="text-xs text-white/60">{tasks[currentTaskIdx + 1].name}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => { navigateTo(tasks[currentTaskIdx].view); }}
                className="flex-1 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-white/70 hover:text-white"
              >
                Open task
              </button>
              <button
                onClick={() => { setActive(false); onComplete(duration); }}
                className="flex-1 py-2 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-200 hover:bg-rose-500/25"
              >
                End session
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}

// Need to import createPortal
import { createPortal } from "react-dom";
