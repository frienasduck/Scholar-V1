"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, LockKeyhole, Trash2, Upload, Pencil, X } from "lucide-react";
import { ebookFailure, pdfValidation } from "@/lib/ebooks/contracts";
import { GuestFeatureGate } from "@/components/guest/guest-feature-gate";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { UploadedBookReader, type UploadedBook } from "./uploaded-book-reader";
import { toast } from "@/lib/notifications/notification-api";
import { openScholarPlus } from "@/lib/subscriptions/promo";
import { setLamPageContext } from "@/lib/lam-context";
import { useStore } from "@/lib/store";
import { profileRemoveItem } from "@/lib/profile-storage";

type EbookSummary = { id: string; title: string; originalFileName: string; sizeBytes: number; pageCount: number; lastPage?: number; lastOpenedAt?: string; processingStatus: string; createdAt: string; resource?: { id: string; state: string; extractedPages?: number; job?: { stage: string; errorCode?: string } } };
type Usage = { used: number; limit: number; remaining: number };

export function CustomEbookLibrary() {
  const identity = useStore(s => s.authed && !s.guestMode ? s.user.email || s.user.username : "guest");
  return <AccountEbookLibrary key={identity}/>;
}

function AccountEbookLibrary() {
  const access = useScholarAccess();
  const guestTrigger = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const input = useRef<HTMLInputElement>(null);
  const [ebooks, setEbooks] = useState<EbookSummary[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<UploadedBook | null>(null);
  const [libraryError, setLibraryError] = useState("");
  const [staged, setStaged] = useState<{ file: File; key: string } | null>(null);
  const [title, setTitle] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [guestPrompt, setGuestPrompt] = useState(false);
  const uploadInFlight = useRef(false);
  const autoOpened = useRef("");

  const refresh = useCallback(async () => {
    if (!access.authenticated) return;
    const response = await fetch("/api/ebooks", { cache: "no-store", signal: AbortSignal.timeout(12_000) }).catch(() => null);
    if (!response || !response.ok) { if (mounted.current) setLibraryError("Your private library is temporarily unavailable. Retry shortly; saved books have not been removed."); return; }
    const value = await response.json().catch(() => null);
    if (!value) { if (mounted.current) setLibraryError("The library response could not be read. Retry shortly."); return; }
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

  const choose = async (file: File) => {
    if (uploadInFlight.current) return;
    const invalid = pdfValidation(file, await file.slice(0, 5).text().catch(() => ""));
    if (!mounted.current) return;
    setUploadError(invalid ?? "");
    if (invalid) { setStaged(null); return; }
    setStaged({ file, key: crypto.randomUUID() }); setTitle("");
    if (input.current) input.current.value = "";
  };
  const upload = async () => {
    if (!staged || uploadInFlight.current) return;
    uploadInFlight.current = true;
    setBusy(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.set("file", staged.file);
      if (title.trim()) form.set("title", title.trim());
      const response = await fetch("/api/ebooks", { method: "POST", body: form, headers: { "x-idempotency-key": staged.key }, signal: AbortSignal.timeout(55_000) });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.message || "Scholar could not upload this PDF.");
      if (!mounted.current) return;
      toast.success(value.duplicate ? "This book is already in your library" : value.ebook.processingStatus === "processing" ? "PDF saved · processing" : "E-Book ready", { description: value.ebook.processingStatus === "processing" ? "Extraction and chapter indexing continue in the background. You can leave this screen." : value.ebook.processingStatus === "needs_ocr" ? "The PDF is saved. Some scanned pages still need OCR." : `${value.ebook.pageCount} pages are ready to study.` });
      setStaged(null);
      await refresh();
    } catch (error) {
      if (mounted.current) setUploadError(error instanceof Error ? error.message : "Upload interrupted. Retry the same file; duplicates are detected safely.");
    } finally {
      uploadInFlight.current = false;
      if (mounted.current) setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const open = useCallback(async (ebook: EbookSummary) => {
    if (ebook.processingStatus === "processing" || ebook.processingStatus === "failed") { toast.error(ebook.processingStatus === "processing" ? "This PDF is still being processed." : ebookFailure(ebook.resource?.job?.errorCode)); return; }
    try {
    const response = await fetch(`/api/ebooks/${encodeURIComponent(ebook.id)}`, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return toast.error("This E-Book could not be opened.");
    const value = await response.json();
    if (!mounted.current) return;
    setActive({ ...ebook, ...value.ebook });
    const url = new URL(location.href); url.searchParams.set("book", ebook.id); history.replaceState(null, "", url);
    } catch { if (mounted.current) toast.error("This E-Book could not be opened. Please retry."); }
  },[]);

  useEffect(()=>{
    try{
      const target=sessionStorage.getItem("scholar:ebook:custom-target") || new URL(location.href).searchParams.get("book");
      const book=target ? ebooks.find(ebook=>ebook.id===target) : null;
      if(book && autoOpened.current !== target && ["ready", "needs_ocr"].includes(book.processingStatus)){autoOpened.current=target!;sessionStorage.removeItem("scholar:ebook:custom-target");void open(book).catch(()=>toast.error("This E-Book could not be opened. Please retry from your library."));}
    }catch{ /* Optional navigation hint; ownership is always checked by the API. */ }
  },[ebooks,open]);

  if (!access.authenticated) {
    return <>
      <section className="eb-glass mb-6 rounded-2xl p-4 sm:p-5"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-cyan-200" /><div><h2 className="font-semibold text-white">Upload your own E-Book</h2><p className="mt-1 text-sm leading-6 text-white/55">Sign in to securely upload private PDFs. Guest files are not sent to the server.</p><button ref={guestTrigger} className="sg-cta-quiet mt-3 min-h-11 rounded-xl px-4 text-sm" onClick={() => setGuestPrompt(true)}>Sign in to upload</button></div></div></section>
      <Dialog open={guestPrompt} onOpenChange={setGuestPrompt}>
        <DialogContent onCloseAutoFocus={event => { event.preventDefault(); guestTrigger.current?.focus(); }} className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-5xl overflow-y-auto border-white/10 bg-black p-0 sm:max-w-5xl">
          <DialogTitle className="sr-only">Sign in for private E-Books</DialogTitle>
          <GuestFeatureGate onSignIn={() => useStore.getState().setAuthed(false)} onBack={() => setGuestPrompt(false)} />
        </DialogContent>
      </Dialog>
    </>;
  }

  return (
    <>
      <section id="custom-ebooks" className="eb-glass mb-6 overflow-hidden rounded-2xl p-4 sm:p-5" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void choose(file); }}>
        {libraryError && <p role="alert" className="mb-3 text-sm text-amber-200">{libraryError} <button className="underline" onClick={() => void refresh()}>Retry</button></p>}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Upload className="h-4 w-4 text-cyan-200" /><h2 className="font-semibold text-white">Upload your own E-Book</h2></div>
            <p className="mt-1 text-xs leading-5 text-white/50">PDF only · private to your account · up to 4 MB and 500 pages</p>
            <button className="mt-2 text-xs text-cyan-200 underline underline-offset-4" onClick={async () => { try { const response = await fetch("/api/resources/backfill", { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.message); if (!mounted.current) return; toast.success(result.indexed ? `${result.indexed} existing PDFs queued for chapter indexing` : "No additional PDFs to index", { description: "Processes up to five at a time; upload and setup allowances are unchanged." }); await refresh(); } catch { if (mounted.current) toast.error("Chapter indexing is unavailable. Check the resource database update."); } }}>Index existing PDFs in my Resource Vault</button>
            {usage ? <p className="mt-2 text-xs font-medium text-cyan-100">{usage.used} of {usage.limit} uploads used this month</p> : null}
          </div>
          <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-4 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/15 focus-within:ring-2 focus-within:ring-cyan-200 ${busy ? "pointer-events-none opacity-50" : ""}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{busy ? "Saving PDF…" : "Choose PDF"}
            <input aria-label="Choose a PDF E-Book" ref={input} className="sr-only" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void choose(file); }} />
          </label>
        </div>
        {uploadError && <p role="alert" className="mt-3 text-sm text-amber-200">{uploadError}</p>}
        {staged && <div className="mt-4 space-y-3 rounded-xl border border-cyan-200/20 bg-black/20 p-4"><p className="break-words text-sm text-white">{staged.file.name} · {(staged.file.size / 1048576).toFixed(2)} MB</p><label className="block text-xs text-white/60">Optional book title<input maxLength={120} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white" placeholder="Use the PDF's title" /></label><div className="flex flex-wrap gap-2"><button disabled={busy} className="sg-cta-primary min-h-11 rounded-xl px-4 text-sm" onClick={() => void upload()}>{busy ? "Uploading PDF…" : uploadError ? "Retry upload" : "Upload PDF"}</button><button disabled={busy} className="sg-cta-quiet inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm" onClick={() => { setStaged(null); setUploadError(""); }}><X className="h-4 w-4" />Remove</button></div><p role="status" className="text-xs text-white/50">{busy ? "Keep this tab open until the PDF is saved. Extraction then continues in the background." : "The file has not been uploaded yet. You can also drop a PDF here."}</p></div>}
        {usage?.remaining === 0 && access.plan === "FREE" ? <button className="mt-3 text-xs font-semibold text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" onClick={() => openScholarPlus({ source: "ebooks", feature: "ebooks" })}>Upgrade for 20 uploads each month</button> : null}
        {ebooks.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{ebooks.map(ebook => <EbookCard key={ebook.id} book={ebook} onOpen={() => void open(ebook)} onUpdate={async (method, body) => {
          try {
            const response = await fetch(`/api/ebooks/${encodeURIComponent(ebook.id)}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12_000) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "The book could not be updated. Please retry.");
            if (method === "DELETE") {
              for (const grade of [9, 11] as const) {
                profileRemoveItem(grade, `custom-ebook-reading:v2:${ebook.id}`);
                profileRemoveItem(grade, `custom-ebook-reading:${ebook.id}`);
              }
            }
            await refresh();
          } catch (error) { toast.error("E-Book update failed", { description: error instanceof Error ? error.message : "Please retry." }); }
        }} />)}</div> : <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/40">Your uploaded E-Books will appear here.</p>}
      </section>
      {active && <UploadedBookReader key={active.id} book={active} onClose={() => { setActive(null); setLamPageContext({}); const url = new URL(location.href); url.searchParams.delete("book"); history.replaceState(null, "", url); void refresh(); }} />}
    </>
  );
}

function EbookCard({ book, onOpen, onUpdate }: { book: EbookSummary; onOpen: () => void; onUpdate: (method: "PATCH" | "DELETE", body?: object) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const ready = ["ready", "needs_ocr"].includes(book.processingStatus);
  const stage = book.resource?.job?.stage;
  const status = book.processingStatus === "processing" ? stage === "INDEXING" ? "Indexing for LAM…" : stage === "CLASSIFYING" ? "Preparing study tools…" : `Reading document${book.pageCount ? ` · ${book.resource?.extractedPages ?? 0}/${book.pageCount} pages extracted` : "…"}` : book.processingStatus === "failed" ? "Processing failed" : `${book.pageCount} pages`;
  const progress = book.lastOpenedAt && book.pageCount ? Math.round((book.lastPage ?? 1) / book.pageCount * 100) : 0;
  const action = async (method: "PATCH" | "DELETE", body?: object) => { if (busy) return; setBusy(true); try { await onUpdate(method, body); } finally { setBusy(false); } };
  return <article className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
    <button disabled={!ready || busy} className="flex w-full min-w-0 items-start gap-3 text-left" onClick={onOpen}>
      <span className="grid h-16 w-12 shrink-0 place-items-center rounded-r-xl border-l-4 border-indigo-200/20 bg-gradient-to-br from-indigo-400/20 to-cyan-200/5"><FileText className="h-6 w-6 text-indigo-200" /></span>
      <span className="min-w-0"><span className="block break-words text-sm font-semibold text-white">{book.title}</span><span role="status" className="mt-1 block text-xs text-white/60">{status} · {(book.sizeBytes / 1048576).toFixed(1)} MB</span><span className="mt-1 block text-xs text-white/50">Private upload{ready ? ` · ${progress}% read` : ""}</span>{book.processingStatus === "needs_ocr" && <span className="mt-1 block text-xs text-amber-200">Some pages need OCR. Text tools use readable pages only.</span>}</span>
    </button>
    {book.processingStatus === "failed" && <p role="alert" className="mt-3 text-xs leading-5 text-amber-200">{ebookFailure(book.resource?.job?.errorCode)}</p>}
    {ready && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full bg-cyan-200/60" style={{ width: `${progress}%` }} /></div>}
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      {ready && <button disabled={busy} className="min-h-11 rounded-lg px-3 text-cyan-100 hover:bg-white/5" onClick={onOpen}>{book.lastOpenedAt ? `Resume page ${book.lastPage ?? 1}` : "Open book"}</button>}
      {book.processingStatus === "failed" && book.resource?.state === "FAILED" && <button disabled={busy} className="min-h-11 rounded-lg px-3 text-cyan-100 hover:bg-white/5" onClick={() => void action("PATCH", { retry: true })}>Retry processing</button>}
      {ready && <button disabled={busy} aria-label={`Rename ${book.title}`} className="grid h-11 w-11 place-items-center rounded-lg text-white/60 hover:bg-white/5" onClick={() => { const title = prompt("Book title", book.title); if (title?.trim()) void action("PATCH", { title: title.trim().slice(0, 120) }); }}><Pencil className="h-4 w-4" /></button>}
      <button disabled={busy} aria-label={book.processingStatus === "processing" ? `Cancel import of ${book.title}` : `Delete ${book.title}`} className="ml-auto grid h-11 w-11 place-items-center rounded-lg text-white/60 hover:bg-white/5 hover:text-red-200" onClick={() => { if (confirm(`Delete “${book.title}”? This removes the uploaded PDF and its Scholar reading data, including notes and bookmarks. An in-progress import will be cancelled.`)) void action("DELETE"); }}><Trash2 className="h-4 w-4" /></button>
    </div>
  </article>;
}
