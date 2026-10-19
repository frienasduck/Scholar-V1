import { originalUnits } from "./originals";
import { checkObjectiveIndex, unitObjectives, sameScope } from "./library";
import { chapterManifest, ACADEMIC_VERSION } from "../coverage";
import { currentTask, type ExamSession, type Lesson } from "../model";
import { requestedDifficulty, validateQuestion } from "../quality";
import { questionIdentity, questionPattern } from "../question-identity";
import { KNOWLEDGE_VERSION, type KnowledgePassage } from "./types";
export function libraryLesson(s:ExamSession,sources:KnowledgePassage[],options:{pace?:string;request?:string}={}):Lesson|undefined {
  const task=currentTask(s);if(!task)return undefined;
  const target=requestedDifficulty(s,options.request??"");
  const candidates=originalUnits.filter(u=>sameScope(u,{grade:s.setup.grade,...task})&&sources.some(p=>p.citation.resourceId===u.id)&&unitObjectives(u).some(id=>(task.objectiveIds??[]).includes(id)));
  const available=(unit:typeof candidates[number])=>unit.checks.filter((q,i)=>{
    const objective=chapterManifest(unit.grade,unit.subjectId,unit.chapterId).objectives[checkObjectiveIndex(unit,i)];
    const id=questionIdentity(unit.subjectId,unit.chapterId,q.question,q.options);
    return (task.objectiveIds??[]).includes(objective.id)&&!s.attempts.some(a=>a.questionId===id||a.question&&questionPattern(a.question)===questionPattern(q.question));
  });
  const distance=(unit:typeof candidates[number])=>Math.min(...available(unit).map(q=>Math.abs((q.difficulty??1)-target)));
  const meetsTarget=(unit:typeof candidates[number])=>available(unit).some(q=>(q.difficulty??1)>=target);
  const unit=candidates.sort((a,b)=>Number(!available(a).length)-Number(!available(b).length)||distance(a)-distance(b)||Number(meetsTarget(b))-Number(meetsTarget(a)))[0];
  if(!unit)return undefined;
  const source=sources.find(p=>p.citation.resourceId===unit.id)!, manifest=chapterManifest(unit.grade,unit.subjectId,unit.chapterId);
  const checks=unit.checks.flatMap((q,i)=>{const objective=manifest.objectives[checkObjectiveIndex(unit,i)];return objective&&(task.objectiveIds??[]).includes(objective.id)?[validateQuestion({...q,id:questionIdentity(unit.subjectId,unit.chapterId,q.question,q.options),subjectId:unit.subjectId,chapterId:unit.chapterId,topic:objective.topic,objectiveId:objective.id,source:"Scholar question bank",citationIds:[source.citation.id]},s)]:[];}).filter(q=>!s.attempts.some(a=>a.questionId===q.id||a.question&&questionPattern(a.question)===questionPattern(q.question))).sort((a,b)=>Math.abs((a.difficulty??1)-target)-Math.abs((b.difficulty??1)-target)).slice(0,3);
  const briefing=[options.pace==="from scratch"||options.pace==="don’t understand"?`Start with prerequisites: ${(unit.prerequisites??["Read the stated conditions before choosing a formula"]).join("; ")}.`:"",unit.explanation,unit.derivation?.length?`Derivation:\n${unit.derivation.join("\n")}`:"",unit.diagram?`Diagram: ${unit.diagram}`:"",...(unit.misconceptions?.map(m=>`Common error: ${m.wrong}\nRepair: ${m.repair}`)??[]),`Revision prompts: ${unit.revision.join("; ")}`,unit.scopeNote].filter(Boolean).join("\n\n");
  const synopsis=unit.explanation.match(/.{1,700}[.!?](?:\s|$)/)?.[0]?.trim()??unit.explanation;
  const quiz=options.pace==="quiz"||["practice","recall","diagnostic"].includes(task.kind);
  const faster=options.pace==="faster";
  return {text:`${quiz?`Try the source-owned questions before opening the solution. Retrieve ${unit.title} from memory; apply the conditions and check your method, not only the final answer.`:faster?`${synopsis}\n\nConditions: ${unit.conditions}`:briefing} [${source.citation.id}]\n\nOriginal Scholar Exam Ready teaching material; not a newly generated AI explanation. This is a topic unit, not complete chapter coverage.`,concept:quiz?undefined:{title:unit.title,explanation:synopsis,formula:unit.formula,conditions:unit.conditions},example:quiz||faster?undefined:unit.examples[target>=4||["example","another method"].includes(options.pace??"")?unit.examples.length-1:0],formulas:unit.formula?[unit.formula]:[],takeaway:quiz?undefined:unit.misconceptions?.[0]?.repair??`Avoid this misconception: ${unit.mistakes[0]}`,questions:checks,citations:[source.citation],grounding:"source-grounded",delivery:{mode:"authored"},materialTrace:{domain:"EXAM_READY",version:KNOWLEDGE_VERSION,at:Date.now(),policy:s.setup.materials,selectedIds:s.setup.resourceIds,excludedIds:s.setup.excludedResourceIds??[],retrieved:[{sourceId:unit.id,version:source.version,heading:unit.title,citationId:source.citation.id}],used:[{sourceId:unit.id,version:source.version,citationId:source.citation.id}]},quality:{version:ACADEMIC_VERSION,status:"partial",objectiveIds:[],checks:["authored reference comparison","independent arithmetic","scoped original bank"],limitations:["Topic unit, not complete chapter or independent subject-expert certification.",...(checks.length?[]:["No bank question matches this exact checkpoint yet."])]}};
}
