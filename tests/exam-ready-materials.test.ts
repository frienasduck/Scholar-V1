import { expect, mock, test } from "bun:test";
import { createSession } from "../src/lib/exam-ready/planner";
import type { Setup } from "../src/lib/exam-ready/model";
mock.module("server-only",()=>({}));
let requestedPage: number|undefined;
const mine={id:"er-user-mine",userId:"owner",grade:11,subjectId:"physics",chapterId:"p5",state:"READY",title:"My notes"};
const wrong={...mine,id:"er-user-wrong",grade:9,subjectId:"science",chapterId:"s9"};
mock.module("@/lib/exam-ready/knowledge/private-materials",()=>({
 privateMaterial:async(user:string,id:string)=>{const r=[mine,wrong].find(r=>r.id===id&&r.userId===user);if(!r)throw new Error("Private material unavailable");return r;},
 privateSummary:(r:typeof mine)=>({...r,visibility:"PRIVATE",mappings:[{curriculumId:"cbse",grade:r.grade,subjectId:r.subjectId,chapterId:r.chapterId}],resourceType:"notes"}),
 retrievePrivate:async(user:string,scope:typeof mine,ids:string[],excluded:string[],_q:string,page?:number)=>{requestedPage=page;return [mine,wrong].filter(r=>r.userId===user&&r.grade===scope.grade&&r.subjectId===scope.subjectId&&r.chapterId===scope.chapterId&&ids.includes(r.id)&&!excluded.includes(r.id)).map(r=>({citation:{id:"",resourceId:r.id,title:r.title,publisher:"User",url:null,heading:"Page 4",page:4},text:"Net force changes momentum in an inertial frame.",version:"v1",objectiveIds:[],origin:"USER_UPLOAD"}));}
}));
const {selectMaterials}=await import("../src/lib/exam-ready/materials");
const config:Setup={exam:"Physics",grade:11,board:"CBSE",examAt:Date.now()+86400000,minutes:120,format:"school",style:"step-by-step",chapters:[{subjectId:"physics",chapterId:"p5",confidence:1}],materials:"all",resourceIds:[],blocks:[],diagnostic:false};
test("personal-only requires explicit private selection and never supplements",async()=>{const empty=await selectMaterials("owner",createSession("s",{...config,materials:"personal"}));expect(empty.sources).toEqual([]);const r=await selectMaterials("owner",createSession("s",{...config,materials:"personal",resourceIds:[mine.id]}));expect(r.sources.map(s=>s.citation.resourceId)).toEqual([mine.id]);expect(r.restricted).toBe(true);});
test("Scholar-only never reads private passages",async()=>{const r=await selectMaterials("owner",createSession("s",{...config,materials:"scholar"}));expect(r.sources.length).toBeGreaterThan(0);expect(r.sources.every(p=>p.origin==="SCHOLAR_AUTHORED")).toBe(true);});
test("custom uses only its explicit independent source IDs",async()=>{const r=await selectMaterials("owner",createSession("s",{...config,materials:"custom",resourceIds:[mine.id]}));expect(r.sources.map(p=>p.citation.resourceId)).toEqual([mine.id]);});
test("foreign, deleted and legacy section selections fail closed",async()=>{await expect(selectMaterials("victim",createSession("s",{...config,resourceIds:[mine.id]}))).rejects.toThrow();await expect(selectMaterials("owner",createSession("s",{...config,resourceIds:["old-ebook-resource"]}))).rejects.toThrow("legacy");});
test("excluded private material is not retrieved",async()=>{const r=await selectMaterials("owner",createSession("s",{...config,materials:"personal",resourceIds:[mine.id],excludedResourceIds:[mine.id]}));expect(r.sources).toEqual([]);});
test("explicit selections cannot introduce another grade or subject",async()=>{const r=await selectMaterials("owner",createSession("s",{...config,materials:"personal",resourceIds:[wrong.id]}));expect(r.sources).toEqual([]);});
test("personal material precedes built-in supplementation",async()=>{const r=await selectMaterials("owner",createSession("s",{...config,materials:"personal-scholar",resourceIds:[mine.id]}));expect(r.sources[0].citation.resourceId).toBe(mine.id);});
test("page request reads the selected page and does not fill it with built-in text",async()=>{const r=await selectMaterials("owner",createSession("s",{...config,resourceIds:[mine.id]}),"Explain page 4");expect(requestedPage).toBe(4);expect(r.pageRequested).toBe(true);expect(r.sources.every(p=>p.citation.resourceId===mine.id)).toBe(true);});
