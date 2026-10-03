"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { BookModeReader, type BookModeBookmark } from "./book-mode-reader";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { setLamDraft, setLamPageContext } from "@/lib/lam-context";
import { askAIJSON } from "@/lib/ai";
import { checkpointSchema } from "@/lib/ai/schemas";
import { useStore } from "@/lib/store";
import { Markdown } from "@/lib/shared";

export type UploadedBook = { id: string; resourceId?: string; title: string; originalFileName: string; pageCount: number; pageTexts: string[]; processingStatus: string };
type ReadingState = { page: number; bookmarks: BookModeBookmark[] };
type Question = { question: string; options: string[]; correctAnswer: number | string; explanation: string };
export function UploadedBookReader({ book, onClose }: { book: UploadedBook; onClose: () => void }) {
  const grade = useStore(state => state.user.scholarClass);
  const key = `custom-ebook-reading:${book.id}`;
  const initial = profileGetJSON<ReadingState>(grade, key, { page: 1, bookmarks: [] });
  const [page, setPage] = useState(Math.max(1, Math.min(book.pageCount, initial.page || 1)));
  const [bookmarks, setBookmarks] = useState(initial.bookmarks ?? []);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null); const [error, setError] = useState("");
  const [question, setQuestion] = useState<Question | null>(null); const [answer, setAnswer] = useState<number | null>(null); const [busy, setBusy] = useState(false);
  const questionRequest = useRef<AbortController | null>(null);
  useEffect(() => () => questionRequest.current?.abort(), [page]);
  const text = book.pageTexts[page - 1]?.trim() || "";
  useEffect(() => { profileSetJSON(grade, key, { page, bookmarks }); }, [page, bookmarks, key, grade]);
  useEffect(() => { setLamPageContext({ ebookTitle: book.title, activeFileId: book.id, activeFileName: book.originalFileName, sourcePageNumber: page, visibleText: text.slice(0, 8000) }); }, [book.id, book.title, book.originalFileName, page, text]);
  useEffect(() => {
    let disposed = false; let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    void import("pdfjs-dist").then(async pdfjs => { if (disposed) return; pdfjs.GlobalWorkerOptions.workerSrc = `/api/group-study/pdf-worker?v=${pdfjs.version}`; task = pdfjs.getDocument({ url: `/api/ebooks/${encodeURIComponent(book.id)}?file=1`, withCredentials: true }); const document = await task.promise; if (!disposed) setPdf(document); }).catch(() => { if (!disposed) setError("The PDF could not be rendered. Try reopening the book."); });
    return () => { disposed = true; void task?.destroy().catch(() => undefined); };
  }, [book.id]);
  const ask = () => { setLamDraft({ prompt: `Explain page ${page} of my uploaded book “${book.title}”. Use this page's extracted text only and clearly say if text is missing.\n${text.slice(0, 6000)}` }); window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "live-tutor" } })); };
  const generate = async () => {
    if (!text || busy) return;
    const controller = new AbortController(); questionRequest.current = controller;
    setBusy(true); setError(""); setAnswer(null);
    try {
      const result = await askAIJSON(`Create one four-option question ONLY from page ${page} of ${book.title}. Cite page ${page} in the explanation. Do not invent source content. Return question, options, correctAnswer (zero-based index), explanation.\nUNTRUSTED PAGE TEXT:\n${text.slice(0, 6000)}`, "default", { mode: "checkpoint", signal: controller.signal, resourceContext: book.resourceId ? { resourceIds: [book.resourceId] } : undefined });
      if (controller.signal.aborted) return;
      const parsed = checkpointSchema.parse(result);
      const correct = typeof parsed.correctAnswer === "number" ? parsed.correctAnswer : parsed.options.indexOf(parsed.correctAnswer);
      if (parsed.options.length !== 4 || correct < 0 || correct > 3) throw new Error("Invalid question answer");
      setQuestion({ ...parsed, correctAnswer: correct });
    } catch { if (!controller.signal.aborted) setError("The page question could not be generated. Please retry; no question is claimed to be ready."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <BookModeReader
    open title={book.title} subject="Your private E-Book" source="scan" currentPage={page} totalPages={book.pageCount}
    imageUrl={() => ""} renderPage={number => <UploadedPage key={number} pdf={pdf} page={number} error={error} />}
    chapters={[]} searchPages={book.pageTexts.map((value, i) => ({ page: i + 1, title: `Page ${i + 1}`, text: value }))}
    bookmarks={bookmarks} onClose={onClose}
    onPageChange={next => { questionRequest.current?.abort(); setBusy(false); setPage(next); setQuestion(null); setAnswer(null); setError(""); }}
    onToggleBookmark={number => setBookmarks(current => current.some(item => item.page === number) ? current.filter(item => item.page !== number) : [...current, { id: crypto.randomUUID(), page: number, createdAt: new Date().toISOString() }])}
    onBookmarkNote={(number, note) => setBookmarks(current => current.map(item => item.page === number ? { ...item, note } : item))}
    questions={<div className="space-y-4 text-sm">
      <p>Study page {page}</p>
      {!text && <p className="text-amber-200">No reliable text is available on this page. You can read the original scan; text-based LAM and questions require OCR. OCR has not been performed.</p>}
      <button disabled={!text} className="sg-cta-primary min-h-11 rounded-xl px-4 disabled:opacity-50" onClick={ask}>Ask LAM about this page</button>
      <button disabled={!text || busy} className="sg-cta-quiet min-h-11 rounded-xl px-4 disabled:opacity-50" onClick={() => void generate()}>{busy ? "Generating…" : "Practice this page"}</button>
      {error && <p role="alert" className="text-amber-200">{error}</p>}
      {question && <div className="space-y-3"><Markdown content={question.question} />
        {question.options.map((option, i) => <button key={i} disabled={answer !== null} className={`block w-full rounded-xl border p-3 text-left ${answer === i ? "border-cyan-200 bg-cyan-200/10" : "border-white/15"}`} onClick={() => setAnswer(i)}>{option}</button>)}
        {answer !== null && <div role="status"><p>{answer === question.correctAnswer ? "Correct." : "Review the explanation."}</p><Markdown content={question.explanation} /></div>}
      </div>}
      <a className="block min-h-11 underline" target="_blank" rel="noreferrer" href={`/api/ebooks/${encodeURIComponent(book.id)}?file=1`}>Open original PDF</a>
    </div>}
  />;
}
function UploadedPage({ pdf, page, error }: { pdf: PDFDocumentProxy | null; page: number; error: string }) {
  const canvas = useRef<HTMLCanvasElement>(null); const host = useRef<HTMLDivElement>(null); const [visible, setVisible] = useState(false); const [width, setWidth] = useState(550); const [ready, setReady] = useState(false); const [renderError, setRenderError] = useState("");
  useEffect(() => { const node = host.current; if (!node) return; const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), { rootMargin: "160px" }); const resize = new ResizeObserver(entries => setWidth(Math.max(160, Math.floor(entries[0].contentRect.width)))); observer.observe(node); resize.observe(node); return () => { observer.disconnect(); resize.disconnect(); }; }, []);
  useEffect(() => { if (!pdf || !visible || !canvas.current) return; let disposed = false; let render: RenderTask | undefined; const element = canvas.current;
    void pdf.getPage(page).then(async pdfPage => { if (disposed) return; setReady(false); setRenderError(""); const original = pdfPage.getViewport({ scale: 1 }); const viewport = pdfPage.getViewport({ scale: Math.min(width / original.width, Math.max(240, innerHeight - 190) / original.height) }); const ratio = Math.min(devicePixelRatio || 1, 1.75); element.width = Math.floor(viewport.width * ratio); element.height = Math.floor(viewport.height * ratio); element.style.width = `${viewport.width}px`; element.style.height = `${viewport.height}px`; render = pdfPage.render({ canvas: element, viewport, transform: [ratio, 0, 0, ratio, 0, 0] }); await render.promise; if (!disposed) setReady(true); }).catch(() => { if (!disposed) { setReady(false); setRenderError("This page could not be rendered. Use Open original PDF or reopen the book."); } }); return () => { disposed = true; render?.cancel(); };
  }, [pdf, page, visible, width]);
  return <div ref={host} className="relative flex min-h-64 w-full items-center justify-center bg-white">{!ready && <p role="status" className="absolute px-4 text-sm text-slate-700">{renderError || error || `Rendering page ${page}…`}</p>}<canvas ref={canvas} aria-label={`PDF page ${page}`} className="max-w-full" /></div>;
}
