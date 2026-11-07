"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileCheck2,
  FileText,
  Flame,
  Layers,
  Lightbulb,
  Play,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { currentTask, evidence, remainingSeconds, type ExamSession, type Lesson } from "@/lib/exam-ready/model";
import { chapterSignals, formatTime, isShortSprint, stageLabels } from "@/lib/exam-ready/experience";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { loadQuizMistakes } from "@/lib/quiz-mistakes";
import { navigateTo } from "@/lib/nav-event";
import { setLamPluginTarget, setWorkspaceMode } from "@/lib/shrinking-scholar";
import { LAMVisual, Plate } from "./presentation";

function formatCountdown(timestamp: number, now: number): string {
  const diffMs = timestamp - now;
  if (diffMs <= 0) return "Exam window reached";
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days}d ${hours % 24}h left`;
  const mins = Math.max(1, Math.floor((diffMs % 3_600_000) / 60_000));
  return `${hours}h ${mins}m left`;
}

function openLamPluginFromExamReady(pluginId: string, prompt: string) {
  setLamPluginTarget(pluginId, prompt);
  setWorkspaceMode("lam-ai", "plugins");
  navigateTo("lam-ai", { pluginId, prompt });
}

export function PreparationHome({
  sessions,
  allowed,
  onNew,
  onChoose,
}: {
  sessions: ExamSession[];
  allowed: boolean;
  onNew: () => void;
  onChoose: (id: string) => void;
}) {
  const curriculum = useCurriculum();
  const scholarClass = useStore((s) => s.user.scholarClass);
  const studyProgress = useStore((s) => s.studyProgress);
  const mastery = useStore((s) => s.mastery);
  const quizAttempts = useStore((s) => s.quizAttempts);
  const flashcards = useStore((s) => s.flashcards);
  const tasks = useStore((s) => s.tasks);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"paths" | "syllabus" | "radar" | "mistakes">("paths");
  const [now] = useState(() => Date.now());

  const mistakes = useMemo(() => loadQuizMistakes(scholarClass), [scholarClass]);

  const analytics = useMemo(() => {
    const allChapters = curriculum.flatMap((subject) =>
      subject.chapters.map((chapter) => {
        const progress = Math.max(0, Math.min(100, Math.round(studyProgress[chapter.id] ?? 0)));
        const subjectMastery = Math.max(0, Math.min(100, Math.round(mastery[subject.id] ?? 0)));
        const chapterMistakes = mistakes.filter(
          (m) =>
            m.chapter.toLowerCase() === chapter.title.toLowerCase() ||
            m.subject.toLowerCase() === subject.name.toLowerCase(),
        ).length;
        const status: "completed" | "in-progress" | "needs-revision" | "unstarted" =
          progress >= 80
            ? "completed"
            : chapterMistakes > 0 || (progress > 0 && progress < 45)
              ? "needs-revision"
              : progress > 0
                ? "in-progress"
                : "unstarted";
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          topicCount: chapter.concepts.length,
          progress,
          subjectMastery,
          chapterMistakes,
          status,
        };
      }),
    );

    const totalChapters = allChapters.length;
    const completedChapters = allChapters.filter((c) => c.status === "completed").length;
    const inProgressChapters = allChapters.filter((c) => c.status === "in-progress" || c.status === "needs-revision").length;
    const avgProgress = totalChapters
      ? Math.round(allChapters.reduce((sum, c) => sum + c.progress, 0) / totalChapters)
      : 0;

    const quizQuestionsTotal = quizAttempts.reduce((sum, a) => sum + (a.total || 0), 0);
    const quizScoreTotal = quizAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
    const sessionCheckedAttempts = sessions.flatMap((s) =>
      s.attempts.filter((a) => a.evaluation !== "self-reviewed"),
    );
    const totalScoredQuestions = quizQuestionsTotal + sessionCheckedAttempts.length;
    const totalCorrectQuestions =
      quizScoreTotal + sessionCheckedAttempts.filter((a) => a.correct).length;
    const verifiedAccuracy =
      totalScoredQuestions > 0
        ? Math.round((totalCorrectQuestions / totalScoredQuestions) * 100)
        : null;

    const dueFlashcards = flashcards.filter(
      (card) => card.box <= 2 || now - (card.lastReviewed || 0) > 86_400_000,
    ).length;

    const upcomingExamTasks = tasks
      .filter((t) => (t.type === "exam" || t.type === "revision") && !t.done)
      .slice(0, 4);

    const priorityChapters = [...allChapters]
      .sort((a, b) => {
        if (b.chapterMistakes !== a.chapterMistakes) return b.chapterMistakes - a.chapterMistakes;
        return a.progress - b.progress;
      })
      .slice(0, 4);

    return {
      allChapters,
      totalChapters,
      completedChapters,
      inProgressChapters,
      avgProgress,
      totalScoredQuestions,
      verifiedAccuracy,
      dueFlashcards,
      upcomingExamTasks,
      priorityChapters,
    };
  }, [curriculum, flashcards, mastery, mistakes, now, quizAttempts, sessions, studyProgress, tasks]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.status === "active") ?? sessions[0] ?? null,
    [sessions],
  );

  const visibleChapters = useMemo(() => {
    const filtered =
      selectedSubjectId === "all"
        ? analytics.allChapters
        : analytics.allChapters.filter((c) => c.subjectId === selectedSubjectId);
    return filtered.slice(0, 8);
  }, [analytics.allChapters, selectedSubjectId]);

  const nextAction = useMemo(() => {
    if (activeSession) {
      const task = currentTask(activeSession);
      return {
        eyebrow: `Resume active preparation · ${activeSession.setup.exam}`,
        title: task ? task.title : "Open final review & mock check",
        detail:
          task?.objective ??
          "Continue from your last saved checkpoint with verified readiness tracking.",
        ctaLabel: "Continue preparation",
        onAction: () => onChoose(activeSession.id),
      };
    }
    if (mistakes.length > 0) {
      const latestMistake = mistakes[0];
      return {
        eyebrow: `${mistakes.length} recorded quiz mistake${mistakes.length === 1 ? "" : "s"} need repair`,
        title: `Repair ${latestMistake.chapter || latestMistake.subject || "recent mistake"}`,
        detail: `You missed "${latestMistake.question.slice(0, 90)}${latestMistake.question.length > 90 ? "…" : ""}". Practise targeted questions or analyse the root cause with LAM.`,
        ctaLabel: "Practise weak topic",
        onAction: () => navigateTo("question-practice", { mode: "practice" }),
      };
    }
    const lowest = analytics.priorityChapters[0];
    if (lowest) {
      return {
        eyebrow: `Recommended next chapter · ${lowest.subjectName}`,
        title: `Start ${lowest.chapterTitle} (${lowest.progress}% covered)`,
        detail:
          "Build a structured Exam Ready path around this chapter or test your baseline in Question Practice.",
        ctaLabel: "Build preparation path",
        onAction: onNew,
      };
    }
    return {
      eyebrow: "Recommended next step",
      title: "Build your first Exam Ready path",
      detail: "Select your exam date, syllabus chapters, and real study budget to generate a step-by-step plan.",
      ctaLabel: "Build my preparation path",
      onAction: onNew,
    };
  }, [activeSession, analytics.priorityChapters, mistakes, onChoose, onNew]);

  return (
    <>
      {/* Progressive Step Tabs: One after the other */}
      <nav className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/40 p-1.5 backdrop-blur-xl" aria-label="Exam Ready Stages">
        <button
          type="button"
          onClick={() => setActiveTab("paths")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${activeTab === "paths" ? "bg-gradient-to-r from-indigo-500/30 to-violet-500/30 text-white border border-white/20 shadow-md" : "text-white/60 hover:text-white hover:bg-white/5"}`}
        >
          <Target size={14} className={activeTab === "paths" ? "text-indigo-300" : ""} />
          <span>1. Active Paths & Plans</span>
          {sessions.length > 0 && <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px]">{sessions.length}</span>}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("syllabus")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${activeTab === "syllabus" ? "bg-gradient-to-r from-indigo-500/30 to-violet-500/30 text-white border border-white/20 shadow-md" : "text-white/60 hover:text-white hover:bg-white/5"}`}
        >
          <Layers size={14} className={activeTab === "syllabus" ? "text-indigo-300" : ""} />
          <span>2. Syllabus & Mastery</span>
          <span className="text-[10px] text-white/50">{analytics.completedChapters}/{analytics.totalChapters}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("radar")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${activeTab === "radar" ? "bg-gradient-to-r from-indigo-500/30 to-violet-500/30 text-white border border-white/20 shadow-md" : "text-white/60 hover:text-white hover:bg-white/5"}`}
        >
          <Flame size={14} className={activeTab === "radar" ? "text-indigo-300" : ""} />
          <span>3. High-Yield Radar</span>
          {analytics.priorityChapters.length > 0 && <span className="rounded-full bg-amber-500/20 text-amber-300 px-1.5 py-0.2 text-[10px]">{analytics.priorityChapters.length}</span>}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("mistakes")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${activeTab === "mistakes" ? "bg-gradient-to-r from-indigo-500/30 to-violet-500/30 text-white border border-white/20 shadow-md" : "text-white/60 hover:text-white hover:bg-white/5"}`}
        >
          <AlertTriangle size={14} className={activeTab === "mistakes" ? "text-indigo-300" : ""} />
          <span>4. Mistake Notebook</span>
          {mistakes.length > 0 && <span className="rounded-full bg-rose-500/20 text-rose-300 px-1.5 py-0.2 text-[10px]">{mistakes.length}</span>}
        </button>
      </nav>
      {activeTab === "paths" && (
        <div className="space-y-6">
          <section className="er-welcome er-plate">
        <div>
          <span className="er-eyebrow">Your teacher. Your time. A clearer next step.</span>
          <h2>
            A focused path,
            <br />
            <em>built for your exam.</em>
          </h2>
          <p>
            Choose your chapters, deadline and real study time. LAM connects teaching, practice and
            revision into one preparation you can return to.
          </p>
          <div className="er-actions">
            <button className="er-primary" disabled={!allowed} onClick={onNew}>
              Build my preparation path <ArrowRight size={18} />
            </button>
            <button
              type="button"
              onClick={() => navigateTo("question-practice", { mode: "practice" })}
            >
              Open Question Practice <Target size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigateTo("past-papers")}
            >
              Past Papers <FileCheck2 size={16} />
            </button>
          </div>
          <div className="er-welcome-benefits">
            <span>
              <Target size={17} /> Choose your focus
            </span>
            <span>
              <Brain size={17} /> Learn and check
            </span>
            <span>
              <Lightbulb size={17} /> Repair real gaps
            </span>
          </div>
        </div>
        <div className="er-welcome-preview">
          <LAMVisual state="greeting" />
          <div className="er-welcome-speech">
            <strong>Let’s get started.</strong>
            <p>I’ll help you create a path that fits your exam, sources and time.</p>
          </div>
        </div>
      </section>

      {/* Transparent, Data-Backed Readiness Command Strip */}
      <section className="er-readiness-command-grid" aria-label="Exam readiness overview">
        <article className="er-plate er-metric-card">
          <span className="er-eyebrow">
            <Layers size={14} /> Syllabus coverage · Class {scholarClass}
          </span>
          <strong className="er-metric-value">{analytics.avgProgress}%</strong>
          <div className="er-progress-track">
            <span style={{ width: `${analytics.avgProgress}%` }} />
          </div>
          <small>
            {analytics.completedChapters}/{analytics.totalChapters} chapters ≥80% ·{" "}
            {analytics.inProgressChapters} in progress
          </small>
        </article>

        <article className="er-plate er-metric-card">
          <span className="er-eyebrow">
            <ClipboardCheck size={14} /> Verified check accuracy
          </span>
          <strong className="er-metric-value">
            {analytics.verifiedAccuracy !== null ? `${analytics.verifiedAccuracy}%` : "Uncalibrated"}
          </strong>
          <div className="er-progress-track">
            <span style={{ width: `${analytics.verifiedAccuracy ?? 0}%` }} />
          </div>
          <small>
            {analytics.totalScoredQuestions > 0
              ? `Across ${analytics.totalScoredQuestions} scored quiz & checkpoint answers`
              : "Complete a quiz or checkpoint to calibrate accuracy"}
          </small>
        </article>

        <article className="er-plate er-metric-card">
          <span className="er-eyebrow">
            <AlertTriangle size={14} /> Recorded weak signals
          </span>
          <strong className="er-metric-value">{mistakes.length}</strong>
          <small>
            {mistakes.length > 0
              ? `${mistakes.length} saved quiz mistake${mistakes.length === 1 ? "" : "s"} ready for targeted repair`
              : "No recorded quiz mistakes yet — take a diagnostic quiz"}
          </small>
          <div className="er-actions">
            <button
              type="button"
              onClick={() =>
                mistakes.length > 0
                  ? openLamPluginFromExamReady(
                      "mistake-analyzer",
                      "Analyse my recent quiz mistakes and build a repair drill.",
                    )
                  : navigateTo("quiz")
              }
            >
              {mistakes.length > 0 ? "Repair with LAM" : "Run diagnostic quiz"}{" "}
              <ArrowRight size={14} />
            </button>
          </div>
        </article>

        <article className="er-plate er-metric-card">
          <span className="er-eyebrow">
            <Flame size={14} /> Active recall & flashcards
          </span>
          <strong className="er-metric-value">{analytics.dueFlashcards} due</strong>
          <small>
            {flashcards.length} total cards in your Class {scholarClass} revision decks
          </small>
          <div className="er-actions">
            <button type="button" onClick={() => navigateTo("flashcards")}>
              Review flashcards <ArrowRight size={14} />
            </button>
          </div>
        </article>
      </section>

      {/* Recommended Next Study Action + Quick Revision Toolkit */}
      <div className="er-overview-v4 er-command-split">
        <section className="er-plate er-next-action-banner" aria-label="Recommended next study action">
          <span className="er-eyebrow">
            <Sparkles size={15} /> {nextAction.eyebrow}
          </span>
          <h3>{nextAction.title}</h3>
          <p>{nextAction.detail}</p>
          <div className="er-actions">
            <button className="er-primary" disabled={!allowed && nextAction.onAction === onNew} onClick={nextAction.onAction}>
              {nextAction.ctaLabel} <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() =>
                openLamPluginFromExamReady(
                  "one-night-exam",
                  `Create a high-yield revision priority plan for Class ${scholarClass}.`,
                )
              }
            >
              <Sparkles size={15} /> One-Night Exam Mode
            </button>
            <button type="button" onClick={() => navigateTo("mock-exam")}>
              <FileCheck2 size={15} /> Mock Exam
            </button>
          </div>
        </section>

        <section className="er-plate er-quick-toolkit" aria-label="Quick revision and practice tools">
          <span className="er-eyebrow">
            <TrendingUp size={15} /> Connected study toolkit
          </span>
          <h3>Jump straight to practice or revision</h3>
          <div className="er-toolkit-grid">
            <button type="button" onClick={() => navigateTo("question-practice", { mode: "practice" })}>
              <Target size={16} />
              <span>
                <strong>Question Practice</strong>
                <small>Chapter drills & filters</small>
              </span>
            </button>
            <button type="button" onClick={() => navigateTo("quiz")}>
              <ClipboardCheck size={16} />
              <span>
                <strong>Timed Quiz</strong>
                <small>Calibrate accuracy</small>
              </span>
            </button>
            <button type="button" onClick={() => navigateTo("past-papers")}>
              <FileText size={16} />
              <span>
                <strong>Past Papers</strong>
                <small>Exam-style papers</small>
              </span>
            </button>
            <button type="button" onClick={() => navigateTo("formulas")}>
              <BookOpen size={16} />
              <span>
                <strong>Formula Sheet</strong>
                <small>Equations & units</small>
              </span>
            </button>
            <button type="button" onClick={() => navigateTo("revision")}>
              <CheckCircle2 size={16} />
              <span>
                <strong>Revision Hub</strong>
                <small>Key chapter summaries</small>
              </span>
            </button>
            <button type="button" onClick={() => navigateTo("doubt-lab")}>
              <Brain size={16} />
              <span>
                <strong>Doubt Lab</strong>
                <small>Step-by-step solutions</small>
              </span>
            </button>
          </div>
        </section>
      </div>

      {/* Saved Exam Ready Preparations */}
      <div className="er-card-title">
        <h2>Your preparations</h2>
        <small>
          {sessions.length
            ? `${sessions.length} saved on this workspace`
            : "Your first path starts here"}
        </small>
      </div>
      <div className="er-session-list">
        {sessions.map((s) => {
          const ev = evidence(s);
          const doneCount = s.tasks.filter((t) => t.status === "done").length;
          return (
            <button className="er-plate" key={s.id} onClick={() => onChoose(s.id)}>
              <div className="er-actions" style={{ margin: 0, width: "100%", justifyContent: "space-between" }}>
                <span className="er-pill">{s.status}</span>
                <span className="er-pill">
                  <Clock size={12} /> {formatCountdown(s.setup.examAt, now)}
                </span>
              </div>
              <h3 style={{ marginTop: 10 }}>{s.setup.exam}</h3>
              <p>
                Class {s.setup.grade} · {s.setup.chapters.length} chapter
                {s.setup.chapters.length === 1 ? "" : "s"} · {doneCount}/{s.tasks.length} checkpoints
              </p>
              <div className="er-progress-track" style={{ width: "100%" }}>
                <span
                  style={{
                    width: `${s.tasks.length ? Math.round((doneCount / s.tasks.length) * 100) : 0}%`,
                  }}
                />
              </div>
              <small>
                {ev.accuracy !== null
                  ? `${ev.accuracy}% checked accuracy (${ev.questions} questions)`
                  : "Readiness calibrating — complete a checkpoint check"}
              </small>
              <strong style={{ marginTop: 6 }}>{currentTask(s)?.title ?? "Final review"}</strong>
              <span>
                Open preparation <ArrowRight size={16} />
              </span>
            </button>
          );
        })}
      </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setActiveTab("syllabus")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
            >
              Next Step: Review Syllabus & Mastery →
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Syllabus & Mastery */}
      {activeTab === "syllabus" && (
        <div className="space-y-6">
          <section className="er-plate" aria-label="Subject and chapter syllabus progress">
          <div className="er-card-title">
            <div>
              <span className="er-eyebrow">Syllabus tracker</span>
              <h3>Subject & chapter-wise readiness</h3>
            </div>
            <small>{analytics.completedChapters} of {analytics.totalChapters} chapters completed</small>
          </div>
          <div className="er-subject-switch" role="tablist" aria-label="Filter syllabus by subject">
            <button
              type="button"
              role="tab"
              aria-selected={selectedSubjectId === "all"}
              aria-pressed={selectedSubjectId === "all"}
              onClick={() => setSelectedSubjectId("all")}
            >
              All subjects
            </button>
            {curriculum.map((subject) => (
              <button
                key={subject.id}
                type="button"
                role="tab"
                aria-selected={selectedSubjectId === subject.id}
                aria-pressed={selectedSubjectId === subject.id}
                onClick={() => setSelectedSubjectId(subject.id)}
              >
                {subject.name} ({Math.round(mastery[subject.id] ?? 0)}%)
              </button>
            ))}
          </div>

          <div className="er-chapter-priorities">
            {visibleChapters.map((item) => (
              <article key={`${item.subjectId}:${item.chapterId}`} className="er-syllabus-chapter-card">
                <div className="er-syllabus-chapter-head">
                  <div>
                    <small className="er-priority-label">{item.subjectName}</small>
                    <strong>{item.chapterTitle}</strong>
                  </div>
                  <span className="er-pill" data-status={item.status}>
                    {item.status.replace("-", " ")}
                  </span>
                </div>
                <div className="er-progress-track">
                  <span style={{ width: `${item.progress}%` }} />
                </div>
                <div className="er-syllabus-chapter-foot">
                  <small>
                    {item.progress}% studied · {item.topicCount} topics
                    {item.chapterMistakes > 0 ? ` · ${item.chapterMistakes} mistake${item.chapterMistakes === 1 ? "" : "s"}` : ""}
                  </small>
                  <div className="er-actions" style={{ margin: 0 }}>
                    <button
                      type="button"
                      onClick={() =>
                        navigateTo("question-practice", {
                          mode: "practice",
                          subject: item.subjectName,
                          chapter: item.chapterTitle,
                        })
                      }
                    >
                      Practise
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          </section>
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setActiveTab("paths")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/70 hover:text-white"
            >
              ← Back to Active Plans
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("radar")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
            >
              Next Step: High-Yield Priority Radar →
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: High-Yield Radar */}
      {activeTab === "radar" && (
        <div className="space-y-6">
          <section className="er-plate" aria-label="Weak topics and revision priorities">
          <div className="er-card-title">
            <div>
              <span className="er-eyebrow">Weak-topic radar</span>
              <h3>Revision priorities & mistake log</h3>
            </div>
          </div>

          {mistakes.length > 0 ? (
            <div className="er-weak-list">
              {mistakes.slice(0, 4).map((mistake) => (
                <article key={mistake.id} className="er-weak-item">
                  <div>
                    <small className="er-priority-label">
                      {mistake.subject} · {mistake.chapter || "General"}
                    </small>
                    <strong>{mistake.question}</strong>
                    <small>
                      Your answer: {mistake.userAnswer} · Correct: {mistake.correctAnswer}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openLamPluginFromExamReady(
                        "mistake-analyzer",
                        `Explain why "${mistake.userAnswer}" is wrong for "${mistake.question}" (correct answer: "${mistake.correctAnswer}") and give me 2 similar practice questions.`,
                      )
                    }
                  >
                    Repair <ArrowRight size={13} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="er-weak-list">
              {analytics.priorityChapters.map((ch) => (
                <article key={`${ch.subjectId}:${ch.chapterId}`} className="er-weak-item">
                  <div>
                    <small className="er-priority-label">
                      {ch.subjectName} · Priority chapter
                    </small>
                    <strong>{ch.chapterTitle}</strong>
                    <small>
                      {ch.progress === 0
                        ? "Not started yet — high leverage for syllabus completion"
                        : `${ch.progress}% syllabus coverage · reinforce with practice checks`}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigateTo("question-practice", {
                        mode: "practice",
                        subject: ch.subjectName,
                        chapter: ch.chapterTitle,
                      })
                    }
                  >
                    Practise <ArrowRight size={13} />
                  </button>
                </article>
              ))}
            </div>
          )}

          {analytics.upcomingExamTasks.length > 0 ? (
            <>
              <div className="er-divider" />
              <span className="er-eyebrow">
                <CalendarDays size={13} /> Upcoming planner exams & revisions
              </span>
              <div className="er-weak-list" style={{ marginTop: 8 }}>
                {analytics.upcomingExamTasks.map((task) => (
                  <div key={task.id} className="er-weak-item">
                    <div>
                      <strong>{task.title}</strong>
                      <small>
                        {task.subject ? `${task.subject} · ` : ""}
                        {task.date}
                      </small>
                    </div>
                    <span className="er-pill">{task.priority}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          </section>
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setActiveTab("syllabus")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/70 hover:text-white"
            >
              ← Back to Syllabus
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mistakes")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
            >
              Next Step: Inspect Mistake Notebook →
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Mistake Notebook */}
      {activeTab === "mistakes" && (
        <div className="space-y-6">
          <section className="er-plate" aria-label="Mistake Notebook and Targeted Repair">
            <div className="er-card-title">
              <div>
                <span className="er-eyebrow">Mistake Notebook</span>
                <h3>Targeted Gap Repair & Accuracy Drill</h3>
              </div>
              <small>{mistakes.length} recorded mistake{mistakes.length === 1 ? "" : "s"}</small>
            </div>
            {mistakes.length > 0 ? (
              <div className="er-weak-list">
                {mistakes.map((mistake) => (
                  <article key={mistake.id} className="er-weak-item">
                    <div>
                      <small className="er-priority-label">{mistake.subject} · {mistake.chapter || "General"}</small>
                      <strong>{mistake.question}</strong>
                      <small className="text-rose-200">Your answer: {mistake.userAnswer} · Correct: {mistake.correctAnswer}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openLamPluginFromExamReady(
                          "mistake-analyzer",
                          `Explain why "${mistake.userAnswer}" is wrong for "${mistake.question}" (correct answer: "${mistake.correctAnswer}") and give me 2 similar practice questions.`
                        )
                      }
                    >
                      Repair with LAM <ArrowRight size={13} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-white/50">
                <p>No quiz mistakes recorded yet! Take a diagnostic quiz or Question Practice drill to calibrate your gap analysis.</p>
                <button
                  type="button"
                  onClick={() => navigateTo("quiz")}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15"
                >
                  Take a Quick Quiz <ArrowRight size={13} />
                </button>
              </div>
            )}
          </section>
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setActiveTab("radar")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/70 hover:text-white"
            >
              ← Back to Radar
            </button>
            <button
              type="button"
              onClick={() => navigateTo("mock-exam")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:brightness-110"
            >
              Launch Timed Mock Exam →
            </button>
          </div>
        </div>
      )}

      <div className="er-home-features">
        {[
          {
            icon: Brain,
            title: "Your learning style",
            text: "Clear steps, concise explanations or examples first — using the existing teaching engine.",
          },
          {
            icon: BookOpen,
            title: "Sources you control",
            text: "Scholar’s independent library, with private uploads protected and unsupported content labelled.",
          },
          {
            icon: CalendarDays,
            title: "Your actual availability",
            text: "A study budget distinct from your exam countdown. Adjust the remaining work as life changes.",
          },
        ].map((f) => (
          <Plate key={f.title} title={f.title} icon={f.icon}>
            <p>{f.text}</p>
          </Plate>
        ))}
      </div>
    </>
  );
}

type OverviewProps = {
  session: ExamSession;
  lesson?: Lesson;
  guest: boolean;
  developmentGuest?: boolean;
  busy: boolean;
  onContinue: () => void;
  onToggle: () => void;
  onNotes: () => void;
  onResources: () => void;
  onSource: (ids: string[]) => void;
  onNote: (text: string) => void;
};

export function SessionOverview({
  session: s,
  guest,
  developmentGuest = false,
  busy,
  onContinue,
  onNotes,
  onResources,
}: OverviewProps) {
  const [now] = useState(() => Date.now());
  const task = currentTask(s);
  const signals = chapterSignals(s);
  const ev = evidence(s);
  const doneCheckpoints = s.tasks.filter((t) => t.status === "done").length;
  const incorrectAttempts = s.attempts.filter(
    (a) => !a.correct && a.evaluation !== "self-reviewed",
  );

  return (
    <>
      <div className="er-overview-v4">
        <section className="er-next-step er-plate">
          <span className="er-eyebrow">
            <Sparkles size={17} />
            Your next step · {task ? stageLabels[task.kind] : "Review"}
          </span>
          <h2>{s.status === "completed" ? "Bring it all together." : "Continue learning."}</h2>
          <h3>{task?.topic ?? "Your final preparation"}</h3>
          <p>
            {task?.objective ??
              "Review your checked answers and recorded gaps before your next exam."}
          </p>
          <div className="er-actions">
            <span className="er-pill">{formatTime(task?.seconds ?? 0)} planned</span>
            <span className="er-pill">Plan v{s.planVersion}</span>
            <span className="er-pill">
              <Clock size={12} /> {formatCountdown(s.setup.examAt, now)}
            </span>
            <span className="er-pill">
              {doneCheckpoints}/{s.tasks.length} checkpoints done
            </span>
          </div>
          <button className="er-primary" disabled={busy} onClick={onContinue}>
            <Play size={16} />
            {s.status === "completed" ? "Open final review" : "Continue learning"}
            <ArrowRight size={18} />
          </button>
          <details>
            <summary>Why this is next</summary>
            <p>{task?.reason ?? "Your preparation is complete; checked evidence is retained."}</p>
          </details>
        </section>

        <section className="er-partner-v4 er-plate">
          <span className="er-eyebrow">Your preparation partner</span>
          <div className="er-partner-message">
            <LAMVisual state={busy ? "planning" : "attentive"} />
            <div>
              <h3>One idea at a time.</h3>
              <p>
                {isShortSprint(s)
                  ? "We’ll protect the essentials: key ideas, useful checks and targeted repair."
                  : "Understand the concept, try an example, then use your answers to choose what needs attention."}
              </p>
            </div>
          </div>
          <ul className="er-preview-features">
            <li>
              <Check size={14} />{" "}
              {ev.accuracy !== null
                ? `${ev.accuracy}% verified accuracy across ${ev.questions} checked question${ev.questions === 1 ? "" : "s"}`
                : "Readiness uses checked evidence — answer a checkpoint question to calibrate"}
            </li>
            <li>
              <Check size={14} />{" "}
              {incorrectAttempts.length > 0
                ? `${incorrectAttempts.length} recorded incorrect check${incorrectAttempts.length === 1 ? "" : "s"} queued for targeted repair`
                : "Zero unresolved incorrect checks in this session so far"}
            </li>
            <li>
              <Check size={14} /> Remaining study budget: {formatTime(remainingSeconds(s, now))}
            </li>
          </ul>
          {guest && (
            <small>
              {developmentGuest
                ? "Local Guest AI uses a bounded approved allowance. No private account access."
                : "Device-only Guest guidance is not a live AI response."}
            </small>
          )}
        </section>
      </div>

      <div className="er-overview-quicktools">
        <button onClick={onNotes}>
          <FileText size={20} />
          <span>
            <strong>Your notes</strong>
            <small>{s.notes ? "Saved work, ready to revisit" : "Capture ideas as you learn"}</small>
          </span>
          <ArrowRight size={16} />
        </button>
        <button onClick={onResources}>
          <BookOpen size={20} />
          <span>
            <strong>Materials & sources</strong>
            <small>Your selected library and source policy</small>
          </span>
          <ArrowRight size={16} />
        </button>
      </div>

      <details className="er-overview-details er-plate" open>
        <summary>
          <Target size={17} />
          Chapter progress & schedule
        </summary>
        <div className="er-chapter-priorities">
          {signals.map((c) => (
            <article key={c.subjectId + ":" + c.chapterId}>
              <div>
                <strong>{c.title}</strong>
                <small>{c.priority}</small>
              </div>
              <div className="er-progress-track">
                <span style={{ width: (c.total ? (c.completed / c.total) * 100 : 0) + "%" }} />
              </div>
              <small>
                {c.completed}/{c.total} planned steps ·{" "}
                {c.accuracy === null
                  ? "Not yet checked"
                  : c.accuracy + "% checked accuracy (" + c.questions + " questions)"}
              </small>
            </article>
          ))}
        </div>
        {s.setup.blocks.length > 0 && (
          <div className="er-schedule">
            {s.setup.blocks.map((b, i) => (
              <div key={i}>
                <strong>
                  {new Date(b.start).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </strong>
                <small>
                  {new Date(b.start).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {b.minutes} min
                </small>
              </div>
            ))}
          </div>
        )}
      </details>
    </>
  );
}
