"use client";

import { useMemo, useSyncExternalStore } from "react";
import { ArrowRight, Brain, CalendarClock, ListChecks, ShieldCheck, TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { navigateTo } from "@/lib/nav-event";
import {
  DAY_MS,
  buildDailyBrief,
  buildRevisionQueue,
  estimateAllMastery,
  examIntelligence,
  findWeakTopics,
  type DailyBriefItem,
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
} from "@/lib/v2/intelligence/profile";
import {
  INTELLIGENCE_CONSENT_EVENT,
  grantIntelligenceConsent,
  loadIntelligenceConsent,
} from "@/lib/v2/intelligence/consent";

const SEVERITY_DOT: Record<WeakTopic["severity"], string> = {
  mild: "bg-amber-300",
  moderate: "bg-orange-400",
  severe: "bg-red-400",
};

function parseDateMs(value: string): number | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function subscribeConsent(cb: () => void) {
  window.addEventListener(INTELLIGENCE_CONSENT_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(INTELLIGENCE_CONSENT_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Dashboard "Today with Scholar" brief. Reads only local Scholar data, and only
 * after the student has explicitly enabled Scholar Intelligence. It never calls
 * the evidence-sync endpoint; the full Intelligence view owns that.
 */
export function TodayBrief() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const guestMode = useStore((s) => s.guestMode);
  const consent = useSyncExternalStore(
    subscribeConsent,
    () => (guestMode ? "guest" : loadIntelligenceConsent(scholarClass) ?? "unset"),
    () => "pending",
  );

  if (consent === "pending") return null;
  if (guestMode || consent !== "granted") {
    return <ConsentCard guest={guestMode} onEnable={() => grantIntelligenceConsent(scholarClass)} />;
  }
  return <BriefBody scholarClass={scholarClass} />;
}

function ConsentCard({ guest, onEnable }: { guest: boolean; onEnable: () => void }) {
  return (
    <section aria-labelledby="today-brief-title" className="order-2 md:order-none relative z-10 px-4 sm:px-8 max-w-5xl mx-auto w-full mb-4 sm:mb-6">
      <div className="dash-glass rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center h-10 w-10 rounded-2xl bg-white/10 text-white shrink-0"><Brain className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 id="today-brief-title" className="text-base font-geist font-medium text-white">Today with Scholar</h2>
            <p className="text-sm text-white/60 mt-1 font-geist">
              {guest
                ? "Sign in to turn on Scholar Intelligence: a daily brief, weak topics and a revision queue built from your own quizzes and practice."
                : "Turn on Scholar Intelligence to see a daily brief, weak topics and a revision queue built from your own quizzes and practice. Nothing is analysed while it is off."}
            </p>
          </div>
        </div>
        {guest ? null : (
          <button type="button" onClick={onEnable} className="dash-glass rounded-full px-5 min-h-11 text-sm text-white font-geist hover:bg-white/5 transition-colors shrink-0 inline-flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Turn on
          </button>
        )}
      </div>
    </section>
  );
}

function BriefBody({ scholarClass }: { scholarClass: 9 | 11 }) {
  const quizAttempts = useStore((s) => s.quizAttempts);
  const tasks = useStore((s) => s.tasks);
  const sessions = useStore((s) => s.sessions);

  const data = useMemo(() => {
    const now = Date.now();
    const events = deriveEvidence(scholarClass);
    const mistakes = deriveMistakes(scholarClass);
    const mastery = [...estimateAllMastery(events, now).values()];
    const weak = findWeakTopics({ events, mistakes, now });
    const exams = deriveExams(scholarClass, now);
    const examInsights = examIntelligence({ exams, mastery, studyProgress: deriveStudyProgress(), evidence: events, now });
    const queue: RevisionQueueItem[] = buildRevisionQueue({
      mastery, weakTopics: weak, mistakes, exams: examInsights,
      schedules: loadSchedules(scholarClass), manualOrder: loadManualOrder(scholarClass), now,
    });
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);
    const brief = buildDailyBrief({
      assignments: (tasks ?? []).filter((t) => t.type === "assignment" && !t.done).map((t) => ({ title: t.title, dueAt: parseDateMs(t.date) ?? now + DAY_MS })),
      exams: exams.map((e) => ({ title: e.title, date: e.date })),
      weakTopics: weak,
      revisionQueue: queue,
      studyMinutesToday: (sessions ?? []).filter((s) => s.completedAt >= startOfToday).reduce((sum, s) => sum + s.duration / 60, 0),
      now,
    });
    return { evidenceCount: events.length, weak, queue, brief, now };
    // quizAttempts/tasks/sessions drive re-derivation when the student's data changes.
  }, [scholarClass, quizAttempts, tasks, sessions]);

  const due = data.queue.filter((q) => q.dueAt <= data.now).length;
  const weak = data.weak.slice(0, 3);
  const items = data.brief.items.filter((i) => i.kind !== "stats").slice(0, 3);

  return (
    <section aria-labelledby="today-brief-title" className="order-2 md:order-none relative z-10 px-4 sm:px-8 max-w-5xl mx-auto w-full mb-4 sm:mb-6">
      <div className="dash-glass-strong rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 id="today-brief-title" className="font-garamond text-xl text-white">Today with Scholar</h2>
            <p className="text-xs text-white/50 font-geist">Built from your own quizzes, practice and planner</p>
          </div>
          <button type="button" onClick={() => navigateTo("intelligence")} className="dash-glass rounded-full min-h-11 px-4 text-xs text-white font-geist inline-flex items-center gap-1.5 hover:bg-white/5 transition-colors shrink-0">
            Full report <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>

        {data.evidenceCount === 0 && items.length === 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white/5 p-4">
            <p className="text-sm text-white/70 font-geist">Not enough activity yet. Solve a few practice questions or take a quiz and your weak topics will show up here.</p>
            <button type="button" onClick={() => navigateTo("question-practice")} className="dash-glass rounded-full min-h-11 px-5 text-sm text-white font-geist shrink-0">Start practising</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/40 font-geist font-medium mb-2 flex items-center gap-1.5"><CalendarClock className="h-3 w-3" aria-hidden="true" /> Needs attention</p>
              {items.length === 0 ? (
                <p className="text-sm text-white/60 font-geist">Nothing urgent. A calm day, so get ahead on a weak topic.</p>
              ) : (
                <ul className="space-y-1.5">{items.map((item, i) => <BriefRow key={`${item.kind}-${i}`} item={item} />)}</ul>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/40 font-geist font-medium mb-2 flex items-center gap-1.5"><TriangleAlert className="h-3 w-3" aria-hidden="true" /> Weak topics{due > 0 ? ` · ${due} revision due` : ""}</p>
              {weak.length === 0 ? (
                <p className="text-sm text-white/60 font-geist">No weak topics detected from your {data.evidenceCount} recorded attempt{data.evidenceCount === 1 ? "" : "s"}.</p>
              ) : (
                <ul className="space-y-1.5">
                  {weak.map((t) => (
                    <li key={`${t.subject}-${t.chapter ?? ""}-${t.topic ?? ""}`} className="flex items-center gap-3 rounded-xl px-2.5 min-h-11 hover:bg-white/5 transition-colors">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${SEVERITY_DOT[t.severity]}`} aria-label={`${t.severity} priority`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-white font-geist truncate">{t.title}</span>
                        <span className="block text-[11px] text-white/50 font-geist">{Math.round(t.accuracy * 100)}% over {t.attempts} attempt{t.attempts === 1 ? "" : "s"}</span>
                      </span>
                      <button type="button" onClick={() => navigateTo(t.suggestion === "practice" ? "question-practice" : t.suggestion === "ask-tutor" ? "lam-ai" : "revision-hub")} className="text-xs text-white/80 hover:text-white underline-offset-4 hover:underline font-geist shrink-0 min-h-11 px-1">
                        {t.suggestionLabel}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {due > 0 ? (
          <button type="button" onClick={() => navigateTo("revision-hub")} className="mt-4 w-full sm:w-auto dash-glass rounded-full min-h-11 px-5 text-sm text-white font-geist inline-flex items-center justify-center gap-2 hover:bg-white/5 transition-colors">
            <ListChecks className="h-4 w-4" aria-hidden="true" /> Review {due} due item{due === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function BriefRow({ item }: { item: DailyBriefItem }) {
  const tone = item.severity === "urgent" ? "bg-red-400" : item.severity === "warning" ? "bg-amber-300" : "bg-white/50";
  return (
    <li className="flex items-center gap-3 rounded-xl px-2.5 min-h-11 hover:bg-white/5 transition-colors">
      <span className={`h-2 w-2 rounded-full shrink-0 ${tone}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm text-white font-geist leading-snug">{item.text}</span>
      {item.action ? (
        <button type="button" onClick={() => navigateTo(item.action!.view)} className="text-xs text-white/80 hover:text-white underline-offset-4 hover:underline font-geist shrink-0 min-h-11 px-1">
          {item.action.label}
        </button>
      ) : null}
    </li>
  );
}
