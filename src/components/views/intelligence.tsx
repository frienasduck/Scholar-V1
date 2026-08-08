"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/lib/notifications/notification-api";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { navigateTo } from "@/lib/nav-event";
import { cn } from "@/lib/utils";
import { openScholarPlus } from "@/lib/subscriptions/promo";
import { QUIZ_MISTAKES_UPDATED_EVENT } from "@/lib/quiz-mistakes";
import { StatCard, EmptyState, ProgressRing } from "@/lib/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Activity, AlertTriangle, ArrowUp, ArrowDown, BookOpenCheck, Brain, CalendarClock,
  CheckCircle2, Clock, CloudOff, Eye, Flame, ListChecks, Loader2, Play,
  RefreshCw, Sparkles, Target, TrendingUp, Video, Wifi, XCircle,
} from "lucide-react";
import {
  DAY_MS,
  dueLabel,
  estimateAllMastery,
  examIntelligence,
  findWeakTopics,
  buildRevisionQueue,
  buildDailyBrief,
  buildWeeklyReport,
  detectPatterns,
  MASTERY_LEVEL_LABELS,
  stateLabel,
  subjectDisplayName,
  type DailyBriefItem,
  type ExamInsight,
  type MasteryEstimate,
  type MistakePattern,
  type MistakeRecord,
  type ReviewRating,
  type RevisionQueueItem,
  type WeakTopic,
} from "@/lib/v2/intelligence";
import {
  deriveEvidence,
  deriveExams,
  deriveMistakes,
  deriveStudyProgress,
  loadManualOrder,
  loadSchedules,
  loadSyncState,
  loadWeekBaseline,
  recordReviewWithEvidence,
  resolveMistake,
  saveManualOrder,
  saveWeekBaseline,
  subjectScoresFromMastery,
  syncEvidence,
  weekStartFor,
  type SyncState,
} from "@/lib/v2/intelligence/profile";

// ============================================================================
// Scholar Intelligence — the academic brain of Scholar V2.1
// Overview (Today with Scholar + mastery) · Weak Radar · Mistake Book ·
// Revision Queue (spaced repetition) · Exam Intelligence (incl. CRASH MODE)
// ============================================================================

interface IntelligenceSnapshot {
  eventsCount: number;
  mastery: MasteryEstimate[];
  weakTopics: WeakTopic[];
  patterns: MistakePattern[];
  mistakes: MistakeRecord[];
  queue: RevisionQueueItem[];
  exams: ExamInsight[];
  brief: { items: DailyBriefItem[] };
  weekly: ReturnType<typeof buildWeeklyReport>;
  now: number;
}

function parseDateMs(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

const SEVERITY_COLORS: Record<WeakTopic["severity"], string> = {
  mild: "#f59e0b",
  moderate: "#f97316",
  severe: "#ef4444",
};

const LEVEL_COLORS: Record<string, string> = {
  UNKNOWN: "#64748b",
  INTRODUCED: "#0ea5e9",
  LEARNING: "#f59e0b",
  DEVELOPING: "#f97316",
  STRONG: "#10b981",
  MASTERED: "#6366f1",
  DECAYING: "#ef4444",
};

const RATING_STYLES: Record<ReviewRating, { label: string; className: string }> = {
  again: { label: "Again", className: "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25" },
  hard: { label: "Hard", className: "bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25" },
  good: { label: "Good", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25" },
  easy: { label: "Easy", className: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25" },
};

export function IntelligenceView() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const quizAttempts = useStore((s) => s.quizAttempts);
  const tasks = useStore((s) => s.tasks);
  const sessions = useStore((s) => s.sessions);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState("overview");
  const [syncState, setSyncState] = useState<SyncState>(() => loadSyncState(scholarClass));
  const [isPlus, setIsPlus] = useState<boolean | null>(null);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    syncEvidence(scholarClass).then((state) => {
      if (!cancelled) setSyncState(state);
    });
    return () => {
      cancelled = true;
    };
  }, [scholarClass]);

  useEffect(() => {
    const handler = () => bump();
    window.addEventListener(QUIZ_MISTAKES_UPDATED_EVENT, handler);
    return () => window.removeEventListener(QUIZ_MISTAKES_UPDATED_EVENT, handler);
  }, [bump]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v2/entitlements", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          const plan = String(data.plan ?? "");
          setIsPlus(plan === "PLUS" || plan === "DEVELOPER" || plan === "UNLOCKED");
        }
      })
      .catch(() => {
        if (!cancelled) setIsPlus(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const snapshot = useMemo<IntelligenceSnapshot>(() => {
    void version;
    const now = Date.now();
    const events = deriveEvidence(scholarClass);
    const mistakes = deriveMistakes(scholarClass);
    const mastery = [...estimateAllMastery(events, now).values()];
    const weakTopics = findWeakTopics({ events, mistakes, now });
    const patterns = detectPatterns(mistakes, now);
    const exams = deriveExams(scholarClass, now);
    const studyProgress = deriveStudyProgress();
    const examInsights = examIntelligence({ exams, mastery, studyProgress, evidence: events, now });
    const schedules = loadSchedules(scholarClass);
    const manualOrder = loadManualOrder(scholarClass);
    const queue = buildRevisionQueue({ mastery, weakTopics, mistakes, exams: examInsights, schedules, manualOrder, now });
    const assignments = (tasks ?? [])
      .filter((task) => task.type === "assignment" && !task.done)
      .map((task) => ({ title: task.title, dueAt: parseDateMs(task.date) ?? now + DAY_MS }));
    const studyMinutesToday = (sessions ?? [])
      .filter((session) => session.completedAt >= startOfDay(now))
      .reduce((sum, session) => sum + session.duration / 60, 0);
    const brief = buildDailyBrief({
      assignments,
      exams: exams.map((exam) => ({ title: exam.title, date: exam.date })),
      weakTopics,
      revisionQueue: queue,
      studyMinutesToday,
      now,
    });
    const baseline = loadWeekBaseline(scholarClass);
    const weekStart = weekStartFor(now);
    const weekly = buildWeeklyReport({
      evidence: events,
      mistakes,
      mastery,
      baseline: baseline?.subjectScores ?? null,
      weekStart: Date.parse(weekStart),
      now,
    });
    return { eventsCount: events.length, mastery, weakTopics, patterns, mistakes, queue, exams: examInsights, brief, weekly, now };
  }, [scholarClass, quizAttempts, tasks, sessions, version]);

  // Capture a weekly baseline once per week so "mastery movement" is measurable.
  useEffect(() => {
    const baseline = loadWeekBaseline(scholarClass);
    const currentWeek = weekStartFor(Date.now());
    if (!baseline || baseline.weekStart !== currentWeek) {
      saveWeekBaseline(scholarClass, {
        weekStart: currentWeek,
        subjectScores: subjectScoresFromMastery(snapshot.mastery),
        takenAt: Date.now(),
      });
    }
  }, [scholarClass, snapshot.mastery]);

  const dueItems = snapshot.queue.filter((item) => item.dueAt <= snapshot.now);
  const masteryAvg = snapshot.mastery.length
    ? Math.round(snapshot.mastery.reduce((sum, estimate) => sum + estimate.score * 100, 0) / snapshot.mastery.length)
    : 0;

  const syncLabel: Record<SyncState, string> = {
    idle: "Not synced",
    syncing: "Syncing…",
    synced: "Synced",
    offline: "Offline",
    guest: "Local mode",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30">V2.1 · NEW</Badge>
            <span className="text-xs text-muted-foreground">The academic brain of Scholar</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-300 via-teal-200 to-indigo-300 bg-clip-text text-transparent">
            Scholar Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Mastery, weak spots, mistakes and revision priorities — computed from your actual Scholar activity.
            Estimates are estimates: Scholar never pretends to know you better than you know yourself.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncChip state={syncState} onSync={() => syncEvidence(scholarClass).then(setSyncState)} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Brain} label="Mastery estimate" value={snapshot.mastery.length ? `${masteryAvg}%` : "—"} sub={snapshot.mastery.length ? `${snapshot.mastery.length} topics tracked` : "Complete a quiz to begin"} accent="#6366f1" />
        <StatCard icon={AlertTriangle} label="Weak topics" value={snapshot.weakTopics.length} sub={snapshot.weakTopics.length ? `${snapshot.weakTopics.filter((w) => w.severity === "severe").length} severe` : "Radar is clear"} accent="#f97316" />
        <StatCard icon={ListChecks} label="Revision due" value={dueItems.length} sub={`${snapshot.queue.length} items in queue`} accent="#10b981" />
        <StatCard icon={CalendarClock} label="Exams ahead" value={snapshot.exams.length} sub={snapshot.exams[0] ? `${snapshot.exams[0].daysRemaining} days to ${snapshot.exams[0].title}` : "No upcoming exams"} accent="#0ea5e9" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Today</TabsTrigger>
          <TabsTrigger value="weak">Weak Radar{snapshot.weakTopics.length ? ` (${snapshot.weakTopics.length})` : ""}</TabsTrigger>
          <TabsTrigger value="mistakes">Mistake Book{snapshot.mistakes.length ? ` (${snapshot.mistakes.length})` : ""}</TabsTrigger>
          <TabsTrigger value="queue">Revision Queue{dueItems.length ? ` (${dueItems.length})` : ""}</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <DailyBriefCard items={snapshot.brief.items} />
          <MasterySection mastery={snapshot.mastery} scholarClass={scholarClass} now={snapshot.now} />
          <WeeklyReportCard weekly={snapshot.weekly} isPlus={isPlus} />
        </TabsContent>

        <TabsContent value="weak">
          <WeakRadarPanel weakTopics={snapshot.weakTopics} />
        </TabsContent>

        <TabsContent value="mistakes">
          <MistakeBookPanel patterns={snapshot.patterns} mistakes={snapshot.mistakes} scholarClass={scholarClass} onChanged={bump} />
        </TabsContent>

        <TabsContent value="queue">
          <RevisionQueuePanel queue={snapshot.queue} scholarClass={scholarClass} onChanged={bump} now={snapshot.now} />
        </TabsContent>

        <TabsContent value="exams">
          <ExamsPanel exams={snapshot.exams} now={snapshot.now} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default IntelligenceView;

// ============================================================================
// Sync chip
// ============================================================================

function SyncChip({ state, onSync }: { state: SyncState; onSync: () => void }) {
  const config: Record<SyncState, { icon: typeof Wifi; label: string; className: string }> = {
    idle: { icon: CloudOff, label: "Not synced", className: "text-muted-foreground" },
    syncing: { icon: RefreshCw, label: "Syncing…", className: "text-amber-400" },
    synced: { icon: Wifi, label: "Synced", className: "text-emerald-400" },
    offline: { icon: CloudOff, label: "Offline", className: "text-muted-foreground" },
    guest: { icon: CloudOff, label: "Local mode", className: "text-muted-foreground" },
  };
  const { icon: Icon, label, className } = config[state];
  return (
    <button
      onClick={onSync}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-border bg-card/60 hover:bg-card transition-colors"
      title="Sync intelligence data with your Scholar account"
    >
      <Icon className={cn("h-3.5 w-3.5", state === "syncing" && "animate-spin", className)} />
      <span className={className}>{label}</span>
    </button>
  );
}

// ============================================================================
// Today with Scholar
// ============================================================================

const BRIEF_ICONS: Record<DailyBriefItem["kind"], typeof Sparkles> = {
  assignment: Clock,
  exam: CalendarClock,
  weak: AlertTriangle,
  "revision-due": ListChecks,
  focus: Flame,
  stats: Sparkles,
};

function DailyBriefCard({ items }: { items: DailyBriefItem[] }) {
  return (
    <Card className="premium-card p-5 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl" />
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-indigo-300" />
        <h2 className="text-base font-semibold">Today with Scholar</h2>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Sparkles} title="Nothing to report yet" description="Complete a quiz or add an exam and Scholar will start briefing your days." />
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, index) => {
            const Icon = BRIEF_ICONS[item.kind];
            return (
              <motion.li
                key={`${item.kind}-${index}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3.5 py-2.5"
              >
                <Icon className={cn("h-4 w-4 shrink-0", item.severity === "urgent" ? "text-red-400" : item.severity === "warning" ? "text-amber-400" : "text-indigo-300")} />
                <p className="flex-1 text-sm">{item.text}</p>
                {item.action && (
                  <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => navigateTo(item.action!.view)}>
                    {item.action.label}
                  </Button>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ============================================================================
// Mastery section
// ============================================================================

function MasterySection({ mastery, scholarClass, now }: { mastery: MasteryEstimate[]; scholarClass: 9 | 11; now: number }) {
  const curriculum = useCurriculum();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const bySubject = useMemo(() => {
    const map = new Map<string, MasteryEstimate[]>();
    for (const estimate of mastery) {
      const list = map.get(estimate.subject) ?? [];
      list.push(estimate);
      map.set(estimate.subject, list);
    }
    return map;
  }, [mastery]);

  if (!mastery.length) {
    return (
      <Card className="premium-card">
        <EmptyState
          icon={Brain}
          title="No mastery data yet"
          description="Scholar builds your mastery map from quizzes, practice and revision. Finish a quiz and it appears here."
          action={<Button onClick={() => navigateTo("quiz")}>Take a quiz</Button>}
        />
      </Card>
    );
  }

  const subjectRows = curriculum
    .map((subject) => {
      const estimates = bySubject.get(subject.id) ?? [];
      const subjectLevel = estimates.find((estimate) => !estimate.chapter && !estimate.topic)
        ?? (estimates.length ? estimates.reduce((a, b) => (a.evidenceCount >= b.evidenceCount ? a : b)) : undefined);
      const score = subjectLevel ? Math.round(subjectLevel.score * 100) : null;
      const needsRefresh = estimates.some((estimate) => estimate.needsRefresh);
      return { subject, estimates, subjectLevel, score, needsRefresh };
    })
    .filter((row) => row.estimates.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-teal-300" /> Subject mastery
        </h2>
        <span className="text-xs text-muted-foreground">Estimate · based on recent evidence</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {subjectRows.map(({ subject, subjectLevel, score, needsRefresh }) => (
          <motion.button
            key={subject.id}
            onClick={() => setSelectedSubject(selectedSubject === subject.id ? null : subject.id)}
            className="text-left"
            whileHover={{ y: -2 }}
          >
            <Card className="premium-card premium-card-hover p-4 h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{subject.icon}</span>
                  <span className="font-medium">{subject.name}</span>
                </div>
                {needsRefresh && <Badge className="bg-red-500/10 text-red-400 border-red-500/30">Needs refresh</Badge>}
              </div>
              {subjectLevel && score !== null ? (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs" style={{ color: LEVEL_COLORS[subjectLevel.level] }}>
                      {MASTERY_LEVEL_LABELS[subjectLevel.level]}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{score}%</span>
                  </div>
                  <Bar value={score} className="h-1.5" fillClassName="bg-gradient-to-r from-indigo-500 to-teal-400" />
                  {subjectLevel.daysSinceRevision !== null && (
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Last revised {subjectLevel.daysSinceRevision} days ago
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Evidence coming in — keep practicing.</p>
              )}
            </Card>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selectedSubject && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card className="premium-card p-4">
              <SubjectDetail subjectId={selectedSubject} mastery={bySubject.get(selectedSubject) ?? []} now={now} />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubjectDetail({ subjectId, mastery }: { subjectId: string; mastery: MasteryEstimate[]; now: number }) {
  const curriculum = useCurriculum();
  const subject = curriculum.find((item) => item.id === subjectId);
  const chapters = mastery.filter((estimate) => estimate.chapter);
  const hasTopicDetail = mastery.some((estimate) => estimate.topic);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <span className="text-lg">{subject?.icon ?? "📚"}</span> {subject?.name ?? subjectDisplayName(subjectId)}
        </h3>
        <span className="text-xs text-muted-foreground">{mastery.length} topic{mastery.length !== 1 ? "s" : ""} tracked</span>
      </div>
      {chapters.length === 0 && !hasTopicDetail && (
        <p className="text-sm text-muted-foreground">Subject-level estimate only so far — quiz questions with chapters give finer detail.</p>
      )}
      <div className="grid gap-2">
        {mastery
          .slice()
          .sort((a, b) => a.score - b.score)
          .map((estimate) => (
            <div key={[estimate.subject, estimate.chapter ?? "", estimate.topic ?? ""].join("|")} className="rounded-lg border border-border/60 bg-background/40 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-sm font-medium truncate">
                  {estimate.topic ?? estimate.chapter ?? subjectDisplayName(estimate.subject)}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-medium" style={{ color: LEVEL_COLORS[estimate.level] }}>
                    {MASTERY_LEVEL_LABELS[estimate.level]}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{Math.round(estimate.score * 100)}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Bar value={Math.round(estimate.score * 100)} className="h-1 flex-1" fillClassName="bg-gradient-to-r from-indigo-500 to-teal-400" />
                {estimate.needsRefresh && estimate.daysSinceRevision !== null && (
                  <span className="text-[11px] text-red-400 whitespace-nowrap">Quick refresh recommended</span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ============================================================================
// Weekly report
// ============================================================================

function WeeklyReportCard({ weekly, isPlus }: { weekly: ReturnType<typeof buildWeeklyReport>; isPlus: boolean | null }) {
  const accuracy = weekly.accuracy === null ? null : Math.round(weekly.accuracy * 100);
  return (
    <Card className="premium-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-teal-300" /> Weekly learning report
        </h2>
        <Badge className="bg-teal-500/10 text-teal-300 border-teal-500/30">
          {weekly.hasBaseline ? "With baseline" : "Baseline starting"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Study time" value={`${Math.round(weekly.studyMinutes)} min`} />
        <MiniStat label="Subjects" value={weekly.subjectsStudied.length ? String(weekly.subjectsStudied.length) : "—"} sub={weekly.subjectsStudied.slice(0, 3).map(subjectDisplayName).join(", ") || "none this week"} />
        <MiniStat label="Questions" value={String(weekly.questionsAttempted)} sub={accuracy === null ? "no accuracy yet" : `${accuracy}% accurate`} />
        <MiniStat label="Consistency" value={`${Math.round(weekly.consistency * 100)}%`} sub={`${weekly.revisionDays} revision day${weekly.revisionDays !== 1 ? "s" : ""}`} />
      </div>
      {(weekly.mostImprovedChapter || weekly.weakestTopic) && (
        <div className="mt-3 space-y-1.5 text-sm">
          {weekly.mostImprovedChapter && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Most improved: <span className="text-foreground font-medium">{subjectDisplayName(weekly.mostImprovedChapter)}</span>
            </p>
          )}
          {weekly.weakestTopic && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> Weakest topic: <span className="text-foreground font-medium">{weekly.weakestTopic}</span>
            </p>
          )}
        </div>
      )}
      {weekly.masteryMovement.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="text-xs text-muted-foreground mb-2">Mastery movement vs last week</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {weekly.masteryMovement.map((move) => (
              <div key={move.subject} className="rounded-lg bg-background/40 border border-border/60 px-3 py-2">
                <p className="text-xs font-medium">{subjectDisplayName(move.subject)}</p>
                <p className={cn("text-sm tabular-nums", (move.to ?? 0) >= (move.from ?? 0) ? "text-emerald-400" : "text-red-400")}>
                  {move.from}% → {move.to}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {isPlus === false && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-indigo-300" />
            <span>Scholar Plus adds deeper weekly trends, mastery history and subject-level breakdowns.</span>
          </div>
          <Button size="sm" className="bg-indigo-500 hover:bg-indigo-400 text-white" onClick={() => openScholarPlus({ source: "ai-tutor", feature: "intelligence-weekly-report" })}>
            Explore Scholar Plus
          </Button>
        </div>
      )}
    </Card>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-background/40 border border-border/60 px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

// ============================================================================
// Weak Topic Radar
// ============================================================================

function WeakRadarPanel({ weakTopics }: { weakTopics: WeakTopic[] }) {
  const [filter, setFilter] = useState<"all" | WeakTopic["severity"]>("all");
  const list = filter === "all" ? weakTopics : weakTopics.filter((topic) => topic.severity === filter);

  if (!weakTopics.length) {
    return (
      <Card className="premium-card">
        <EmptyState
          icon={Eye}
          title="Radar is clear"
          description="No repeated struggles detected yet. When a concept keeps going wrong, Scholar will flag it here with a suggested action."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["all", "mild", "moderate", "severe"] as const).map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              filter === level ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {level === "all" ? "All" : level[0].toUpperCase() + level.slice(1)}
            {level !== "all" ? ` (${weakTopics.filter((topic) => topic.severity === level).length})` : ""}
          </button>
        ))}
      </div>
      <div className="grid gap-3">
        {list.map((topic) => (
          <Card key={[topic.subject, topic.chapter ?? "", topic.topic ?? ""].join("|")} className="premium-card premium-card-hover p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium truncate">{topic.title}</h3>
                  <Badge className="bg-muted text-muted-foreground border-border">{subjectDisplayName(topic.subject)}</Badge>
                  <Badge className="border" style={{ color: SEVERITY_COLORS[topic.severity], borderColor: `${SEVERITY_COLORS[topic.severity]}40`, background: `${SEVERITY_COLORS[topic.severity]}12` }}>
                    {topic.severity[0].toUpperCase() + topic.severity.slice(1)}
                  </Badge>
                  {topic.masteryLevel === "DECAYING" && <Badge className="bg-red-500/10 text-red-400 border-red-500/30">Needs refresh</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(topic.accuracy * 100)}% accuracy · {topic.recentWrong} recent wrong{topic.recentWrong !== 1 ? "s" : ""}
                  {topic.lastAttemptAt ? ` · last attempted ${timeAgo(topic.lastAttemptAt)}` : ""}
                  {topic.lastRevisedAt ? ` · revised ${timeAgo(topic.lastRevisedAt)}` : ""}
                </p>
                <div className="mt-2 max-w-xs">
                  <Bar value={Math.round(topic.accuracy * 100)} className="h-1" fillClassName={topic.severity === "severe" ? "bg-red-500" : topic.severity === "moderate" ? "bg-orange-500" : "bg-amber-400"} />
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <WeakAction topic={topic} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WeakAction({ topic }: { topic: WeakTopic }) {
  const config: Record<WeakTopic["suggestion"], { label: string; icon: typeof Play; view: string }> = {
    revise: { label: "Revise", icon: BookOpenCheck, view: "revision-hub" },
    practice: { label: "Practice", icon: Play, view: "quiz" },
    watch: { label: "Watch", icon: Video, view: "nigtube" },
    "ask-tutor": { label: "Ask Tutor", icon: Sparkles, view: "ai-tutor" },
    "create-reminder": { label: "Create Reminder", icon: Clock, view: "reminders" },
  };
  const { label, icon: Icon, view } = config[topic.suggestion];
  return (
    <Button size="sm" variant="outline" onClick={() => navigateTo(view)}>
      <Icon className="h-3.5 w-3.5 mr-1.5" /> {label}
    </Button>
  );
}

// ============================================================================
// Mistake Book
// ============================================================================

function MistakeBookPanel({ patterns, mistakes, scholarClass, onChanged }: {
  patterns: MistakePattern[];
  mistakes: MistakeRecord[];
  scholarClass: 9 | 11;
  onChanged: () => void;
}) {
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const subjects = useMemo(() => [...new Set(mistakes.map((mistake) => mistake.subject))], [mistakes]);
  const list = subjectFilter === "all" ? mistakes : mistakes.filter((mistake) => mistake.subject === subjectFilter);
  const open = list.filter((mistake) => !mistake.resolved);

  if (!mistakes.length) {
    return (
      <Card className="premium-card">
        <EmptyState
          icon={XCircle}
          title="No mistakes recorded yet"
          description="Wrong answers from quizzes and practice are collected here automatically, with a suggested type and pattern analysis."
        />
      </Card>
    );
  }

  const toggleResolved = (mistake: MistakeRecord) => {
    resolveMistake(scholarClass, mistake.id, !mistake.resolved);
    toast.success(mistake.resolved ? "Mistake restored to the book." : "Marked as resolved — it leaves the revision queue.");
    onChanged();
  };

  return (
    <div className="space-y-4">
      {patterns.length > 0 && (
        <Card className="premium-card p-5 border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h3 className="font-semibold text-sm">Mistake pattern analysis</h3>
          </div>
          <ul className="space-y-2">
            {patterns.map((pattern) => (
              <li key={pattern.id} className="rounded-lg bg-background/40 border border-border/60 px-3.5 py-2.5 text-sm">
                <p>{pattern.insight}</p>
                <p className="text-xs text-muted-foreground mt-1">{pattern.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSubjectFilter("all")}
          className={cn("px-3 py-1.5 rounded-full text-xs font-medium", subjectFilter === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70")}
        >
          All ({open.length})
        </button>
        {subjects.map((subject) => (
          <button
            key={subject}
            onClick={() => setSubjectFilter(subject)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium", subjectFilter === subject ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70")}
          >
            {subjectDisplayName(subject)} ({mistakes.filter((mistake) => mistake.subject === subject && !mistake.resolved).length})
          </button>
        ))}
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={() => navigateTo("quiz")}>
            <Play className="h-3.5 w-3.5 mr-1.5" /> Practice my mistakes
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {list.map((mistake) => (
          <Card key={mistake.id} className={cn("premium-card p-4", mistake.resolved && "opacity-55")}>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-muted text-muted-foreground border-border">{subjectDisplayName(mistake.subject)}</Badge>
                  <Badge className="border border-border text-muted-foreground">{mistake.mistakeType}</Badge>
                  {mistake.chapter && <Badge className="bg-muted text-muted-foreground border-border">{mistake.chapter}</Badge>}
                  {mistake.resolved && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Resolved</Badge>}
                </div>
                <p className={cn("text-sm mt-2", mistake.resolved && "line-through")}>{mistake.question}</p>
                {mistake.userAnswer && (
                  <div className="mt-2 space-y-1 text-xs">
                    <p className="text-red-400/90"><span className="text-muted-foreground">You answered:</span> {mistake.userAnswer}</p>
                    {mistake.correctAnswer && <p className="text-emerald-400/90"><span className="text-muted-foreground">Correct:</span> {mistake.correctAnswer}</p>}
                  </div>
                )}
                {mistake.explanation && <p className="text-xs text-muted-foreground mt-2">{mistake.explanation}</p>}
                <p className="text-[11px] text-muted-foreground mt-2">{timeAgo(mistake.at)} · {mistake.source}</p>
              </div>
              <div className="shrink-0">
                <Button size="sm" variant={mistake.resolved ? "outline" : "ghost"} onClick={() => toggleResolved(mistake)}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> {mistake.resolved ? "Restore" : "Mark resolved"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {list.length === 0 && <EmptyState icon={CheckCircle2} title="All clear here" description="No mistakes match this filter." />}
      </div>
    </div>
  );
}

// ============================================================================
// Revision Queue
// ============================================================================

function RevisionQueuePanel({ queue, scholarClass, onChanged, now }: {
  queue: RevisionQueueItem[];
  scholarClass: 9 | 11;
  onChanged: () => void;
  now: number;
}) {
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [justRated, setJustRated] = useState<string | null>(null);

  const due = queue.filter((item) => item.dueAt <= now);
  const reviewing = queue.find((item) => item.id === reviewingId) ?? null;

  const rate = (item: RevisionQueueItem, rating: ReviewRating) => {
    recordReviewWithEvidence(scholarClass, {
      itemId: item.id,
      rating,
      subject: item.subject,
      chapter: item.chapter,
      topic: item.topic,
    });
    setJustRated(item.id);
    setTimeout(() => {
      setJustRated(null);
      setReviewingId(null);
      onChanged();
    }, 350);
  };

  const move = (item: RevisionQueueItem, direction: -1 | 1) => {
    const order = [...loadManualOrder(scholarClass)];
    const current = queue.map((entry) => entry.id);
    const index = current.indexOf(item.id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    saveManualOrder(scholarClass, next);
    onChanged();
  };

  if (!queue.length) {
    return (
      <Card className="premium-card">
        <EmptyState
          icon={ListChecks}
          title="Revision queue is empty"
          description="Weak topics, unresolved mistakes and topics needing a refresh appear here, prioritized by exams and recency."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Due now" value={String(due.length)} />
        <MiniStat label="In queue" value={String(queue.length)} />
        <MiniStat label="Mature" value={String(queue.filter((item) => item.state === "MATURE").length)} />
      </div>

      <AnimatePresence mode="wait">
        {reviewing ? (
          <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card className="premium-card p-5 border-indigo-500/20">
              <div className="flex items-center justify-between mb-3">
                <Badge className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30">Active recall</Badge>
                <Button size="sm" variant="ghost" onClick={() => setReviewingId(null)}>Exit</Button>
              </div>
              <p className="text-lg font-medium">{reviewing.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {subjectDisplayName(reviewing.subject)} · {stateLabel(reviewing.state)} · reviewed {reviewing.reviewCount}×{reviewing.lapses ? ` · ${reviewing.lapses} lapse${reviewing.lapses > 1 ? "s" : ""}` : ""}
              </p>
              {justRated === reviewing.id ? (
                <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Updating your schedule…
                </div>
              ) : (
                <div className="mt-5 flex flex-wrap gap-2">
                  {(["again", "hard", "good", "easy"] as ReviewRating[]).map((rating) => (
                    <button
                      key={rating}
                      onClick={() => rate(reviewing, rating)}
                      className={cn("px-4 py-2 rounded-xl border text-sm font-medium transition-colors", RATING_STYLES[rating].className)}
                    >
                      {RATING_STYLES[rating].label}
                    </button>
                  ))}
                </div>
              )}
              {reviewing.reasons.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {reviewing.reasons.map((reason) => (
                    <span key={reason} className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground">{reason}</span>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {queue.map((item, index) => (
              <Card key={item.id} className={cn("premium-card premium-card-hover p-4", item.dueAt > now && "opacity-60")}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-sm truncate">{item.title}</h3>
                      <Badge className="bg-muted text-muted-foreground border-border">{subjectDisplayName(item.subject)}</Badge>
                      <Badge className={cn("border", item.state === "RELEARNING" ? "text-red-400 border-red-500/30 bg-red-500/10" : "text-muted-foreground border-border")}>
                        {stateLabel(item.state)}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {item.dueAt <= now ? <span className="text-emerald-400">due now</span> : dueLabel({ state: item.state, intervalDays: item.intervalDays, ease: item.ease, dueAt: item.dueAt, reviewCount: item.reviewCount, lapses: item.lapses }, now)}
                        {item.reviewCount > 0 ? ` · reviewed ${item.reviewCount}×` : ""}
                      </span>
                    </div>
                    {item.reasons.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {item.reasons.slice(0, 2).map((reason) => (
                          <span key={reason} className="text-[11px] text-muted-foreground">{reason}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => move(item, -1)} disabled={index === 0} aria-label="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => move(item, 1)} disabled={index === queue.length - 1} aria-label="Move down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReviewingId(item.id)} disabled={item.dueAt > now && item.reviewCount > 0}>
                      <Play className="h-3.5 w-3.5 mr-1.5" /> Review
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Exam Intelligence
// ============================================================================

function ExamsPanel({ exams, now }: { exams: ExamInsight[]; now: number }) {
  if (!exams.length) {
    return (
      <Card className="premium-card">
        <EmptyState
          icon={CalendarClock}
          title="No upcoming exams"
          description="Add an exam to your Planner and Scholar will build preparedness estimates, coverage tracking and (when time is short) a CRASH MODE plan."
          action={<Button onClick={() => navigateTo("planner")}>Open Planner</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {exams.map((exam) => (
        <Card key={exam.id} className={cn("premium-card p-5", exam.daysRemaining <= 3 && "border-red-500/25")}>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-base">{exam.title}</h3>
                {exam.subject && <Badge className="bg-muted text-muted-foreground border-border">{subjectDisplayName(exam.subject)}</Badge>}
                <Badge className={cn("border", exam.daysRemaining <= 3 ? "text-red-400 border-red-500/30 bg-red-500/10" : exam.daysRemaining <= 7 ? "text-amber-400 border-amber-500/30 bg-amber-500/10" : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10")}>
                  {exam.daysRemaining === 0 ? "Today" : exam.daysRemaining === 1 ? "Tomorrow" : `${exam.daysRemaining} days left`}
                </Badge>
                {exam.crashMode && <Badge className="bg-red-500/15 text-red-300 border-red-500/30">CRASH MODE</Badge>}
              </div>
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                <CoverageBar label="Syllabus coverage" value={exam.syllabusCoverage} />
                <CoverageBar label="Revision completion" value={exam.revisionCompletion} />
              </div>
              {exam.weakChapters.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1.5">Weak chapters</p>
                  <div className="flex flex-wrap gap-1.5">
                    {exam.weakChapters.map((chapter) => (
                      <span key={chapter} className="text-[11px] px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{chapter}</span>
                    ))}
                  </div>
                </div>
              )}
              {exam.crashMode && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-sm font-semibold text-red-300 mb-2">Compressed revision plan</p>
                  <CrashList title="Must do" items={exam.crashMode.mustDo} tone="must" />
                  <CrashList title="Should do" items={exam.crashMode.shouldDo} tone="should" />
                  <CrashList title="Optional" items={exam.crashMode.optional} tone="optional" />
                </div>
              )}
            </div>
            <div className="shrink-0 flex flex-row lg:flex-col items-center gap-4 lg:gap-2 lg:justify-center">
              <ProgressRing
                value={exam.preparedness ?? 0}
                size={92}
                stroke={7}
                color={exam.preparedness === null ? "#64748b" : exam.preparedness >= 70 ? "#10b981" : exam.preparedness >= 45 ? "#f59e0b" : "#ef4444"}
                label={exam.preparedness === null ? "—" : `${exam.preparedness}%`}
              />
              <p className="text-[11px] text-muted-foreground max-w-[110px] text-center leading-snug">
                {exam.preparedness === null ? "Start practicing to see your estimate" : "Preparedness estimate"}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CoverageBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xs tabular-nums">{value === null ? "—" : `${Math.round(value * 100)}%`}</p>
      </div>
      <Bar value={value === null ? 0 : Math.round(value * 100)} className="h-1.5" fillClassName="bg-gradient-to-r from-indigo-500 to-teal-400" />
    </div>
  );
}

function CrashList({ title, items, tone }: { title: string; items: string[]; tone: "must" | "should" | "optional" }) {
  if (!items.length) return null;
  return (
    <div className="mb-2 last:mb-0">
      <p className={cn("text-xs font-semibold mb-1", tone === "must" ? "text-red-400" : tone === "should" ? "text-amber-400" : "text-muted-foreground")}>{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", tone === "must" ? "bg-red-400" : tone === "should" ? "bg-amber-400" : "bg-muted-foreground")} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Minimal progress bar with a customizable fill (shadcn Progress is fixed-color). */
function Bar({ value, className, fillClassName }: { value: number; className?: string; fillClassName?: string }) {
  const safe = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted/70", className)} role="progressbar" aria-valuenow={safe} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full w-full rounded-full transition-all", fillClassName)} style={{ transform: `translateX(-${100 - safe}%)` }} />
    </div>
  );
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}
