"use client";
import { getCurriculum } from "@/lib/curriculum-helper";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { useLearningProfile } from "./personalization-provider";
import { GlassSurface } from "@/components/liquid-glass/glass-surface";
import { GlassButton } from "@/components/liquid-glass/glass-button";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
export function LearningProfileSettings() {
  const access=useScholarAccess();const {profile,open,rebuild,error,refresh}=useLearningProfile();
  const enabled=useStore(s=>s.settings.yourScholarEnabled === true);
  const updateSettings=useStore(s=>s.updateSettings);
  const visibility=<div className="flex items-center justify-between gap-4 py-4"><div><label htmlFor="your-scholar-enabled">Your Scholar</label><p className="text-sm text-muted-foreground">Show personalized daily guidance on your dashboard. Off by default; your learning profile stays saved.</p></div><Switch id="your-scholar-enabled" checked={enabled} onCheckedChange={value=>updateSettings({yourScholarEnabled:value})} /></div>;
  if(!access.authenticated)return <GlassSurface className="learning-profile">{visibility}<h2>My Learning Profile</h2><p>Sign in to make Scholar yours. Guest Mode doesn't require a learning profile.</p></GlassSurface>;
  if(!profile)return <GlassSurface className="learning-profile">{visibility}<h2>My Learning Profile</h2><p>{error || "Loading your saved preferences…"}</p><GlassButton onClick={()=>void refresh()}>Retry</GlassButton></GlassSurface>;
  const p=profile.preferences;const names=(ids:string[])=>getCurriculum(p.grade).filter(s=>ids.includes(s.id)).map(s=>s.name).join(", ") || "Not specified";
  const fields={"Study level":`Class ${p.grade} · ${p.board}`,Subjects:names(p.subjects),"Exam goals":p.goals.join(", ") || "Not specified",Strengths:names(p.strong),"Priority subjects":names(p.weak),Challenges:p.challenges.join(", ") || "Not specified",Explanations:[p.style,...p.secondaryStyles].join(", "),"LAM style":`${p.personality} · ${p.guidance}`,Routine:`${p.studyWindow} · ${p.minutes} min available`,"Preferred study days":p.days.map(day=>["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day]).join(", ") || "Flexible", "Daily goal":`${p.dailyGoal} minutes`,"Upcoming exam":p.exam ? `${p.exam.name} · ${p.exam.date}` : "None",Reasons:p.reasons.join(", ") || "Not specified"};
  return <GlassSurface material="elevated" className="learning-profile">{visibility}<h2 className="text-xl">Personalization · My Learning Profile</h2><p className="text-sm text-muted-foreground mt-2">Preferences shape your recommendations, not permissions. Editing never deletes study data.</p><dl>{Object.entries(fields).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><div className="flex gap-3 flex-wrap"><GlassButton variant="primary" onClick={open}>{profile.status==="COMPLETED" ? "Edit preferences / Save changes" : "Finish setup"}</GlassButton><GlassButton onClick={rebuild}>Rebuild my Scholar</GlassButton></div><p className="text-xs text-muted-foreground mt-4">Save choices as you continue. At the last step, build to apply the new dashboard and LAM defaults. Rebuilding doesn't renew the initial 50 MB allowance.</p></GlassSurface>;
}
