import { currentTask, type Attempt, type ExamSession, type Lesson } from "./model";
import { eligibleRevisionItems } from "./revision";

export const classroomActivities=["learn","practice","recall","repair"] as const;
export type ClassroomActivity=typeof classroomActivities[number];
export function activityForTask(kind?:string):ClassroomActivity {
    return ["practice","diagnostic"].includes(kind??"")?"practice":["recall","revise"].includes(kind??"")?"recall":["repair","mistakes"].includes(kind??"")?"repair":"learn";
}
export function currentAttempt(s:ExamSession) {return s.attempts.filter(a=>a.taskId===currentTask(s)?.id).at(-1);}
export function classroomQuestion(s:ExamSession,lesson:Lesson|undefined,selectedId?:string|null){return lesson?.questions.find(q=>q.id===selectedId)??lesson?.questions.find(q=>!s.attempts.some(a=>a.questionId===q.id));}
export function recordedMistakes(s:ExamSession) {return s.attempts.filter(a=>!a.correct&&a.evaluation!=="self-reviewed").toSorted((a,b)=>b.at-a.at);}
export function sourcePermitted(s:ExamSession,id:string) {
    if(s.setup.excludedResourceIds?.includes(id))return false;
    const privateSource=id.startsWith("er-user-")||id.startsWith("er-session-notes:");
    if(s.setup.materials==="custom")return s.setup.resourceIds.includes(id);
    if(s.setup.materials==="personal")return privateSource&&(s.setup.resourceIds.includes(id)||id===`er-session-notes:${s.id}`);
    return ["scholar","scholar-web","verified"].includes(s.setup.materials)?!privateSource:!privateSource||s.setup.resourceIds.includes(id)||id===`er-session-notes:${s.id}`;
}
export function attemptHasContext(s:ExamSession,a:Attempt) {
    return Object.values(s.lessons).some(l=>l.citations.length>0&&l.citations.every(c=>sourcePermitted(s,c.resourceId))&&l.questions.some(q=>q.id===a.questionId));
}
export type RecallCard={id:string;topic:string;prompt:string;answer:string;kind:"concept"|"formula";source:string};
export function recallCards(s:ExamSession,lesson?:Lesson):RecallCard[] {
    const archived=eligibleRevisionItems(s).filter(i=>s.tasks.some(t=>t.objectiveIds?.includes(i.objectiveId)));
    const cards:RecallCard[]=archived.map(i=>({id:i.objectiveId,topic:i.topic,prompt:`Explain ${i.topic} in your own words. State when it applies.`,answer:i.summary,kind:"concept",source:"Saved permitted lesson"}));
    const allowed=lesson&&lesson.grounding!=="material gap"&&lesson.citations.length>0&&lesson.citations.every(c=>sourcePermitted(s,c.resourceId))?lesson:undefined;
    if(allowed?.concept)cards.push({id:`current:${allowed.concept.title}`,topic:allowed.concept.title,prompt:`Explain ${allowed.concept.title} without looking.`,answer:allowed.concept.explanation,kind:"concept",source:allowed.delivery?.mode==="live"?"Saved live explanation":"Stored source guidance"});
    const formulas=[...new Set([...archived.flatMap(i=>i.formulas),...(allowed?.formulas??[])])];
    formulas.forEach(f=>cards.push({id:`formula:${f}`,topic:currentTask(s)?.topic??"Formula recall",prompt:"Recall this relation, define each symbol, and state its conditions.",answer:f,kind:"formula",source:"Permitted lesson formulas"}));
    return [...new Map(cards.map(c=>[c.kind==="concept"?`concept:${c.topic.trim().toLowerCase()}`:c.id,c])).values()].slice(-36);
}
export type ClassroomUI={activity:ClassroomActivity;section:"explanation"|"concept"|"example"|"check";tool:"tools"|"notes"|"formulas"|"mistakes"|"resources";recallReviewed:string[];unsure:string[];scratch:string;answers:Record<string,string>;questionId:string};
export const defaultClassroomUI:ClassroomUI={activity:"learn",section:"explanation",tool:"notes",recallReviewed:[],unsure:[],scratch:"",answers:{},questionId:""};
export function readClassroomUI(raw:string|null,fallback:ClassroomUI=defaultClassroomUI):ClassroomUI {
    if(raw&&raw.length>200000)return {...fallback};
    try{const v=JSON.parse(raw??"null");if(v?.version!==4)return {...fallback};const strings=(a:unknown)=>Array.isArray(a)?a.filter((s):s is string=>typeof s==="string"&&s.length<1200).slice(-60):[];
        return {questionId:typeof v.questionId==="string"&&v.questionId.length<160?v.questionId:"",activity:classroomActivities.includes(v.activity)?v.activity:fallback.activity,section:["explanation","concept","example","check"].includes(v.section)?v.section:fallback.section,tool:["tools","notes","formulas","mistakes","resources"].includes(v.tool)?v.tool:fallback.tool,recallReviewed:strings(v.recallReviewed),unsure:strings(v.unsure),scratch:typeof v.scratch==="string"?v.scratch.slice(0,12000):"",answers:v.answers&&typeof v.answers==="object"&&!Array.isArray(v.answers)?Object.fromEntries(Object.entries(v.answers).filter(([k,a])=>k.length<160&&typeof a==="string").slice(-40).map(([k,a])=>[k,(a as string).slice(0,3000)])):{}};
    }catch{return {...fallback};}
}
/** Browsing an old lesson is read-only and never advances the mission. */
export function savedTaskLesson(s:ExamSession,id:string):Lesson|undefined {
    if(!s.tasks.some(t=>t.id===id&&t.status==="done"))return;
    return Object.entries(s.lessons).filter(([key,l])=>key.startsWith(`${id}:`)&&l.citations.length>0&&l.citations.every(c=>sourcePermitted(s,c.resourceId))).at(-1)?.[1];
}
