"use client";
import { useEffect,useRef,useState } from "react";
import type { LearningProfileView } from "./personalization-provider";
import { GlassSurface } from "@/components/liquid-glass/glass-surface";
import { GlassButton } from "@/components/liquid-glass/glass-button";
export function ImportStage({profile,onUploaded,onBusy}:{profile:LearningProfileView;onUploaded:()=>Promise<void>;onBusy:(busy:boolean)=>void}) {
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  const [books,setBooks]=useState<{id:string;title:string;processingStatus:string}[]>([]);
  const retry=useRef<{file:File;key:string}|null>(null);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{const controller=new AbortController();void fetch("/api/ebooks",{cache:"no-store",signal:controller.signal}).then(async response=>{if(response.ok){const data=await response.json();setBooks((data.ebooks ?? []).filter((b:{allocation?:string})=>b.allocation==="onboarding"));}}).catch(()=>{});return()=>controller.abort();},[]);
  const upload=async(file:File,key=crypto.randomUUID())=>{
    if(busy) return;
    if(file.type!=="application/pdf" || file.size>4*1024*1024){setMessage("Choose a PDF up to 4 MB. Larger material can be split into several PDFs.");return;}
    retry.current={file,key};setBusy(true);onBusy(true);setMessage("");
    try {
      const form=new FormData();form.set("file",file);form.set("allocation","onboarding");
      const response=await fetch("/api/ebooks",{method:"POST",headers:{"x-idempotency-key":key,"x-scholar-import":"initial-setup"},body:form,signal:AbortSignal.timeout(55_000)});
      const data=await response.json();if(!response.ok) throw new Error(data.message || "Your PDF could not be imported. No space was used.");
      setBooks(previous=>[...previous.filter(b=>b.id!==data.ebook.id),data.ebook]);retry.current=null;
      setMessage(data.ebook.processingStatus==="processing" ? "Saved privately. Extraction and chapter indexing continue in the background; you can continue setup." : data.ebook.processingStatus==="needs_ocr" ? "Saved. This scanned PDF needs OCR; extracted text may be incomplete." : "Imported and ready in Custom E-Books. It stays available after setup.");
      await onUploaded();
    }catch(e){setMessage(e instanceof Error && e.name!=="TimeoutError" ? e.message : "The connection interrupted. Retry this import to check its saved result without using space twice.");}
    finally {setBusy(false);onBusy(false);}
  };
  const remaining=Math.max(0,profile.bonus.total-profile.bonus.used);
  return <div className="your-scholar-import">
    <GlassSurface material="elevated" className="your-scholar-import-meter"><span>{profile.bonus.closed ? "Your original bonus is closed" : `${(remaining/1024/1024).toFixed(1)} MB available`}</span><p>Initial setup includes 50 MB of one-time bonus import space. Imported PDFs stay private and available; this is not recurring monthly storage.</p></GlassSurface>
    {profile.bonus.closed ? <p>Your saved material is still in Custom E-Books. Rebuilding preferences doesn't renew the initial allowance.</p> : <><input ref={input} type="file" accept="application/pdf" aria-label="Import study PDF" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value="";}}/><GlassButton variant="primary" disabled={busy || remaining===0} onClick={()=>input.current?.click()}>{busy ? "Reading your PDF…" : "Choose a study PDF"}</GlassButton><p className="your-scholar-note">Up to 4 MB and 500 pages per PDF. Notes, worksheets and textbooks are welcome. Scans may need OCR. No API keys needed.</p></>}
    <div role="status" aria-live="polite">{message}</div>
    {retry.current && !busy ? <GlassButton onClick={()=>{if(retry.current)void upload(retry.current.file,retry.current.key);}}>Retry this import</GlassButton> : null}
    <ul>{books.map(book=><li key={book.id}>{book.title} · {book.processingStatus==="processing" ? "Processing in background" : book.processingStatus==="failed" ? "Processing failed · check Resources" : book.processingStatus==="needs_ocr" ? "Needs OCR" : "Ready"}</li>)}</ul>
  </div>;
}
