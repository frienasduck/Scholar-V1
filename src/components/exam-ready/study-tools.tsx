"use client";
import { useId, useState } from "react";
import { Bookmark, BookOpen, Brain, FileText, Lightbulb, Sparkles, TriangleAlert } from "lucide-react";
import { ExamContent as ScholarAIContent } from "./content";
import { currentTask, evidence, subjectChapter, type ExamSession, type Lesson } from "@/lib/exam-ready/model";
import { Materials } from "./tools";
import { isShortSprint } from "@/lib/exam-ready/experience";
import { Plate } from "./presentation";

export type ToolTab = "tools" | "notes" | "formulas" | "mistakes" | "resources";
export interface StudyToolsProps {
    session: ExamSession; lesson?: Lesson; guest: boolean; busy: boolean; notes: string;
    onNotes: (text: string) => void; onImportant: () => void; onSave: () => void;
    onFlashcards: () => void; onTeach: (pace?: string, question?: string) => void;
    onSources: (ids: string[]) => void; tab: ToolTab; onTab: (tab: ToolTab) => void;
}
export function FormulaDock({ session, lesson, onBookmark }: { session: ExamSession; lesson?: Lesson; onBookmark?: (text: string) => void }) {
    const task = currentTask(session), restricted = ["personal", "custom"].includes(session.setup.materials);
    const formulas = lesson?.formulas ?? (restricted ? [] : task ? subjectChapter(session.setup, task.subjectId, task.chapterId)?.formulas ?? [] : []);
    return <div className="er-formulas">{formulas.length ? formulas.slice(0, 8).map((f, i) => <details key={`${i}:${f}`}><summary><span>ƒ<span className="sr-only">Formula {i + 1}</span></span><span><ScholarAIContent content={f.split(" · ")[0]}/></span></summary><div className="er-formula-expanded"><p>{f.includes(" · ") ? f.split(" · ").slice(1).join(" · ") : "Check every symbol, its units and the conditions before substituting."}</p>{lesson?.concept?.formula && i === 0 && <><p>{lesson.concept.symbols}</p><p>{lesson.concept.conditions}</p></>}{lesson?.example && i === 0 && <ScholarAIContent content={lesson.example.result}/>}<button onClick={() => onBookmark?.(f)} disabled={!onBookmark}><Bookmark size={14}/> Add to revision notes</button></div></details>) : <div className="er-empty-state"><Lightbulb/><p>{restricted ? "Formulas will appear when your selected materials support them." : "Your teacher will collect relevant formulas here."}</p></div>}</div>;
}
export function MistakeMemory({ session, onTeach, busy }: { session: ExamSession; onTeach: StudyToolsProps["onTeach"]; busy: boolean }) {
    const mistakes = evidence(session).mistakes;
    return <div className="er-mistakes">{mistakes.length ? mistakes.slice(-8).reverse().map(a => <details key={a.id}><summary><TriangleAlert size={17}/><span><strong>{a.topic}</strong><small>{a.mistake ?? "Understanding to repair"} · {a.evaluation}</small></span></summary><p>Your answer: {a.answer}</p><ScholarAIContent content={`${a.expected}\n\n${a.explanation}`}/><button disabled={busy} onClick={() => onTeach("another method", `Repair my recorded mistake in ${a.topic}: ${a.answer}. Teach a different method and give me a fresh check.`)}>Repair with LAM <Sparkles size={14}/></button></details>) : <div className="er-empty-state"><Brain/><strong>A memory of your learning, not a list of assumed mistakes.</strong><p>Your checked answers will reveal the gaps to revisit here.</p></div>}</div>;
}
export function StudyTools(p: StudyToolsProps) {
    const [scratch, setScratch] = useState(""), id = useId();
    const tabs: { id: ToolTab; label: string; icon: typeof Brain }[] = [{ id: "tools", label: "My tools", icon: Sparkles }, { id: "notes", label: "Notes", icon: FileText }, { id: "formulas", label: "Formulas", icon: Lightbulb }, { id: "mistakes", label: "Mistakes", icon: Brain }, { id: "resources", label: "Resources", icon: BookOpen }];
    const task = currentTask(p.session);
    const append = (text: string) => p.onNotes(`${p.notes}${p.notes ? "\n\n" : ""}${text}`.slice(0, 20000));
    const notePanel = <><div className="er-card-title"><h3><FileText size={17}/> Your working notepad</h3><span className="er-save-status">{p.notes === p.session.notes ? p.guest ? "Saved on device" : "Saved to preparation" : "Device draft saved · syncing…"}</span></div><label className="sr-only" htmlFor={`${id}-notepad`}>Preparation notes</label><textarea id={`${id}-notepad`} rows={6} maxLength={20000} value={p.notes} onChange={e => p.onNotes(e.target.value)} placeholder="Key ideas, questions, formulas, things to revisit…"/><div className="er-actions"><button aria-pressed={p.session.important} onClick={p.onImportant} disabled={p.busy}><Bookmark size={15}/> {p.session.important ? "Bookmarked" : "Bookmark"}</button><button onClick={p.onSave}>Save to Scholar Notes</button><button onClick={p.onFlashcards}>Make flashcard</button></div><div className="er-actions"><button disabled={p.busy || !p.notes.trim()} onClick={() => p.onTeach("notes summary")}>Explain my notes</button><button disabled={p.busy || !p.notes.trim()} onClick={() => p.onTeach("notes quiz")}>Quiz me from this</button></div></>;
    return <aside className="er-study-tools er-plate"><div className="er-tool-tabs" role="tablist" aria-label="Study tools">{tabs.map(t => <button key={t.id} id={`${id}-tool-${t.id}`} role="tab" aria-selected={p.tab === t.id} aria-controls={`${id}-panel`} tabIndex={p.tab === t.id ? 0 : -1} onClick={() => p.onTab(t.id)} onKeyDown={e => { const index = tabs.findIndex(t => t.id === p.tab); const next = e.key === "ArrowRight" ? (index + 1) % tabs.length : e.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1; if (next >= 0) { e.preventDefault(); p.onTab(tabs[next].id); document.getElementById(`${id}-tool-${tabs[next].id}`)?.focus(); } }}><t.icon size={17}/><span>{t.label}</span></button>)}</div><div className="er-tool-body" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tool-${p.tab}`} tabIndex={0} key={p.tab}>
        {(p.tab === "tools" || p.tab === "notes") && notePanel}
        {p.tab === "tools" && <><div className="er-divider"/><Plate title="Formulas at hand" icon={Lightbulb}><FormulaDock session={p.session} lesson={p.lesson} onBookmark={append}/></Plate><div className="er-divider"/><div className="er-card-title"><h3><Brain size={17}/> Mistake memory</h3><button onClick={() => p.onTab("mistakes")}>View all →</button></div><MistakeMemory session={p.session} onTeach={p.onTeach} busy={p.busy}/></>}
        {p.tab === "notes" && <details><summary>Temporary scratchpad</summary><label>Working that stays in this tab<textarea rows={4} value={scratch} onChange={e => setScratch(e.target.value)}/></label></details>}
        {p.tab === "formulas" && <><h3>Formula dock</h3><FormulaDock session={p.session} lesson={p.lesson} onBookmark={append}/><button disabled={p.busy} onClick={() => p.onTeach("example", "Explain the symbols, units, conditions and a worked example for the current formula.")}>Teach the formula</button></>}
        {p.tab === "mistakes" && <><h3>Mistake memory</h3><MistakeMemory session={p.session} onTeach={p.onTeach} busy={p.busy}/></>}
        {p.tab === "resources" && <><h3>Resources beside the lesson</h3><Materials compact shortTime={isShortSprint(p.session)} grade={p.session.setup.grade} guest={p.guest} selected={p.session.setup.resourceIds} subjectId={task?.subjectId} chapterId={task?.chapterId} mode={p.session.setup.materials} onSelect={p.onSources}/></>}
    </div></aside>;
}
