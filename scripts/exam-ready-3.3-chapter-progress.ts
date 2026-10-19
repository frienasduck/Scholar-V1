import { readFile, writeFile } from "node:fs/promises";
import { teacherDepth } from "../src/lib/exam-ready/knowledge/teacher-depth";
type Chapter={grade:number;subjectId:string;chapterId:string;title:string;explanations:number;workedExamples:number;questions:number;revisionItems:number;objectivesWithTeaching:number;objectivesWithQuestions:number;contentComplete:boolean;liveTeachingVerified:boolean};
const before=JSON.parse(await readFile("test-artifacts/exam-ready-3.2-coverage.json","utf8")) as {chapters:Chapter[]};
const after=JSON.parse(await readFile("test-artifacts/exam-ready-3.3-coverage.json","utf8")) as {chapters:Chapter[]};
const chapters=after.chapters.map(chapter=>{
  const prior=before.chapters.find(item=>item.grade===chapter.grade&&item.subjectId===chapter.subjectId&&item.chapterId===chapter.chapterId)!;
  return {grade:chapter.grade,subjectId:chapter.subjectId,chapterId:chapter.chapterId,title:chapter.title,newUnits:teacherDepth.filter(unit=>unit.grade===chapter.grade&&unit.subjectId===chapter.subjectId&&unit.chapterId===chapter.chapterId).map(unit=>({id:unit.id,title:unit.title,topicIndexes:unit.topicIndexes,checkObjectiveIndexes:unit.checkObjectiveIndexes})),before:{units:prior.explanations,examples:prior.workedExamples,questions:prior.questions,revision:prior.revisionItems,taught:prior.objectivesWithTeaching,assessed:prior.objectivesWithQuestions},after:{units:chapter.explanations,examples:chapter.workedExamples,questions:chapter.questions,revision:chapter.revisionItems,taught:chapter.objectivesWithTeaching,assessed:chapter.objectivesWithQuestions},contentComplete:chapter.contentComplete,liveTeachingVerified:chapter.liveTeachingVerified};
});
await writeFile("test-artifacts/exam-ready-3.3/chapter-progress.json",JSON.stringify({at:new Date().toISOString(),scope:"3.2-to-3.3 counts from saved coverage audits; not certification",chapters},null,2)+"\n");
console.log(JSON.stringify(chapters.filter(chapter=>chapter.newUnits.length)));
