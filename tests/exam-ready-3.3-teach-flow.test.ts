import { expect,mock,test } from "bun:test";
mock.module("server-only",()=>({}));
import { AIProviderError } from "../src/lib/ai/errors";
import type { Segments } from "../src/lib/exam-ready/knowledge/generation";
let checkpoints:Segments={},calls=0,failProvider=true;
const adapter=mock(async(_user:string,_prompt:string,_signal:AbortSignal,_schema?:Record<string,unknown>,_policy?:{singleAttempt?:boolean;maxTokens?:number})=>{calls++;if(failProvider)throw new AIProviderError("Busy",429,"GROQ_RATE_LIMITED",60);return response;});
mock.module("../src/lib/ai/structured",()=>({completeJSON:adapter}));
const actualGeneration=await import("../src/lib/exam-ready/knowledge/generation");
mock.module("../src/lib/exam-ready/knowledge/generation",()=>({
  ...actualGeneration,
  readSegments:async()=>structuredClone(checkpoints),saveSegments:async(_user:string,_session:string,_hash:string,parts:Segments)=>{checkpoints=structuredClone(parts);}
}));
// Dynamic imports keep Bun's server-only marker out of the browser-free fixture.
const {teach}=await import("../src/lib/exam-ready/teacher");
const {libraryLesson}=await import("../src/lib/exam-ready/knowledge/bank");
const {createSession}=await import("../src/lib/exam-ready/planner");
const {currentTask}=await import("../src/lib/exam-ready/model");
const {retrieveBuiltIn}=await import("../src/lib/exam-ready/knowledge/library");
const s=createSession("flow-fixture",{exam:"Public synthetic teaching test",grade:11,board:"CBSE",examAt:Date.now()+86400000,minutes:120,format:"mixed",style:"step-by-step",chapters:[{subjectId:"physics",chapterId:"p5",confidence:1}],materials:"scholar",resourceIds:[],blocks:[],diagnostic:false});
const task=currentTask(s)!;task.objectiveIds=["11:physics:p5:o2"];task.kind="learn";
const sources=retrieveBuiltIn({grade:11,subjectId:"physics",chapterId:"p5"},task.objectiveIds,[],[],"scholar"),authored=libraryLesson(s,sources)!;
const selected={sources,resources:[],restricted:true,pageRequested:false,privateAvailable:true,policyFingerprint:"fixture"};
const response={text:authored.text,concept:authored.concept,formulas:authored.formulas,takeaway:authored.takeaway};
test("actual teach function returns clearly labelled stored guidance on 429 and respects its saved wait",async()=>{
  const first=await teach("fixture-user",s,"normal","Explain why this formula applies",AbortSignal.timeout(5000),selected);
  expect(first.delivery?.mode).toBe("offline-fallback");expect(first.delivery?.retryAt).toBeGreaterThan(Date.now());expect(first.text).toContain("not a new AI response");expect(first.questions[0].source).toBe("Scholar question bank");
  await teach("fixture-user",s,"normal","Explain why this formula applies",AbortSignal.timeout(5000),selected);expect(calls).toBe(1);
});
test("actual adapted teach flow requests only core and keeps source-owned pending questions",async()=>{
  checkpoints={};failProvider=false;calls=0;s.lessons[`${task.id}:prior`]=authored;
  const lesson=await teach("fixture-user",s,"normal","Explain the method",AbortSignal.timeout(5000),selected);
  expect(calls).toBe(1);expect(lesson.questions.length).toBeGreaterThan(0);expect(lesson.questions[0].source).toBe("Scholar question bank");expect(lesson.delivery?.mode).toBe("live");
  const call=adapter.mock.calls.at(-1)!;expect(String(call[1])).toContain("ONLY the missing core segment");expect(call[4]).toMatchObject({singleAttempt:true,maxTokens:2400});
});
