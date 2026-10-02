"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, BookMarked, Check, ClipboardList, Download, ExternalLink, Eye, FileStack, FileText, Filter, FlaskConical, Globe, Library, Loader2, Play, Search, Sigma, Star, Upload, Video, X, Zap, type LucideIcon } from "lucide-react";
import { getCurriculum } from "@/lib/curriculum-helper";
import { useStore } from "@/lib/store";
import { navigateTo } from "@/lib/nav-event";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { toast } from "@/lib/notifications/notification-api";
import { ARTIFACT_TYPES, type ArtifactType } from "@/lib/resources/artifacts";
import type { IndexedChunk, ResourceRecord, ResourceResult } from "@/lib/resources/types";
import { ImportDialog, ResourceDetail } from "./resource-library";
import { canonicalResourceType, filterLibrary, libraryStats, loadResourcePages, readableSource } from "./library-presentation";
import "./classic-resources.css";

type Props = { subjectId?: string; chapterId?: string; type?: string; initialSearch?: string; initialResourceId?: string };
type Entry = ResourceResult["resources"][number];
type View = "library" | "favorites" | "downloads" | "recent";
type Sort = "recommended" | "newest" | "downloads" | "title";
const BACKGROUND = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4";
const TYPE_META: Record<string, { label: string; icon: LucideIcon; color: string; emoji: string }> = {
  notes: { label: "Notes", icon: FileText, color: "#818cf8", emoji: "📄" },
  textbook: { label: "NCERT Resources", icon: BookMarked, color: "#10b981", emoji: "📚" },
  "question-bank": { label: "Question Bank", icon: FileStack, color: "#38bdf8", emoji: "📂" },
  "sample-paper": { label: "Sample Paper", icon: ClipboardList, color: "#fb7185", emoji: "📖" },
  "past-paper": { label: "Past Papers", icon: ClipboardList, color: "#facc15", emoji: "🎯" },
  video: { label: "Video Reference", icon: Video, color: "#f87171", emoji: "🎥" },
  reference: { label: "Useful Website", icon: Globe, color: "#60a5fa", emoji: "🌐" },
  syllabus: { label: "CBSE Syllabus", icon: BookOpen, color: "#fbbf24", emoji: "📘" },
  simulation: { label: "Interactive Practical", icon: FlaskConical, color: "#4ade80", emoji: "🧪" },
  summary: { label: "Quick Revision", icon: Zap, color: "#fb923c", emoji: "⭐" },
  "formula-sheet": { label: "Formula Sheet", icon: Sigma, color: "#e879f9", emoji: "📈" },
  definitions: { label: "Definitions", icon: BookOpen, color: "#2dd4bf", emoji: "📖" },
  flashcards: { label: "Flashcards", icon: FileStack, color: "#c084fc", emoji: "🗂" },
  practice: { label: "Practice", icon: ClipboardList, color: "#22d3ee", emoji: "📝" },
};
const VIEWS: { id: View; label: string }[] = [
  { id: "library", label: "Library" }, { id: "favorites", label: "Favorites" },
  { id: "downloads", label: "Downloads" }, { id: "recent", label: "Recent" },
];

export function ClassicResourceLibrary(props: Props) {
  const identity = useStore(state => state.guestMode || !state.authed ? "guest" : state.user.email || state.user.username);
  const grade = useStore(state => state.user.scholarClass);
  return <ClassicLibrary key={`${identity}:${grade}`} {...props} grade={grade} identity={identity}/>;
}

function ClassicLibrary({ grade, identity, subjectId = "", chapterId = "", type: initialType = "", initialSearch = "", initialResourceId }: Props & { grade: 9 | 11; identity: string }) {
  const authed = useStore(state => state.authed && !state.guestMode);
  const bookmarks = useStore(state => state.bookmarks);
  const toggleBookmark = useStore(state => state.toggleBookmark);
  const [subject, setSubject] = useState(subjectId);
  const [chapter, setChapter] = useState(chapterId);
  const [type, setType] = useState(canonicalResourceType(initialType));
  const [search, setSearch] = useState(initialSearch);
  const [scope, setScope] = useState("all");
  const [view, setView] = useState<View>("library");
  const [sort, setSort] = useState<Sort>("recommended");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ResourceResult | null>(null);
  const [searchResult, setSearchResult] = useState<{ query: string; resources: Entry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string | null>(initialResourceId ?? null);
  const [importOpen, setImportOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [animatedBackground, setAnimatedBackground] = useState(false);
  const downloadController = useRef<AbortController | null>(null);
  const historyKey = `resource-library:${identity}`;
  const curriculum = getCurriculum(grade);
  const chapters = curriculum.find(item => item.id === subject)?.chapters ?? [];

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      function ids(key: string) {
        const stored = profileGetJSON<unknown>(grade, `${historyKey}:${key}`, []);
        return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string").slice(0, 500) : [];
      }
      setRecent(ids("recent")); setDownloads(ids("downloads"));
    });
    return () => { cancelAnimationFrame(frame); downloadController.current?.abort(); };
  }, [grade, historyKey]);

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAnimatedBackground(!motion.matches && document.visibilityState === "visible");
    const frame = requestAnimationFrame(update);
    motion.addEventListener("change", update); document.addEventListener("visibilitychange", update);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      loadResourcePages(new URLSearchParams({ grade: String(grade) }), controller.signal)
        .then(data => { if (!controller.signal.aborted) setResult(data); })
        .catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [grade, refresh]);

  const query = search.trim();
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true); setSearchError("");
      loadResourcePages(new URLSearchParams({ grade: String(grade), q: query }), controller.signal)
        .then(data => { if (!controller.signal.aborted) setSearchResult({ query, resources: data.resources }); })
        .catch(cause => { if (!controller.signal.aborted) { setSearchError(cause.message); setSearchResult({ query, resources: [] }); } })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [grade, query, refresh]);

  useEffect(() => {
    if (!result?.resources.some(resource => ["EXTRACTING", "CLASSIFYING", "INDEXING"].includes(resource.state))) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") setRefresh(value => value + 1); }, 5000);
    return () => clearInterval(timer);
  }, [result]);

  const catalog = result?.resources ?? [];
  const stats = libraryStats(catalog);
  const favorites = useMemo(() => new Set(bookmarks.filter(id => id.startsWith("resource:")).map(id => id.slice(9))), [bookmarks]);
  const downloaded = useMemo(() => new Set(downloads), [downloads]);
  const recentSet = useMemo(() => new Set(recent), [recent]);
  const pendingSearch = !!query && (searching || searchResult?.query !== query);
  const candidates = query ? searchResult?.query === query ? searchResult.resources : [] : catalog;
  const filtered = filterLibrary(candidates, { subject, chapter, type, scope, view, favorites, downloads: downloaded, recent: recentSet });
  if (view === "recent") filtered.sort((left, right) => recent.indexOf(left.id) - recent.indexOf(right.id));
  else if (sort === "title") filtered.sort((left, right) => left.title.localeCompare(right.title));
  else if (sort === "newest") filtered.sort((left, right) => (right.lastCheckedAt ?? "").localeCompare(left.lastCheckedAt ?? ""));
  else if (sort === "downloads") filtered.sort((left, right) => Number(downloaded.has(right.id)) - Number(downloaded.has(left.id)));
  const pages = Math.max(1, Math.ceil(filtered.length / 24));
  const activePage = Math.min(page, pages);
  const visible = filtered.slice((activePage - 1) * 24, activePage * 24);
  const shownError = error || (query ? searchError : "");

  function openResource(id: string) {
    setSelected(id);
    setRecent(previous => {
      const next = [id, ...previous.filter(value => value !== id)].slice(0, 50);
      profileSetJSON(grade, `${historyKey}:recent`, next); return next;
    });
  }
  async function downloadSource(resource: ResourceRecord) {
    if (!readableSource(resource) || downloading) return;
    const controller = new AbortController(); downloadController.current = controller; setDownloading(resource.id);
    try {
      const excerpts: IndexedChunk[] = []; let offset = 0; let more = true;
      while (more) {
        if (offset > 2000) throw new Error("This source is too large for a text download. Read it in the source reader instead.");
        const response = await fetch(`/api/resources/${encodeURIComponent(resource.id)}?offset=${offset}`, { signal: controller.signal, credentials: "same-origin" });
        const detail = await response.json() as { resource: ResourceRecord; chunks: IndexedChunk[]; hasMore: boolean; message?: string };
        if (!response.ok) throw new Error(detail.message ?? "Source download failed.");
        if (!readableSource(detail.resource)) throw new Error("This source is not available for copying.");
        if (detail.hasMore && !detail.chunks.length) throw new Error("Source excerpts are incomplete. Please retry.");
        excerpts.push(...detail.chunks); offset += detail.chunks.length; more = detail.hasMore;
      }
      if (!excerpts.length) throw new Error("No readable text is available. Open the original source instead.");
      const text = [resource.title, resource.publisher, resource.attributionText, resource.canonicalUrl, resource.licenseUrl, "Source text exported by Scholar; attribution and source license retained.", ...excerpts.map(chunk => `\n## ${chunk.heading}${chunk.page ? ` · page ${chunk.page}` : ""}\n${chunk.text}`)].filter(Boolean).join("\n\n");
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `${resource.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 100)}.txt`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloads(previous => { const next = [resource.id, ...previous.filter(id => id !== resource.id)]; profileSetJSON(grade, `${historyKey}:downloads`, next); return next; });
      toast.success("Source text downloaded", { description: "Attribution and license references are included." });
    } catch (cause) { if (!controller.signal.aborted) toast.error("Download failed", { description: (cause as Error).message }); }
    finally { if (!controller.signal.aborted) setDownloading(null); }
  }

  return <section className="classic-resources relative min-h-[calc(100vh-4rem)] overflow-hidden -m-4 lg:-m-6 text-white" aria-label="Resources">
    <div className="cr-background" aria-hidden="true">{animatedBackground && <video autoPlay loop muted playsInline preload="none" src={BACKGROUND}/>}</div>
    <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <nav className="cr-nav" aria-label="Resource library views">
        <div className="flex items-center gap-3"><div className="grid place-items-center h-9 w-9 rounded-xl bg-white/5 border border-white/10"><Library size={20}/></div><span className="font-semibold text-lg">Resources</span></div>
        <div className="cr-tabs">{VIEWS.map(tab => <button key={tab.id} aria-pressed={view === tab.id} onClick={() => { setView(tab.id); setPage(1); }} className={view === tab.id ? "is-active" : ""}>{tab.label}</button>)}</div>
        <div className="cr-glass cr-count"><Library size={14}/><strong>{loading && !result ? "…" : stats.resources}</strong> resources</div>
      </nav>
      <header className="mt-8 mb-8">
        <div className="cr-glass cr-eyebrow"><span/>DIGITAL ACADEMIC LIBRARY · CBSE CLASS {grade}</div>
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">Your complete <span className="cr-shiny">study library</span></h1>
        <p className="mt-4 text-white/60 max-w-lg text-sm leading-relaxed">{loading && !result ? "Loading your study library…" : `${stats.resources} resources across ${stats.subjects} subjects and ${stats.chapters} chapters — official textbooks, open notes, question banks, videos, and more.`}</p>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat icon={Library} label="Resources" value={stats.resources} accent="#818cf8"/>
        <Stat icon={BookOpen} label="Chapters" value={stats.chapters} accent="#10b981"/>
        <Stat icon={Star} label="Favorites" value={catalog.filter(resource => favorites.has(resource.id)).length} accent="#f59e0b"/>
        <Stat icon={Download} label="Downloaded" value={catalog.filter(resource => downloaded.has(resource.id)).length} accent="#0ea5e9"/>
      </div>
      <div className="cr-glass rounded-2xl p-4 mb-6 space-y-4">
        <label className="cr-search ri-search"><Search size={16}/><input id="aura-resources-search" aria-label="Search resources and indexed text" placeholder="Search by subject, chapter, keyword, or topic…" value={search} maxLength={160} onChange={event => { setSearch(event.target.value); setPage(1); }}/>{search && <button aria-label="Clear resource search" onClick={() => { setSearch(""); setPage(1); }}><X size={16}/></button>}</label>
        <div className="flex flex-wrap gap-2" aria-label="Filter by subject"><Chip label="All Subjects" active={!subject} onClick={() => { setSubject(""); setChapter(""); setPage(1); }}/>{curriculum.map(item => <Chip key={item.id} label={`${item.icon} ${item.name}`} accent={item.accent} active={subject === item.id} onClick={() => { setSubject(item.id); setChapter(""); setPage(1); }}/>)}</div>
        {subject && chapters.length > 0 && <div className="cr-chapters" aria-label="Filter by chapter"><Chip label="All Chapters" small active={!chapter} onClick={() => { setChapter(""); setPage(1); }}/>{chapters.map(item => <Chip key={item.id} label={item.title} small active={chapter === item.id} onClick={() => { setChapter(item.id); setPage(1); }}/>)}</div>}
        <div className="flex flex-wrap gap-1.5" aria-label="Filter by resource type"><Chip label="All Types" small active={!type} onClick={() => { setType(""); setPage(1); }}/>{Object.entries(TYPE_META).filter(([key]) => stats.types[key] || type === key).map(([key, meta]) => <Chip key={key} label={`${meta.emoji} ${meta.label}`} count={stats.types[key]} accent={meta.color} small active={type === key} onClick={() => { setType(key); setPage(1); }}/>)}</div>
        <div className="cr-sort"><span><Filter size={12}/> Sort:</span>{(["recommended", "newest", "downloads", "title"] as Sort[]).map(value => <button key={value} aria-pressed={sort === value} className={sort === value ? "is-active" : ""} onClick={() => { setSort(value); setPage(1); }}>{value === "recommended" ? "Recommended" : value === "newest" ? "Newest" : value === "downloads" ? "Downloaded first" : "A-Z"}</button>)}<label className="cr-scope"><span className="sr-only">Library scope</span><select aria-label="Library scope" value={scope} onChange={event => { setScope(event.target.value); setPage(1); }}><option value="all">All libraries</option><option value="built-in">Built-in</option><option value="personal" disabled={!authed}>My private imports</option></select></label><button className="cr-import" onClick={() => authed ? setImportOpen(true) : navigateTo("settings")}><Upload size={14}/>{authed ? "Import material" : "Sign in to import"}</button></div>
      </div>
      {shownError && <div className="ri-notice mb-4" role="alert">{shownError} <button className="ri-button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
      {result && !result.privateAvailable && <p className="ri-notice mb-4">Built-in resources are available. Your private index needs the database update or is temporarily unavailable; no private content was returned.</p>}
      <div className="cr-results" aria-live="polite">{loading && !result || pendingSearch ? <span><Loader2 size={14} className="animate-spin"/>Finding resources…</span> : <span>{filtered.length} resource{filtered.length !== 1 ? "s" : ""} found{view !== "library" ? ` in ${view}` : ""}{loading ? " · updating…" : ""}</span>}</div>
      <div className="cr-grid" aria-busy={loading || pendingSearch}>{visible.map(resource => <ResourceCard key={resource.id} resource={resource} favorite={favorites.has(resource.id)} downloaded={downloaded.has(resource.id)} downloading={downloading === resource.id} downloadsBusy={!!downloading} onFavorite={() => toggleBookmark(`resource:${resource.id}`)} onOpen={() => openResource(resource.id)} onDownload={() => void downloadSource(resource)}/>)}</div>
      {!visible.length && !loading && !pendingSearch && !shownError && <div className="cr-glass rounded-2xl p-10 text-center"><Library size={42} className="mx-auto text-white/25 mb-3"/><h2 className="text-white/70 font-medium">{view === "favorites" ? "No favorites yet" : view === "downloads" ? "No source text downloaded yet" : view === "recent" ? "No recently opened resources" : "No resources found"}</h2><p className="text-sm text-white/50 mt-2">{view === "library" ? "Try another filter or import your own material. Missing chapter content is not invented." : "Open the Library tab to explore, save, and study your resources."}</p><button className="ri-button mt-4" onClick={() => { setView("library"); setSearch(""); setSubject(""); setChapter(""); setType(""); setScope("all"); setPage(1); }}>Show library</button></div>}
      {pages > 1 && <nav className="ri-pagination" aria-label="Resource pages"><button className="ri-button" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>Previous</button><span>{activePage} / {pages}</span><button className="ri-button" disabled={activePage === pages} onClick={() => setPage(activePage + 1)}>Next</button></nav>}
    </div>
    <ResourceDetail key={selected ?? "closed"} id={selected} grade={grade} initialAid={ARTIFACT_TYPES.includes(type as ArtifactType) ? type as ArtifactType : undefined} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); setRefresh(value => value + 1); }}/>
    <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} grade={grade} onDone={id => { setImportOpen(false); openResource(id); setRefresh(value => value + 1); }}/>
  </section>;
}

function Stat({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: number; accent: string }) {
  return <div className="cr-glass rounded-xl p-3 flex items-center gap-3"><div className="grid place-items-center h-9 w-9 rounded-lg" style={{ background: `${accent}15` }}><Icon size={16} style={{ color: accent }}/></div><div><p className="text-lg font-bold leading-none">{value}</p><p className="text-[10px] uppercase tracking-wide text-white/45 mt-0.5">{label}</p></div></div>;
}

function Chip({ label, active, onClick, accent, count, small }: { label: string; active: boolean; onClick: () => void; accent?: string; count?: number; small?: boolean }) {
  return <button className={`cr-chip ${small ? "cr-chip-small" : ""}`} aria-pressed={active} onClick={onClick} style={active ? { background: accent ? `${accent}30` : "rgba(255,255,255,.1)", borderColor: accent ? `${accent}60` : "rgba(255,255,255,.2)" } : undefined}>{label}{count !== undefined && <span className="ml-1 opacity-60">({count})</span>}</button>;
}

function ResourceCard({ resource, favorite, downloaded, downloading, downloadsBusy, onFavorite, onOpen, onDownload }: { resource: Entry; favorite: boolean; downloaded: boolean; downloading: boolean; downloadsBusy: boolean; onFavorite: () => void; onOpen: () => void; onDownload: () => void }) {
  const meta = TYPE_META[resource.resourceType] ?? TYPE_META.reference;
  const Icon = meta.icon;
  const readable = readableSource(resource);
  const badge = resource.visibility === "PRIVATE" ? "PRIVATE" : resource.qualityStatus === "verified-official" ? "OFFICIAL" : "OPEN SOURCE";
  return <article className="cr-glass cr-card rounded-xl p-4 flex flex-col gap-3">
    <div className="flex items-start gap-3"><div className="grid place-items-center h-10 w-10 rounded-lg shrink-0" style={{ background: `${meta.color}15` }}><Icon size={20} style={{ color: meta.color }}/></div><div className="min-w-0 flex-1"><div className="cr-card-labels"><span style={{ color: meta.color }}>{meta.emoji} {meta.label}</span><span className={`cr-source-badge ${badge === "OFFICIAL" ? "cr-official" : ""}`}>{badge}</span></div><h2 className="text-sm font-semibold leading-snug mt-1"><button className="cr-title" onClick={onOpen}>{resource.title}</button></h2></div><button className="cr-star" aria-label={`${favorite ? "Unsave" : "Save"} ${resource.title}`} aria-pressed={favorite} onClick={onFavorite}><Star size={16} className={favorite ? "fill-amber-400 text-amber-400" : "text-white/40"}/></button></div>
    <p className="text-xs text-white/55 line-clamp-2 flex-1">{resource.description}</p>
    <div className="cr-card-info"><span>{resource.publisher}</span><span>{resource.state === "LINK_ONLY" ? "Original source · link only" : readable ? "Readable source text" : resource.state.toLowerCase().replace(/_/g, " ")}</span>{downloaded && <span className="text-emerald-400 flex items-center gap-1"><Check size={12}/> Downloaded</span>}</div>
    <div className="cr-card-actions"><button className="cr-open" style={{ background: meta.color }} onClick={onOpen}><Play size={13}/>{readable ? "Read & study" : "Open"}</button><button className="cr-action" aria-label={`Preview ${resource.title}`} title="Source details and study tools" onClick={onOpen}><Eye size={15}/></button>{resource.canonicalUrl && <a className="cr-action" href={resource.canonicalUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open original source for ${resource.title}`} title="Open original source"><ExternalLink size={15}/></a>}{readable && <button className="cr-action" disabled={downloadsBusy} aria-label={`Download source text for ${resource.title}`} title="Download source text with attribution" onClick={onDownload}>{downloading ? <Loader2 size={15} className="animate-spin"/> : <Download size={15}/>}</button>}</div>
  </article>;
}
