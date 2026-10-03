"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, LockKeyhole, Trash2, Upload } from "lucide-react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { UploadedBookReader, type UploadedBook } from "./uploaded-book-reader";
import { toast } from "@/lib/notifications/notification-api";
import { openScholarPlus } from "@/lib/subscriptions/promo";
import { setLamPageContext } from "@/lib/lam-context";
import { useStore } from "@/lib/store";

type EbookSummary = { id: string; title: string; originalFileName: string; sizeBytes: number; pageCount: number; processingStatus: string; createdAt: string };
type Usage = { used: number; limit: number; remaining: number };

export function CustomEbookLibrary() {
  const identity = useStore(s => s.authed && !s.guestMode ? s.user.email || s.user.username : "guest");
  return <AccountEbookLibrary key={identity}/>;
}

function AccountEbookLibrary() {
  const access = useScholarAccess();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const input = useRef<HTMLInputElement>(null);
  const [ebooks, setEbooks] = useState<EbookSummary[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<UploadedBook | null>(null);
  const [libraryError, setLibraryError] = useState("");

  const refresh = useCallback(async () => {
    if (!access.authenticated) return;
    const response = await fetch("/api/ebooks", { cache: "no-store", signal: AbortSignal.timeout(12_000) }).catch(() => null);
    if (!response || !response.ok) { if (mounted.current) setLibraryError("Your private library is temporarily unavailable. Retry shortly; saved books have not been removed."); return; }
    const value = await response.json();
    if (!mounted.current) return;
    setEbooks(value.ebooks ?? []);
    setUsage(value.usage ?? null);
    setLibraryError("");
  }, [access.authenticated]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!ebooks.some(book => book.processingStatus === "processing")) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    return () => clearInterval(timer);
  }, [ebooks, refresh]);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/ebooks", { method: "POST", body: form, headers: { "x-idempotency-key": crypto.randomUUID() }, signal: AbortSignal.timeout(55_000) });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.message || "Scholar could not upload this PDF.");
      if (!mounted.current) return;
      toast.success(value.ebook.processingStatus === "processing" ? "PDF saved · processing" : "E-Book ready", { description: value.ebook.processingStatus === "processing" ? "Extraction and chapter indexing continue in the background." : value.ebook.processingStatus === "needs_ocr" ? "The PDF is saved. Some scanned pages still need OCR." : `${value.ebook.pageCount} pages are ready to study.` });
      await refresh();
    } catch (error) {
      toast.error("Upload failed", { description: error instanceof Error ? error.message : "Try another PDF." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const open = useCallback(async (ebook: EbookSummary) => {
    if (ebook.processingStatus === "processing" || ebook.processingStatus === "failed") { toast.error(ebook.processingStatus === "processing" ? "This PDF is still being processed." : "Extraction failed. Open Resources to retry or remove the file."); return; }
    try {
    const response = await fetch(`/api/ebooks/${encodeURIComponent(ebook.id)}`, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return toast.error("This E-Book could not be opened.");
    const value = await response.json();
    if (!mounted.current) return;
    setActive({ ...ebook, ...value.ebook, pageTexts: Array.isArray(value.ebook.pageTexts) ? value.ebook.pageTexts : [] });
    setLamPageContext({ ebookTitle: ebook.title, activeFileId: ebook.id, activeFileName: ebook.originalFileName, visibleText: String(value.ebook.text || "").slice(0, 8_000) });
    } catch { if (mounted.current) toast.error("This E-Book could not be opened. Please retry."); }
  },[]);

  useEffect(()=>{
    try{
      const target=sessionStorage.getItem("scholar:ebook:custom-target");
      const book=target ? ebooks.find(ebook=>ebook.id===target) : null;
      if(book){sessionStorage.removeItem("scholar:ebook:custom-target");void open(book).catch(()=>toast.error("This E-Book could not be opened. Please retry from your library."));}
    }catch{ /* Optional navigation hint; ownership is always checked by the API. */ }
  },[ebooks,open]);

  if (!access.authenticated) {
    return <section className="eb-glass mb-6 rounded-2xl p-4 sm:p-5"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-cyan-200" /><div><h2 className="font-semibold text-white">Upload your own E-Book</h2><p className="mt-1 text-sm leading-6 text-white/55">Sign in to securely upload private PDFs. Guest files are not sent to the server.</p></div></div></section>;
  }

  return (
    <>
      <section id="custom-ebooks" className="eb-glass mb-6 overflow-hidden rounded-2xl p-4 sm:p-5">
        {libraryError && <p role="alert" className="mb-3 text-sm text-amber-200">{libraryError} <button className="underline" onClick={() => void refresh()}>Retry</button></p>}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Upload className="h-4 w-4 text-cyan-200" /><h2 className="font-semibold text-white">Upload your own E-Book</h2></div>
            <p className="mt-1 text-xs leading-5 text-white/50">PDF only · private to your account · up to 4 MB and 500 pages</p>
            <button className="mt-2 text-xs text-cyan-200 underline underline-offset-4" onClick={async () => { try { const response = await fetch("/api/resources/backfill", { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.message); if (!mounted.current) return; toast.success(result.indexed ? `${result.indexed} existing PDFs queued for chapter indexing` : "No additional PDFs to index", { description: "Processes up to five at a time; upload and setup allowances are unchanged." }); await refresh(); } catch { if (mounted.current) toast.error("Chapter indexing is unavailable. Check the resource database update."); } }}>Index existing PDFs in my Resource Vault</button>
            {usage ? <p className="mt-2 text-xs font-medium text-cyan-100">{usage.used} of {usage.limit} uploads used this month</p> : null}
          </div>
          <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-4 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/15 ${busy || usage?.remaining === 0 ? "pointer-events-none opacity-50" : ""}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{busy ? "Saving PDF…" : usage?.remaining === 0 ? "Monthly limit reached" : "Choose PDF"}
            <input ref={input} className="sr-only" type="file" accept="application/pdf,.pdf" disabled={busy || usage?.remaining === 0} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
          </label>
        </div>
        {usage?.remaining === 0 && access.plan === "FREE" ? <button className="mt-3 text-xs font-semibold text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" onClick={() => openScholarPlus({ source: "ebooks", feature: "ebooks" })}>Upgrade for 20 uploads each month</button> : null}
        {ebooks.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{ebooks.map((ebook) => <article key={ebook.id} className="rounded-xl border border-white/10 bg-black/20 p-3"><button className="flex w-full min-w-0 items-start gap-3 text-left" onClick={() => void open(ebook)}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.06]"><FileText className="h-5 w-5 text-indigo-200" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{ebook.title}</span><span className="mt-0.5 block text-xs text-white/45">{ebook.processingStatus === "processing" ? "Processing…" : ebook.processingStatus === "failed" ? "Processing failed" : `${ebook.pageCount} pages`} · {(ebook.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>{ebook.processingStatus === "needs_ocr" ? <span className="mt-1 block text-[11px] text-amber-200">Scanned pages need OCR</span> : null}</span></button><div className="mt-2 flex justify-end"><button aria-label={`Delete ${ebook.title}`} className="grid h-10 w-10 place-items-center rounded-lg text-white/35 hover:bg-white/[.06] hover:text-red-200" onClick={async () => { if (!confirm(`Remove “${ebook.title}”?`)) return; await fetch(`/api/ebooks/${ebook.id}`, { method: "DELETE" }); await refresh(); }}><Trash2 className="h-4 w-4" /></button></div></article>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/40">Your uploaded E-Books will appear here.</p>}
      </section>
      {active && <UploadedBookReader key={active.id} book={active} onClose={() => { setActive(null); setLamPageContext({}); }} />}
    </>
  );
}
