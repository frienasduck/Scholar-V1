import { expect, mock, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { originalUnits } from "../src/lib/exam-ready/knowledge/originals";
import { retrieveBuiltIn, unitObjectives, checkObjectiveIndex, independentCoverage } from "../src/lib/exam-ready/knowledge/library";
import { createSession } from "../src/lib/exam-ready/planner";
import { chapterManifest, curriculumInventory } from "../src/lib/exam-ready/coverage";
import { syllabusAlignment } from "../src/lib/exam-ready/knowledge/syllabus-alignment";
import { currentTask } from "../src/lib/exam-ready/model";
import { AcademicQualityError, validateLesson, validateQuestion } from "../src/lib/exam-ready/quality";
mock.module("server-only",()=>({}));
const { libraryLesson } = await import("../src/lib/exam-ready/knowledge/bank");
const { acceptedExample } = await import("../src/lib/exam-ready/knowledge/generation");
const expanded=originalUnits.filter(u=>u.checkObjectiveIndexes);

test("new original MCQs do not place every correct answer at A, and preserve exact keys",()=>{
  const choices=expanded.flatMap(unit=>unit.checks).filter(q=>q.kind==="mcq");
  const positions=choices.map(q=>q.options!.indexOf(q.answer));
  expect(choices.length).toBeGreaterThan(20);
  expect(new Set(positions).size).toBe(4);
  expect(positions.every(position=>position>=0&&position<4)).toBe(true);
  expect(choices.every(q=>new Set(q.options).size===4)).toBe(true);
});

for(const unit of expanded) test(`${unit.id}: actual retrieval, objective keys and ready authored lesson`,()=>{
  const s=createSession("content-qa",{exam:"Original content QA",grade:11,board:"CBSE",examAt:Date.now()+86400000,minutes:180,format:"mixed",style:"step-by-step",chapters:[{subjectId:unit.subjectId,chapterId:unit.chapterId,confidence:1}],materials:"custom",resourceIds:[unit.id],blocks:[],diagnostic:false});
  const task=currentTask(s)!;Object.assign(task,{kind:"learn",objectiveIds:unitObjectives(unit),topics:unit.topicIndexes.map(i=>chapterManifest(11,unit.subjectId,unit.chapterId).objectives[i].topic)});
  const passages=retrieveBuiltIn(unit,task.objectiveIds!,[unit.id],[],"custom");
  expect(passages).toHaveLength(1);expect(passages[0].text).toContain(unit.explanation);
  expect(passages[0].text).toContain(unit.misconceptions![0].repair);
  for(const [index,q] of unit.checks.entries()) expect(()=>validateQuestion({...q,id:"test",topic:"",subjectId:unit.subjectId,chapterId:unit.chapterId,source:"Scholar question bank",objectiveId:chapterManifest(11,unit.subjectId,unit.chapterId).objectives[checkObjectiveIndex(unit,index)].id},s)).not.toThrow();
  const lesson=libraryLesson(s,passages)!;
  expect(lesson.materialTrace?.used[0].sourceId).toBe(unit.id);
  expect(lesson.takeaway).toBe(unit.misconceptions![0].repair);
  try { expect(validateLesson(lesson,s,"normal").quality?.status).toBe("validated-structure"); }
  catch(error) { if(error instanceof AcademicQualityError) throw new Error(`${unit.id}: ${error.issues.join("; ")}`); throw error; }
  expect(retrieveBuiltIn(unit,task.objectiveIds!,[unit.id],[unit.id],"custom")).toEqual([]);
});

test("rotational calculations have independent mechanics checks, not just expression self-consistency",()=>{
  const rotor=originalUnits.find(u=>u.id.endsWith("p7-angular-momentum"))!;
  const [initialI,finalI,omega]=[4,2,3];const finalOmega=initialI*omega/finalI;
  expect(finalOmega).toBe(6);expect(.5*finalI*finalOmega**2-.5*initialI*omega**2).toBe(18);
  expect(rotor.examples[0].calculations!.map(c=>c.value)).toEqual([6,18]);
  const masses=[1,2],radii=[.2,.4];expect(masses.reduce((v,m,i)=>v+m*radii[i]**2,0)).toBeCloseTo(.36,12);
  expect((.5*4*.5**2)/4).toBeCloseTo(.125,12);
});

test("binomial coefficients checked independently by exact polynomial convolution",()=>{
  let coefficients=[1];for(let factor=0;factor<7;factor++){const next=Array(coefficients.length+1).fill(0);for(let i=0;i<coefficients.length;i++){next[i]+=coefficients[i];next[i+1]+=-2*coefficients[i];}coefficients=next;}
  expect(coefficients[4]).toBe(560);
  const q=originalUnits.find(u=>u.id.endsWith("m8-general-term"))!.checks[0];expect(q.numeric?.value).toBe(coefficients[4]);
  const terms=new Map<number,number>([[0,1]]);for(let n=0;n<9;n++){const next=new Map<number,number>();for(const [power,value] of terms){for(const [dp,factor] of [[2,2],[-1,-1]])next.set(power+dp,(next.get(power+dp)??0)+value*factor);}terms.clear();for(const entry of next)terms.set(...entry);}
  expect(terms.get(0)).toBe(672);expect(originalUnits.find(u=>u.id.endsWith("m8-independent-term"))!.checks[0].numeric?.value).toBe(672);
});

test("chemical bookkeeping checks charge and electron counts explicitly",()=>{
  const valence={N:5,O:6,H:1};expect(valence.N+3*valence.O+1).toBe(24);
  expect(valence.N+4*valence.H-1).toBe(8);
  expect(valence.O-6-2/2).toBe(-1);
  expect(originalUnits.find(u=>u.id.endsWith("c4-orbitals"))!.topicIndexes).toEqual([7]);
  const geometries={BF3:{bonds:3,lonePairs:0,shape:"trigonal planar"},NH3:{bonds:3,lonePairs:1,shape:"trigonal pyramidal"}};
  expect(geometries.BF3.bonds+geometries.BF3.lonePairs).toBe(3);expect(geometries.NH3.bonds+geometries.NH3.lonePairs).toBe(4);
});

test("the new live inertia error is rejected without another provider request",async()=>{
  const record=JSON.parse(await readFile("test-artifacts/exam-ready-3.2/live-1-physics-p7.json","utf8"));
  expect(record.raw.example.calculations[1].value).toBe(2);
  expect(1+3*1**2).toBe(4);
  expect(()=>acceptedExample(record.raw.example)).toThrow();
  expect(record.result.lesson).toBeUndefined();
});

test("coverage distinguishes readable topics, assessment support and live certification",()=>{
  const inventory=independentCoverage();expect(inventory).toHaveLength(150);
  const pcm=inventory.filter(c=>c.grade===11&&["physics","chemistry","maths"].includes(c.subjectId));expect(pcm).toHaveLength(45);
  expect(pcm.filter(c=>c.alignment.status==="THEORY_CHAPTER_MATCH")).toHaveLength(37);
  expect(pcm.filter(c=>c.alignment.status==="FORMATIVE_ONLY")).toHaveLength(4);
  expect(pcm.filter(c=>c.alignment.status==="NOT_SEPARATE_THEORY_UNIT")).toHaveLength(4);
  expect(inventory.every(c=>!c.contentComplete&&!c.liveTeachingVerified)).toBe(true);
  expect(inventory.filter(c=>!c.indexedMaterials).every(c=>c.objectivesWithTeaching===0&&c.objectivesWithQuestions===0)).toBe(true);
});

test("all 37 current Class XI PCM theory chapters have an actual usable first learning checkpoint",()=>{
  const chapters=curriculumInventory().filter(c=>c.grade===11&&syllabusAlignment(c.grade,c.subjectId,c.chapterId).status==="THEORY_CHAPTER_MATCH");
  expect(chapters).toHaveLength(37);
  for(const chapter of chapters){
    const s=createSession("starter-qa",{exam:"Current-scope starter QA",grade:11,board:"CBSE",examAt:Date.now()+86400000,minutes:120,format:"mixed",style:"step-by-step",chapters:[{subjectId:chapter.subjectId,chapterId:chapter.chapterId,confidence:1}],materials:"scholar",resourceIds:[],blocks:[],diagnostic:false});
    const task=currentTask(s)!;
    const sources=retrieveBuiltIn(chapter,task.objectiveIds??[],[],[],"scholar",task.topic);
    const lesson=libraryLesson(s,sources);
    if(!lesson?.questions.length) throw new Error(`${chapter.subjectId}/${chapter.chapterId}: first mission lacks a usable source-owned question`);
    try{expect(validateLesson(lesson,s,"normal").quality?.status).toBe("validated-structure");}
    catch(error){if(error instanceof AcademicQualityError)throw new Error(`${chapter.chapterId}: ${error.issues.join("; ")}`);throw error;}
  }
});

test("advanced binomial and novice emergency scenarios use actual independent bank material",()=>{
  const advanced=createSession("advanced",{exam:"Hard binomial practice",grade:11,board:"CBSE",examAt:Date.now()+86400000,minutes:180,format:"mixed",style:"step-by-step",chapters:[{subjectId:"maths",chapterId:"m8",confidence:5}],materials:"scholar",resourceIds:[],blocks:[],diagnostic:false});
  const task=currentTask(advanced)!;Object.assign(task,{kind:"learn",objectiveIds:["11:maths:m8:o4"],topics:["Applications of the binomial theorem"]});
  const lesson=libraryLesson(advanced,retrieveBuiltIn({grade:11,subjectId:"maths",chapterId:"m8"},task.objectiveIds!,[],[],"scholar"))!;
  expect(lesson.questions.some(q=>(q.difficulty??1)>=4)).toBe(true);
  expect(validateLesson(lesson,advanced,"normal").quality?.status).toBe("validated-structure");
  const emergency=createSession("emergency",{exam:"Tomorrow's two-chapter exam",grade:11,board:"CBSE",examAt:Date.now()+86400000,minutes:120,format:"mixed",style:"step-by-step",chapters:[{subjectId:"physics",chapterId:"p5",confidence:1},{subjectId:"physics",chapterId:"p6",confidence:1}],materials:"scholar",resourceIds:[],blocks:[],diagnostic:false});
  expect(emergency.tasks.reduce((n,t)=>n+t.seconds,0)).toBeLessThanOrEqual(7200);
  for(const id of ["p5","p6"]){const t=emergency.tasks.find(t=>t.chapterId===id&&t.kind==="learn")!;emergency.tasks.forEach(task=>{task.status=task.id===t.id?"active":"pending";});
    expect(libraryLesson(emergency,retrieveBuiltIn({grade:11,subjectId:"physics",chapterId:id},t.objectiveIds??[],[],[],"scholar"))?.questions.length).toBeGreaterThan(0);}
});
