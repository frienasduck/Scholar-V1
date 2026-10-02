"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Brain, Check, Coffee, FileCheck2, Menu, Sparkles, Target, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/notifications/notification-api";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { currentTask, evidence, remainingSeconds, type ExamSession, type Question, type Setup } from "@/lib/exam-ready/model";
import { activeLesson, adaptiveMinutes, formatTime, isShortSprint } from "@/lib/exam-ready/experience";
import { localMissionLesson } from "@/lib/exam-ready/preview";
import { openExamReadyMock } from "@/lib/exam-ready/mock-adapter";
import { SetupFlow } from "./setup";
import { Materials } from "./tools";
import { useExamSessions } from "./use-session";
import { MissionPath, Plate, SessionHeader } from "./presentation";
import { PreparationHome, SessionOverview } from "./overview";
import { StudyTools, type ToolTab } from "./study-tools";
import { TeacherPanel } from "./teacher-panel";
import { FinalReview } from "./final-review";
import "./exam-ready.css";

type Mode = "overview" | "study" | "resources" | "review";
export function ExamReadyWorkspace() {
    const a = useScholarAccess(), grade = useStore(s => s.user.scholarClass), guest = useStore(s => s.guestMode);
    return <Workspace key={`${a.user?.id ?? "guest"}:${grade}`} scope={a.user?.id ?? "guest"} grade={grade} guest={guest || !a.authenticated}/>;
}
function Workspace({ scope, grade, guest }: { scope: string; grade: 9 | 11; guest: boolean }) {
    const c = useExamSessions(scope, grade, guest);
    const [betaNotice, setBetaNotice] = useState(true);
    const [selected, setSelected] = useState<string | null>(null), [setup, setSetup] = useState(false), [edit, setEdit] = useState(false), [mode, setMode] = useState<Mode>("overview"), [lessonKey, setLessonKey] = useState(""), [tool, setTool] = useState<ToolTab>("tools"), [mobilePanel, setMobilePanel] = useState<"path" | "tools" | null>(null), [draft, setDraft] = useState<string | null>(null), [previewPace, setPreviewPace] = useState("normal"), [adjust, setAdjust] = useState<"behind" | "more" | null>(null), [minutes, setMinutes] = useState(45), [planChange, setPlanChange] = useState(""), [reward, setReward] = useState("");
    const s = c.sessions.find(s => s.id === selected), task = s ? currentTask(s) : undefined;
    const savedLesson = s ? activeLesson(s, lessonKey) : undefined;
    const demo = guest && s ? localMissionLesson(s, previewPace) : undefined;
    const lesson = guest ? demo : savedLesson, notes = draft ?? s?.notes ?? "";
    const lastAuto = useRef("");
    const draftKey = `scholar:exam-ready:draft:${scope}:${grade}:${selected ?? "none"}`, selectedKey = `scholar:exam-ready:selected:${scope}:${grade}`;
    const addNote = useStore(s => s.addNote), addDeck = useStore(s => s.addDeck), addFlashcard = useStore(s => s.addFlashcard);
    function choose(id: string | null) { setSelected(id); setDraft(null); setLessonKey(""); setMode("overview"); setReward(""); setPlanChange(""); try { if (id) localStorage.setItem(selectedKey, id); else localStorage.removeItem(selectedKey); } catch { /* This tab still works with storage disabled. */ } }
    useEffect(() => { let id: string | null = null, returning = false; try { const resume = sessionStorage.getItem("scholar:exam-ready:resume"); returning = !!resume; id = resume ?? localStorage.getItem(selectedKey); sessionStorage.removeItem("scholar:exam-ready:resume"); } catch { /* Storage is optional. */ } const frame = requestAnimationFrame(() => { setSelected(id); if (returning) setMode("review"); }); return () => cancelAnimationFrame(frame); }, [selectedKey]);
    useEffect(() => { let value: string | null = null; try { value = localStorage.getItem(draftKey); } catch { /* Controlled notes remain available. */ } const frame = requestAnimationFrame(() => setDraft(value)); return () => cancelAnimationFrame(frame); }, [draftKey]);
    function saveDraft(text: string) { setDraft(text); try { localStorage.setItem(draftKey, text); } catch { toast.error("Device storage is full. Keep this tab open and save to Scholar Notes."); } }
    // Save local drafts immediately and debounce durable saves. A failed request
    // leaves the draft intact and does not create an automatic retry loop.
    useEffect(() => {
        if (!s || draft === null || draft === s.notes || c.busy || c.error) return;
        const timer = setTimeout(() => { void c.act(s, { type: "notes", text: draft, important: s.important }); }, 1500);
        return () => clearTimeout(timer);
    }, [s, draft, c.busy, c.error, c.act]);
    useEffect(() => {
        if (!s || guest || setup || mode !== "study" || s.status !== "active" || !task || ["break", "mock"].includes(task.kind) || savedLesson || c.busy || c.error || draft !== null && draft !== s.notes) return;
        const id = `${s.id}:${task.id}`;
        if (lastAuto.current === id) return;
        lastAuto.current = id;
        void c.teacher(s, "normal").then(key => { if (key) setLessonKey(key); });
    }, [s, guest, setup, mode, task, savedLesson, c.busy, c.error, c.teacher, draft]);
    async function flushNotes(value: ExamSession) {
        return notes !== value.notes ? await c.act(value, { type: "notes", text: notes, important: value.important }) : value;
    }
    async function teach(pace = "normal", request = "") {
        if (!s) return;
        if (guest) { setPreviewPace(pace); toast.info("This is an offline curriculum guide. Sign in for a new AI explanation or to ask LAM your own question."); return; }
        const value = await flushNotes(s);
        if (!value) return;
        const key = await c.teacher(value, pace, request);
        if (key) setLessonKey(key);
    }
    async function toggle() { if (!s) return; await c.act(s, { type: s.status === "active" ? "pause" : "resume" }); }
    async function continueStudy() { if (!s) return; if (s.status === "completed") { setMode("review"); return; } setMode(task?.kind === "mock" ? "review" : "study"); if (s.status !== "active") await c.act(s, { type: "resume" }); }
    async function next(skip = false) {
        if (!s) return;
        const saved = await flushNotes(s); if (!saved) return;
        const value = await c.act(saved, { type: skip ? "skip" : "next" });
        if (!value) return;
        setLessonKey(""); setPreviewPace("normal"); setReward(skip ? "" : task?.title ?? "Checkpoint completed");
        document.getElementById("main-scroll")?.scrollTo({ top: 0, behavior: "auto" });
        if (value.status === "completed" || currentTask(value)?.kind === "mock") setMode("review");
    }
    async function answer(q: Question, text: string) { if (!s) return false; return !!await c.act(s, { type: "answer", questionId: q.id, answer: text }); }
    function saveToNotes() { if (!s) return; addNote({ title: `${s.setup.exam} · Exam Ready`, content: notes, tags: ["exam-ready", ...s.setup.chapters.map(c => c.subjectId)], pinned: s.important }); toast.success("Saved to Scholar Notes."); }
    function flashcard() { if (!s || !notes.trim()) { toast.info("Add a concept or answer to your notepad first."); return; } const deck = addDeck({ name: `${s.setup.exam} · Revision`, subject: task?.subjectId }); addFlashcard({ deckId: deck, front: `Recall: ${task?.topic ?? s.setup.exam}`, back: notes.slice(0, 6000) }); toast.success("Created a revision flashcard in Scholar."); }
    function appendNote(text: string) { saveDraft(`${notes}${notes ? "\n\n" : ""}${guest ? "[Offline teaching example]\n" : ""}${text}`.slice(0, 20000)); toast.success("Added to your preparation notes."); }
    function sources(ids: string[]) { if (s) void c.act(s, { type: "settings", setup: { ...s.setup, resourceIds: ids } }); }
    async function launchMock(format: Setup["format"]) { if (!s || guest) return; if (Date.now() >= s.setup.examAt || remainingSeconds(s) <= 0) { toast.info("Your preparation time has ended. Adjust the exam or study budget before starting a mock."); return; } let value = await flushNotes(s); if (!value) return; if (value.setup.format !== format) value = await c.act(value, { type: "settings", setup: { ...value.setup, format } }); if (value) openExamReadyMock(value, scope); }
    function showTools(tab: ToolTab = "tools") { setTool(tab); setMobilePanel("tools"); }
    const tools = s && <StudyTools session={s} lesson={lesson} guest={guest} busy={c.busy} notes={notes} onNotes={saveDraft} onImportant={() => c.act(s, { type: "notes", text: notes, important: !s.important })} onSave={saveToNotes} onFlashcards={flashcard} onTeach={teach} onSources={sources} tab={tool} onTab={setTool}/>;
    const modes: { id: Mode; label: string; icon: typeof Brain }[] = [{ id: "overview", label: "Overview", icon: Target }, { id: "study", label: "Study with LAM", icon: Brain }, { id: "resources", label: "Resources & tools", icon: BookOpen }, { id: "review", label: "Final review & mock", icon: FileCheck2 }];
    return <div className="er-root er-workspace-root" data-mode={mode} data-session={!!s && !setup} data-emergency={!!s && isShortSprint(s)}><div className="er-atmosphere" aria-hidden="true"/><div className="er-content"><header className="er-header"><div><span className="er-eyebrow"><Sparkles size={13}/> Scholar <button className="er-beta-badge" onClick={() => setBetaNotice(true)}>Early Beta</button></span><h1>Exam <em>Ready.</em></h1><p>Your adaptive preparation space for exam success.</p></div><div className="er-header-actions">{s && !setup && <><button onClick={() => choose(null)}>← Preparations</button><button disabled={c.busy} onClick={() => { setEdit(true); setSetup(true); }}>Adjust exam</button></>}<button disabled={c.busy || !c.access?.allowed} onClick={() => { setEdit(false); setSetup(true); }}>New preparation <ArrowRight size={15}/></button>{c.access?.source === "temporary_free" && <small>Free for everyone during Early Beta{c.access.freeUntil ? ` · until ${new Date(c.access.freeUntil).toLocaleDateString()}` : ""}</small>}</div></header>
        {guest && <div className="er-guest-notice"><span><Sparkles size={15}/> {mode === "study" ? "Guest preview · saved on this device." : "Guest workspace · local plans, timers and notes. Teaching example is available."}</span><a href="/login">Sign in for live LAM & sync <ArrowRight size={14}/></a></div>}
        {c.offline && <p className="er-callout" role="status">Offline · saved lessons and notes are still here. Reconnect for new AI teaching and evaluated answers.</p>}
        {c.queue.length > 0 && <div className="er-callout"><p>{c.queue.length} pending edits. Local work stays retained until you resolve it.</p><div className="er-actions"><button disabled={c.busy || c.offline} onClick={c.sync}>Sync edits</button>{s && <button disabled={c.busy || c.offline} onClick={async () => { if (!confirm("Keep a recovery copy of local work and use the saved server plan? Pending checklist changes for this preparation will be removed.")) return; saveDraft(notes); await c.recover(s.id); }}>Resolve device conflict</button>}</div></div>}
        {c.error && <div role="alert" className="er-error"><p>{c.error} Your work remains saved.</p>{s && !guest && <button disabled={c.busy} onClick={() => c.reload(s.id)}>Reload saved session</button>}</div>}
        {c.loading ? <div className="er-workspace-skeleton" role="status" aria-label="Opening preparation"><div/><div/><div/></div> : setup ? <SetupFlow grade={grade} guest={guest} busy={c.busy} initial={edit ? s?.setup : undefined} onCancel={() => setSetup(false)} onStart={async config => { const value = edit && s ? await c.act(s, { type: "settings", setup: config }) : await c.start(config); if (value) { choose(value.id); setSetup(false); setMode("overview"); } }}/> : !s ? <PreparationHome sessions={c.sessions} allowed={!!c.access?.allowed} onNew={() => { setEdit(false); setSetup(true); }} onChoose={choose}/> : <>
            <SessionHeader session={s} busy={c.busy} onToggle={toggle} study={mode === "study"}/><div className="er-workspace-navigation" aria-label="Exam Ready workspace">{modes.map(m => <button key={m.id} aria-current={mode === m.id ? "page" : undefined} aria-pressed={mode === m.id} onClick={() => { if (m.id === "study") void continueStudy(); else setMode(m.id); }}><m.icon size={16}/>{m.label}</button>)}</div>
            {mode !== "study" && <MissionPath session={s}/>}
            <div className="er-mode-content" key={mode}>
                {mode === "overview" && <SessionOverview session={s} lesson={savedLesson} guest={guest} busy={c.busy} onContinue={continueStudy} onToggle={toggle} onNotes={() => showTools("notes")} onResources={() => setMode("resources")} onSource={sources} onNote={appendNote}/>}
                {mode === "study" && <><div className="er-mobile-tools"><button onClick={() => setMobilePanel("path")}><Menu size={16}/> Mission path</button><button onClick={() => showTools()}><BookOpen size={16}/> Study tools</button></div><div className="er-cockpit"><aside className="er-path-panel er-plate"><span className="er-eyebrow">Your mission</span><MissionPath session={s} vertical/><details><summary>Plan changes · {s.history.length}</summary>{s.history.slice(-5).map((h, i) => <p key={i} className="er-muted">v{h.version} · {h.reason}</p>)}</details></aside>{task?.kind === "break" ? <Plate className="er-break-reward" title="A short reset. You earned the pause." icon={Coffee}><span className="er-reward-icon"><Check size={32}/></span><h2>{reward || "Focused work deserves a breather."}</h2><p>Look away, stretch, breathe. Your task timer gives the suggested break length; skipping is always okay.</p><p className="er-muted">{evidence(s).questions} checked questions · {evidence(s).accuracy === null ? "No scored evidence yet" : `${evidence(s).accuracy}% checked accuracy`}</p><div className="er-actions"><button onClick={toggle} disabled={c.busy}>{s.status === "active" ? "Pause break" : "Take break"}</button><button className="er-primary" onClick={() => next(true)} disabled={c.busy}>Skip & continue <ArrowRight size={17}/></button></div></Plate> : <TeacherPanel key={`${s.id}:${task?.id}`} session={s} lesson={lesson} guest={guest} busy={c.busy} onTeach={teach} onAnswer={answer} onNext={next} onNote={appendNote}/>}<div className="er-desktop-tools">{tools}</div></div></>}
                {mode === "resources" && <div className="er-resource-workspace"><Plate title="Supporting materials" icon={BookOpen}><p className="er-muted">Sources for your current chapter, selected within your material policy. No invented relevance scores or previews.</p><Materials grade={grade} guest={guest} busy={c.busy} shortTime={isShortSprint(s)} selected={s.setup.resourceIds} subjectId={task?.subjectId} chapterId={task?.chapterId} mode={s.setup.materials} onSelect={sources}/></Plate>{tools}</div>}
                {mode === "review" && <FinalReview session={s} guest={guest} busy={c.busy} offline={c.offline} onMock={launchMock} onReturn={() => setMode(task?.kind === "mock" || s.status === "completed" ? "overview" : "study")} onComplete={async () => {const saved = await flushNotes(s); if(saved) await c.act(saved,{type:"complete"});}}/>}
            </div>
            {reward && mode === "study" && task?.kind !== "break" && <div className="er-reward-toast" role="status"><Check size={17}/><span>Checkpoint cleared · {reward}</span><button className="er-icon-button" aria-label="Dismiss checkpoint celebration" onClick={() => setReward("")}><X size={14}/></button></div>}
            {mode !== "review" && <div className="er-adaptive-bar"><div><Sparkles size={20}/><span><strong>Need to adjust?</strong><small>Your path can change with your time.</small></span></div><button disabled={c.busy} data-tone="behind" onClick={() => { setAdjust("behind"); setMinutes(adaptiveMinutes(s, "behind")); }}>I’m falling behind <small>Keep the essential work</small></button><button disabled={c.busy} data-tone="more" onClick={() => { setAdjust("more"); setMinutes(adaptiveMinutes(s, "more")); }}>I have more time <small>Add practice and recall</small></button><div className="er-step-progress"><small>{s.tasks.filter(t => t.status === "done").length}/{s.tasks.length} checkpoints completed</small><div className="er-progress-track"><span style={{ width: `${s.tasks.filter(t => t.status === "done").length / Math.max(1, s.tasks.length) * 100}%` }}/></div></div></div>}
            {planChange && <p className="er-plan-change" role="status">{planChange}</p>}
            {mobilePanel && <Dialog open onOpenChange={open => { if (!open) setMobilePanel(null); }}><DialogContent className="er-drawer er-root"><DialogTitle>{mobilePanel === "path" ? "Your adaptive mission" : "Your study tools"}</DialogTitle><DialogDescription>Stay inside your preparation. Notes are saved to this device immediately.</DialogDescription>{mobilePanel === "path" ? <MissionPath session={s} vertical/> : tools}</DialogContent></Dialog>}
            {adjust && <Dialog open onOpenChange={open => { if (!open) setAdjust(null); }}><DialogContent className="er-drawer er-root"><DialogTitle>{adjust === "behind" ? "Let’s protect the essential work." : "Let’s use the extra time well."}</DialogTitle><DialogDescription>Completed work and recorded answers are kept. Only the remaining mission is rebuilt.</DialogDescription><label>New remaining study time (minutes)<input type="number" min={1} max={43200} value={minutes} onChange={e => setMinutes(Number(e.target.value))}/></label><p>{adjust === "behind" ? "Lower-priority work is compressed, critical teaching and a final check are kept, and optional breaks disappear in a short sprint." : "Extra time adds practice and, when the exam horizon allows it, spaced recall for weak chapters."}</p><button className="er-primary" disabled={c.busy || !Number.isInteger(minutes) || minutes < 1 || minutes > 43200} onClick={async () => { const before = s.tasks.filter(t => t.status === "pending" || t.status === "active"); const value = await c.act(s, { type: "replan", minutes, reason: adjust === "behind" ? "Falling behind: protect essentials and compress remaining work" : "More time: expand practice and recall" }); if (value) { const after = value.tasks.filter(t => t.status === "pending" || t.status === "active"); setPlanChange(`Plan v${value.planVersion}: ${before.length} remaining steps → ${after.length}; ${formatTime(remainingSeconds(value))} study time left. Completed work and answer evidence are retained.`); setAdjust(null); setLessonKey(""); } }}>{c.busy ? <span className="er-spinner"/> : <Sparkles size={16}/>}Rebuild remaining plan</button></DialogContent></Dialog>}
        </>}
    </div><Dialog open={betaNotice} onOpenChange={setBetaNotice}><DialogContent className="er-root er-drawer er-beta-dialog"><DialogTitle>Welcome to Exam Ready · Early Beta</DialogTitle><DialogDescription>Exam Ready is in its early beta. Expect bugs, errors and rough edges while we improve the experience. That’s why it’s currently free for all users. Explore it, share feedback, and enjoy!</DialogDescription><p>Guest plans and notes stay on this device. Sign in for live LAM teaching and account sync. Readiness estimates are study guidance, not a guarantee of exam results.</p><button className="er-primary" onClick={() => setBetaNotice(false)}>Got it — let’s prepare <ArrowRight size={16}/></button></DialogContent></Dialog></div>;
}
