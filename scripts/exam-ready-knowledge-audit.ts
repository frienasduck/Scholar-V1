import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { independentCoverage, builtInMaterials, retrieveBuiltIn } from "../src/lib/exam-ready/knowledge/library";
import { originalUnits } from "../src/lib/exam-ready/knowledge/originals";
const chapters=independentCoverage(), resources=chapters.flatMap(builtInMaterials), byHash=new Map<string,string[]>();
for(const r of resources) byHash.set(r.version,[...byHash.get(r.version)??[],r.id]);
const begin=performance.now();for(let i=0;i<1000;i++)retrieveBuiltIn({grade:11,subjectId:"physics",chapterId:"p5"},["11:physics:p5:o4"],[],[],"scholar","friction");
const result={at:new Date().toISOString(),domain:"EXAM_READY",summary:{supported:chapters.length,indexedChapters:chapters.filter(c=>c.indexedMaterials>0).length,fullyCovered:chapters.filter(c=>c.complete).length,withoutMaterial:chapters.filter(c=>c.indexedMaterials===0).length,storedMaterials:resources.length,originalTeachingUnits:chapters.reduce((n,c)=>n+c.explanations,0),licensedPrimarySections:chapters.reduce((n,c)=>n+c.primarySources,0),workedExamples:chapters.reduce((n,c)=>n+c.workedExamples,0),questions:chapters.reduce((n,c)=>n+c.questions,0),revisionItems:chapters.reduce((n,c)=>n+c.revisionItems,0),externalReferenceRecords:chapters.reduce((n,c)=>n+c.externalReferences,0),totalIndexedPassages:resources.reduce((n,r)=>n+r.indexedChunks,0),distinctExternalPrimaryDocuments:new Set(resources.filter(r=>r.sourceType==="licensed-primary").map(r=>r.canonicalUrl)).size},retrievalMeanMs:(performance.now()-begin)/1000,duplicateContentHashes:[...byHash].filter(([,ids])=>ids.length>1),chapters};
const questions=originalUnits.flatMap(unit=>unit.checks), examples=originalUnits.flatMap(unit=>unit.examples);
const academicEvidence={
  registryObjectives:chapters.reduce((n,c)=>n+c.requiredObjectives.length,0),
  objectivesWithTeaching:chapters.reduce((n,c)=>n+c.objectivesWithTeaching,0),
  objectivesWithQuestions:chapters.reduce((n,c)=>n+c.objectivesWithQuestions,0),
  explicitObjectiveMappedUnits:originalUnits.filter(unit=>unit.checkObjectiveIndexes).length,
  explanationWords:originalUnits.reduce((n,unit)=>n+unit.explanation.trim().split(/\s+/).length,0),
  examplesWithCalculationTraces:examples.filter(example=>example.calculations?.length).length,
  workedExampleCalculationTraceRows:examples.reduce((n,example)=>n+(example.calculations?.length??0),0),
  numericQuestions:questions.filter(question=>question.numeric).length,
  difficultyDistribution:Object.fromEntries([1,2,3,4,5].map(difficulty=>[difficulty,questions.filter(q=>(q.difficulty??1)===difficulty).length])),
  mcqKeyPositions:Object.fromEntries([0,1,2,3].map(position=>[position,questions.filter(q=>q.kind==="mcq"&&q.options?.indexOf(q.answer)===position).length])),
  structuredMisconceptions:originalUnits.reduce((n,unit)=>n+(unit.misconceptions?.length??0),0),
  formulaBearingUnits:originalUnits.filter(unit=>unit.formula?.trim()).length,
  independentlyCertifiedChapters:0,
  class11SubjectBreakdown:["physics","chemistry","maths","cs","english"].map(subjectId=>{
    const subject=chapters.filter(chapter=>chapter.grade===11&&chapter.subjectId===subjectId);
    return {subjectId,registryChapters:subject.length,readableChapters:subject.filter(c=>c.indexedMaterials).length,units:subject.reduce((n,c)=>n+c.explanations,0),examples:subject.reduce((n,c)=>n+c.workedExamples,0),questions:subject.reduce((n,c)=>n+c.questions,0),objectivesWithTeaching:subject.reduce((n,c)=>n+c.objectivesWithTeaching,0),objectivesWithQuestions:subject.reduce((n,c)=>n+c.objectivesWithQuestions,0)};
  }),
};
const output=process.argv[2]??"test-artifacts/exam-ready-3.3-coverage.json";
await mkdir(resolve("test-artifacts"),{recursive:true});await writeFile(resolve(output),JSON.stringify({...result,academicEvidence},null,2)+"\n");console.log(JSON.stringify({...result.summary,retrievalMeanMs:result.retrievalMeanMs,duplicateContentHashes:result.duplicateContentHashes,academicEvidence}));
