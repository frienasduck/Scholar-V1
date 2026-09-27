"use client";
import { createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { loadLamState,updateLamPreferences } from "@/lib/lam/storage";
import { useStore } from "@/lib/store";
import { entryMode,type Preferences,type SetupStatus } from "@/lib/personalization/schema";
import type { Blueprint } from "@/lib/personalization/engine";
import { GlassSurface } from "@/components/liquid-glass/glass-surface";
import { GlassButton } from "@/components/liquid-glass/glass-button";
import "./personalization.css";
const PersonalizationFlow = dynamic(()=>import("./personalization-flow").then(m=>m.PersonalizationFlow));
export interface LearningProfileView {
  required:boolean;status:SetupStatus;stage:number;revision:number;preferences:Preferences;result:Blueprint|null;
  bonus:{total:number;used:number;closed:boolean};jobStartedAt:string|null;
}
interface ProfileContext { profile:LearningProfileView|null;loading:boolean;error:string;open:()=>void;rebuild:()=>void;refresh:()=>Promise<void> }
const Context=createContext<ProfileContext>({profile:null,loading:false,error:"",open:()=>{},rebuild:()=>{},refresh:async()=>{}});
export const useLearningProfile=()=>useContext(Context);
export function PersonalizationProvider({children}:{children:ReactNode}) {
  const access=useScholarAccess();
  const [profile,setProfile]=useState<LearningProfileView|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [manual,setManual]=useState(false);
  const [startAt,setStartAt]=useState<number|undefined>(undefined);
  const [entered,setEntered]=useState(false);
  const [arrival,setArrival]=useState(false);
  const alive=useRef(true);
  const load=useCallback(async(signal?:AbortSignal)=>{
    try {
      const response=await fetch("/api/personalization",{cache:"no-store",signal:signal ?? AbortSignal.timeout(12_000)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.message || "Your learning profile could not be loaded.");
      if(alive.current) {setProfile(data);if(entryMode(access.authenticated,data.required,data.status)==="setup")setArrival(true);setError("");}
    } catch(e) {if(alive.current && !signal?.aborted) setError(e instanceof Error ? e.message : "Your learning profile could not be loaded.");}
    finally {if(alive.current && !signal?.aborted) setLoading(false);}
  },[access.authenticated]);
  useEffect(()=>{
    alive.current=true;const controller=new AbortController();void load(AbortSignal.any([controller.signal,AbortSignal.timeout(12_000)]));
    return()=>{alive.current=false;controller.abort();};
  },[load]);
  // Apply only a saved completed blueprint, once per revision, without changing provider or enabling voice.
  const applied=useRef("");
  useEffect(()=>{
    if(!profile?.result) return;
    const key=JSON.stringify({grade:profile.result.grade,lam:profile.result.lam});
    if(applied.current === key) return;
    try {const id=`class-${profile.result.grade}`;if(loadLamState(id).preferences.personalizationStamp!==key)updateLamPreferences(id,{liveTutorPersonality:profile.result.lam.personality,responseDetail:profile.result.lam.responseDetail,personalizationStamp:key});applied.current=key;} catch { /* Server profile remains available even if browser storage is full. */ }
  },[profile]);
  const mode=profile ? entryMode(access.authenticated,profile.required,profile.status) : "bypass";
  const show=manual || (!entered && (arrival || mode === "setup"));
  return <Context.Provider value={{profile,loading,error,open:()=>{setStartAt(profile?.result ? 1 : undefined);setManual(true);},rebuild:()=>{setStartAt(11);setManual(true);},refresh:()=>load()}}>
    {show && profile ? <PersonalizationFlow startAt={startAt} profile={profile} onProfile={setProfile} onEnter={()=>{setEntered(true);setManual(false);setStartAt(undefined);useStore.getState().setOnboarded(true);void access.refresh();}} /> : <>
      {loading ? <div role="status" className="grid min-h-dvh place-items-center">Opening your Scholar…</div> : <>
        {mode === "invite" && !entered ? <GlassSurface className="your-scholar-invite" material="elevated"><div><strong>Make Scholar yours.</strong><p>A learning profile shapes your next steps, study priorities, and LAM.</p></div><GlassButton variant="primary" onClick={()=>setManual(true)}>Personalize Scholar</GlassButton><GlassButton onClick={async()=>{try{const response=await fetch("/api/personalization",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"skip",revision:profile?.revision ?? 0})});if(!response.ok)throw new Error();setProfile(await response.json());}catch{setError("The invitation could not be dismissed. Retry when connected.");}}}>Not now</GlassButton></GlassSurface> : null}
        {error ? <div role="status" className="your-scholar-invite"><span>{error}</span><GlassButton onClick={()=>void load()}>Retry profile</GlassButton></div> : null}
        {children}
      </>}
    </>}
  </Context.Provider>;
}
