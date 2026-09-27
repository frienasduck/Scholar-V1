"use client";
import { useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { useStore } from "@/lib/store";
import { useScholarStartupReady } from "@/components/launch-readiness-gate";
import { DEFAULT_PREFERENCES,editablePreferences,preferencesSchema,type Preferences } from "@/lib/personalization/schema";
import type { LearningProfileView } from "./personalization-provider";
import { GlassSurface } from "@/components/liquid-glass/glass-surface";
import { GlassButton } from "@/components/liquid-glass/glass-button";
import { QuestionStage,QUESTION_TITLES,QUESTION_SUBTITLES } from "./question-stage";
import { ImportStage } from "./import-stage";
import { PlanetJourney } from "./planet-journey";

export function PersonalizationFlow({profile,onProfile,onEnter,startAt}:{profile:LearningProfileView;onProfile:(p:LearningProfileView)=>void;onEnter:()=>void;startAt?:number}) {
  const access=useScholarAccess();const router=useRouter();
  const startupReady=useScholarStartupReady();
  const name=useStore(s=>s.user.name).split(" ")[0];
  const reduceMotion=useStore(s=>s.settings.reduceMotion);
  const [value,setValue]=useState<Preferences>(()=>editablePreferences(profile.preferences));
  const [expiredExam]=useState(()=>profile.preferences.exam && profile.preferences.exam.date < new Date().toISOString().slice(0,10) ? profile.preferences.exam.name : "");
  const [stage,setStage]=useState(startAt ?? (profile.status==="NOT_STARTED" ? 0 : Math.min(profile.stage,11)));
  const [mode,setMode]=useState<"questions"|"analysis"|"reveal">(profile.status==="ANALYZING" ? "analysis" : "questions");
  const [busy,setBusy]=useState(false);const [uploading,setUploading]=useState(false);
  const [error,setError]=useState("");const [feedback,setFeedback]=useState("");
  const [active,setActive]=useState("profile");const [message,setMessage]=useState("Checking your saved progress…");
  const [planAfter,setPlanAfter]=useState(false);
  const [hidden,setHidden]=useState(false);
  const heading=useRef<HTMLHeadingElement>(null);const feedbackTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const abort=useRef<AbortController|null>(null);
  useEffect(()=>()=>{abort.current?.abort();if(feedbackTimer.current)clearTimeout(feedbackTimer.current);},[]);
  useEffect(()=>{const sync=()=>setHidden(document.hidden);document.addEventListener("visibilitychange",sync);return()=>document.removeEventListener("visibilitychange",sync);},[]);
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[stage,mode]);
  const react=(text:string)=>{setFeedback(text);if(feedbackTimer.current)clearTimeout(feedbackTimer.current);feedbackTimer.current=setTimeout(()=>setFeedback(""),5000);};
  const reload=async()=>{const response=await fetch("/api/personalization",{cache:"no-store",signal:AbortSignal.timeout(12_000)});const data=await response.json();if(!response.ok)throw new Error(data.message);onProfile(data);return data as LearningProfileView;};
  useEffect(()=>{
    if(profile.status!=="ANALYZING" || busy) return;
    let stopped=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      try{
        const response=await fetch("/api/personalization",{cache:"no-store",signal:AbortSignal.timeout(8000)});const data=await response.json() as LearningProfileView;
        if(stopped)return;
        if(response.ok){onProfile(data);if(data.status==="COMPLETED"){setMode("reveal");return;}if(data.status==="FAILED_RETRYABLE" || (data.jobStartedAt && Date.now()-new Date(data.jobStartedAt).getTime()>50_000)){setError("The connection interrupted. Your saved answers are safe; retry the build.");return;}}
      }catch{if(!stopped)setError("Waiting for your connection. Your answers are saved.");}
      if(!stopped)timer=setTimeout(()=>void poll(),2000);
    };void poll();return()=>{stopped=true;clearTimeout(timer);};
  },[profile.status,busy,onProfile]);
  const save=async(action:"begin"|"save"|"skip",nextStage:number,nextValue=value)=>{
    const parsed=action==="skip" ? null : preferencesSchema.safeParse(nextValue);if(parsed && !parsed.success){throw new Error(parsed.error.issues[0]?.message ?? "Check your choices.");}
    const response=await fetch("/api/personalization",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,revision:profile.revision,stage:nextStage,...(parsed?.success ? {preferences:parsed.data} : {})}),signal:AbortSignal.timeout(12_000)});
    const data=await response.json();if(!response.ok)throw new Error(data.message || "Your answers could not be saved.");onProfile(data);return data as LearningProfileView;
  };
  const advance=async(next:number,nextValue=value)=>{
    if(busy || uploading)return;setBusy(true);setError("");
    try{await save(stage===0 ? "begin" : "save",next,nextValue);setValue(nextValue);setStage(next);setFeedback("");}catch(e){setError(e instanceof Error ? e.message : "Could not save. Please retry.");}finally{setBusy(false);}
  };
  const skip=async()=>{
    if(busy||uploading)return;setBusy(true);setError("");
    try{await save("skip",stage,profile.preferences);onEnter();}catch(e){setError(e instanceof Error ? e.message : "Could not save your choice. Retry.");}finally{setBusy(false);}
  };
  const build=async(useAI=true)=>{
    if(busy||uploading)return;setBusy(true);setError("");setMode("analysis");setActive("profile");
    abort.current?.abort();abort.current=new AbortController();
    try {
      const current=profile.status==="COMPLETED" || profile.status==="SKIPPED" || !preferencesSchema.safeParse(profile.preferences).success ? await save("save",11) : profile;
      const response=await fetch("/api/personalization/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:current.revision,useAI}),signal:AbortSignal.any([abort.current.signal,AbortSignal.timeout(55_000)])});
      if(!response.ok){const data=await response.json();throw new Error(data.message || "Scholar could not start this build.");}
      if(response.headers.get("Content-Type")?.includes("application/json")){const data=await response.json();onProfile(data.profile);setMode("reveal");return;}
      const reader=response.body?.getReader();if(!reader)throw new Error("The connection interrupted. Retry your saved setup.");
      const decoder=new TextDecoder();let buffer="";let finished=false;
      try{while(true){const {done,value:chunk}=await reader.read();if(done)break;buffer+=decoder.decode(chunk,{stream:true});if(buffer.length>32_000)throw new Error("Scholar sent an unexpected response. Retry shortly.");const parts=buffer.split("\n\n");buffer=parts.pop()??"";for(const part of parts){if(!part.startsWith("data: "))continue;const event=JSON.parse(part.slice(6));if(event.error)throw new Error(event.message);if(event.stage){setActive(event.stage);setMessage(event.message);}if(event.profile){onProfile(event.profile);setMode("reveal");finished=true;}}}}finally{reader.releaseLock();}
      if(!finished)throw new Error("The connection interrupted. Your answers are saved; check progress or retry.");
    }catch(e){if(!abort.current?.signal.aborted)setError(e instanceof Error && e.name!=="TimeoutError" ? e.message : "Scholar took too long. Your answers are saved; retry without AI.");}
    finally{setBusy(false);}
  };
  const skipQuestion=()=>{
    const defaults:Partial<Preferences>=stage===1 ? {subjects:[],strong:[],weak:[],exam:null} : stage===2 ? {goals:[]} : stage===3 ? {strong:[],weak:[]} : stage===4 ? {challenges:[]} : stage===5 ? {style:DEFAULT_PREFERENCES.style,secondaryStyles:[]} : stage===6 ? {personality:"calm",guidance:"balanced"} : stage===7 ? {minutes:30,dailyGoal:30,days:[],studyWindow:"Varies"} : stage===8 ? {exam:null} : stage===9 ? {reasons:[]} : {};
    void advance(stage+1,{...value,...defaults});
  };
  const enter=()=>{onEnter();router.replace(planAfter ? "/plus" : "/");};
  return <main className={`your-scholar ${reduceMotion ? "your-scholar-reduced" : ""} ${hidden ? "is-paused" : ""}`} data-startup-ready={startupReady} data-setup-stage={mode==="questions" ? stage : mode}>
    <div className="your-scholar-atmosphere" aria-hidden="true"/>
    <header className="your-scholar-header"><span className="your-scholar-wordmark">✦ SCHOLAR</span><span className="your-scholar-eyebrow">Yours, from the start.</span><GlassButton variant="ghost" onClick={()=>void skip()} disabled={busy||uploading || (mode==="analysis" && !error)}>Skip setup for now</GlassButton></header>
    <div className="your-scholar-layout">
      <aside className="your-scholar-observatory" aria-hidden="true"><div className="your-scholar-cosmos planet-profile"><div className="your-scholar-orbit orbit-one"/><div className="your-scholar-orbit orbit-two"/><div className="your-scholar-planet"><div className="your-scholar-planet-light"/><div className="your-scholar-planet-core"/></div></div><span className="your-scholar-coordinate">YOUR SCHOLAR / 01</span><p>Not another workspace.<br/>Your own world of learning.</p></aside>
      <GlassSurface material="elevated" className="your-scholar-stage">
        {mode==="questions" ? <div key={stage} className="your-scholar-stage-content">
          <p className="your-scholar-eyebrow">{stage===0 ? "An arrival, not a form." : `Your Scholar · ${stage} / 11`}</p>
          <h1 ref={heading} tabIndex={-1}>{stage===0 ? `Let's build your Scholar${name ? `, ${name}` : ""}.` : stage<=9 ? QUESTION_TITLES[stage-1] : stage===10 ? "Bring your study material." : "A little more room to grow."}</h1>
          <p className="your-scholar-subtitle">{stage===0 ? "Tell Scholar how you learn, what you're working toward, and where you need help. We'll shape your workspace around you." : stage<=9 ? QUESTION_SUBTITLES[stage-1] : stage===10 ? "The notes and books that matter to you deserve a place here. Import now, or come with just your curiosity." : "Scholar Free is a real starting point. Plus expands supported tools and limits, without changing your learning profile."}</p>
          {expiredExam ? <p className="your-scholar-note">The saved date for {expiredExam} has passed. This new draft clears that exam; your other choices stay intact. You can add an upcoming exam later in setup.</p> : null}
          {stage===0 ? <div className="your-scholar-intro-details"><span>✧ Your priorities, up front</span><span>◎ LAM, tuned to you</span><span>▤ Your material, in reach</span><p>Your answers stay in your Scholar account. Every question is optional; you can edit them in Settings.</p></div> : stage<=9 ? <QuestionStage stage={stage} value={value} onChange={setValue} feedback={react} hasClass9={access.has("class_9_access")}/> : stage===10 ? <ImportStage profile={profile} onUploaded={async()=>{await reload();}} onBusy={setUploading}/> : <div className="your-scholar-plus"><GlassSurface material="premium"><p className="your-scholar-eyebrow">SCHOLAR PLUS</p><h2>Go deeper, when you're ready.</h2><p>{value.goals.some(g=>g.startsWith("JEE")) ? "JEE Focused Mode supports your competitive goals." : "More room for focused learning and supported AI tools."} Plus includes LAM AI, Class 9 access, supported premium study tools, and higher monthly generation/import limits.</p><p>Your original import bonus stays separate. Choosing Plus here does not start a payment or change access.</p><GlassButton aria-pressed={planAfter} onClick={()=>setPlanAfter(p=>!p)}>{planAfter ? "Plan review added after setup ✓" : "Review actual plans after setup"}</GlassButton></GlassSurface><p className="your-scholar-note">{access.has("lam_ai") ? "Your current plan already includes LAM AI." : "Free keeps standard LAM and supported study tools. LAM AI's full tutor experience remains Plus-gated."}</p></div>}
          <div className="your-scholar-feedback" role="status" aria-live="polite" aria-atomic="true">{feedback ? <GlassSurface material="control">✧ {feedback}</GlassSurface> : null}</div>
          <footer className="your-scholar-actions">{stage>0 ? <GlassButton disabled={busy||uploading} onClick={()=>void advance(stage-1)}>Back</GlassButton> : null}<div className="your-scholar-action-spacer"/>{stage>0 && stage<11 ? <GlassButton variant="ghost" disabled={busy||uploading} onClick={skipQuestion}>{stage===10 ? "Skip import" : "Not sure · Skip"}</GlassButton> : null}<GlassButton variant="primary" disabled={busy||uploading} onClick={()=>stage===11 ? void build() : void advance(stage+1)}>{busy ? "Saving…" : stage===0 ? "Begin" : stage===11 ? "Continue Free · Build my Scholar" : "Continue"}</GlassButton></footer>
          {stage>0 ? <p className="your-scholar-save-note">Continue saves this step. You can return after closing this tab.</p> : null}
        </div> : mode==="analysis" ? <PlanetJourney active={active} message={message} hasMaterials={profile.bonus.used>0}/> : <div className="your-scholar-reveal"><span className="your-scholar-eyebrow">Your world is ready.</span><h1 ref={heading} tabIndex={-1}>This is your Scholar.</h1><p className="your-scholar-subtitle">{profile.result?.summary}</p><ul>{profile.result?.consequences.map(item=><li key={item}><span aria-hidden="true">✧</span>{item}</li>)}</ul>{profile.result?.ai==="fallback" ? <p className="your-scholar-note">Your workspace is built from your preferences. Optional AI refinement was unavailable; nothing blocks your arrival.</p> : null}<GlassButton variant="primary" onClick={enter}>Enter Scholar</GlassButton></div>}
        {error ? <div role="alert" className="your-scholar-error"><p>{error}</p>{mode==="analysis" ? <><GlassButton disabled={busy} onClick={()=>void build(false)}>Retry without AI</GlassButton><GlassButton onClick={()=>void reload().then(p=>{if(p.status==="COMPLETED")setMode("reveal");}).catch(()=>setError("Your profile could not be loaded. Check your connection."))}>Check saved progress</GlassButton></> : <GlassButton onClick={()=>void reload().then(p=>{setValue(editablePreferences(p.preferences));setStage(p.stage);setError("");}).catch(()=>setError("Your profile could not be loaded. Check your connection."))}>Reload saved answers</GlassButton>}</div> : null}
      </GlassSurface>
    </div>
  </main>;
}
