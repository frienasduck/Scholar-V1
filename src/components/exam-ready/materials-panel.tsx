"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { subjectChapter, currentTask, type ExamSession, type Lesson, type Setup } from "@/lib/exam-ready/model";
import { Materials } from "./tools";
import { getCurriculum } from "@/lib/curriculum-helper";
type Props={session:ExamSession;lesson?:Lesson;guest:boolean;busy:boolean;onSetup:(value:Setup)=>void};
export function MaterialsPanel(p:Props&{onClose:()=>void}){return <Dialog open onOpenChange={open=>{if(!open)p.onClose();}}><DialogContent className="er-root er-v4 er-materials-dialog"><DialogTitle>Study materials</DialogTitle><DialogDescription>Available, selected, retrieved and cited sources — kept distinct.</DialogDescription><MaterialsWorkspace {...p}/></DialogContent></Dialog>;}
export function MaterialsWorkspace({session,lesson,guest,busy,onSetup}:Props){
  const task = currentTask(session), [chosen, setChosen] = useState(`${task?.subjectId}:${task?.chapterId}`);
  const scope = session.setup.chapters.find(c => `${c.subjectId}:${c.chapterId}` === chosen) ?? session.setup.chapters[0];
  const mode = session.setup.materials;
  return <section className="er-materials-browser"><h2>Materials &amp; Sources</h2><p className="er-muted">Browse the independent library for your selected chapters. A source badge is not proof of complete academic coverage.</p>
    <div className="er-material-policy"><label>Chapter<select value={`${scope.subjectId}:${scope.chapterId}`} onChange={e=>setChosen(e.target.value)}>{session.setup.chapters.map(c=><option key={`${c.subjectId}:${c.chapterId}`} value={`${c.subjectId}:${c.chapterId}`}>{getCurriculum(session.setup.grade).find(v=>v.id===c.subjectId)?.name} · {subjectChapter(session.setup,c.subjectId,c.chapterId)?.title}</option>)}</select></label>
    <label>Teaching sources<select disabled={busy} value={mode} onChange={e=>onSetup({...session.setup,materials:e.target.value as Setup["materials"]})}><option value="scholar">Scholar Materials</option><option disabled={guest} value="personal">My Materials only</option><option disabled={guest} value="personal-scholar">Scholar + My Materials</option><option value="verified">Reference-checked Materials</option><option value="custom">Only selected materials</option>{["all","scholar-web"].includes(mode) && <option value={mode}>Current combined mode</option>}</select></label></div>
    <details className="er-source-policy"><summary>How sources are used</summary><p>Your files are only used after explicit selection. My Materials only does not silently supplement missing text. Source changes retain mission order and invalidate the old teaching context; answer drafts and notes are retained.</p></details>
    {session.setup.resourceIds.length>0 && <button disabled={busy} onClick={()=>onSetup({...session.setup,resourceIds:[],materials:"scholar"})}>Clear selections and use Scholar Materials</button>}
    {(session.setup.excludedResourceIds?.length??0)>0 && <button disabled={busy} onClick={()=>onSetup({...session.setup,excludedResourceIds:[]})}>Reset exclusions</button>}
    {lesson?.materialTrace?.retrieved.some(r=>r.sourceId.startsWith("er-session-notes:")) && <p className="er-callout">The saved turn received your preparation notepad. {lesson.materialTrace.used.some(r=>r.sourceId.startsWith("er-session-notes:")) ? "It cited that session-owned note version." : "It did not cite the notes as a source."} This is not an uploaded textbook.</p>}
    <Materials key={chosen} grade={session.setup.grade} guest={guest} subjectId={scope.subjectId} chapterId={scope.chapterId} selected={session.setup.resourceIds} excluded={session.setup.excludedResourceIds} mode={mode} busy={busy} trace={lesson?.materialTrace} onSelect={ids=>onSetup({...session.setup,resourceIds:ids})} onPolicyChange={(ids,excluded)=>onSetup({...session.setup,resourceIds:ids,excludedResourceIds:excluded})}/>
  </section>;
}
