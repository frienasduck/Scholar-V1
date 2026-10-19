import { beforeEach, expect, mock, test } from "bun:test";
import { ebookFixture } from "./ebook-fixtures";
mock.module("server-only",()=>({}));
const rows=new Map<string,Record<string,unknown>>();
const db={
 $queryRaw:async(strings:TemplateStringsArray,...v:unknown[])=>{const sql=strings.join("?");if(sql.includes('FROM "User"'))return [{id:v[0]}];if(sql.includes('FROM "ExamReadyMaterial"')){const r=rows.get(v[0] as string);return r&&r.userId===v[1]&&!r.deletedAt?[structuredClone(r)]:[];}return [];},
 $executeRaw:async(strings:TemplateStringsArray,...v:unknown[])=>{
  const sql=strings.join("?");
  if(sql.includes('SET "leaseToken"=')){const r=rows.get(v[1] as string);if(!r||r.userId!==v[2]||r.deletedAt||r.leaseToken||r.state!=="PROCESSING")return 0;r.leaseToken=v[0];r.attempts=Number(r.attempts)+1;return 1;}
  if(sql.includes('SET "pages"=')){const state=sql.includes('"state"=?'),index=state?3:2,r=rows.get(v[index] as string);if(!r||r.userId!==v[index+1]||r.deletedAt||r.leaseToken!==v[index+2])return 0;r.pages=JSON.parse(v[0] as string);r.metadata=JSON.parse(v[1] as string);r.state=state?v[2]:"PROCESSING";r.leaseToken=null;r.attempts=0;r.revision=Number(r.revision)+1;r.updatedAt=new Date();return 1;}
  if(sql.includes('SET "state"=\'FAILED\'')){const r=rows.get(v[1] as string);if(!r||r.userId!==v[2]||r.deletedAt||r.leaseToken!==v[3])return 0;r.state="FAILED";r.errorCode=v[0];r.leaseToken=null;return 1;}
  return 0;
 },
 $transaction:async(fn:(tx:unknown)=>unknown)=>fn(db)
};
mock.module("@/lib/db",()=>({db}));
const {validateMaterialFile,privateMaterial,retrievePrivate,processMaterial}=await import("../src/lib/exam-ready/knowledge/private-materials");
beforeEach(()=>rows.clear());
function add(id="er-user-a",userId="A",overrides:Record<string,unknown>={}){rows.set(id,{id,userId,grade:11,subjectId:"physics",chapterId:"p5",title:"Synthetic physics notes",mime:"application/pdf",sizeBytes:1000,contentHash:"synthetic",revision:0,fileBytes:ebookFixture(2),state:"READY",pages:["Page 1: Net force equals mass times acceleration in the stated inertial frame.","Page 2: Static friction adjusts below its limiting magnitude until impending slip."],metadata:{indexedPages:2,pageCount:2},attempts:0,updatedAt:new Date(),...overrides});}
test("file type, magic bytes and size are validated independently",()=>{expect(()=>validateMaterialFile(ebookFixture(1),"application/pdf")).not.toThrow();for(const [bytes,mime]of [[Buffer.from("not pdf"),"application/pdf"],[ebookFixture(1),"text/plain"],[Buffer.alloc(3*1024*1024+1),"text/plain"],[Buffer.from([0]),"text/plain"]]as const)expect(()=>validateMaterialFile(bytes,mime)).toThrow();});
test("user B cannot read A's metadata, bytes or text",async()=>{add();await expect(privateMaterial("B","er-user-a",true)).rejects.toThrow("not found");await expect(retrievePrivate("B",{grade:11,subjectId:"physics",chapterId:"p5"},["er-user-a"],[],"force")).rejects.toThrow();});
test("retrieval preserves exact requested page and ignores exclusions",async()=>{add();const r=await retrievePrivate("A",{grade:11,subjectId:"physics",chapterId:"p5"},["er-user-a"],[],"friction",2,2);expect(r).toHaveLength(1);expect(r[0].citation.page).toBe(2);expect(r[0].text).toContain("Static friction");expect(await retrievePrivate("A",{grade:11,subjectId:"physics",chapterId:"p5"},["er-user-a"],["er-user-a"],"force")).toEqual([]);});
test("wrong chapter, processing and unreviewed OCR never become factual passages",async()=>{add();expect(await retrievePrivate("A",{grade:11,subjectId:"physics",chapterId:"p6"},["er-user-a"],[],"force")).toEqual([]);for(const state of ["PROCESSING","NEEDS_OCR","NEEDS_REVIEW","FAILED"]){rows.get("er-user-a")!.state=state;expect(await retrievePrivate("A",{grade:11,subjectId:"physics",chapterId:"p5"},["er-user-a"],[],"force")).toEqual([]);}});
test("soft deletion immediately blocks source retrieval",async()=>{add();rows.get("er-user-a")!.deletedAt=new Date();await expect(privateMaterial("A","er-user-a")).rejects.toThrow("not found");});
test("another user cannot claim the ingestion job",async()=>{add("er-user-a","A",{state:"PROCESSING"});expect(await processMaterial("B","er-user-a")).toBe(false);expect(rows.get("er-user-a")!.attempts).toBe(0);});
test("real PDF parser preserves page boundaries through the independent job",async()=>{add("er-user-a","A",{state:"PROCESSING",pages:[],metadata:{}});expect(await processMaterial("A","er-user-a")).toBe(true);const r=rows.get("er-user-a")!;expect(r.state).toBe("READY");expect((r.pages as string[])[1]).toContain("Page 2");const p=await retrievePrivate("A",{grade:11,subjectId:"physics",chapterId:"p5"},["er-user-a"],[],"force",2,2);expect(p[0].citation.page).toBe(2);expect(p[0].version).toBe("synthetic:1");},45000);
test("mixed PDF extraction is durably saved before its separate OCR stage",async()=>{add("er-user-a","A",{state:"PROCESSING",pages:[],metadata:{},fileBytes:ebookFixture(2,{mixed:true})});await processMaterial("A","er-user-a");const r=rows.get("er-user-a")!,m=r.metadata as Record<string,unknown>;expect(r.state).toBe("PROCESSING");expect(m.ocrPending).toEqual([1]);expect(m.reviewRequiredPages).toEqual([2]);expect(m.extractionComplete).toBe(true);expect((r.pages as string[])[0]).toContain("Newton");expect(await retrievePrivate("A",{grade:11,subjectId:"physics",chapterId:"p5"},["er-user-a"],[],"force")).toEqual([]);},45000);

