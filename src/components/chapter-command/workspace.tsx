"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowRight, BookOpen, Brain, CalendarDays, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Clock3, FileQuestion, FileText, Flame, Gauge, GraduationCap,
  Layers3, Lightbulb, ListChecks, Mic, Pause, Play, Plus, Search, Send,
  Sparkles, Target, Timer, TrendingUp, Video, X,
} from "lucide-react";
import { askAI } from "@/lib/ai";
import { AIClientError } from "@/lib/ai/client";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { getChapterCommandData, STATUS_META, type ChapterCommandData, type ChapterStatus } from "@/lib/chapter-command";
import { navigateTo } from "@/lib/nav-event";
import { useCurriculum } from "@/lib/use-curriculum";
import { useStore, type QuizAttempt, type QuizQuestion, type Task } from "@/lib/store";
import type { PracticeQuestion } from "@/lib/question-bank";
import { toast } from "@/lib/notifications/notification-api";
import { getFlashcardCountByChapter } from "@/lib/flashcards-class11-meta";
import { openChapterDestination, practiceChapterId } from "@/lib/chapter-navigation";
import "./workspace.css";
import { ResourceLibrary, ResourceShelf } from "@/components/resources/resource-library";

type Mode = "overview" | "mastery" | "resources" | "practice" | "lam" | "revision" | "analytics" | "planner" | "mock" | "recommendations";
type FlowId = "learn" | "questions" | "mcq" | "doubts" | "revision" | "mock";
const FLOW_STEPS = [
  { id: "learn", title: "Learn the chapter", detail: "Build the foundation in Study", icon: BookOpen },
  { id: "questions", title: "Work through questions", detail: "Solve and understand the method", icon: ListChecks },
  { id: "mcq", title: "Check with MCQs", detail: "Test recall with instant feedback", icon: Target },
  { id: "doubts", title: "Clear doubts with LAM", detail: "Explain anything still unclear", icon: Sparkles },
  { id: "revision", title: "Revise the essentials", detail: "Recall formulas, notes and definitions", icon: Brain },
  { id: "mock", title: "Take a chapter mock", detail: "Bring everything together", icon: FileQuestion },
] as const;
function flowNote(data: ChapterCommandData, id: FlowId) { return `ccc-flow:v1:${data.classProfile}:${data.subjectId}:${data.chapterId}:${id}`; }
function lamFlowPrompt(data: ChapterCommandData, id: FlowId) {
  const intro = `I am studying Class ${data.classProfile} ${data.subjectName}, chapter "${data.chapterTitle}". Stay strictly within this chapter. Do not invent textbook passages or claim to know my performance.`;
  const instructions: Record<FlowId, string> = {
    learn: "Scholar has no mapped lesson for this chapter. Teach its core ideas in a clear order, starting with a simple explanation and worked example. Pause after each concept for one check question, then adapt to my answer.",
    questions: "Scholar has no mapped worked questions here. Guide me through three chapter-appropriate problems from easy to harder. Present one question at a time, let me attempt it first, then explain the solution step by step and correct mistakes without revealing later answers.",
    mcq: "Scholar has no mapped MCQs here. Run an interactive five-question chapter MCQ drill, one question at a time with four choices. Wait for my answer before revealing the correct option, explain why, track my score in this conversation, and end with weak concepts to revise.",
    doubts: "Run a focused doubt-clearing session. First ask which concept or question confuses me most. Explain it simply with an example, ask a short check question, and follow up until I can explain it back.",
    revision: "Quiz me on the chapter's most important concepts, formulas and definitions one item at a time. Give concise corrections and a final revision checklist.",
    mock: "Scholar has no mapped mock questions here. Conduct a chapter-only mini mock with five varied questions, one at a time. Do not show answers until I respond. Explain each answer and finish with a score and honest revision advice.",
  };
  return `${intro} ${instructions[id]}`;
}
type WorkspaceContext = {
  data: ChapterCommandData;
  mode: Mode;
  go: (mode: Mode) => void;
  attempts: QuizAttempt[];
  notes: ReturnType<typeof useStore.getState>["notes"];
  tasks: Task[];
  flowTasks: Task[];
  saveFlow: () => void;
  launchFlowStep: (id: FlowId) => void;
  activity: ReturnType<typeof useStore.getState>["activity"];
  accuracy: number | null;
  totalAnswered: number;
  weakQuestions: QuizQuestion[];
  addNote: ReturnType<typeof useStore.getState>["addNote"];
  addTask: ReturnType<typeof useStore.getState>["addTask"];
  toggleTask: ReturnType<typeof useStore.getState>["toggleTask"];
  addQuizAttempt: ReturnType<typeof useStore.getState>["addQuizAttempt"];
  addXP: ReturnType<typeof useStore.getState>["addXP"];
  addSession: ReturnType<typeof useStore.getState>["addSession"];
  pushActivity: ReturnType<typeof useStore.getState>["pushActivity"];
};

const MODES = [
  { id: "overview", label: "Overview", icon: Layers3, caption: "Your chapter at a glance" },
  { id: "mastery", label: "Mastery", icon: Target, caption: "See what is complete" },
  { id: "resources", label: "Resources", icon: BookOpen, caption: "Everything to learn with" },
  { id: "practice", label: "Practice", icon: ListChecks, caption: "Solve and improve" },
  { id: "lam", label: "Ask LAM", icon: Sparkles, caption: "Chapter-aware help" },
  { id: "revision", label: "Revision", icon: Brain, caption: "Recall the essentials" },
  { id: "analytics", label: "Analytics", icon: Activity, caption: "Learn from results" },
  { id: "planner", label: "Missions", icon: CalendarDays, caption: "Make a study plan" },
  { id: "mock", label: "Mock exam", icon: FileQuestion, caption: "Test under pressure" },
  { id: "recommendations", label: "Next steps", icon: Lightbulb, caption: "Know what to do next" },
] as const;

function clamp(value: number) { return Math.max(0, Math.min(100, value)); }
function isChapterAttempt(attempt: QuizAttempt, data: ChapterCommandData) {
  return attempt.title.includes(`[CCC:${data.chapterId}]`) || attempt.questions.some((question) => question.chapter === data.chapterId);
}
function openChapterBook(data: ChapterCommandData) {
  const bookId = data.classProfile === 11 ? ({ physics: "physics-pt1", maths: "maths-pt1", chemistry: "chemistry-pt1" } as Record<string, string>)[data.subjectId] : undefined;
  if (!bookId || !data.ebook.available || !data.ebook.startPage) {
    openChapterDestination({ view: "study", scholarClass: data.classProfile, subjectId: data.subjectId, chapterId: data.chapterId });
    return;
  }
  try { sessionStorage.setItem("scholar:ebook:target", JSON.stringify({ bookId, page: data.ebook.startPage, destination: "Reader" })); } catch {}
  navigateTo("ebook");
}

export function ChapterCommandCenter() {
  const curriculum = useCurriculum();
  const scholarClass = useStore((state) => state.user.scholarClass);
  const jeeMode = useStore((state) => state.user.jeeMode);
  const studyProgress = useStore((state) => state.studyProgress);
  const subjectMastery = useStore((state) => state.mastery);
  const allAttempts = useStore((state) => state.quizAttempts);
  const allNotes = useStore((state) => state.notes);
  const allTasks = useStore((state) => state.tasks);
  const allActivity = useStore((state) => state.activity);
  const addNote = useStore((state) => state.addNote);
  const addTask = useStore((state) => state.addTask);
  const toggleTask = useStore((state) => state.toggleTask);
  const addQuizAttempt = useStore((state) => state.addQuizAttempt);
  const addXP = useStore((state) => state.addXP);
  const addSession = useStore((state) => state.addSession);
  const pushActivity = useStore((state) => state.pushActivity);
  const [subjectId, setSubjectId] = useState("physics");
  const [chapterId, setChapterId] = useState("p2");
  const [mode, setMode] = useState<Mode>("overview");
  const [chapterSearch, setChapterSearch] = useState("");
  const [lamLaunch, setLamLaunch] = useState<{ id: number; prompt: string } | null>(null);
  const modesRef = useRef<HTMLElement>(null);
  const [modeEdges, setModeEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem("scholar:ccc:selected") ?? "null") as { subjectId?: string; chapterId?: string } | null;
        if (saved?.subjectId && saved.chapterId) { setSubjectId(saved.subjectId); setChapterId(saved.chapterId); }
      } catch {}
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const selectChapter = (nextSubjectId: string, nextChapterId: string) => {
    setSubjectId(nextSubjectId); setChapterId(nextChapterId); setMode("overview"); setLamLaunch(null);
    try { sessionStorage.setItem("scholar:ccc:selected", JSON.stringify({ subjectId: nextSubjectId, chapterId: nextChapterId })); } catch {}
  };
  const updateModeEdges = useCallback(() => {
    const element = modesRef.current;
    if (!element) return;
    setModeEdges({ left: element.scrollLeft > 4, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    updateModeEdges();
    const element = modesRef.current;
    if (!element) return;
    const observer = new ResizeObserver(updateModeEdges);
    observer.observe(element);
    return () => observer.disconnect();
  }, [updateModeEdges]);

  const selectedSubject = curriculum.find((subject) => subject.id === subjectId) ?? curriculum[0];
  const selectedChapter = selectedSubject?.chapters.find((chapter) => chapter.id === chapterId) ?? selectedSubject?.chapters[0];
  const effectiveSubjectId = selectedSubject?.id ?? subjectId;
  const effectiveChapterId = selectedChapter?.id ?? chapterId;
  const data = useMemo(() => getChapterCommandData({
    scholarClass, jeeMode, subjectId: effectiveSubjectId, chapterId: effectiveChapterId,
    studyProgressPct: studyProgress[effectiveChapterId] ?? 0,
    subjectMasteryPct: subjectMastery[effectiveSubjectId] ?? 0,
  }), [scholarClass, jeeMode, effectiveSubjectId, effectiveChapterId, studyProgress, subjectMastery]);

  const attempts = useMemo(() => data ? allAttempts.filter((attempt) => isChapterAttempt(attempt, data)) : [], [allAttempts, data]);
  const notes = useMemo(() => data ? allNotes.filter((note) => note.tags.includes(`chapter:${data.chapterId}`)) : [], [allNotes, data]);
  const tasks = useMemo(() => data ? allTasks.filter((task) => task.note === `chapter:${data.chapterId}`) : [], [allTasks, data]);
  const flowTasks = useMemo(() => data ? allTasks.filter((task) => FLOW_STEPS.some((step) => task.note === flowNote(data, step.id))) : [], [allTasks, data]);
  const activity = useMemo(() => data ? allActivity.filter((item) => item.text.toLowerCase().includes(data.chapterTitle.toLowerCase())) : [], [allActivity, data]);
  const totalAnswered = attempts.reduce((sum, attempt) => sum + Object.keys(attempt.responses).length, 0);
  const totalCorrect = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
  const accuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : null;
  const weakQuestions = useMemo(() => attempts.flatMap((attempt) => attempt.questions.filter((question) => attempt.responses[question.id] !== undefined && attempt.responses[question.id] !== question.answer)), [attempts]);
  const saveFlow = () => {
    if (!data) return;
    const existing = new Set(useStore.getState().tasks.map((task) => task.note));
    FLOW_STEPS.forEach((step, index) => {
      const note = flowNote(data, step.id);
      if (existing.has(note)) return;
      const due = new Date(); due.setDate(due.getDate() + index);
      addTask({ title: `${data.chapterTitle} · ${step.title}`, subject: data.subjectId, type: step.id === "revision" ? "revision" : step.id === "mock" ? "exam" : "study", date: due.toISOString().slice(0, 10), priority: index === 0 ? "high" : "medium", note });
    });
  };
  const launchFlowStep = (id: FlowId) => {
    if (!data) return;
    saveFlow();
    const practiceId = practiceChapterId(data.subjectId, data.chapterId);
    const openLam = () => { setLamLaunch({ id: Date.now(), prompt: lamFlowPrompt(data, id) }); setMode("lam"); };
    if (id === "learn") {
      if (!data.overview && !data.concepts.length) return openLam();
      return openChapterDestination({ view: "study", scholarClass: data.classProfile, subjectId: data.subjectId, chapterId: data.chapterId });
    }
    if (id === "questions" || id === "mcq") {
      if (!practiceId || !(id === "questions" ? data.questions.subjective : data.questions.mcq)) return openLam();
      return openChapterDestination({ view: "practice", scholarClass: data.classProfile, subjectId: data.subjectId, chapterId: data.chapterId, filter: id === "questions" ? "subjective" : "mcq" });
    }
    if (id === "doubts") return openLam();
    if (id === "revision") { setMode("revision"); return; }
    if (data.questions.mcq < 3) return openLam();
    openChapterDestination({ view: "mock-exam", scholarClass: data.classProfile, subjectId: data.subjectId, chapterId: data.chapterId });
  };
  const context: WorkspaceContext | null = data ? { data, mode, go: setMode, attempts, notes, tasks, flowTasks, saveFlow, launchFlowStep, activity, accuracy, totalAnswered, weakQuestions, addNote, addTask, toggleTask, addQuizAttempt, addXP, addSession, pushActivity } : null;
  const filteredChapters = selectedSubject?.chapters.filter((chapter) => chapter.title.toLowerCase().includes(chapterSearch.toLowerCase())) ?? [];

  if (!data || !context) return <div className="ccc-empty-page">No chapter is available for this class yet.</div>;
  const status: ChapterStatus = data.studyProgressPct === 0 && !attempts.length ? "not-started"
    : data.studyProgressPct >= 80 && accuracy !== null && accuracy >= 80 ? "mastered"
    : accuracy !== null && accuracy < 60 ? "practice-needed"
    : data.studyProgressPct >= 70 && accuracy !== null && accuracy >= 70 ? "test-ready"
    : data.studyProgressPct >= 30 ? "learning" : "started";

  return <div className="ccc-root">
    <div className="ccc-atmosphere" aria-hidden="true"><span className="ccc-orbit ccc-orbit-one"/><span className="ccc-orbit ccc-orbit-two"/><span className="ccc-planet"/></div>
    <div className="ccc-layout">
      <aside className="ccc-rail ccc-glass" aria-label="Chapter selector">
        <div className="ccc-rail-brand"><GraduationCap size={24}/><div><strong>Chapter Command Centre</strong><small>Every chapter. A clearer path.</small></div></div>
        <div className="ccc-rail-quick">
          <label htmlFor="ccc-quick-subject">Subject</label><select id="ccc-quick-subject" aria-label="Subject" className="ccc-select" value={effectiveSubjectId} onChange={(event) => { const next = curriculum.find((item) => item.id === event.target.value); selectChapter(event.target.value, next?.chapters[0]?.id ?? ""); }}>{curriculum.map((subject) => <option key={subject.id} value={subject.id}>{subject.icon} {subject.name}</option>)}</select>
          <label htmlFor="ccc-quick-chapter">Chapter</label><select id="ccc-quick-chapter" aria-label="Chapter" className="ccc-select" value={effectiveChapterId} onChange={(event) => selectChapter(effectiveSubjectId, event.target.value)}>{selectedSubject?.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select>
        </div>
        <label className="ccc-label" htmlFor="ccc-subject">Subject</label>
        <select id="ccc-subject" className="ccc-select" value={effectiveSubjectId} onChange={(event) => { const next = curriculum.find((item) => item.id === event.target.value); selectChapter(event.target.value, next?.chapters[0]?.id ?? ""); }}>
          {curriculum.map((subject) => <option key={subject.id} value={subject.id}>{subject.icon} {subject.name}</option>)}
        </select>
        <label className="ccc-label" htmlFor="ccc-chapter-search">Find a chapter</label>
        <div className="ccc-search"><Search size={16}/><input id="ccc-chapter-search" value={chapterSearch} onChange={(event) => setChapterSearch(event.target.value)} placeholder="Search chapters"/></div>
        <nav className="ccc-chapter-list" aria-label="Chapters">
          {filteredChapters.length === 0 && <p className="ccc-muted">No matching chapters.</p>}
          {filteredChapters.map((chapter, index) => <button key={chapter.id} type="button" className={`ccc-chapter ${chapter.id === effectiveChapterId ? "is-active" : ""}`} aria-current={chapter.id === effectiveChapterId ? "page" : undefined} onClick={() => selectChapter(effectiveSubjectId, chapter.id)}>
            <span className="ccc-chapter-number">{String(index + 1).padStart(2, "0")}</span><span className="ccc-chapter-name">{chapter.title}</span><span className="ccc-chapter-progress">{studyProgress[chapter.id] ? `${Math.round(studyProgress[chapter.id])}%` : ""}</span>
          </button>)}
        </nav>
        <div className="ccc-rail-footer"><Sparkles size={17}/><span>One focused workspace for learning, practice and revision.</span></div>
      </aside>

      <div className="ccc-main">
        <header className="ccc-hero ccc-glass">
          <div className="ccc-hero-top"><span className="ccc-eyebrow">SCHOLAR / {data.subjectName.toUpperCase()} / CHAPTER {data.chapterNumber}</span><span className="ccc-status" style={{ color: STATUS_META[status].color }}>{STATUS_META[status].label}</span></div>
          <div className="ccc-hero-body"><div><p className="ccc-kicker">Your chapter workspace</p><h1>{data.chapterTitle}</h1><p className="ccc-hero-copy">{data.overview || `Learn ${data.subjectName.toLowerCase()} with a clear path from first concept to exam readiness.`}</p></div><div className="ccc-hero-metric"><ProgressRing value={data.studyProgressPct} label="Study progress"/><span>{totalAnswered ? `${totalAnswered} questions attempted` : "Start practicing to measure accuracy"}</span></div></div>
          <div className="ccc-hero-actions"><button className="ccc-primary" onClick={() => launchFlowStep("learn")}><Play size={16}/> Start guided flow <ArrowRight size={16}/></button><button className="ccc-secondary" onClick={() => setMode("planner")}><ListChecks size={16}/> Chapter missions</button><button className="ccc-secondary" onClick={() => setMode("lam")}><Sparkles size={16}/> Ask LAM</button></div>
        </header>

        <div className="ccc-mode-shell ccc-glass">
          <button type="button" className="ccc-mode-arrow" aria-label="Scroll sections left" disabled={!modeEdges.left} onClick={() => modesRef.current?.scrollBy({ left: -290, behavior: "smooth" })}><ChevronLeft size={17}/></button>
          <nav ref={modesRef} className="ccc-modes" aria-label="Chapter workspace sections" onScroll={updateModeEdges}>
            {MODES.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" title={item.caption} aria-current={mode === item.id ? "page" : undefined} className={`ccc-mode ${mode === item.id ? "is-active" : ""}`} onClick={(event) => { setMode(item.id); event.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }}><Icon size={17}/><span>{item.label}</span></button>; })}
          </nav>
          <button type="button" className="ccc-mode-arrow" aria-label="Scroll sections right" disabled={!modeEdges.right} onClick={() => modesRef.current?.scrollBy({ left: 290, behavior: "smooth" })}><ChevronRight size={17}/></button>
        </div>
        <div key={`${effectiveChapterId}-${mode}`} className="ccc-mode-content">
          {mode === "overview" && <Overview ctx={context}/>}
          {mode === "mastery" && <Mastery ctx={context}/>}
          {mode === "resources" && <Resources ctx={context}/>}
          {mode === "practice" && <Practice ctx={context} kind="practice"/>}
          {mode === "lam" && <ChapterLam ctx={context} launch={lamLaunch} onLaunchConsumed={() => setLamLaunch(null)}/>}
          {mode === "revision" && <Revision ctx={context}/>}
          {mode === "analytics" && <Analytics ctx={context}/>}
          {mode === "planner" && <Planner ctx={context}/>}
          {mode === "mock" && <Practice ctx={context} kind="mock"/>}
          {mode === "recommendations" && <Recommendations ctx={context}/>}
        </div>
      </div>
    </div>
  </div>;
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  return <div className="ccc-ring" style={{ background: `conic-gradient(#30d9e7 ${clamp(value)}%, rgba(159,189,229,.12) 0)` }} role="img" aria-label={`${label}: ${Math.round(value)} percent`}><div><strong>{Math.round(value)}%</strong><small>{label}</small></div></div>;
}
function Card({ title, icon: Icon, children, action, className = "" }: { title: string; icon: typeof BookOpen; children: React.ReactNode; action?: { label: string; onClick: () => void }; className?: string }) {
  return <section className={`ccc-card ccc-glass ${className}`}><div className="ccc-card-head"><h2><Icon size={18}/>{title}</h2>{action && <button className="ccc-text-action" onClick={action.onClick}>{action.label}<ArrowRight size={14}/></button>}</div>{children}</section>;
}
function Empty({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  return <div className="ccc-empty"><p>{text}</p>{action && <button className="ccc-secondary" onClick={action.onClick}>{action.label}<ArrowRight size={14}/></button>}</div>;
}
function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note?: string; icon: typeof BookOpen }) {
  return <div className="ccc-metric ccc-glass"><Icon size={20}/><div><small>{label}</small><strong>{value}</strong>{note && <span>{note}</span>}</div></div>;
}
function Action({ title, description, icon: Icon, onClick, primary = false }: { title: string; description: string; icon: typeof BookOpen; onClick: () => void; primary?: boolean }) {
  return <button className={`ccc-action ${primary ? "is-primary" : ""}`} onClick={onClick}><Icon size={23}/><span><strong>{title}</strong><small>{description}</small></span><ArrowRight size={16}/></button>;
}

function GuidedFlow({ ctx }: { ctx: WorkspaceContext }) {
  const { data, flowTasks, saveFlow, launchFlowStep, toggleTask } = ctx;
  const completed = flowTasks.filter((task) => task.done).length;
  const next = FLOW_STEPS.find((step) => !flowTasks.find((task) => task.note === flowNote(data, step.id))?.done);
  const practiceId = practiceChapterId(data.subjectId, data.chapterId);
  const missing = (id: FlowId) => id === "learn" ? !data.overview && !data.concepts.length
    : id === "questions" ? !practiceId || data.questions.subjective === 0
    : id === "mcq" ? !practiceId || data.questions.mcq === 0
    : id === "mock" ? data.questions.mcq < 3 : false;
  return <section className="ccc-flow ccc-glass" aria-label={`Guided learning flow for ${data.chapterTitle}`}>
    <div className="ccc-flow-head"><div><span className="ccc-eyebrow">YOUR CHAPTER ROUTE</span><h3>Learn {data.chapterTitle}, step by step.</h3><p>Each action opens the exact chapter in Scholar. If mapped material is missing, LAM guides that step instead.</p></div><div className="ccc-flow-count"><strong>{completed}/{FLOW_STEPS.length}</strong><span>steps done</span></div></div>
    <div className="ccc-progress-track"><span style={{ width: `${completed / FLOW_STEPS.length * 100}%` }}/></div>
    <ol className="ccc-flow-list">{FLOW_STEPS.map((step, index) => {
      const Icon = step.icon;
      const task = flowTasks.find((item) => item.note === flowNote(data, step.id));
      const isNext = next?.id === step.id;
      const fallback = missing(step.id);
      return <li key={step.id} className={`ccc-flow-step ${task?.done ? "is-done" : ""} ${isNext ? "is-next" : ""}`}>
        <span className="ccc-flow-index">{task?.done ? <Check size={15}/> : String(index + 1).padStart(2, "0")}</span>
        <span className="ccc-flow-icon"><Icon size={18}/></span>
        <div className="ccc-flow-copy"><strong>{step.title}</strong><small>{fallback ? "Chapter content not mapped yet · LAM will teach and practice with you" : step.detail}</small>{isNext && <em>Next recommended step</em>}</div>
        <div className="ccc-flow-actions"><button type="button" className={isNext ? "ccc-primary" : "ccc-secondary"} onClick={() => launchFlowStep(step.id)}>{fallback ? "Practice with LAM" : step.id === "doubts" ? "Open LAM" : "Open step"}<ArrowRight size={14}/></button>{task && <button type="button" className="ccc-flow-check" onClick={() => toggleTask(task.id)} aria-label={`${task.done ? "Mark incomplete" : "Mark complete"}: ${step.title}`} title={task.done ? "Mark incomplete" : "Mark complete"}>{task.done ? <CheckCircle2 size={17}/> : <span/>}</button>}</div>
      </li>;
    })}</ol>
    <div className="ccc-flow-foot"><span>{flowTasks.length ? "Your checklist is saved in Scholar Missions. Mark steps done when you finish them." : "Start any step to save this chapter flow as a checklist in Scholar Missions."}</span>{!flowTasks.length && <button type="button" className="ccc-secondary" onClick={saveFlow}>Save flow <Plus size={14}/></button>}</div>
  </section>;
}

function Overview({ ctx }: { ctx: WorkspaceContext }) {
  const { data, flowTasks, activity, accuracy, totalAnswered, go } = ctx;
  const nextFlow = FLOW_STEPS.find((step) => !flowTasks.find((task) => task.note === flowNote(data, step.id))?.done);
  return <div className="ccc-stack">
    <div className="ccc-section-intro"><div><span className="ccc-eyebrow">01 / CHAPTER HOME</span><h2>Everything starts here.</h2><p>Know what is done, what needs work, and your next useful move.</p></div></div>
    <GuidedFlow ctx={ctx}/>
    <div className="ccc-action-grid"><Action primary title="Resume study" description="Pick up this chapter" icon={Play} onClick={() => openChapterBook(data)}/><Action title="Ask LAM" description="Clear a chapter doubt" icon={Sparkles} onClick={() => go("lam")}/><Action title="Practice" description="Get instant explanations" icon={ListChecks} onClick={() => go("practice")}/><Action title="Resource vault" description="Notes, video and more" icon={BookOpen} onClick={() => go("resources")}/></div>
    <div className="ccc-grid-two"><Card title="Chapter progress" icon={Target} action={{ label: "Mastery map", onClick: () => go("mastery") }}><div className="ccc-progress-card"><ProgressRing value={data.studyProgressPct} label="Reading"/><div className="ccc-progress-lines"><p><strong>{data.studyProgressPct}%</strong> of chapter study recorded</p><p><strong>{accuracy === null ? "—" : `${accuracy}%`}</strong> practice accuracy {totalAnswered ? `across ${totalAnswered} questions` : "· no attempts yet"}</p><p><strong>{data.concepts.length}</strong> concepts in this chapter</p></div></div><p className="ccc-fine-print">Accuracy appears after you complete practice or a mock exam here.</p></Card>
    <Card title="Quick summary" icon={FileText} action={{ label: "Revision board", onClick: () => go("revision") }}><p className="ccc-body-copy">{data.overview || "A chapter overview has not been added yet. Start with the textbook and use LAM to explore a concept."}</p><div className="ccc-chip-row">{data.concepts.slice(0, 6).map((concept) => <span className="ccc-chip" key={concept}>{concept}</span>)}</div></Card></div>
    <div className="ccc-grid-three"><Card title="Next mission" icon={CalendarDays} action={{ label: "All missions", onClick: () => go("planner") }}>{nextFlow ? <><div className="ccc-list-row"><CheckCircle2 size={18}/><span><strong>{nextFlow.title}</strong><small>{nextFlow.detail}</small></span></div><button className="ccc-secondary" onClick={() => ctx.launchFlowStep(nextFlow.id)}>Open this step <ArrowRight size={14}/></button></> : <p className="ccc-body-copy">Your chapter flow is complete. Revisit weak areas or begin another chapter.</p>}</Card><Card title="Key formulas" icon={Gauge} action={{ label: "All formulas", onClick: () => go("revision") }}>{data.formulas.length ? data.formulas.slice(0, 3).map((formula) => <div className="ccc-formula" key={formula.key}>{formula.formula}</div>) : <Empty text="No formulas mapped to this chapter yet."/>}</Card><Card title="Recent activity" icon={Clock3}>{activity.length ? activity.slice(0, 4).map((item) => <div className="ccc-list-row" key={item.id}><Activity size={16}/><span><strong>{item.text}</strong><small>{new Date(item.at).toLocaleDateString()}</small></span></div>) : <Empty text="Your chapter activity will appear as you study and practice."/>}</Card></div>
    <ResourceShelf grade={data.classProfile} subjectId={data.subjectId} chapterId={data.chapterId} title="Your chapter reading path"/>
  </div>;
}

function Mastery({ ctx }: { ctx: WorkspaceContext }) {
  const { data, accuracy, totalAnswered, attempts, go } = ctx;
  const attemptedIds = new Set(attempts.flatMap((attempt) => attempt.questions.filter((question) => attempt.responses[question.id] !== undefined).map((question) => question.id)));
  const chapterQuestions = data.questions.questions;
  const questionCoverage = chapterQuestions.length ? Math.round((attemptedIds.size / chapterQuestions.length) * 100) : 0;
  return <div className="ccc-stack"><div className="ccc-section-intro"><div><span className="ccc-eyebrow">02 / PROGRESS & MASTERY</span><h2>A clearer view of progress.</h2><p>Reading, question coverage and accuracy are measured separately—without invented topic scores.</p></div></div>
    <div className="ccc-metric-grid"><Metric icon={BookOpen} label="Study progress" value={`${data.studyProgressPct}%`} note="Recorded by Scholar"/><Metric icon={ListChecks} label="Questions attempted" value={String(totalAnswered)} note={`${questionCoverage}% of available set covered`}/><Metric icon={Target} label="Practice accuracy" value={accuracy === null ? "Not measured" : `${accuracy}%`} note={accuracy === null ? "Complete a practice set" : `${attempts.length} completed set${attempts.length === 1 ? "" : "s"}`}/></div>
    <div className="ccc-grid-two"><Card title="Concept map" icon={Layers3}><p className="ccc-body-copy">Use these concepts as your chapter route. Topic-level mastery appears only when Scholar has question-level evidence.</p><div className="ccc-concept-grid">{data.concepts.length ? data.concepts.map((concept, index) => <button key={`${concept}-${index}`} className="ccc-concept" onClick={() => go("lam")}><span>{String(index + 1).padStart(2, "0")}</span><strong>{concept}</strong><ChevronRight size={15}/></button>) : <Empty text="A concept outline is not available for this chapter yet."/>}</div></Card><Card title="Chapter milestones" icon={CheckCircle2}><div className="ccc-milestones">{[{ label: "Start learning", done: data.studyProgressPct > 0 }, { label: "Reach halfway in study", done: data.studyProgressPct >= 50 }, { label: "Complete a practice set", done: attempts.some((attempt) => !attempt.title.includes("Mock")) }, { label: "Take a chapter mock", done: attempts.some((attempt) => attempt.title.includes("Mock")) }].map((item) => <div key={item.label} className={`ccc-milestone ${item.done ? "is-done" : ""}`}><span>{item.done ? <Check size={16}/> : <span/>}</span><strong>{item.label}</strong></div>)}</div><button className="ccc-primary" onClick={() => go(accuracy === null ? "practice" : "recommendations")}>What should I do next? <ArrowRight size={16}/></button></Card></div>
  </div>;
}

function Resources({ ctx }: { ctx: WorkspaceContext }) {
  const { data } = ctx;
  return <div className="ccc-stack"><ResourceLibrary grade={data.classProfile} subjectId={data.subjectId} chapterId={data.chapterId}/><button className="ccc-secondary" onClick={() => openChapterBook(data)}>Open Scholar's mapped chapter reader <BookOpen size={16}/></button></div>;
}

function toQuizQuestion(question: PracticeQuestion, chapterId: string, subjectId: string): QuizQuestion {
  return { id: question.id, type: "mcq", question: question.question, options: question.options, answer: question.answer, explanation: question.explanation, subject: subjectId, chapter: chapterId, difficulty: "medium" };
}
function Practice({ ctx, kind }: { ctx: WorkspaceContext; kind: "practice" | "mock" }) {
  const { data, attempts } = ctx;
  const [count, setCount] = useState(kind === "mock" ? 10 : 5);
  const [timed, setTimed] = useState(kind === "mock");
  const [run, setRun] = useState<{ questions: QuizQuestion[]; startedAt: number } | null>(null);
  const source = data.questions.questions.filter((question) => question.type === "mcq" && question.options?.length && question.answer);
  const presetCounts = [...new Set([5, 10, 20, source.length].filter((value) => value > 0 && value <= source.length))];
  const completed = attempts.filter((attempt) => kind === "mock" ? attempt.title.includes("Mock") : !attempt.title.includes("Mock"));
  const start = () => {
    if (!source.length) return;
    const selected = [...source].sort(() => Math.random() - 0.5).slice(0, count).map((question) => toQuizQuestion(question, data.chapterId, data.subjectId));
    setRun({ questions: selected, startedAt: Date.now() });
  };
  return <div className="ccc-stack"><div className="ccc-section-intro"><div><span className="ccc-eyebrow">{kind === "mock" ? "09 / MOCK EXAM COMMAND" : "04 / PRACTICE ARENA"}</span><h2>{kind === "mock" ? "Prepare under real pressure." : "Practice with a purpose."}</h2><p>{kind === "mock" ? "Build a chapter test, watch the clock and review every explanation." : "Answer real chapter questions with immediate feedback and a clear review."}</p></div></div>
    {run ? <QuestionRunner key={run.startedAt} ctx={ctx} kind={kind} questions={run.questions} startedAt={run.startedAt} timed={timed} onExit={() => setRun(null)}/> : <>
      <div className="ccc-grid-two">
        <Card title={kind === "mock" ? "Build your mock" : "Choose a drill"} icon={kind === "mock" ? FileQuestion : ListChecks}>
          <p className="ccc-body-copy">{source.length ? `${source.length} multiple-choice questions are ready for this chapter.` : "No multiple-choice questions are mapped to this chapter yet."}</p>
          <div className="ccc-presets">{presetCounts.map((value) => <button key={value} className={count === value ? "is-active" : ""} onClick={() => setCount(value)}>{value} questions <small>{kind === "mock" ? `${value} min` : value === 5 ? "Quick check" : "Focused set"}</small></button>)}</div>
          {kind === "mock" && source.length > 0 && <label className="ccc-count-label">Custom question count <input type="number" min={1} max={source.length} value={Math.min(count, source.length)} onChange={(event) => setCount(Math.max(1, Math.min(source.length, Number(event.target.value) || 1)))}/></label>}
          <label className="ccc-toggle"><input type="checkbox" checked={timed} onChange={(event) => setTimed(event.target.checked)}/> <Timer size={16}/> {timed ? "Timed mode on" : "Untimed mode"}</label>
          {source.length ? <button className="ccc-primary" onClick={start}><Play size={16}/> Start {kind === "mock" ? "mock exam" : "practice"}<ArrowRight size={16}/></button> : <button className="ccc-primary" onClick={() => ctx.launchFlowStep(kind === "mock" ? "mock" : "mcq")}><Sparkles size={16}/> Practice with LAM <ArrowRight size={16}/></button>}
        </Card>
        <Card title="Your progress" icon={Target}><div className="ccc-metric-grid ccc-metric-grid-inner"><Metric icon={ListChecks} label="Completed sets" value={String(completed.length)}/><Metric icon={Target} label="Latest score" value={completed.length ? `${Math.round(completed[0].score / completed[0].total * 100)}%` : "—"}/></div><p className="ccc-body-copy">{completed.length ? "Each completed set is saved to your Scholar history and powers this chapter's analytics." : "Your first completed set will unlock accuracy and mistake insights."}</p></Card>
      </div>
      <div className="ccc-grid-two"><Card title="More ways to practice" icon={Layers3}><div className="ccc-list-row"><BookOpen size={17}/><span><strong>Subjective questions</strong><small>{data.questions.subjective} mapped to this chapter</small></span><button className="ccc-text-action" onClick={() => ctx.launchFlowStep("questions")}>{data.questions.subjective && practiceChapterId(data.subjectId, data.chapterId) ? "Open chapter" : "Practice with LAM"} <ArrowRight size={14}/></button></div><div className="ccc-list-row"><FileText size={17}/><span><strong>Past-paper questions</strong><small>{data.pastPapers.total} chapter-linked questions</small></span><button className="ccc-text-action" onClick={() => ctx.go("resources")}>See resources <ArrowRight size={14}/></button></div></Card><Card title="Recent results" icon={TrendingUp}>{completed.length ? completed.slice(0, 4).map((attempt) => <div key={attempt.id} className="ccc-list-row"><CheckCircle2 size={17}/><span><strong>{attempt.score}/{attempt.total} correct</strong><small>{new Date(attempt.finishedAt).toLocaleDateString()} · {Math.round(attempt.timeSpent / 60)} min</small></span></div>) : <Empty text="No completed sets yet."/>}</Card></div>
    </>}
    {!run && <ResourceShelf grade={data.classProfile} subjectId={data.subjectId} chapterId={data.chapterId} aid="practice" title="Practice from source explanations"/>}
  </div>;
}

function QuestionRunner({ ctx, kind, questions, startedAt, timed, onExit }: { ctx: WorkspaceContext; kind: "practice" | "mock"; questions: QuizQuestion[]; startedAt: number; timed: boolean; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  useEffect(() => { if (paused || finished) return; const id = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(id); }, [paused, finished]);
  const question = questions[index];
  const timeLimit = questions.length * 60;
  const complete = useCallback((providedResponses?: Record<string, string>) => {
    if (finished) return;
    const finalResponses = providedResponses ?? (choice !== null && revealed ? { ...responses, [question.id]: choice } : responses);
    const score = questions.filter((item) => finalResponses[item.id] === item.answer).length;
    const attempt: QuizAttempt = { id: crypto.randomUUID(), title: `[CCC:${ctx.data.chapterId}] ${kind === "mock" ? "Mock" : "Practice"} · ${ctx.data.chapterTitle}`, subject: ctx.data.subjectId, questions, responses: finalResponses, score, total: questions.length, startedAt, finishedAt: Date.now(), timeSpent: seconds };
    ctx.addQuizAttempt(attempt);
    ctx.addXP(score * (kind === "mock" ? 8 : 5));
    ctx.pushActivity({ type: kind === "mock" ? "exam" : "quiz", text: `${ctx.data.chapterTitle}: ${kind === "mock" ? "mock" : "practice"} ${score}/${questions.length}`, icon: "✦" });
    setResponses(finalResponses);
    setFinished(true);
    toast.success(`${score}/${questions.length} correct · results saved`);
  }, [finished, choice, revealed, responses, question, questions, ctx, kind, startedAt, seconds]);
  useEffect(() => { if (!timed || paused || finished) return; const id = window.setTimeout(() => complete(), Math.max(0, timeLimit - seconds) * 1000); return () => window.clearTimeout(id); }, [timed, paused, finished, timeLimit, seconds, complete]);
  const advance = () => { if (index === questions.length - 1) complete(choice ? { ...responses, [question.id]: choice } : responses); else { setIndex(index + 1); setChoice(null); setRevealed(false); } };
  if (finished) { const score = questions.filter((item) => responses[item.id] === item.answer).length; return <div className="ccc-grid-two"><Card title="Set complete" icon={CheckCircle2}><div className="ccc-result-number">{Math.round(score / questions.length * 100)}%</div><p className="ccc-body-copy">{score} of {questions.length} correct · {Math.floor(seconds / 60)}m {seconds % 60}s. Your result is saved to Chapter Analytics.</p><div className="ccc-inline-actions"><button className="ccc-primary" onClick={onExit}>Back to {kind === "mock" ? "mock command" : "practice"}</button><button className="ccc-secondary" onClick={() => ctx.go("analytics")}>See analytics <ArrowRight size={15}/></button></div></Card><Card title="Answer review" icon={FileText}><div className="ccc-review-list">{questions.map((item, number) => <div className="ccc-list-row" key={item.id}><span className={responses[item.id] === item.answer ? "ccc-correct" : "ccc-wrong"}>{responses[item.id] === item.answer ? <Check size={17}/> : <X size={17}/>}</span><span><strong>{number + 1}. {item.question}</strong><small>Correct answer: {item.answer} · {item.explanation}</small></span></div>)}</div></Card></div>; }
  return <div className="ccc-grid-two ccc-question-layout"><Card title={`Question ${index + 1} of ${questions.length}`} icon={FileQuestion}><div className="ccc-question-progress"><span style={{ width: `${(index / questions.length) * 100}%` }}/></div><p className="ccc-question-text">{question.question}</p><div className="ccc-options">{question.options?.map((option, optionIndex) => { const letter = String.fromCharCode(65 + optionIndex); const isCorrect = revealed && letter === question.answer; const isWrong = revealed && letter === choice && choice !== question.answer; return <button key={letter} disabled={revealed || paused} className={`${choice === letter ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`} onClick={() => setChoice(letter)}><span>{letter}</span>{option}</button>; })}</div><div className="ccc-inline-actions">{kind === "practice" && !revealed && <button className="ccc-secondary" disabled={!choice || paused} onClick={() => { setResponses((current) => ({ ...current, [question.id]: choice! })); setRevealed(true); }}>Check answer</button>}{(kind === "mock" || revealed) && <button className="ccc-primary" disabled={kind === "mock" && !choice || paused} onClick={() => { if (kind === "mock" && choice) setResponses((current) => ({ ...current, [question.id]: choice })); advance(); }}>{index === questions.length - 1 ? "Finish set" : "Next question"}<ArrowRight size={16}/></button>}</div></Card><div className="ccc-stack"><Card title="Session controls" icon={Timer}><div className="ccc-timer">{String(Math.floor((timed ? Math.max(0, timeLimit - seconds) : seconds) / 60)).padStart(2, "0")}:{String((timed ? Math.max(0, timeLimit - seconds) : seconds) % 60).padStart(2, "0")}</div><p className="ccc-body-copy">{timed ? "Remaining · auto-submits when time runs out" : "Elapsed · take your time"}</p><div className="ccc-inline-actions"><button className="ccc-secondary" onClick={() => setPaused(!paused)}>{paused ? <Play size={15}/> : <Pause size={15}/>} {paused ? "Resume" : "Pause"}</button><button className="ccc-secondary" onClick={() => complete()}>Finish now</button></div></Card>{revealed && <Card title={choice === question.answer ? "Correct answer" : "Learn from this one"} icon={Lightbulb}><p className="ccc-body-copy">{question.explanation}</p></Card>}</div></div>;
}

function ChapterLam({ ctx, launch, onLaunchConsumed }: { ctx: WorkspaceContext; launch: { id: number; prompt: string } | null; onLaunchConsumed: () => void }) {
  const { data, weakQuestions, pushActivity } = ctx;
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const launchedId = useRef<number | null>(null);
  const suggestions = ["Explain this chapter simply", `Explain ${data.concepts[0] || data.chapterTitle}`, "Test my understanding", "What should I revise next?"];
  const send = useCallback(async (prompt: string) => {
    if (!prompt.trim() || loading) return;
    setMessages((current) => [...current, { role: "user", content: prompt }]);
    setInput(""); setLoading(true);
    try {
      const context = `You are Scholar's chapter tutor. Class ${data.classProfile} ${data.subjectName}, chapter ${data.chapterNumber}: ${data.chapterTitle}. Overview: ${data.overview || "not available"}. Concepts: ${data.concepts.join(", ") || "not mapped"}. Key formulas: ${data.formulas.slice(0, 6).map((formula) => formula.formula).join("; ") || "not mapped"}. Recorded reading progress: ${data.studyProgressPct}%. ${weakQuestions.length ? `Previously missed questions: ${weakQuestions.slice(0, 3).map((question) => question.question).join(" | ")}.` : "No question-level weakness evidence yet."} Answer the student's question accurately with a short explanation, a simple example when useful, and one useful next step. Do not claim to have seen performance data that is not in this context. Student question: ${prompt}`;
      const answer = await askAI(context, data.subjectId === "physics" ? "physics-11" : "default", { resourceContext: { subjectId: data.subjectId, chapterId: data.chapterId } });
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
      pushActivity({ type: "ai", text: `${data.chapterTitle}: asked LAM about ${prompt.slice(0, 60)}`, icon: "✦" });
    } catch (error) { setMessages((current) => [...current, { role: "assistant", content: error instanceof AIClientError && error.status === 401 ? "Sign in to use Chapter LAM. Your chapter-specific practice prompt is saved above; reopen this step after signing in." : "LAM could not respond right now. Please try again shortly." }]); }
    finally { setLoading(false); }
  }, [data, weakQuestions, loading, pushActivity]);
  useEffect(() => {
    if (!launch || launchedId.current === launch.id) return;
    launchedId.current = launch.id;
    onLaunchConsumed();
    void send(launch.prompt);
  }, [launch, onLaunchConsumed, send]);
  const startVoice = () => {
    type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
    type SpeechLike = { lang: string; onresult: ((event: SpeechResult) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void };
    const recognitionWindow = window as typeof window & { SpeechRecognition?: new () => SpeechLike; webkitSpeechRecognition?: new () => SpeechLike };
    const Recognition = recognitionWindow.SpeechRecognition ?? recognitionWindow.webkitSpeechRecognition;
    if (!Recognition) { toast.error("Voice input is not supported by this browser."); return; }
    try { const recognition = new Recognition(); recognition.lang = "en-IN"; recognition.onresult = (event) => setInput(event.results[0][0].transcript); recognition.onerror = () => { setListening(false); toast.error("Microphone unavailable. Check browser permission and try again."); }; recognition.onend = () => setListening(false); setListening(true); recognition.start(); }
    catch { setListening(false); toast.error("Could not start the microphone."); }
  };
  return <div className="ccc-stack"><div className="ccc-section-intro"><div><span className="ccc-eyebrow">05 / ASK LAM</span><h2>A tutor inside this chapter.</h2><p>Ask a doubt, unpack a concept, or get help with the question you missed.</p></div></div><div className="ccc-lam-layout"><Card title="Ask LAM" icon={Sparkles} className="ccc-lam-chat"><div className="ccc-chat-messages" aria-live="polite">{messages.length ? messages.map((message, index) => <div key={index} className={`ccc-chat-message ${message.role}`}><small>{message.role === "user" ? "You" : "LAM"}</small>{message.role === "assistant" ? <ScholarAIContent content={message.content} mode="compact"/> : <p>{message.content}</p>}</div>) : <div className="ccc-chat-welcome"><Sparkles size={35}/><h3>Start with a question.</h3><p>LAM has this chapter's overview, concepts, formulas and your recorded practice misses.</p></div>}{loading && <div className="ccc-chat-message assistant"><small>LAM</small><p className="ccc-thinking">Thinking through your question…</p></div>}</div><form className="ccc-composer" onSubmit={(event) => { event.preventDefault(); void send(input); }}><input aria-label="Ask LAM about this chapter" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask a chapter question…"/><button type="button" title="Use microphone" aria-label="Use microphone" className={listening ? "is-listening" : ""} onClick={startVoice}><Mic size={18}/></button><button title="Send question" aria-label="Send question" type="submit" disabled={!input.trim() || loading}><Send size={18}/></button></form></Card><div className="ccc-stack"><Card title="Concept breakdown" icon={Layers3}><div className="ccc-compact-list">{data.concepts.length ? data.concepts.slice(0, 6).map((concept) => <button className="ccc-list-row ccc-clickable" key={concept} onClick={() => void send(`Explain ${concept} step by step with a simple example`)}><Brain size={17}/><span><strong>{concept}</strong><small>Explore with LAM</small></span><ChevronRight size={15}/></button>) : <Empty text="No chapter concepts are mapped yet. Ask LAM any question above."/>}</div></Card><Card title="Suggested questions" icon={Lightbulb}><div className="ccc-compact-list">{suggestions.map((suggestion) => <button className="ccc-list-row ccc-clickable" key={suggestion} onClick={() => void send(suggestion)}><Sparkles size={16}/><span><strong>{suggestion}</strong></span><ArrowRight size={15}/></button>)}</div></Card><Card title="Related material" icon={BookOpen}><div className="ccc-inline-actions"><button className="ccc-secondary" onClick={() => ctx.go("resources")}>Resource vault <ArrowRight size={15}/></button><button className="ccc-secondary" onClick={() => ctx.go("revision")}>Revision board <ArrowRight size={15}/></button></div></Card></div></div></div>;
}

function Revision({ ctx }: { ctx: WorkspaceContext }) {
  const { data, notes, addNote } = ctx;
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const flashItems = [...(data.importantDefinitions ?? []).map((item) => ({ front: item.term, back: item.definition })), ...data.formulas.map((item) => ({ front: "Recall this formula", back: item.formula }))];
  const createNote = () => { if (!noteTitle.trim() || !noteText.trim()) return; addNote({ title: noteTitle.trim(), content: noteText.trim(), tags: [`chapter:${data.chapterId}`], folder: "Chapter Command Centre", color: "#39c9e1" }); setNoteTitle(""); setNoteText(""); setShowNoteForm(false); toast.success("Chapter note saved"); };
  return <div className="ccc-stack"><div className="ccc-section-intro"><div><span className="ccc-eyebrow">06 / REVISION BOARD</span><h2>Everything worth remembering.</h2><p>Quick notes, formulas, definitions and a fast recall loop before the exam.</p></div><span className="ccc-pill">Exam-ready workspace</span></div><div className="ccc-grid-three"><Card title="Quick notes" icon={FileText} action={{ label: showNoteForm ? "Close" : "Add note", onClick: () => setShowNoteForm(!showNoteForm) }}>{showNoteForm && <div className="ccc-note-form"><input aria-label="Note title" placeholder="Note title" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)}/><textarea aria-label="Note content" placeholder="Write the key idea in your own words…" value={noteText} onChange={(event) => setNoteText(event.target.value)}/><button className="ccc-primary" onClick={createNote} disabled={!noteTitle.trim() || !noteText.trim()}><Plus size={15}/> Save note</button></div>}{notes.length ? notes.slice(0, 5).map((note) => <div className="ccc-list-row" key={note.id}><FileText size={17}/><span><strong>{note.title}</strong><small>{note.content.slice(0, 95)}</small></span></div>) : !showNoteForm && <Empty text="No notes saved for this chapter. Capture one idea you want to remember."/>}</Card><Card title="Key formulas" icon={Gauge}>{data.formulas.length ? data.formulas.slice(0, 8).map((formula) => <div className="ccc-formula" key={formula.key}>{formula.formula}</div>) : <Empty text="No formulas are mapped to this chapter."/>}</Card><Card title="Important definitions" icon={BookOpen}>{data.importantDefinitions?.length ? data.importantDefinitions.slice(0, 7).map((definition) => <div className="ccc-definition" key={definition.term}><strong>{definition.term}</strong><p>{definition.definition}</p></div>) : <Empty text="No definitions have been mapped yet. Use your notes to build a revision set."/>}</Card></div><div className="ccc-grid-two"><Card title="Flash revision" icon={Flame}>{flashItems.length ? <><button className="ccc-flash-card" onClick={() => setFlipped(!flipped)} aria-label="Flip revision card"><small>{flipped ? "ANSWER" : "TAP TO RECALL"} · {flashIndex + 1}/{flashItems.length}</small><strong>{flipped ? flashItems[flashIndex].back : flashItems[flashIndex].front}</strong><span>Tap to flip</span></button><div className="ccc-inline-actions"><button className="ccc-secondary" onClick={() => { setFlashIndex((flashIndex - 1 + flashItems.length) % flashItems.length); setFlipped(false); }}>Previous</button><button className="ccc-primary" onClick={() => { setFlashIndex((flashIndex + 1) % flashItems.length); setFlipped(false); }}>Next card <ArrowRight size={15}/></button></div></> : <Empty text="Definitions and formulas will create recall cards when available."/>}</Card><Card title="One-page chapter snapshot" icon={Layers3}><p className="ccc-body-copy">{data.overview || "Open your chapter textbook and notes to create a summary."}</p><h3 className="ccc-subheading">Key ideas</h3><div className="ccc-chip-row">{data.concepts.slice(0, 9).map((concept) => <span className="ccc-chip" key={concept}>{concept}</span>)}</div>{data.examTips?.length ? <div className="ccc-callout"><Lightbulb size={17}/><span>{data.examTips[0]}</span></div> : null}<div className="ccc-inline-actions"><button className="ccc-secondary" onClick={() => openChapterBook(data)}>Open textbook <ArrowRight size={15}/></button><button className="ccc-secondary" onClick={() => navigateTo("flashcards")}>Scholar flashcards <ArrowRight size={15}/></button></div></Card></div><ResourceShelf grade={data.classProfile} subjectId={data.subjectId} chapterId={data.chapterId} aid="flashcards" title="Source-linked revision"/></div>;
}

function Analytics({ ctx }: { ctx: WorkspaceContext }) {
  const { attempts, totalAnswered, accuracy, weakQuestions, data, go } = ctx;
  const totalTime = attempts.reduce((sum, attempt) => sum + attempt.timeSpent, 0);
  const mockAttempts = attempts.filter((attempt) => attempt.title.includes("Mock"));
  const practiceAttempts = attempts.filter((attempt) => !attempt.title.includes("Mock"));
  const trend = [...attempts].reverse().slice(-8);
  const unanswered = attempts.reduce((sum, attempt) => sum + Math.max(0, attempt.total - Object.keys(attempt.responses).length), 0);
  return <div className="ccc-stack"><div className="ccc-section-intro"><div><span className="ccc-eyebrow">07 / ANALYTICS & WEAK AREAS</span><h2>Understand your performance.</h2><p>Insights come from completed chapter sets—not guessed scores or generic predictions.</p></div></div><div className="ccc-metric-grid"><Metric icon={Target} label="Accuracy" value={accuracy === null ? "Not measured" : `${accuracy}%`} note={`${totalAnswered} answers recorded`}/><Metric icon={Gauge} label="Practice time" value={totalTime ? `${Math.max(1, Math.round(totalTime / 60))} min` : "—"} note="Across completed sets"/><Metric icon={FileQuestion} label="Attempts" value={String(attempts.length)} note={`${practiceAttempts.length} practice · ${mockAttempts.length} mock`}/></div><div className="ccc-grid-two"><Card title="Improvement trend" icon={TrendingUp}>{trend.length ? <div className="ccc-trend" role="img" aria-label="Score percentage for recent attempts">{trend.map((attempt) => <div className="ccc-trend-column" key={attempt.id}><span>{Math.round(attempt.score / attempt.total * 100)}%</span><div><i style={{ height: `${Math.max(5, attempt.score / attempt.total * 100)}%` }}/></div><small>{new Date(attempt.finishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small></div>)}</div> : <Empty text="Complete a practice set to begin your chapter trend." action={{ label: "Start practice", onClick: () => go("practice") }}/>}</Card><Card title="Question breakdown" icon={ListChecks}>{attempts.length ? <><div className="ccc-breakdown"><span>Correct <strong>{attempts.reduce((sum, attempt) => sum + attempt.score, 0)}</strong></span><span>Needs review <strong>{totalAnswered - attempts.reduce((sum, attempt) => sum + attempt.score, 0)}</strong></span><span>Unanswered <strong>{unanswered}</strong></span></div><div className="ccc-breakdown-bar"><span style={{ width: `${accuracy ?? 0}%` }}/></div><p className="ccc-fine-print">Accuracy uses answered questions. Set scores include unanswered questions. Confidence and per-topic time are not tracked yet.</p></> : <Empty text="No question results for this chapter yet."/>}</Card></div><div className="ccc-grid-two"><Card title="Questions to revisit" icon={Lightbulb}>{weakQuestions.length ? weakQuestions.slice(-6).map((question) => <div className="ccc-list-row" key={question.id}><span className="ccc-wrong"><X size={16}/></span><span><strong>{question.question}</strong><small>{question.explanation}</small></span></div>) : <Empty text={unanswered ? `${unanswered} questions were left unanswered. Try completing the full set to get a clearer picture.` : attempts.length ? "No missed questions in your completed sets. Keep testing your understanding." : "Your missed questions will appear here after practice."}/>}</Card><Card title="Your next improvement move" icon={Sparkles}><p className="ccc-body-copy">{!attempts.length || unanswered ? "Complete a short practice set to build reliable chapter evidence." : accuracy !== null && accuracy < 70 ? "Revisit the explanations for missed questions, then retry a focused set." : "You are answering accurately. Try a timed mock to test retention under pressure."}</p><button className="ccc-primary" onClick={() => go(!attempts.length || unanswered || (accuracy ?? 0) < 70 ? "practice" : "mock")}>{!attempts.length || unanswered || (accuracy ?? 0) < 70 ? "Practice this chapter" : "Try a mock exam"}<ArrowRight size={16}/></button></Card></div></div>;
}

function Planner({ ctx }: { ctx: WorkspaceContext }) {
  const { data, tasks, addTask, toggleTask, addSession, pushActivity } = ctx;
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [focusLength, setFocusLength] = useState(25);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [focusRunning, setFocusRunning] = useState(false);
  const focusCounter = useRef(0);
  useEffect(() => { if (!focusRunning) return; const id = window.setInterval(() => { focusCounter.current += 1; setFocusSeconds(focusCounter.current); if (focusCounter.current >= focusLength * 60) { window.clearInterval(id); setFocusRunning(false); addSession({ id: crypto.randomUUID(), type: "pomodoro", duration: focusLength * 60, completedAt: Date.now(), subject: data.subjectId }); pushActivity({ type: "study", text: `${data.chapterTitle}: completed ${focusLength}-minute focus block`, icon: "⏱" }); toast.success("Focus block complete"); } }, 1000); return () => window.clearInterval(id); }, [focusRunning, focusLength, data.subjectId, data.chapterTitle, addSession, pushActivity]);
  const createTask = () => { if (!title.trim()) return; addTask({ title: title.trim(), subject: data.subjectId, type: "study", date, done: false, priority, note: `chapter:${data.chapterId}` }); setTitle(""); toast.success("Chapter mission added"); };
  const done = tasks.filter((task) => task.done).length;
  const remaining = Math.max(0, focusLength * 60 - focusSeconds);
  return <div className="ccc-stack"><div className="ccc-section-intro"><div><span className="ccc-eyebrow">08 / STUDY PLANNER</span><h2>Turn intention into a mission.</h2><p>Follow the chapter route, add personal goals and begin a focused study block.</p></div></div><GuidedFlow ctx={ctx}/><div className="ccc-grid-two"><Card title="Personal missions" icon={Target}><div className="ccc-mission-progress"><strong>{done}/{tasks.length}</strong><span>personal goals complete</span></div><div className="ccc-progress-track"><span style={{ width: `${tasks.length ? done / tasks.length * 100 : 0}%` }}/></div>{tasks.length ? <div className="ccc-compact-list">{[...tasks].sort((a, b) => a.date.localeCompare(b.date)).map((task) => <label className={`ccc-task ${task.done ? "is-done" : ""}`} key={task.id}><input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)}/><span><strong>{task.title}</strong><small>{task.date} · {task.priority} priority</small></span></label>)}</div> : <Empty text="No extra goals yet. The guided chapter route above is ready; add a personal mission if you need one."/>}</Card><div className="ccc-stack"><Card title="Add a chapter mission" icon={Plus}><div className="ccc-note-form"><input aria-label="Mission title" placeholder="e.g. Work through ten numericals" value={title} onChange={(event) => setTitle(event.target.value)}/><div className="ccc-inline-fields"><label>Due date<input aria-label="Mission due date" type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label><label>Priority<select aria-label="Mission priority" value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div><button className="ccc-primary" disabled={!title.trim()} onClick={createTask}>Add mission <Plus size={16}/></button></div></Card><Card title="Focus block" icon={Clock3}><div className="ccc-timer">{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</div><div className="ccc-presets">{[15, 25, 45].map((value) => <button key={value} className={focusLength === value ? "is-active" : ""} disabled={focusRunning} onClick={() => { setFocusLength(value); setFocusSeconds(0); focusCounter.current = 0; }}>{value} min</button>)}</div><div className="ccc-inline-actions"><button className="ccc-primary" onClick={() => setFocusRunning(!focusRunning)}>{focusRunning ? <Pause size={16}/> : <Play size={16}/>} {focusRunning ? "Pause" : focusSeconds ? "Resume" : "Start focus"}</button><button className="ccc-secondary" onClick={() => { setFocusRunning(false); setFocusSeconds(0); focusCounter.current = 0; }}>Reset</button></div></Card></div></div></div>;
}

function Recommendations({ ctx }: { ctx: WorkspaceContext }) {
  const { data, attempts, tasks, accuracy, totalAnswered, weakQuestions, go } = ctx;
  const pending = tasks.filter((task) => !task.done).sort((a, b) => a.date.localeCompare(b.date));
  const next = !data.studyProgressPct ? { title: "Start with the chapter", reason: "A first reading builds the context needed for practice.", action: () => openChapterBook(data), label: "Open textbook", icon: BookOpen } : totalAnswered < 5 ? { title: "Complete a short practice set", reason: "A few answered questions are not enough to identify reliable weak areas yet.", action: () => go("practice"), label: "Start practice", icon: ListChecks } : accuracy !== null && accuracy < 70 ? { title: "Review the questions you missed", reason: `${weakQuestions.length} missed responses give you a concrete place to improve.`, action: () => go("analytics"), label: "Review mistakes", icon: Lightbulb } : { title: "Test your knowledge under a timer", reason: "Your completed sets show solid accuracy. A mock checks recall under exam pressure.", action: () => go("mock"), label: "Build a mock", icon: FileQuestion };
  const NextIcon = next.icon;
  const queue = [
    { title: "Continue studying", detail: `${data.studyProgressPct}% reading recorded`, action: () => openChapterBook(data), icon: BookOpen },
    { title: "Practice questions", detail: `${data.questions.total} available`, action: () => go("practice"), icon: ListChecks },
    { title: "Revise key ideas", detail: `${data.formulas.length} formulas · ${data.concepts.length} concepts`, action: () => go("revision"), icon: Brain },
    { title: "Take a chapter mock", detail: attempts.some((item) => item.title.includes("Mock")) ? "Retest and compare" : "No mock taken yet", action: () => go("mock"), icon: FileQuestion },
  ];
  return <div className="ccc-stack"><div className="ccc-section-intro"><div><span className="ccc-eyebrow">10 / SMART RECOMMENDATIONS</span><h2>One useful step forward.</h2><p>Recommendations follow your recorded study and question results.</p></div></div><section className="ccc-next ccc-glass"><div className="ccc-next-icon"><NextIcon size={27}/></div><div><span className="ccc-eyebrow">YOUR NEXT BEST ACTION</span><h3>{next.title}</h3><p>{next.reason}</p><button className="ccc-primary" onClick={next.action}>{next.label}<ArrowRight size={16}/></button></div></section><div className="ccc-grid-two"><Card title="Why this matters" icon={Lightbulb}><p className="ccc-body-copy">{next.reason} Scholar does not estimate a topic score until your work provides evidence. Keep learning, then use your results to target revision.</p><div className="ccc-chip-row"><span className="ccc-chip">Study {data.studyProgressPct}%</span><span className="ccc-chip">Accuracy {accuracy === null ? "not measured" : `${accuracy}%`}</span><span className="ccc-chip">{attempts.length} sets completed</span></div></Card><Card title="Unfinished missions" icon={CalendarDays}>{pending.length ? pending.slice(0, 4).map((task) => <div className="ccc-list-row" key={task.id}><Clock3 size={17}/><span><strong>{task.title}</strong><small>Due {task.date} · {task.priority} priority</small></span></div>) : <Empty text="No unfinished chapter missions. Add a goal when you are ready." action={{ label: "Open planner", onClick: () => go("planner") }}/>}</Card></div><Card title="Your action queue" icon={ListChecks}><div className="ccc-queue">{queue.map((item, index) => { const Icon = item.icon; return <button className="ccc-queue-item" key={item.title} onClick={item.action}><span className="ccc-queue-number">{index + 1}</span><Icon size={21}/><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRight size={16}/></button>; })}</div></Card>{data.commonMistakes?.length ? <Card title="Mistakes to watch for" icon={Lightbulb}><div className="ccc-concept-grid">{data.commonMistakes.slice(0, 6).map((mistake, index) => <div className="ccc-concept" key={`${mistake}-${index}`}><span>{index + 1}</span><strong>{mistake}</strong></div>)}</div></Card> : null}</div>;
}
