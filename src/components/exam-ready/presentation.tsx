"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, Brain, Check, Clock3, Coffee, FileCheck2, Layers, Lightbulb, Pause, Play, Sparkles, Target, Zap } from "lucide-react";
import { currentTask, elapsedMs, evidence, remainingSeconds, type ExamSession, type TaskKind } from "@/lib/exam-ready/model";
import { formatTime, stageLabels } from "@/lib/exam-ready/experience";

export const stageIcons: Record<TaskKind, typeof Brain> = { diagnostic: Target, learn: BookOpen, repair: Lightbulb, revise: Sparkles, practice: FileCheck2, recall: Brain, mistakes: Zap, mock: Layers, break: Coffee };
export function LAMVisual({ small = false }: { small?: boolean }) {
    return <div className={`er-lam-visual ${small ? "er-lam-small" : ""}`} aria-hidden="true"><div className="er-lam-orbit"/><div className="er-lam-core"><span/><span/><i/></div><div className="er-lam-badge"><Sparkles size={13}/> LAM</div></div>;
}
export function Plate({ title, icon: Icon, action, children, className = "" }: { title?: string; icon?: typeof Brain; action?: ReactNode; children: ReactNode; className?: string }) {
    return <section className={`er-plate ${className}`}>{title && <div className="er-card-title"><h3>{Icon && <Icon size={18}/>} {title}</h3>{action}</div>}{children}</section>;
}
export function ReadinessRing({ session, large = false }: { session: ExamSession; large?: boolean }) {
    const e = evidence(session), value = e.readiness;
    return <div className={`er-readiness ${large ? "er-readiness-large" : ""}`}><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" className="er-ring-track"/><circle cx="50" cy="50" r="42" className="er-ring-value" pathLength="100" strokeDasharray={`${value ?? Math.min(22, e.questions * 4)} 100`}/></svg><div><strong>{value === null ? <Target size={large ? 36 : 24}/> : `${value}%`}</strong><small>{value === null ? "Calibrating" : "Estimate"}</small></div></div>;
}
export function SessionClocks({ session, busy, onToggle, compact = false, examCountdown = false }: { session: ExamSession; busy: boolean; onToggle: () => void; compact?: boolean; examCountdown?: boolean }) {
    const [now, setNow] = useState(session.updatedAt);
    useEffect(() => { const update = () => setNow(Date.now()); update(); const timer = setInterval(update, 1000); return () => clearInterval(timer); }, []);
    const task = currentTask(session), used = session.taskElapsedMs + (session.status === "active" ? Math.max(0, now - session.taskSince) : 0), stepLeft = task ? task.seconds - used / 1000 : 0;
    return <div className={`er-clocks ${compact ? "er-clock-card" : ""}`} aria-live="off"><div><small><Clock3 size={13}/> {compact ? "Study session" : "Study time left"}</small><strong>{formatTime(compact ? stepLeft : remainingSeconds(session, now))}</strong>{compact && <small>{stepLeft < 0 ? "Step overtime · plan will rebalance" : task ? stageLabels[task.kind] : "Preparation completed"}</small>}</div>{!compact && <div><small>Until your exam</small><strong>{formatTime((session.setup.examAt - now) / 1000)}</strong></div>}{compact && <div className="er-time-detail"><span>{formatTime(remainingSeconds(session, now))}<small>Study left</small></span><span>{formatTime(examCountdown ? (session.setup.examAt - now) / 1000 : elapsedMs(session, now) / 1000)}<small>{examCountdown ? "Until exam" : "Time used"}</small></span></div>}<button className={compact ? "er-timer-toggle" : "er-icon-button"} aria-label={session.status === "active" ? "Pause study timer" : "Resume study timer"} disabled={busy || session.status === "completed" || remainingSeconds(session, now) <= 0} onClick={onToggle}>{session.status === "active" ? <Pause size={18}/> : <Play size={18}/>}</button></div>;
}
export function MissionPath({ session, vertical = false }: { session: ExamSession; vertical?: boolean }) {
    const active = currentTask(session);
    const groups = session.tasks.reduce<{ kind: TaskKind; label: string; seconds: number; total: number; done: number; active: boolean }[]>((items, t) => {
        const cycle = t.title.match(/cycle (\d+)/)?.[1];
        const label = t.title.startsWith("Mixed application") ? `Mixed practice${cycle ? ` · ${cycle}` : ""}` : t.title.startsWith("Spaced recall") ? `Recall${cycle ? ` · ${cycle}` : ""}` : t.title.startsWith("Targeted repair") ? "Targeted repair" : stageLabels[t.kind];
        const previous = items.at(-1);
        if (previous?.kind === t.kind && previous.label === label) { previous.seconds += t.seconds; previous.total++; previous.done += t.status === "done" ? 1 : 0; previous.active ||= t.id === active?.id; }
        else items.push({ kind: t.kind, label, seconds: t.seconds, total: 1, done: t.status === "done" ? 1 : 0, active: t.id === active?.id });
        return items;
    }, []);
    return <nav className={`er-mission ${vertical ? "er-mission-vertical" : ""}`} aria-label="Adaptive study mission"><ol>{groups.map((g, i) => { const Icon = stageIcons[g.kind], done = g.done === g.total; return <li key={`${g.kind}:${i}`} data-active={g.active} data-done={done} aria-current={g.active ? "step" : undefined}><span className="er-stage-icon">{done ? <Check size={21}/> : <Icon size={21}/>}</span><div><strong><small>{i + 1}</small> {g.label}</strong><span>{formatTime(g.seconds)}{g.total > 1 ? ` · ${g.total} steps` : ""}</span>{vertical && g.active && <small className="er-current-topic">{active?.topic}</small>}</div>{!vertical && <ArrowRight className="er-stage-arrow" size={15}/>}</li>; })}</ol></nav>;
}
export function SessionHeader({ session, busy, onToggle, study = false }: { session: ExamSession; busy: boolean; onToggle: () => void; study?: boolean }) {
    const e = evidence(session);
    return <div className="er-context-header"><div className="er-exam-identity"><span className="er-icon-tile"><FileCheck2/></span><div><strong>{session.setup.exam}</strong><small>Class {session.setup.grade} · {session.setup.board} · {session.setup.chapters.length} chapters</small></div><div className="er-exam-date"><strong>{new Date(session.setup.examAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong><small>{new Date(session.setup.examAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</small></div></div><SessionClocks session={session} busy={busy} onToggle={onToggle} compact={study} examCountdown={study}/><div className="er-compact-evidence"><ReadinessRing session={session}/><div><small>Preparation readiness</small><strong>{e.readiness === null ? "Let's see where you stand." : e.readiness >= 70 ? "Build on your progress." : "Your gaps are becoming clearer."}</strong><small>{e.questions ? `${e.questions} checked questions · ${e.accuracy}% accuracy` : "Answer checks to build real evidence."}</small></div></div></div>;
}
