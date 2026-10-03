"use client";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { ProposedStudyPlan } from "@/lib/lam/study-plan";

export function StudyPlanProposal({ plan, onClose }: { plan: ProposedStudyPlan; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const savedRef = useRef(false);
  const [identity] = useState(() => `${useStore.getState().user.email}:${useStore.getState().user.scholarClass}`);
  const save = () => {
    const store = useStore.getState();
    if (identity !== `${store.user.email}:${store.user.scholarClass}`) { setNotice("Your profile changed. Create a new plan before saving."); return; }
    if (savedRef.current) return;
    savedRef.current = true;
    try {
      for (const task of plan.tasks) {
        const marker = `[${plan.id}] ${task.note}`;
        if (!useStore.getState().tasks.some(existing => existing.note === marker && existing.title === task.title)) store.addTask({ ...task, note: marker });
      }
      setSaved(true);
      setNotice("Added to your current Scholar Planner. You can edit the dates and times there.");
    } catch {
      savedRef.current = false;
      setNotice("The complete plan could not be added. Retry to add any remaining tasks without duplicating the saved ones.");
    }
  };
  return <section className="rounded-2xl border border-cyan-200/25 bg-slate-950/90 p-4 text-sm shadow-lg" aria-label="Proposed study plan">
    <h3 className="font-semibold">Your proposed {plan.subject} preparation</h3>
    <p className="mt-2 text-slate-300">{plan.deadlineKind === "study" ? "Study deadline" : "Exam"}: {new Date(plan.examAt).toLocaleString("en-IN", { timeZone: plan.timezone })} · {plan.timezone}</p>
    <ol className="mt-3 space-y-2">{plan.tasks.map((task, i) => <li key={i} className="rounded-xl border border-white/10 p-3"><p>{i + 1}. {task.title}</p><p className="mt-1 text-xs text-slate-400">{task.date} · {task.time}</p><details className="mt-2 text-xs leading-6 text-slate-300"><summary>Study guidance</summary>{task.note}</details></li>)}</ol>
    <ul className="mt-3 space-y-1 text-xs text-amber-100">{plan.assumptions.map(item => <li key={item}>{item}</li>)}</ul>
    {notice && <p role="status" className="mt-3">{notice}</p>}
    <div className="mt-4 flex flex-wrap gap-2"><button disabled={saved} className="sg-cta-primary min-h-11 rounded-full px-4 disabled:opacity-60" onClick={save}>{saved ? "Added to Planner" : "Add to Planner"}</button><button className="sg-cta-quiet min-h-11 rounded-full px-4" onClick={onClose}>{saved ? "Close" : "Cancel"}</button></div>
  </section>;
}
