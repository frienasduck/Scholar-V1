import { mock } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createSession, recordAnswer } from "../src/lib/exam-ready/planner";
import { currentTask } from "../src/lib/exam-ready/model";
import { chapterManifest } from "../src/lib/exam-ready/coverage";
import { retrieveBuiltIn } from "../src/lib/exam-ready/knowledge/library";
import { boundedPassages } from "../src/lib/exam-ready/knowledge/context";
import { validateLesson } from "../src/lib/exam-ready/quality";

// Public synthetic provider-only probes; not a deployed authentication bypass.
// No database writes, private materials, environment output or automatic repairs.
mock.module("server-only", () => ({}));
const { libraryLesson } = await import("../src/lib/exam-ready/knowledge/bank");
const { generateScholarGroqJSON } = await import("../src/lib/ai/scholar-groq");
const { teacherGenerationPrompt, normalizeTeachingData, assembleTeacherLesson } = await import("../src/lib/exam-ready/teacher");
const { stagedLesson, generationContract } = await import("../src/lib/exam-ready/knowledge/generation");
if (!process.argv.includes("--run")) throw new Error("Explicit authorized --run required.");
const ledgerPath = ".sepb-staging/exam-ready-3.3-live-budget.json";
const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
if (ledger.cap !== 5 || !Number.isInteger(ledger.used) || ledger.used < 0 || ledger.model !== "openai/gpt-oss-120b") throw new Error("Invalid bounded 3.3 ledger.");
if (ledger.halted || ledger.used >= ledger.cap) throw new Error("3.3 budget exhausted or halted; no new request permitted.");
const cases = [
  {subjectId:"physics",chapterId:"p5",index:1,confidence:1,pace:"from scratch",request:"I am very weak with two hours before tomorrow's Physics exam. Explain why increasing the mass requires more net force for the same acceleration. Use the retained problem's actual data and do not spoil the unanswered check."},
  {subjectId:"physics",chapterId:"p5",index:0,confidence:1,pace:"don’t understand",request:"I incorrectly said a moving object always needs a net force to keep moving. Explain the mistake using a different simple example; stay with this current first-law question."},
  {subjectId:"chemistry",chapterId:"c4",index:7,confidence:3,pace:"deeper",request:"Explain why unpaired electrons determine magnetic behaviour and why the given occupancies are needed. Connect it to the current molecular-orbital bond-order example without inventing unsupported occupancies."},
  {subjectId:"maths",chapterId:"m8",index:0,confidence:5,pace:"deeper",request:"I am advanced and have one hour. Explain the method choices in the retained multi-step coefficient problem, without revealing the pending check's final answer. This should develop reasoning rather than repeat a definition."},
  {subjectId:"physics",chapterId:"p5",index:3,confidence:2,pace:"deeper",request:"Why is friction acting in that direction in this current problem? Use the current retained example's forces and assumptions. If a diagram is helpful, describe a source-supported free-body diagram; do not invent an image or claim it was rendered."},
] as const;
const directory="test-artifacts/exam-ready-3.3";
await mkdir(directory,{recursive:true});
const results: unknown[]=[];
for (const probe of cases.slice(ledger.used)) {
  if(ledger.halted || ledger.used>=ledger.cap) break;
  const session=createSession("synthetic-3.3-probe",{exam:"Public synthetic 3.3 reliability check",grade:11,board:"CBSE",examAt:Date.now()+86400000,minutes:probe.subjectId==="maths"?60:120,format:"mixed",style:"step-by-step",chapters:[{subjectId:probe.subjectId,chapterId:probe.chapterId,confidence:probe.confidence}],materials:"scholar",resourceIds:[],blocks:[],diagnostic:false});
  const task=currentTask(session)!,objective=chapterManifest(11,probe.subjectId,probe.chapterId).objectives[probe.index];
  Object.assign(task,{kind:"learn",topic:objective.topic,topics:[objective.topic],objectiveIds:[objective.id],title:objective.topic+" · "+chapterManifest(11,probe.subjectId,probe.chapterId).title,objective:"Explain and check "+objective.topic});
  const sources=boundedPassages(retrieveBuiltIn({grade:11,...probe},[objective.id],[],[],"scholar",probe.request));
  const authored=libraryLesson(session,sources,{pace:probe.pace,request:probe.request});
  if(!authored?.example || !authored.questions.length)throw new Error("Probe has no vetted source-owned example/check; no transport reserved.");
  const vetted=validateLesson(authored,session,probe.pace,probe.request);
  session.lessons[`${task.id}:current`]=vetted;
  if(probe.index===0&&probe.subjectId==="physics")recordAnswer(session,vetted.questions[0],"A moving object always needs a net force",false,"objective");
  const prompt=teacherGenerationPrompt(session,probe.pace,probe.request,true,sources,"core",{example:vetted.example,questions:vetted.questions});
  ledger.used++; // Reserve durably BEFORE transport. Restarts cannot reset this budget.
  await writeFile(ledgerPath,JSON.stringify(ledger,null,2)+"\n");
  const started=performance.now(),artifact=`${directory}/live-${ledger.used}-${probe.subjectId}-${probe.chapterId}.json`;
  let raw:unknown,checkpoint:unknown,result:unknown;
  try {
    const staged=await stagedLesson({saved:{example:vetted.example,questions:vetted.questions},teaching:true,needExample:true,
      generate:async()=>{raw=await generateScholarGroqJSON({model:ledger.model,singleAttempt:true,jsonSchema:generationContract("core"),maxTokens:4000,temperature:.25,signal:AbortSignal.timeout(50000),messages:[{role:"system",content:prompt},{role:"user",content:"Return the requested core JSON only. This is one transport attempt; do not output a schema."}]});return raw;},
      normalize:normalizeTeachingData,validateCore:core=>{if(!sources.some(p=>JSON.stringify(core).includes(`[${p.citation.id}]`)))throw new Error("No retrieved citation supports the core");},
      validate:body=>assembleTeacherLesson(session,probe.pace,probe.request,true,sources,body,vetted.questions),checkpoint:async parts=>{checkpoint=parts;},
    });
    if(staged.providerFailure?.status===429)ledger.halted=true;
    result={scope:`${probe.subjectId}/${probe.chapterId}`,objective:objective.id,model:ledger.model,elapsedMs:Math.round(performance.now()-started),complete:!!staged.lesson,pending:staged.pending,providerFailure:staged.providerFailure?{code:staged.providerFailure.code,status:staged.providerFailure.status,retryAfterSeconds:staged.providerFailure.retryAfterSeconds}:undefined};
    await writeFile(artifact,JSON.stringify({at:new Date().toISOString(),kind:"Real provider-only public synthetic core adaptation with source-owned checks; NOT authenticated browser/academic certification",probe,prompt,raw,checkpoint,result,lesson:staged.lesson},null,2)+"\n");
  }catch(error){
    const failure=error as Error&{status?:number;code?:string;retryAfterSeconds?:number};if(failure.status===429)ledger.halted=true;
    result={scope:`${probe.subjectId}/${probe.chapterId}`,model:ledger.model,elapsedMs:Math.round(performance.now()-started),complete:false,error:failure.message,status:failure.status,code:failure.code,retryAfterSeconds:failure.retryAfterSeconds};
    await writeFile(artifact,JSON.stringify({at:new Date().toISOString(),probe,prompt,raw,checkpoint,result},null,2)+"\n");
  }
  await writeFile(ledgerPath,JSON.stringify(ledger,null,2)+"\n");
  results.push({...result as object,artifact});
  console.log(JSON.stringify(results.at(-1)));
  await writeFile(`${directory}/live-summary.json`,JSON.stringify({at:new Date().toISOString(),transportCap:5,used:ledger.used,halted:ledger.halted,maxOutputTokensPerCall:4000,results},null,2)+"\n");
}
