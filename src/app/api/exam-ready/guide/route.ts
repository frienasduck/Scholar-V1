import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { checkGrade } from "@/lib/personalization/server";
import { chapterManifest } from "@/lib/exam-ready/coverage";
import { examAccess } from "@/lib/exam-ready/access";
import { fail, reply } from "@/lib/exam-ready/http";
import { createSession } from "@/lib/exam-ready/planner";
import { currentTask } from "@/lib/exam-ready/model";
import { retrieveBuiltIn } from "@/lib/exam-ready/knowledge/library";
import { offlineGuide } from "@/lib/exam-ready/knowledge/offline";
import { materialModes } from "@/lib/exam-ready/model";
export async function GET(request:Request) {
  try {
    const p=new URL(request.url).searchParams, grade=p.get("grade")==="9"?9:11, subjectId=z.string().min(1).max(40).parse(p.get("subjectId")),chapterId=z.string().min(1).max(60).parse(p.get("chapterId"));
    const user=await getSessionUser();if(!(await examAccess(user?.id??null)).allowed||!user&&grade===9)return reply({message:"This guide is unavailable for this session."},403);if(user)await checkGrade(user.id,grade);
    const manifest=chapterManifest(grade,subjectId,chapterId), ids=(p.get("objectives")??"").split(",").filter(id=>manifest.objectives.some(o=>o.id===id)).slice(0,8);
    const pace=z.enum(["normal","faster","deeper","example","another method","don’t understand","quiz","from scratch"]).parse(p.get("pace")??"normal"), question=z.string().max(1800).parse(p.get("request")??""), confidence=z.coerce.number().int().min(1).max(5).parse(p.get("confidence")??1),mode=z.enum(materialModes).parse(p.get("mode")??"scholar");
    const selected=z.array(z.string().min(1).max(180)).max(12).parse((p.get("selected")??"").split(",").filter(Boolean));
    const kind=z.enum(["diagnostic","learn","repair","revise","practice","recall","mistakes"]).parse(p.get("kind")??"learn");
    const now=Date.now(),s=createSession("guest-guide",{exam:"Offline topic guide",grade,board:"CBSE",examAt:now+86400000,minutes:120,format:"school",style:"step-by-step",chapters:[{subjectId,chapterId,confidence}],materials:mode,resourceIds:selected,excludedResourceIds:(p.get("excluded")??"").split(",").slice(0,100),blocks:[],diagnostic:false});
    const task=currentTask(s)!;task.objectiveIds=ids;task.topics=manifest.objectives.filter(o=>ids.includes(o.id)).map(o=>o.topic);task.topic=task.topics[0]??manifest.title;
    task.kind=kind;
    const sources=retrieveBuiltIn({grade,subjectId,chapterId},ids,selected,s.setup.excludedResourceIds??[],mode,question);
    // Public authored self-review, no AI, private files, persisted answers or readiness.
    return reply({lesson:offlineGuide(s,sources,pace,question)});
  }catch(e){return fail(e);}
}
