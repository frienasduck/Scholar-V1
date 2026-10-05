"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Eye, Maximize2, PanelLeft, PenLine, Search, Sparkles, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { BookModeSearchPage } from "./book-mode-reader";
import styles from "./page-reader-shell.module.css";

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
  const root = useRef<HTMLElement>(null);
  const currentChapter = props.chapters.filter(item => item.page <= props.page).at(-1)?.title;
  // Scroll only the document, never move the reader underneath Scholar's header.
  useEffect(() => { stage.current?.scrollTo({ top: 0, left: 0 }); }, [props.page]);
  useEffect(() => { root.current?.closest("#main-scroll")?.scrollTo({ top: 0 }); }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (search.trim().length < 2) return;
    const timer = setTimeout(() => {
      setSearchState("Searching saved page text…");
      void props.onSearch(search, controller.signal).then(value => { if (!controller.signal.aborted) { setResults(value); setSearchState(value.length ? "" : "No matching text. Scanned pages must be OCR'd and saved first."); } }).catch(() => { if (!controller.signal.aborted) setSearchState("Search is unavailable. Please retry."); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, props.onSearch]);
  const control = styles.control;
  return <section ref={root} className={styles.reader} data-sidebar={sidebar === null ? "auto" : String(sidebar)} aria-label={`${props.title} reader`}>
    <div className={styles.library}><button onClick={props.onClose} className={control}><ArrowLeft size={17} />Library</button></div>
    <header className={styles.toolbar}>
      <div className={styles.identity}><button aria-label="Toggle chapter and page navigation" aria-expanded={sidebar ?? undefined} className={control} onClick={() => setSidebar(value => value === null ? !window.matchMedia("(min-width: 768px)").matches : !value)}><PanelLeft size={18} /></button><span>Pg {props.page}</span><span className={styles.chapter}>{currentChapter || props.title}</span></div>
      <div className="flex max-w-full items-center gap-1 overflow-x-auto"><button className={control} aria-label="Zoom out" disabled={zoom <= 75} onClick={() => setZoom(value => value - 25)}><ZoomOut size={18} /></button><span className="w-12 text-center text-sm text-white/60">{zoom}%</span><button className={control} aria-label="Zoom in" disabled={zoom >= 200} onClick={() => setZoom(value => value + 25)}><ZoomIn size={18} /></button><button className={control} onClick={() => setZoom(100)}>Fit width</button><button className={control} onClick={props.onBookMode} title="Immersive book mode" aria-label="Immersive book mode"><Maximize2 size={18} /></button><button className={control} aria-label="Study tools" onClick={() => setToolsOpen(true)}><BookOpen size={18} /><span className="hidden sm:inline">Study tools</span></button></div>
    </header>
      {sidebar !== false && <aside className={styles.sidebar} aria-label="Chapters and pages">
        <label className="mb-4 flex items-center gap-2 rounded-xl border border-white/15 px-3"><Search size={16} /><input value={search} onChange={event => { setSearch(event.target.value); setResults([]); setSearchState(""); }} maxLength={160} placeholder="Search book text" aria-label="Search book text" className="min-h-11 min-w-0 w-full bg-transparent text-sm outline-none" /></label>
        {searchState && <p role="status" className="mb-3 text-xs leading-5 text-white/60">{searchState}</p>}
        {results.map(result => <button key={result.page} className={`${control} mb-2 w-full flex-col items-start text-left`} onClick={() => props.onPage(result.page)}><span>Pg {result.page}</span><span className="text-xs text-white/60">{result.text}</span></button>)}
        <h3 className="mb-2 text-xs uppercase tracking-wider text-white/45">Chapters</h3>
        {props.chapters.length ? props.chapters.map((chapter, i) => <button key={i} onClick={() => props.onPage(chapter.page)} className={`mb-2 w-full rounded-2xl p-3 text-left text-sm ${currentChapter === chapter.title ? "bg-indigo-500/20 text-indigo-200" : "text-white/65 hover:bg-white/5"}`}><span className="block">{chapter.title}</span><span className="mt-1 block text-xs text-white/40">Pg {chapter.page}</span></button>) : <p className="mb-4 text-xs leading-5 text-white/50">No chapter outline in this PDF. Jump directly to any page below.</p>}
        <h3 className="mb-3 mt-5 text-xs uppercase tracking-wider text-white/45">Pages</h3>
        <div className={styles.pages}>{Array.from({ length: props.totalPages }, (_, i) => <button key={i} aria-label={`Go to page ${i + 1}`} aria-current={props.page === i + 1 ? "page" : undefined} onClick={() => props.onPage(i + 1)}>{i + 1}</button>)}</div>
      </aside>}
        <div ref={stage} className={styles.document} role="region" aria-label="PDF document" tabIndex={0}><h2 className={styles.pageTitle}>Pg {props.page}<span> — {currentChapter || props.title}</span></h2>
          <div className={styles.pageViewport}><div className={styles.paper} style={{ width: `${zoom}%` }}>{props.renderPage(zoom)}</div></div>
          <div className="my-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center"><button className={control} onClick={props.onBookmark}>{props.bookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}Bookmark</button><button className={control} onClick={() => setToolsOpen(true)}><PenLine size={17} />Add note</button><button className={control} onClick={props.onOCR}><Eye size={17} />Extract text (OCR)</button><button className={control} onClick={props.onAsk}><Sparkles size={17} />Ask LAM</button><button className={control} onClick={() => setToolsOpen(true)}><BookOpen size={17} />Practice & summary</button></div>
          <p role="status" className="mb-4 text-center text-xs leading-5 text-white/50">{props.textReady ? "Page text available to LAM" : "Scanned page · extract and review text to enable LAM"} · {props.status}</p>
        </div>
        <nav className={styles.pagination} aria-label="Book pagination"><button className={control} disabled={props.page <= 1} onClick={() => props.onPage(props.page - 1)}><ChevronLeft size={18} />Prev</button><div className={styles.pagePosition}><label className="flex items-center gap-2 text-sm text-white/60"><input key={props.page} type="number" aria-label="Page number" min={1} max={props.totalPages} defaultValue={props.page} onKeyDown={event => { if (event.key === "Enter") { const page = Number(event.currentTarget.value); if (Number.isInteger(page) && page >= 1 && page <= props.totalPages) props.onPage(page); } }} onBlur={event => { const page = Number(event.currentTarget.value); if (Number.isInteger(page) && page >= 1 && page <= props.totalPages) props.onPage(page); }} />/ {props.totalPages}</label><progress aria-label="Reading progress" value={props.page} max={props.totalPages} /><span>{Math.round(props.page / props.totalPages * 100)}%</span></div><button className={control} disabled={props.page >= props.totalPages} onClick={() => props.onPage(props.page + 1)}>Next<ChevronRight size={18} /></button></nav>
    <Dialog open={toolsOpen} onOpenChange={setToolsOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto border-white/15 bg-[#10131e] text-white"><DialogTitle>Study page {props.page}</DialogTitle><DialogDescription>Notes, summaries and practice use this book's saved page text.</DialogDescription>{props.tools}</DialogContent></Dialog>
  </section>;
}
