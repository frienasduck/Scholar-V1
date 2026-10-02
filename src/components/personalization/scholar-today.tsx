"use client";
import { useLearningProfile } from "./personalization-provider";
import { useStore } from "@/lib/store";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { navigateTo } from "@/lib/nav-event";
import { GlassSurface } from "@/components/liquid-glass/glass-surface";
import { GlassButton } from "@/components/liquid-glass/glass-button";
import type { StudyAction } from "@/lib/personalization/engine";
import { ResourceShelf } from "@/components/resources/resource-library";
export function ScholarToday() {
  const {profile,open}=useLearningProfile();const sessions=useStore(s=>s.sessions);
  const access=useScholarAccess();
  const activeGrade=useStore(s=>s.user.scholarClass);
  if(!profile?.result)return null;
  const plan=profile.result;
  if(plan.grade!==activeGrade)return <GlassSurface material="elevated" className="scholar-today"><h2>Your study level changed.</h2><p>Update your learning profile to build recommendations for Class {activeGrade}. Your saved work is unchanged.</p><GlassButton onClick={open}>Update learning profile</GlassButton></GlassSurface>;
  const date=new Date().toDateString();
  const studied=Math.round(sessions.filter(s=>s.type==="pomodoro" && new Date(s.completedAt).toDateString()===date).reduce((sum,s)=>sum+s.duration/60,0));
  const priority=plan.priorities[0] ?? null;
  const start=(action:StudyAction)=>{
    if(action.tool==="jee"){if(access.has("jee_focused_mode")){if(!useStore.getState().user.jeeMode)window.dispatchEvent(new CustomEvent("scholar:class-switch",{detail:{jeeToggle:true}}));navigateTo("practice");}else navigateTo("plus",{feature:"jee"});return;}
    if(action.tool==="ebook" && plan.imports[0])try{sessionStorage.setItem("scholar:ebook:custom-target",plan.imports[0].id);}catch{ /* The library remains accessible without browser storage. */ }
    navigateTo(action.tool,{subjectId:action.subjectId,...(action.tool==="ebook" ? {bookId:plan.imports[0]?.id} : {})});
  };
  const examDays=plan.exam ? Math.ceil((new Date(`${plan.exam.date}T23:59:59`).getTime()-Date.now())/86400000) : null;
  return <GlassSurface material="elevated" className="scholar-today" data-personalized="true">
    <span className="your-scholar-eyebrow">YOUR SCHOLAR / TODAY</span><h2>{priority ? `A little progress in ${priority.name}.` : "Your next useful step."}</h2>
    <p>{plan.summary}</p>
    <div className="scholar-today-priorities" aria-label="Subject priorities">{plan.priorities.map((subject,i)=><span key={subject.id}>{i+1} · {subject.name}{subject.reason==="Your chosen priority" ? " · Priority" : ""}</span>)}</div>
    <p><strong>{studied} / {plan.dailyGoal} min</strong> of completed focus time today · {plan.studyWindow==="Varies" ? "Whenever works for you" : `Your ${plan.studyWindow.toLowerCase()} study window`}</p>
    {plan.days.length ? <p>Preferred days · {plan.days.map(day=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day]).join(", ")}</p> : null}
    {plan.exam ? <p>{plan.exam.name} · {plan.exam.date} · {examDays!>=0 ? `${examDays} days to prepare` : "Date passed — update your learning profile"}</p> : null}
    <div className="scholar-today-actions">{plan.actions.map((action,i)=><GlassButton key={action.tool} variant={i===0 ? "primary" : "secondary"} onClick={()=>start(action)}><span className="block">{action.title}<small>{action.reason}</small></span></GlassButton>)}</div>
    <GlassButton variant="ghost" className="mt-4" onClick={open}>Edit my learning profile</GlassButton>
    <ResourceShelf grade={activeGrade} subjectId={priority?.id} title="Sources for your next useful step"/>
  </GlassSurface>;
}
