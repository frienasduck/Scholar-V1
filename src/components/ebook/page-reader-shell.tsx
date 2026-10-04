"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Eye, Maximize2, PanelLeft, PenLine, Search, Sparkles, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { BookModeSearchPage } from "./book-mode-reader";

type Props = {
  title: string; page: number; totalPages: number;
  chapters: { title: string; page: number }[]; bookmarked: boolean; textReady: boolean;
  renderPage: (widthPercent: number) => ReactNode; tools: ReactNode; status: string;
  onClose: () => void; onPage: (page: number) => void; onBookmark: () => void;
  onOCR: () => void; onAsk: () => void; onBookMode: () => void;
  onSearch: (query: string, signal: AbortSignal) => Promise<BookModeSearchPage[]>;
};

/** The familiar Scholar scan reader, also used by private uploaded books. */
export function PageReaderShell(props: Props) {
  const [sidebar, setSidebar] = useState<boolean | null>(null);
  const [zoom, setZoom] = useState(100);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<BookModeSearchPage[]>([]);
  const [searchState, setSearchState] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const currentChapter = props.chapters.filter(item => item.page <= props.page).at(-1)?.title;
  useEffect(() => { stage.current?.scrollIntoView({ block: "start", behavior: "auto" }); }, [props.page]);
  useEffect(() => {
    const controller = new AbortController();
    if (search.trim().length < 2) return;
    const timer = setTimeout(() => {
      setSearchState("Searching saved page text…");
      void props.onSearch(search, controller.signal).then(value => { if (!controller.signal.aborted) { setResults(value); setSearchState(value.length ? "" : "No matching text. Scanned pages must be OCR'd and saved first."); } }).catch(() => { if (!controller.signal.aborted) setSearchState("Search is unavailable. Please retry."); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, props.onSearch]);
  const control = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.035] px-3 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-200 disabled:opacity-40";
  return <section className="-m-3 min-w-0 bg-[#070a10] text-white md:-m-5" aria-label={`${props.title} reader`}>
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#080b12]/95 p-3 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-2"><button onClick={props.onClose} className={control}><ArrowLeft size={17} />Library</button><button aria-label="Toggle chapter and page navigation" aria-expanded={sidebar ?? undefined} className={control} onClick={() => setSidebar(value => value === null ? !window.matchMedia("(min-width: 768px)").matches : !value)}><PanelLeft size={18} /></button><span className="text-sm text-white/60">Pg {props.page}</span></div>
      <div className="flex max-w-full items-center gap-1 overflow-x-auto"><button className={control} aria-label="Zoom out" disabled={zoom <= 75} onClick={() => setZoom(value => value - 25)}><ZoomOut size={18} /></button><span className="w-12 text-center text-sm text-white/60">{zoom}%</span><button className={control} aria-label="Zoom in" disabled={zoom >= 200} onClick={() => setZoom(value => value + 25)}><ZoomIn size={18} /></button><button className={control} onClick={() => setZoom(100)}>Fit width</button><button className={control} onClick={props.onBookMode} title="Immersive book mode" aria-label="Immersive book mode"><Maximize2 size={18} /></button><button className={control} aria-label="Study tools" onClick={() => setToolsOpen(true)}><BookOpen size={18} /><span className="hidden sm:inline">Study tools</span></button></div>
    </header>
    <div className="flex min-w-0 flex-col md:flex-row">
      {sidebar !== false && <aside className={`${sidebar === null ? "hidden md:block" : ""} max-h-80 shrink-0 overflow-y-auto border-b border-white/10 bg-[#0b0d16] p-3 md:sticky md:top-[70px] md:max-h-[calc(100dvh-170px)] md:w-64 md:border-b-0 md:border-r xl:w-72`} aria-label="Chapters and pages">
        <h2 className="mb-3 break-words font-semibold">{props.title}</h2>
        <label className="mb-4 flex items-center gap-2 rounded-xl border border-white/15 px-3"><Search size={16} /><input value={search} onChange={event => { setSearch(event.target.value); setResults([]); setSearchState(""); }} maxLength={160} placeholder="Search book text" aria-label="Search book text" className="min-h-11 min-w-0 w-full bg-transparent text-sm outline-none" /></label>
        {searchState && <p role="status" className="mb-3 text-xs leading-5 text-white/60">{searchState}</p>}
        {results.map(result => <button key={result.page} className={`${control} mb-2 w-full flex-col items-start text-left`} onClick={() => props.onPage(result.page)}><span>Pg {result.page}</span><span className="text-xs text-white/60">{result.text}</span></button>)}
        <h3 className="mb-2 text-xs uppercase tracking-wider text-white/45">Chapters</h3>
        {props.chapters.length ? props.chapters.map((chapter, i) => <button key={i} onClick={() => props.onPage(chapter.page)} className={`mb-2 w-full rounded-2xl p-3 text-left text-sm ${currentChapter === chapter.title ? "bg-indigo-500/20 text-indigo-200" : "text-white/65 hover:bg-white/5"}`}><span className="block">{chapter.title}</span><span className="mt-1 block text-xs text-white/40">Pg {chapter.page}</span></button>) : <p className="mb-4 text-xs leading-5 text-white/50">No chapter outline in this PDF. Jump directly to any page below.</p>}
        <h3 className="mb-3 mt-5 text-xs uppercase tracking-wider text-white/45">Pages</h3>
        <div className="grid grid-cols-5 gap-1.5">{Array.from({ length: props.totalPages }, (_, i) => <button key={i} aria-label={`Go to page ${i + 1}`} aria-current={props.page === i + 1 ? "page" : undefined} onClick={() => props.onPage(i + 1)} className={`min-h-10 rounded-lg border text-xs focus-visible:outline-2 focus-visible:outline-cyan-200 ${props.page === i + 1 ? "border-indigo-400/60 bg-indigo-500/30 text-indigo-200" : "border-white/5 bg-white/[.035] text-white/55 hover:bg-white/10"}`}>{i + 1}</button>)}</div>
      </aside>}
      <main className="min-w-0 flex-1">
        <div ref={stage} className="scroll-mt-32 px-2 pt-5 sm:px-5"><h2 className="mb-4 text-center text-sm font-medium text-white/65">Pg {props.page}{currentChapter ? ` — ${currentChapter}` : ` — ${props.title}`}</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10"><div style={{ width: `${zoom}%`, marginInline: "auto" }}>{props.renderPage(zoom)}</div></div>
          <div className="my-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center"><button className={control} onClick={props.onBookmark}>{props.bookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}Bookmark</button><button className={control} onClick={() => setToolsOpen(true)}><PenLine size={17} />Add note</button><button className={control} onClick={props.onOCR}><Eye size={17} />Extract text (OCR)</button><button className={control} onClick={props.onAsk}><Sparkles size={17} />Ask LAM</button><button className={control} onClick={() => setToolsOpen(true)}><BookOpen size={17} />Practice & summary</button></div>
          <p role="status" className="mb-4 text-center text-xs leading-5 text-white/50">{props.textReady ? "Page text available to LAM" : "Scanned page · extract and review text to enable LAM"} · {props.status}</p>
        </div>
        <nav className="sticky bottom-0 z-10 flex items-center justify-between gap-2 border-t border-white/10 bg-[#080b12]/95 p-3" aria-label="Book pagination"><button className={control} disabled={props.page <= 1} onClick={() => props.onPage(props.page - 1)}><ChevronLeft size={18} />Prev</button><label className="flex items-center gap-2 text-sm text-white/60"><input key={props.page} type="number" aria-label="Page number" min={1} max={props.totalPages} defaultValue={props.page} className="min-h-10 w-16 rounded-xl border border-white/15 bg-white/5 text-center" onKeyDown={event => { if (event.key === "Enter") { const page = Number(event.currentTarget.value); if (page >= 1 && page <= props.totalPages) props.onPage(page); } }} onBlur={event => { const page = Number(event.currentTarget.value); if (Number.isInteger(page) && page >= 1 && page <= props.totalPages) props.onPage(page); }} />/ {props.totalPages}</label><button className={control} disabled={props.page >= props.totalPages} onClick={() => props.onPage(props.page + 1)}>Next<ChevronRight size={18} /></button></nav>
      </main>
    </div>
    <Dialog open={toolsOpen} onOpenChange={setToolsOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto border-white/15 bg-[#10131e] text-white"><DialogTitle>Study page {props.page}</DialogTitle><DialogDescription>Notes, summaries and practice use this book's saved page text.</DialogDescription>{props.tools}</DialogContent></Dialog>
  </section>;
}
