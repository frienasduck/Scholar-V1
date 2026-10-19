import { currentTask, type ExamSession, type Lesson } from "./model";
import type { KnowledgePassage } from "./knowledge/types";

/** Only a current, permitted source-version lesson may anchor a follow-up. */
export function currentTeachingLesson(s:ExamSession,sources?:KnowledgePassage[]) {
  const task=currentTask(s);if(!task)return undefined;
  return Object.entries(s.lessons).reverse().find(([key,lesson])=>key.startsWith(`${task.id}:`) && lesson.grounding!=="material gap" && (!sources || !!lesson.materialTrace?.used.length && lesson.materialTrace.used.every(used=>sources.some(source=>source.citation.resourceId===used.sourceId&&source.version===used.version))))?.[1];
}
export function teachingIntent(request:string,pace="normal") {
  if(/\b(full|complete) (solution|answer)|show (the )?solution\b/i.test(request))return "solution";
  if(/\bhint\b|without (?:giving|revealing|spoiling).*answer/i.test(request))return "hint";
  if(/\b(harder|challenging|advanced|jee|expert)\b/i.test(request))return "challenge";
  if(/\b(don.?t understand|confused|simpler|basics|from scratch)\b/i.test(request)||["don’t understand","from scratch"].includes(pace))return "prerequisite";
  return "explain";
}
export function supportTurn(s:ExamSession,sources:KnowledgePassage[],request:string,pace="normal"):Lesson|undefined {
  const intent=teachingIntent(request,pace);if(!["hint","solution"].includes(intent))return undefined;
  const lesson=currentTeachingLesson(s,sources);if(!lesson)return undefined;
  const q=lesson.questions.find(q=>!s.attempts.some(a=>a.questionId===q.id))??lesson.questions.at(-1);if(!q)return undefined;
  const index=Math.min(2,Math.max(0,Number(request.match(/\bhint\s*([123])\b/i)?.[1]??1)-1));
  const hints=q.hints?.length?q.hints:[`Identify what is asked and the conditions stated in this problem. ${lesson.concept?.conditions??""}`,`Choose the relation from the taught concept: ${lesson.concept?.formula??lesson.concept?.title??q.topic}. State known and unknown quantities before substitution.`,q.numeric&&/[+*/^()-]/.test(q.numeric.expression)?`Work through the substituted expression ${q.numeric.expression}; keep the result in ${q.numeric.unit||"dimensionless form"}. The calculated answer is not shown here.`:`Use the chosen relation step by step; check signs, units and domain before stating the result. Ask for the full solution when you are ready.`];
  return {...lesson,text:intent==="solution"?`## Worked solution requested\n\n${q.question}\n\n${q.explanation}\n\nConclusion: ${q.answer}\n\nThis solution was revealed; it is not independent mastery evidence.`:`## Hint ${index+1}\n\n${hints[index]??hints.at(-1)}\n\nThe answer is not revealed. Try your method, request Hint ${Math.min(3,index+2)}, or ask for the full solution.`,concept:undefined,example:undefined,takeaway:undefined,questions:lesson.questions.map(item=>item.id===q.id?{...item,hints,assistance:item.assistance==="solution"||intent==="solution"?"solution":"hint"}:item),delivery:{mode:"support"},quality:{version:lesson.quality?.version??"exam-ready-3.1.0",status:"partial",objectiveIds:[],checks:["current permitted lesson context"],limitations:["Hints/solutions are assistance, not independent performance."]}};
}
export function compactTeachingContext(s:ExamSession,sources?:KnowledgePassage[]) {
  const previous=currentTeachingLesson(s,sources), pending=previous?.questions.find(q=>!s.attempts.some(a=>a.questionId===q.id));
  return previous?{text:previous.text.slice(0,2600),concept:previous.concept,example:previous.example,question:pending?{id:pending.id,question:pending.question,options:pending.options,objectiveId:pending.objectiveId,difficulty:pending.difficulty}:undefined,previousAnswer:s.attempts.filter(a=>a.taskId===currentTask(s)?.id).at(-1),sourceVersions:previous.materialTrace?.used}:undefined;
}
