"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { BookOpen, FileText, Film, Globe, Image as ImageIcon, Search, Upload } from "lucide-react";
import { examRequest } from "./use-session";
import type { ResourceRecord } from "@/lib/resources/types";
const ImportDialog = dynamic(() => import("@/components/resources/resource-library").then(m => m.ImportDialog));
const ResourceDetail = dynamic(() => import("@/components/resources/resource-library").then(m => m.ResourceDetail));
export function Materials({ grade, guest, selected, onSelect, mode = "all", subjectId, chapterId, compact = false, busy = false, shortTime = false }: {
    grade: 9 | 11;
    guest: boolean;
    selected: string[];
    onSelect: (ids: string[]) => void;
    mode?: string;
    subjectId?: string;
    chapterId?: string;
    compact?: boolean;
    busy?: boolean;
    shortTime?: boolean;
}) {
    const [resources, setResources] = useState<ResourceRecord[]>([]), [error, setError] = useState(""), [q, setQ] = useState(""), [type, setType] = useState(""), [page, setPage] = useState(1), [pages, setPages] = useState(1), [scope, setScope] = useState(guest ? "built-in" : "all"), [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true), [importOpen, setImportOpen] = useState(false), [detail, setDetail] = useState<string | null>(null), [scan, setScan] = useState(false);
    useEffect(() => { const controller = new AbortController(); const timeout = setTimeout(() => { setLoading(true); const params = new URLSearchParams({ grade: String(grade), scope: mode === "personal" ? "personal" : mode === "scholar" || mode === "scholar-web" ? "built-in" : scope, q, page: String(page), limit: "8" }); if (subjectId)
        params.set("subjectId", subjectId); if (type && !(shortTime && type === "video")) params.set("type", type); if (chapterId)
        params.set("chapterId", chapterId); fetch(`/api/resources?${params}`, { signal: controller.signal, cache: "no-store" }).then(async (r) => { const v = await r.json(); if (!r.ok)
        throw new Error(v.message ?? "Resources unavailable"); setResources(v.resources); setPages(v.pages); setError(v.privateAvailable === false && scope !== "built-in" ? "Private materials are unavailable until the resource database is configured." : ""); }).catch(e => { if (!controller.signal.aborted)
        setError(e.message); }).finally(() => { if (!controller.signal.aborted)
        setLoading(false); }); }, q ? 250 : 0); return () => { clearTimeout(timeout); controller.abort(); }; }, [grade, q, type, page, scope, refresh, mode, subjectId, chapterId, shortTime]);
    const visible = shortTime ? resources.filter(r => r.resourceType !== "video") : resources;
    return <div className={`er-materials ${compact ? "er-materials-compact" : ""}`}>{shortTime && <p className="er-muted">Short sprint: videos are hidden. Use targeted formulas, examples and questions rather than opening a long lecture.</p>}<div className="er-resource-filters" aria-label="Resource type filters">{[["", "All materials"], ["notes", "Notes"], ["textbook", "Textbooks"], ["video", "Videos"], ["past-paper", "Previous papers"], ["formula-sheet", "Formulas"]].filter(([value]) => !shortTime || value !== "video").map(([value, label]) => <button key={value} aria-pressed={(shortTime && type === "video" ? "" : type) === value} onClick={() => { setType(value); setPage(1); }}>{label}</button>)}</div><div className="er-resource-toolbar"><label><span><Search size={14}/> Find material</span><input placeholder="Search notes, PDFs, videos…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }}/></label><label>Library<select value={mode === "personal" ? "personal" : mode === "scholar" || mode === "scholar-web" ? "built-in" : scope} onChange={e => { setScope(e.target.value); setPage(1); }} disabled={mode === "personal" || mode === "scholar" || mode === "scholar-web"}><option value="built-in">Scholar / curated open web</option>{!guest && <><option value="personal">Your uploads</option><option value="all">All permitted sources</option></>}</select></label><button onClick={() => setRefresh(n => n + 1)}>Refresh</button>{!guest && <><button className="er-primary" onClick={() => setImportOpen(true)}><Upload size={15}/> Upload / paste</button><button onClick={() => setScan(!scan)}><ImageIcon size={15}/> Scan image</button></>}</div>
  {scan && <ImageScan grade={grade} onDone={() => { setScan(false); setRefresh(n => n + 1); }}/>}{error && <p className="er-error" role="status">{error}</p>}{loading ? <div className="er-resource-grid" role="status" aria-label="Retrieving permitted materials">{[0,1,2].map(i => <div className="er-resource-skeleton" key={i}/>)}</div> : visible.length ? <div className="er-resource-grid">{visible.map(r => { const Icon = r.resourceType === "video" ? Film : r.resourceType === "textbook" ? BookOpen : r.sourceType === "web" ? Globe : FileText; return <article className="er-resource-card" key={r.id}><button className="er-resource-preview" data-type={r.resourceType} onClick={() => setDetail(r.id)} aria-label={`Open ${r.title}`}><span className="er-resource-type">{r.resourceType.replaceAll("-", " ")}</span><Icon size={32}/><span>{r.publisher || "Your material"}</span><div className="er-preview-lines"><i/><i/><i/></div></button><h4>{r.title}</h4><p>{r.description || "Open this material to inspect its available content."}</p><small>{r.state === "LINK_ONLY" ? "Original source link · not indexed text" : r.state.replaceAll("_", " ")}{r.visibility === "PRIVATE" ? " · Private" : " · Shared"}</small><div className="er-resource-bottom"><label><input type="checkbox" disabled={busy || !selected.includes(r.id) && selected.length >= 12} checked={selected.includes(r.id)} onChange={e => onSelect(e.target.checked ? [...selected, r.id] : selected.filter(id => id !== r.id))}/> {selected.includes(r.id) ? "In preparation" : "Use this source"}</label><button onClick={() => setDetail(r.id)}>Open →</button></div></article>; })}</div> : <div className="er-empty-state"><BookOpen/><strong>No matching material on this page.</strong><p>Try the next page or another filter, upload readable notes, or explicitly change the material mode. LAM can teach from general knowledge only when your chosen mode permits it.</p></div>}
  <div className="er-actions"><button disabled={page <= 1} onClick={() => setPage(n => n - 1)}>Previous</button><small>{page} / {pages}</small><button disabled={page >= pages} onClick={() => setPage(n => n + 1)}>Next</button><small>{selected.length} selected</small></div>
  {importOpen && <ImportDialog open onClose={() => setImportOpen(false)} grade={grade} onDone={id => { setImportOpen(false); if (id && !selected.includes(id))
        onSelect([...selected, id].slice(0, 12)); setRefresh(n => n + 1); }} onPdfDone={() => { setImportOpen(false); setRefresh(n => n + 1); }}/>}
  {detail && <ResourceDetail id={detail} grade={grade} onClose={() => setDetail(null)} onChanged={() => setRefresh(n => n + 1)}/>}
  </div>;
}
function ImageScan({ grade, onDone }: {
    grade: 9 | 11;
    onDone: () => void;
}) {
    const [file, setFile] = useState<File | null>(null), [text, setText] = useState(""), [confidence, setConfidence] = useState<number | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
    async function scan() { if (!file)
        return; setBusy(true); setError(""); try {
        const form = new FormData();
        form.set("file", file);
        form.set("feature", "homework_scanner");
        const r = await fetch("/api/ocr", { method: "POST", body: form, signal: AbortSignal.timeout(50000) }), v = await r.json();
        if (!r.ok)
            throw new Error(v.error ?? v.message ?? "OCR is unavailable");
        setText(v.text);
        setConfidence(v.confidence);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function save() { setBusy(true); try {
        await examRequest("/api/resources", { title: file?.name ?? "Reviewed scan", text, grade });
        onDone();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <div className="er-callout"><h3>Review an image scan</h3><p>Uses Scholar’s existing OCR access rules. Scan quality is not proof of correctness. Check equations, symbols and units yourself; diagrams are not reconstructed.</p><label>Image (PNG / JPEG / WebP, up to 10 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)}/></label><button disabled={busy || !file} onClick={scan}>{busy ? "Working…" : "Extract text"}</button>{confidence !== null && <><p>OCR confidence: {confidence}% · {confidence < 80 ? "Low quality: consider a clearer scan." : "Review before saving."}</p><label>Extracted text<textarea rows={6} value={text} onChange={e => setText(e.target.value)} maxLength={250000}/></label><button disabled={busy || text.trim().length < 40} onClick={save}>I reviewed this — save privately</button></>}{error && <p role="alert">{error}</p>}</div>;
}
