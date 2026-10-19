"use client";
import { useEffect, useRef, useState } from "react";
import { BookOpen, FileText, Film, Globe, Search, Upload, LayoutGrid, List, X } from "lucide-react";
import { examRequest } from "./use-session";
import { ExamContent } from "./content";
import type { KnowledgeMaterial } from "@/lib/exam-ready/knowledge/types";
import type { MaterialTrace } from "@/lib/exam-ready/knowledge/types";

type Props = {
 grade: 9 | 11; guest: boolean; selected: string[]; onSelect: (ids: string[]) => void;
 mode?: string; subjectId?: string; chapterId?: string; compact?: boolean; busy?: boolean; shortTime?: boolean;
 excluded?: string[]; onPolicyChange?: (selected: string[], excluded: string[]) => void; trace?: MaterialTrace;
};
export function Materials({ grade, guest, selected, onSelect, mode = "all", subjectId, chapterId, compact = false, busy = false, excluded = [], onPolicyChange, trace }: Props) {
 const [layout,setLayout]=useState<"list"|"grid">("list"),[type,setType]=useState("all"),[origin,setOrigin]=useState("all"),[sort,setSort]=useState("relevant"),[total,setTotal]=useState(0);
 const [resources, setResources] = useState<KnowledgeMaterial[]>([]), [error, setError] = useState(""), [q, setQ] = useState(""), [page, setPage] = useState(1), [pages, setPages] = useState(1), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0), [detail, setDetail] = useState<KnowledgeMaterial | null>(null), [text, setText] = useState(""), [file, setFile] = useState<File | null>(null), [uploading, setUploading] = useState(false), [reviewPage, setReviewPage] = useState(1), [reviewText, setReviewText] = useState("");
 useEffect(() => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
   setLoading(true);
   const params = new URLSearchParams({ grade: String(grade), q, page: String(page), scope: mode === "personal" ? "personal" : ["scholar","scholar-web","verified"].includes(mode) ? "built-in" : "all" });
   params.set("type",type);params.set("origin",origin);params.set("sort",sort);
   if (subjectId) params.set("subjectId", subjectId);
   if (chapterId) params.set("chapterId", chapterId);
   fetch(`/api/exam-ready/materials?${params}`, {signal: controller.signal, cache:"no-store"}).then(async r => {
    const value = await r.json(); if(!r.ok) throw new Error(value.message ?? "Materials unavailable");
    setResources(value.resources); setPages(value.pages);setTotal(value.total);setPage(value.page);
    setError(value.privateAvailable === false ? "Your private Exam Ready index is unavailable. Built-in materials are listed separately; private-only teaching will not substitute them." : "");
   }).catch(e => {if(!controller.signal.aborted) setError(e.message);}).finally(() => {if(!controller.signal.aborted) setLoading(false);});
  }, q ? 250 : 0);
  return () => {clearTimeout(timer); controller.abort();};
 }, [grade,subjectId,chapterId,mode,q,page,refresh,type,origin,sort]);
 const openRequest = useRef<AbortController|null>(null);
 useEffect(()=>()=>openRequest.current?.abort(),[]);
 async function open(r: KnowledgeMaterial, requestedPage?:number) {
  openRequest.current?.abort(); const controller=new AbortController();openRequest.current=controller;
  setDetail(r); setText(""); setReviewText("");
  if(r.state==="LINK_ONLY") return;
  try {
   const value = await examRequest(`/api/exam-ready/materials/${r.id}${r.visibility==="PRIVATE"?`?page=${requestedPage??1}`:""}`,undefined,"GET",controller.signal);
   if(controller.signal.aborted) return;
   if(value.text) setText(value.text);
   else {setText(value.pages?.length ? `Page ${value.page}\n${value.pages[0] || "[No readable text]"}` : "Extraction is not complete yet. Refresh processing status; no readable page is claimed.");setDetail(value.material);setReviewText(value.pages?.[0] ?? ""); setReviewPage(value.page??1);}
  } catch(e) {if(!controller.signal.aborted)setError((e as Error).message);}
 }
 async function upload() {
  if(!file || !subjectId || !chapterId) return;
  setUploading(true); setError("");
  try {
   const form = new FormData(); form.set("file",file); form.set("grade",String(grade)); form.set("subjectId",subjectId); form.set("chapterId",chapterId);
   const r = await fetch("/api/exam-ready/materials",{method:"POST",body:form,signal:AbortSignal.timeout(58000)}), v = await r.json();
   if(!r.ok) throw new Error(v.message ?? "Upload failed");
   if(selected.length<12) onSelect([...new Set([...selected,v.id])]);
   setFile(null); setRefresh(n=>n+1);
  } catch(e) {setError((e as Error).message);} finally {setUploading(false);}
 }
 async function manage(action: "retry" | "review" | "remove") {
  if(!detail) return;
  setUploading(true); setError("");
  try {
   await examRequest(`/api/exam-ready/materials/${detail.id}`, action==="remove" ? {} : action==="review" ? {action,page:reviewPage,text:reviewText} : {action}, action==="remove" ? "DELETE" : "PATCH");
   if(action==="remove") onSelect(selected.filter(id=>id!==detail.id));
   setDetail(null); setRefresh(n=>n+1);
  } catch(e) {setError((e as Error).message);} finally {setUploading(false);}
 }
 return <div data-layout={compact?"grid":layout} className={`er-materials ${compact ? "er-materials-compact" : ""}`}>
  <p className="er-muted">Independent Exam Ready library. Links are additional references, never stored textbook text. Missing coverage is not marked complete.</p>
  <div className="er-resource-toolbar"><label><span><Search size={14}/> Find material</span><input value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/></label><button onClick={()=>setRefresh(n=>n+1)}>Refresh status</button></div>
  {!compact&&<div className="er-material-filters"><label>Material type<select value={type} onChange={e=>{setType(e.target.value);setPage(1);}}>{[["all","All materials"],["notes","Notes"],["textbook","Textbooks"],["past-paper","Past papers"],["question-bank","Question banks"],["formula-sheet","Formula sheets"],["video","Videos"],["reference","References"]].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Source priority<select value={origin} onChange={e=>{setOrigin(e.target.value);setPage(1);}}><option value="all">All permitted sources</option><option value="scholar">Scholar authored / indexed</option><option value="reference">Reference only (external)</option><option disabled={guest} value="private">Uploaded by me</option></select></label><label>Sort materials<select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="relevant">Library order for this scope</option><option value="title">Title A–Z</option></select></label><div className="er-segments" role="group" aria-label="Material layout"><button aria-label="List layout" aria-pressed={layout==="list"} onClick={()=>setLayout("list")}><List size={18}/></button><button aria-label="Grid layout" aria-pressed={layout==="grid"} onClick={()=>setLayout("grid")}><LayoutGrid size={18}/></button></div></div>}
  <p className="er-material-count">{loading?"Updating scoped library…":`${total} materials in this filtered scope`} · {selected.length} explicitly selected · {excluded.length} excluded. Availability is not proof of use.</p>
  {error && <p className="er-error" role="status">{error}</p>}
  {loading ? <p role="status">Loading Exam Ready materials…</p> : <div className="er-resource-grid">{resources.filter(r=>r.mappings.some(m=>m.grade===grade&&(!subjectId||m.subjectId===subjectId)&&(!chapterId||m.chapterId===chapterId))).map(r=>{
   const currentVersion = (row: {sourceId:string;version:string}) => row.sourceId===r.id && row.version===r.version && !excluded.includes(r.id);
   const used = trace?.used.some(currentVersion), retrieved = trace?.retrieved.some(currentVersion);
   const Icon = r.resourceType==="video" ? Film : r.resourceType==="textbook" ? BookOpen : r.sourceType==="web" ? Globe : FileText;
   return <article className="er-resource-card" key={r.id}><button className="er-resource-preview" data-type={r.resourceType} onClick={()=>void open(r)} aria-label={`Open ${r.title}`}><span className="er-resource-type">{r.resourceType.replaceAll("-"," ")}</span><Icon size={32}/><span>{r.publisher||"Your material"}</span><div className="er-preview-lines"><i/><i/><i/></div></button><h4>{r.title}</h4><p>{r.description}</p><small>{r.visibility==="PRIVATE"?"My materials":"Scholar library"} · {r.state.replaceAll("_"," ")} · {r.indexedChunks} indexed passages{r.pages ? ` · ${r.pages} pages` : ""}</small><p className="er-muted">{used ? "Used in the saved explanation" : retrieved ? "Retrieved for the saved turn" : selected.includes(r.id) ? "Selected — not proof of use" : "Available — not proof of use"}</p><small>{r.reviewStatus} · {r.licenseType}</small><div className="er-resource-bottom"><button onClick={()=>void open(r)}>Open material</button>{r.state!=="LINK_ONLY" && <label><input type="checkbox" disabled={busy} checked={onPolicyChange ? !excluded.includes(r.id) && (r.visibility==="GLOBAL" && mode!=="personal" && mode!=="custom" || selected.includes(r.id)) : selected.includes(r.id)} onChange={e=>{
    const ids = e.target.checked ? [...new Set([...selected,r.id])].slice(0,12) : selected.filter(id=>id!==r.id);
    if(onPolicyChange) onPolicyChange(ids,e.target.checked ? excluded.filter(id=>id!==r.id) : [...new Set([...excluded,r.id])]); else onSelect(ids);
   }}/>{onPolicyChange ? "Include in teaching" : "Select / prioritise"}</label>}</div></article>;
  })}</div>}
  {!loading && !resources.length && <p>No readable material matches this scope yet. Select a different chapter or add your notes; no unrelated lesson will be substituted.</p>}
  <div className="er-actions"><button disabled={page<=1} onClick={()=>setPage(n=>n-1)}>Previous</button><small>{page}/{pages}</small><button disabled={page>=pages} onClick={()=>setPage(n=>n+1)}>Next</button><small>{selected.length} selected</small></div>
  {!guest && <details><summary><Upload size={14}/> Add private Exam Ready material</summary><p>PDF, PNG, JPEG or plain text, up to 3 MB. Choose one chapter for accurate ownership and retrieval. Files are not added to E-Books or Resources. OCR text requires review.</p><input aria-label="Exam Ready material file" type="file" accept="application/pdf,image/png,image/jpeg,text/plain" onChange={e=>setFile(e.target.files?.[0]??null)}/><button disabled={uploading || !file || !subjectId || !chapterId} onClick={()=>void upload()}>{uploading?"Processing request…":"Upload privately"}</button>{(!subjectId || !chapterId) && <p>Choose one chapter before uploading.</p>}</details>}
  {guest && <p className="er-muted">Sign in for private uploads. Guest material browsing does not use paid AI.</p>}
  {detail && <section className="er-material-preview" aria-label="Opened material"><button onClick={()=>setDetail(null)}><X size={16}/>Close material</button><h3>{detail.title}</h3><p>{detail.attributionText}</p><span className="er-pill">{detail.state.replaceAll("_"," ")}</span><p className="er-muted">{selected.includes(detail.id)?"Selected, not necessarily used in a lesson.":excluded.includes(detail.id)?"Excluded from teaching.":"Available within the current policy."}</p>{detail.state==="LINK_ONLY" && detail.canonicalUrl ? <a href={detail.canonicalUrl} target="_blank" rel="noopener noreferrer">Open external reference (not indexed)</a> : <ExamContent content={(text || "Reading saved content…").replace(/!\[([^\]]*)\]\([^)]*\)/g,"[Embedded image omitted — open the original material]")}/>} {detail.licenseUrl && <a href={detail.licenseUrl} target="_blank" rel="noopener noreferrer">Source license and attribution</a>}
   {detail.visibility==="PRIVATE" && <><a href={`/api/exam-ready/materials/${detail.id}?file=1`} target="_blank" rel="noopener noreferrer">Open original private file</a>{["FAILED","NEEDS_OCR"].includes(detail.state) && <button disabled={uploading} onClick={()=>void manage("retry")}>Retry processing</button>}{detail.state==="NEEDS_REVIEW" && <><p>Check every page and equation. Your review is not independent academic certification.</p><label>Page<input type="number" value={reviewPage} min={1} max={detail.pages||1} onChange={e=>{const p=Number(e.target.value);setReviewPage(p);if(Number.isInteger(p)&&p>=1&&p<=(detail.pages||1))void open(detail,p);}}/></label><label>Corrected page text<textarea value={reviewText} onChange={e=>setReviewText(e.target.value)} maxLength={20000}/></label><button disabled={uploading || reviewText.trim().length<30} onClick={()=>void manage("review")}>Save reviewed page</button></>}<button disabled={uploading} onClick={()=>void manage("remove")}>Remove my material from retrieval</button></>}
   <p className="er-muted">{detail.limitations.join(" ")}</p></section>}
 </div>;
}
