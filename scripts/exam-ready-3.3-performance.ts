import { mock } from "bun:test";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { retrieveBuiltIn } from "../src/lib/exam-ready/knowledge/library";
import { boundedPassages } from "../src/lib/exam-ready/knowledge/context";
import { createSession } from "../src/lib/exam-ready/planner";
import { currentTask } from "../src/lib/exam-ready/model";
import { validateLesson } from "../src/lib/exam-ready/quality";
mock.module("server-only",()=>({}));
const {libraryLesson}=await import("../src/lib/exam-ready/knowledge/bank");
const {teacherGenerationPrompt}=await import("../src/lib/exam-ready/teacher");
const s=createSession("synthetic-performance",{exam:"Offline performance fixture",grade:11,board:"CBSE",examAt:Date.now()+86400000,minutes:120,format:"mixed",style:"step-by-step",chapters:[{subjectId:"physics",chapterId:"p5",confidence:1}],materials:"scholar",resourceIds:[],blocks:[],diagnostic:false});
const task=currentTask(s)!;Object.assign(task,{kind:"learn",objectiveIds:["11:physics:p5:o2"],topics:["Newton's second law (F = ma)"]});
const retrieve=()=>retrieveBuiltIn({grade:11,subjectId:"physics",chapterId:"p5"},task.objectiveIds!,[],[],"scholar","friction");
const sources=boundedPassages(retrieve()),lesson=libraryLesson(s,sources)!;s.lessons[`${task.id}:current`]=lesson;
function measure(fn:()=>unknown){for(let i=0;i<100;i++)fn();const times:number[]=[];for(let i=0;i<1000;i++){const start=performance.now();fn();times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {iterations:times.length,meanMs:times.reduce((n,t)=>n+t,0)/times.length,p50Ms:times[500],p95Ms:times[950],maxMs:times.at(-1)};}
const output={at:new Date().toISOString(),scope:"Single local Bun process, warm public synthetic microbenchmarks. Not provider/network/browser/GPU/physical-device latency.",retrieval:measure(retrieve),packing:measure(()=>boundedPassages(sources)),bankAssembly:measure(()=>libraryLesson(s,sources)),validation:measure(()=>validateLesson(lesson,s,"normal","")),corePrompt:measure(()=>teacherGenerationPrompt(s,"deeper","Why that method?",true,sources,"core",{example:lesson.example,questions:lesson.questions})),sourceCharacters:JSON.stringify(sources).length,corePromptCharacters:teacherGenerationPrompt(s,"deeper","Why that method?",true,sources,"core",{}).length};
await writeFile("test-artifacts/exam-ready-3.3/performance.json",JSON.stringify(output,null,2)+"\n");console.log(JSON.stringify(output));
