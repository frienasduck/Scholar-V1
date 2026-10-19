import { currentTask, type ExamSession, type Lesson } from "../model";
import { libraryLesson } from "./bank";
import type { KnowledgePassage } from "./types";
import { supportTurn } from "../teaching-support";
export function offlineGuide(s:ExamSession,sources:KnowledgePassage[],pace="normal",request=""):Lesson {
  const base=libraryLesson(s,sources);
  if(base) {
    const task=currentTask(s)!;s.lessons[`${task.id}:offline-context`]=base;
    const help=supportTurn(s,sources,request,pace);if(help)return {...help,grounding:"offline curriculum guidance"};
    const lesson=libraryLesson(s,sources,{pace,request})!;
    return {...lesson,grounding:"offline curriculum guidance",text:`${request?"Offline source-based guidance, not a personalised AI answer. Open the stored explanation below; live interpretation of other questions requires sign-in.\n\n":""}${lesson.text}`};
  }
  return {text:sources.length?"Readable reference passages exist for this topic. Open View Materials to read them. A complete authored guide/check is not ready yet; no generated or unrelated lesson is substituted.":"No readable built-in teaching unit is available for this exact topic under your current source selection. Open View Materials to review exclusions or sign in to add your own notes.",formulas:[],questions:[],citations:sources.map(s=>s.citation),grounding:"material gap"};
}
