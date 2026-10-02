"use client";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Bookmark, ExternalLink, FileText, Loader2, Search, Upload, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { getCurriculum } from "@/lib/curriculum-helper";
import { navigateTo } from "@/lib/nav-event";
import { askAI } from "@/lib/ai";
import { toast } from "@/lib/notifications/notification-api";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { RESOURCE_TYPES, type IndexedChunk, type ResourceRecord, type ResourceResult } from "@/lib/resources/types";
import { ARTIFACT_TYPES, type ArtifactType, type StudyArtifact } from "@/lib/resources/artifacts";
import "./resources.css";

type LibraryProps = { grade?: 9 | 11; subjectId?: string; chapterId?: string; type?: string; compact?: boolean; title?: string; aid?: ArtifactType; initialSearch?: string; initialResourceId?: string };
async function jsonRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, credentials: "same-origin" });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? "Resource request failed. Please retry.");
  return json;
}
export function ResourceLibrary(props: LibraryProps) {
  const scope = useStore(s => s.guestMode || !s.authed ? "guest" : s.user.email || s.user.username);
  const grade = useStore(s => s.user.scholarClass);
  return <Library key={`${scope}:${props.grade ?? grade}:${props.subjectId ?? ""}:${props.chapterId ?? ""}:${props.type ?? ""}:${props.aid ?? ""}`} {...props} grade={props.grade ?? grade}/>;
}
export const ResourceShelf = (props: LibraryProps) => <ResourceLibrary {...props} compact/>;

function Library({ grade = 11, subjectId: fixedSubject, chapterId: fixedChapter, type: fixedType, compact, title, aid, initialSearch = "", initialResourceId }: LibraryProps) {
  const authed = useStore(s => s.authed && !s.guestMode);
  const bookmarks = useStore(s => s.bookmarks); const toggleBookmark = useStore(s => s.toggleBookmark);
  const [search, setSearch] = useState(initialSearch); const [subject, setSubject] = useState(fixedSubject ?? ""); const [chapter, setChapter] = useState(fixedChapter ?? "");
  const [type, setType] = useState(fixedType ?? ""); const [scope, setScope] = useState("all"); const [saved, setSaved] = useState(false);
  const [page, setPage] = useState(1); const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<ResourceResult | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(initialResourceId ?? null); const [importOpen, setImportOpen] = useState(false);
  const curriculum = getCurriculum(grade); const chapters = curriculum.find(s => s.id === subject)?.chapters ?? [];
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      const query = new URLSearchParams({ grade: String(grade), limit: compact ? "3" : "12", page: String(page), scope });
      if (search) query.set("q", search); if (subject) query.set("subjectId", subject); if (chapter) query.set("chapterId", chapter); if (type || aid) query.set("type", type || aid!);
      jsonRequest(`/api/resources?${query}`, { signal: controller.signal }).then(setResult).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [grade, subject, chapter, type, page, search, scope, compact, refresh, aid]);
  useEffect(() => {
    if (!result?.resources.some(r => ["EXTRACTING", "CLASSIFYING", "INDEXING"].includes(r.state))) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") setRefresh(r => r + 1); }, 5000);
    return () => clearInterval(timer);
  }, [result]);
  const resources = result?.resources.filter(r => !saved || bookmarks.includes(`resource:${r.id}`)) ?? [];
  return <section className={`ri-library ${compact ? "ri-compact" : ""}`} aria-label={title ?? "Resource library"}>
    <div className="ri-heading"><div><span className="ri-eyebrow">SCHOLAR / KNOWLEDGE LIBRARY</span><h2>{title ?? (compact ? "Learn from real sources." : "Your Resource Vault")}</h2><p>{aid ? "Source-linked study aids, with excerpts you can verify." : "Official links, open study text and your private imports. One chapter-aware library."}</p></div>
      {!compact && <button className="ri-button" onClick={() => authed ? setImportOpen(true) : navigateTo("settings")}><Upload size={16}/>{authed ? "Import material" : "Sign in to import"}</button>}
      {compact && <button className="ri-button" onClick={() => { sessionStorage.setItem("scholar:resources:target", JSON.stringify({ subjectId: subject, chapterId: chapter, type, q: search })); navigateTo("resources"); }}>Explore library <BookOpen size={15}/></button>}
    </div>
    {!compact && <div className="ri-filters">
      <label className="ri-search"><Search size={16}/><input aria-label="Search resources and indexed text" placeholder="Search titles, topics and source text…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/></label>
      {!fixedSubject && <select aria-label="Filter resource subject" value={subject} onChange={e => { setSubject(e.target.value); setChapter(""); setPage(1); }}><option value="">All subjects</option>{curriculum.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
      {!fixedChapter && <select aria-label="Filter resource chapter" value={chapter} onChange={e => { setChapter(e.target.value); setPage(1); }} disabled={!subject}><option value="">All chapters</option>{chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>}
      {!fixedType && <select aria-label="Filter resource type" value={type} onChange={e => { setType(e.target.value); setPage(1); }}><option value="">All resource types</option>{RESOURCE_TYPES.map(t => <option key={t} value={t}>{t.replace(/-/g, " ")}</option>)}</select>}
      <select aria-label="Library scope" value={scope} onChange={e => { setScope(e.target.value); setPage(1); }}><option value="all">All libraries</option><option value="built-in">Built-in</option><option value="personal" disabled={!authed}>My private imports</option></select>
      <button className="ri-button" aria-pressed={saved} onClick={() => setSaved(!saved)}><Bookmark size={15}/>{saved ? "Showing saved" : "Saved on this page"}</button>
    </div>}
    {error && <p className="ri-notice" role="alert">{error} <button className="ri-button" onClick={() => setRefresh(r => r + 1)}>Retry</button></p>}
    {result && !result.privateAvailable && <p className="ri-notice">Built-in sources are available. Your private index needs the resource database update or is temporarily unavailable; no private content was returned.</p>}
    {loading && !result ? <div className="ri-skeleton" role="status"><Loader2 size={20}/> Finding chapter resources…</div> : <>
      <div className="ri-results" aria-live="polite"><span>{result?.total ?? 0} matching sources {loading ? "· updating…" : ""}</span></div>
      <div className="ri-grid">{resources.map(r => <article className="ri-card" key={r.id}>
        <div className="ri-card-meta"><span>{r.resourceType.replace(/-/g, " ")}</span><button className="ri-icon-button" aria-label={`${bookmarks.includes(`resource:${r.id}`) ? "Unsave" : "Save"} ${r.title}`} aria-pressed={bookmarks.includes(`resource:${r.id}`)} onClick={() => toggleBookmark(`resource:${r.id}`)}><Bookmark size={16}/></button></div>
        <button className="ri-card-title" onClick={() => setSelected(r.id)}>{r.title}</button><p>{r.description}</p>
        <div className="ri-provenance"><strong>{r.publisher}</strong><span>{r.visibility === "PRIVATE" ? "Private · only you" : r.qualityStatus === "verified-official" ? "Official source" : "Supplemental source"}</span><span>{r.state === "LINK_ONLY" ? "Original source · link only" : r.state === "READY" ? "Readable and indexed" : r.state.toLowerCase().replace(/_/g, " ")}</span><span>{r.reason}</span></div>
        <div className="ri-card-actions"><button className="ri-button ri-primary" onClick={() => setSelected(r.id)}>{aid && r.canGenerateDerivatives ? `Open ${aid}` : r.canStoreCopy ? "Read & study" : "Source details"}<BookOpen size={15}/></button>{r.canonicalUrl && <a className="ri-button" href={r.canonicalUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open original source for ${r.title}`}><ExternalLink size={15}/></a>}</div>
      </article>)}</div>
      {!resources.length && !error && <div className="ri-empty"><BookOpen/><h3>{scope === "personal" ? "Your private library starts here." : "No sources match these filters."}</h3><p>{scope === "personal" ? "Import a PDF, text note or source link. It stays in your account." : "Try a broader topic or another type. Scholar will not invent unavailable chapter material."}</p><button className="ri-button" onClick={() => { setSearch(""); setType(fixedType ?? ""); setPage(1); }}>Reset search</button></div>}
      {!compact && result && result.pages > 1 && <nav className="ri-pagination" aria-label="Resource pages"><button className="ri-button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>{result.page} / {result.pages}</span><button className="ri-button" disabled={page >= result.pages} onClick={() => setPage(p => p + 1)}>Next</button></nav>}
    </>}
    <ResourceDetail key={selected ?? "closed"} id={selected} grade={grade} initialAid={aid ?? (ARTIFACT_TYPES.includes(type as ArtifactType) ? type as ArtifactType : undefined)} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); setRefresh(r => r + 1); }}/>
    <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} grade={grade} onDone={id => { setImportOpen(false); setSelected(id); setRefresh(r => r + 1); }}/>
  </section>;
}

export function ResourceDetail({ id, grade, initialAid, onClose, onChanged }: { id: string | null; grade: 9 | 11; initialAid?: ArtifactType; onClose: () => void; onChanged: () => void }) {
  const opener = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<{ resource: ResourceRecord; chunks: IndexedChunk[]; hasMore: boolean; job?: { errorCode?: string } } | null>(null);
  const [offset, setOffset] = useState(0); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [studyAid, setStudyAid] = useState<StudyArtifact | null>(null); const [answer, setAnswer] = useState(""); const [question, setQuestion] = useState("");
  const [subject, setSubject] = useState(""); const [chapter, setChapter] = useState(""); const [revealed, setRevealed] = useState<number[]>([]);
  const authed = useStore(s => s.authed && !s.guestMode); const addNote = useStore(s => s.addNote);
  useEffect(() => {
    if (!id) return; const controller = new AbortController();
    jsonRequest(`/api/resources/${encodeURIComponent(id)}?offset=${offset}`, { signal: controller.signal }).then(data => { setDetail(data); setSubject(data.resource.mappings[0]?.subjectId ?? ""); setChapter(data.resource.mappings[0]?.chapterId ?? ""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id, offset]);
  async function makeAid(type: ArtifactType) { if (!id) return; setBusy(true); setError(""); setRevealed([]); try { const result = await jsonRequest(`/api/resources/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }) }); setStudyAid(result.artifact); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function ask() { if (!detail || !question.trim() || busy) return; setBusy(true); setError(""); try { const response = await askAI(question, "default", { resourceContext: { resourceIds: [detail.resource.id], subjectId: subject, chapterId: chapter } }); setAnswer(response); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const resource = detail?.resource; const curriculum = getCurriculum(grade);
  function saveNote() { if (!resource) return; const text = studyAid ? studyAid.items.map(i => `## ${i.front}\n${i.back}\nSource: ${i.citation.title}, ${i.citation.heading}${i.citation.page ? `, page ${i.citation.page}` : ""}`).join("\n\n") : detail!.chunks.map(c => `## ${c.heading}\n${c.text}`).join("\n\n"); addNote({ id: crypto.randomUUID(), title: `${resource.title} · source notes`, content: `${text}\n\n${resource.attributionText}\n${resource.canonicalUrl ?? "Private Scholar upload"}\n${resource.licenseUrl ?? ""}`, folder: "", tags: ["source-derived", subject, chapter].filter(Boolean), color: "cyan", pinned: false, createdAt: Date.now(), updatedAt: Date.now(), versions: [] }); toast.success("Source notes saved", { description: "Your original notes were kept. Attribution and references are included." }); }
  return <Dialog open={!!id} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="ri-dialog sm:max-w-4xl" onOpenAutoFocus={() => { opener.current = document.activeElement as HTMLElement; }} onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus(); else document.querySelector<HTMLInputElement>('.ri-search input')?.focus(); }}><DialogTitle>{resource?.title ?? "Resource details"}</DialogTitle><DialogDescription>Provenance, chapter mapping and source-linked study tools.</DialogDescription>
    {error && <p role="alert" className="ri-notice">{error}</p>}{!resource && !error && <p role="status">Loading source…</p>}
    {resource && <div className="ri-detail">
      <div className="ri-source-info"><strong>{resource.publisher} · {resource.visibility === "PRIVATE" ? "Only you" : "Built-in source"}</strong><p>{resource.attributionText}</p>{resource.licenseUrl && <a href={resource.licenseUrl} target="_blank" rel="noopener noreferrer">{resource.licenseType}</a>}<p>{resource.lastCheckedAt ? `Source verified ${new Date(resource.lastCheckedAt).toLocaleDateString()}` : "User-provided material; not academically verified"}</p>{resource.confidence !== undefined && resource.visibility === "PRIVATE" && <p>Mapping confidence: {Math.round(resource.confidence * 100)}% · please review inferred chapters.</p>}</div>
      <div className="ri-card-actions">{resource.canonicalUrl && <a className="ri-button ri-primary" href={resource.canonicalUrl} target="_blank" rel="noopener noreferrer">Open original <ExternalLink size={15}/></a>}{resource.ebookId && resource.state === "READY" && <button className="ri-button" onClick={() => { sessionStorage.setItem("scholar:ebook:custom-target", resource.ebookId!); navigateTo("ebook"); onClose(); }}>Open private E-Book</button>}</div>
      {!resource.canStoreCopy && <p className="ri-notice">Link-only source. Scholar has not copied its content and will not pretend to summarize it. Open the original to study; add your own notes separately.</p>}
      {["EXTRACTING", "CLASSIFYING", "INDEXING", "FAILED", "REJECTED"].includes(resource.state) && <p className="ri-notice">{["EXTRACTING", "CLASSIFYING", "INDEXING"].includes(resource.state) ? `Processing: ${resource.state.toLowerCase()}. Refresh the source after a moment.` : `Processing ${resource.state.toLowerCase()}: ${detail?.job?.errorCode ?? "check your file"}`}<button className="ri-button" onClick={onChanged}>Refresh library</button>{resource.state === "FAILED" && <button className="ri-button" onClick={async () => { try { await jsonRequest(`/api/resources/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: '{"retry":true}' }); onChanged(); } catch (e) { setError((e as Error).message); } }}>Retry extraction</button>}</p>}
      {resource.sourceMetadata?.needsOcr === true && <p className="ri-notice">Scanned PDF: OCR is not available on the server. Re-export searchable text or paste your notes. No complete study aids are claimed.</p>}
      {resource.visibility === "PRIVATE" && <div className="ri-filters"><label>Map to chapter</label><select aria-label="Choose mapping subject" value={subject} onChange={e => { setSubject(e.target.value); setChapter(""); }}><option value="">Choose subject</option>{curriculum.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select aria-label="Choose mapping chapter" value={chapter} onChange={e => setChapter(e.target.value)} disabled={!subject}><option value="">Whole subject</option>{curriculum.find(s => s.id === subject)?.chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select><button className="ri-button" disabled={!subject || busy} onClick={async () => { try { await jsonRequest(`/api/resources/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapping: { curriculumId: "cbse", grade, subjectId: subject, chapterId: chapter } }) }); onChanged(); } catch (e) { setError((e as Error).message); } }}>Save mapping</button></div>}
      {!!detail?.chunks.length && <>
        <div className="ri-card-actions">{ARTIFACT_TYPES.map(type => <button className="ri-button" disabled={busy} key={type} onClick={() => makeAid(type)}>{type.replace(/-/g, " ")}{initialAid === type ? " · recommended" : ""}</button>)}<button className="ri-button" onClick={saveNote}><FileText size={15}/>Copy excerpts to my Notes</button></div>
        {busy && <p role="status"><Loader2 className="inline animate-spin" size={16}/> Preparing source-linked response…</p>}
        {studyAid && <section className="ri-aid"><h3>{studyAid.type.replace(/-/g, " ")}</h3><p>Generated by Scholar from source excerpts · {studyAid.quality} · {studyAid.license}</p>{studyAid.items.length ? studyAid.items.map((item, i) => <article className="ri-excerpt" key={i}><h4>{item.front}</h4>{["flashcards", "practice"].includes(studyAid.type) && !revealed.includes(i) ? <button className="ri-button" onClick={() => setRevealed(r => [...r, i])}>Reveal source answer</button> : <ScholarAIContent className="ri-source-text" content={item.back} normalizeLegacy={false}/>}<small>{item.citation.title} · {item.citation.heading}{item.citation.page ? ` · p. ${item.citation.page}` : ""}</small></article>) : <p>No source-backed {studyAid.type.replace(/-/g, " ")} items were found. Read the original or ask LAM; no content was invented.</p>}</section>}
        <details open={!studyAid}><summary>Read source excerpts</summary>{detail.chunks.map(c => <article className="ri-excerpt" key={c.ordinal}><h3>{c.heading}{c.page ? ` · page ${c.page}` : ""}</h3><ScholarAIContent className="ri-source-text" content={c.text} normalizeLegacy={false}/></article>)}</details>
        <div className="ri-pagination"><button className="ri-button" disabled={offset === 0} onClick={() => setOffset(n => Math.max(0, n - 12))}>Previous excerpts</button><button className="ri-button" disabled={!detail.hasMore} onClick={() => setOffset(n => n + 12)}>More excerpts</button></div>
        <form className="ri-lam-form" onSubmit={e => { e.preventDefault(); void ask(); }}><label htmlFor="ri-lam-question">Ask LAM about this source</label><div><input id="ri-lam-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={2000} placeholder="Explain a concept using these sources…"/><button className="ri-button ri-primary" disabled={busy || !authed || !question.trim()}><Sparkles size={16}/>{authed ? "Ask LAM" : "Sign in to ask"}</button></div></form>{answer && <ScholarAIContent content={answer}/>}
      </>}
      {resource.visibility === "PRIVATE" && <button className="ri-button ri-danger" onClick={async () => { if (!confirm("Remove this private resource and its indexed text? Copied notes remain yours.")) return; try { await jsonRequest(`/api/resources/${id}`, { method: "DELETE" }); onChanged(); } catch (e) { setError((e as Error).message); } }}>Remove private resource</button>}
    </div>}
  </DialogContent></Dialog>;
}
export function ImportDialog({ open, onClose, grade, onDone, onPdfDone }: { open: boolean; onClose: () => void; grade: 9 | 11; onDone: (id: string) => void; onPdfDone?: () => void }) {
  const [mode, setMode] = useState("file"); const [title, setTitle] = useState(""); const [value, setValue] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit() {
    setBusy(true); setError("");
    try {
      if (mode === "file") {
        if (!file) throw new Error("Choose a PDF, TXT or Markdown file.");
        const form = new FormData(); form.set("file", file); form.set("title", title || file.name); form.set("grade", String(grade));
        const pdf = /\.pdf$/i.test(file.name);
        const response = await jsonRequest(pdf ? "/api/ebooks" : "/api/resources", { method: "POST", headers: pdf ? { "x-idempotency-key": crypto.randomUUID() } : {}, body: form });
        if (pdf) { onClose(); if (onPdfDone) onPdfDone(); else navigateTo("ebook"); } else onDone(response.id);
      } else { const response = await jsonRequest("/api/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title || (mode === "url" ? "Saved source link" : "Study notes"), [mode]: value, grade }) }); onDone(response.id); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent className="ri-dialog"><DialogTitle>Import private study material</DialogTitle><DialogDescription>Only your account can access these resources. PDF: 4 MB / 500 pages. TXT and Markdown: 250 KB. Public URLs are saved as links, not scraped for study content.</DialogDescription><div className="ri-card-actions">{["file", "text", "url"].map(m => <button className="ri-button" key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{m}</button>)}</div><label className="ri-field">Title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={180}/></label>{mode === "file" ? <label className="ri-field">Study file<input type="file" accept=".pdf,.txt,.md" onChange={e => setFile(e.target.files?.[0] ?? null)}/></label> : <label className="ri-field">{mode === "url" ? "Public HTTPS URL" : "Your notes"}<textarea value={value} onChange={e => setValue(e.target.value)} maxLength={mode === "url" ? 2000 : 250_000} rows={mode === "url" ? 2 : 8}/></label>}{error && <p role="alert">{error}</p>}<button className="ri-button ri-primary" disabled={busy} onClick={submit}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>}Import to my library</button></DialogContent></Dialog>;
}
