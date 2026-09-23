"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, FileText, Loader2, LockKeyhole, Sparkles, Trash2, Upload } from "lucide-react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/notifications/notification-api";
import { openScholarPlus } from "@/lib/subscriptions/promo";
import { setLamPageContext } from "@/lib/lam-context";

type EbookSummary = { id: string; title: string; originalFileName: string; sizeBytes: number; pageCount: number; processingStatus: string; createdAt: string };
type Usage = { used: number; limit: number; remaining: number };

export function CustomEbookLibrary() {
  const access = useScholarAccess();
  const input = useRef<HTMLInputElement>(null);
  const [ebooks, setEbooks] = useState<EbookSummary[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<(EbookSummary & { text: string }) | null>(null);

  const refresh = useCallback(async () => {
    if (!access.authenticated) return;
    const response = await fetch("/api/ebooks", { cache: "no-store" });
    if (!response.ok) return;
    const value = await response.json();
    setEbooks(value.ebooks ?? []);
    setUsage(value.usage ?? null);
  }, [access.authenticated]);

  useEffect(() => { void refresh(); }, [refresh]);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/ebooks", { method: "POST", body: form, headers: { "x-idempotency-key": crypto.randomUUID() } });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.message || "Scholar could not upload this PDF.");
      toast.success("E-Book ready", { description: value.ebook.processingStatus === "needs_ocr" ? "The PDF is saved. Some scanned pages still need OCR." : `${value.ebook.pageCount} pages are ready to study.` });
      await refresh();
    } catch (error) {
      toast.error("Upload failed", { description: error instanceof Error ? error.message : "Try another PDF." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const open = async (ebook: EbookSummary) => {
    const response = await fetch(`/api/ebooks/${encodeURIComponent(ebook.id)}`, { cache: "no-store" });
    if (!response.ok) return toast.error("This E-Book could not be opened.");
    const value = await response.json();
    setActive({ ...ebook, text: value.ebook.text || "No selectable text was found in this PDF." });
    setLamPageContext({ ebookTitle: ebook.title, activeFileId: ebook.id, activeFileName: ebook.originalFileName, visibleText: String(value.ebook.text || "").slice(0, 8_000) });
  };

  if (!access.authenticated) {
    return <section className="eb-glass mb-6 rounded-2xl p-4 sm:p-5"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-cyan-200" /><div><h2 className="font-semibold text-white">Upload your own E-Book</h2><p className="mt-1 text-sm leading-6 text-white/55">Sign in to securely upload private PDFs. Guest files are not sent to the server.</p></div></div></section>;
  }

  return (
    <>
      <section id="custom-ebooks" className="eb-glass mb-6 overflow-hidden rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Upload className="h-4 w-4 text-cyan-200" /><h2 className="font-semibold text-white">Upload your own E-Book</h2></div>
            <p className="mt-1 text-xs leading-5 text-white/50">PDF only · private to your account · up to 4 MB and 500 pages</p>
            {usage ? <p className="mt-2 text-xs font-medium text-cyan-100">{usage.used} of {usage.limit} uploads used this month</p> : null}
          </div>
          <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-4 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/15 ${busy || usage?.remaining === 0 ? "pointer-events-none opacity-50" : ""}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{busy ? "Reading PDF…" : usage?.remaining === 0 ? "Monthly limit reached" : "Choose PDF"}
            <input ref={input} className="sr-only" type="file" accept="application/pdf,.pdf" disabled={busy || usage?.remaining === 0} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
          </label>
        </div>
        {usage?.remaining === 0 && access.plan === "FREE" ? <button className="mt-3 text-xs font-semibold text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" onClick={() => openScholarPlus({ source: "ebooks", feature: "ebooks" })}>Upgrade for 20 uploads each month</button> : null}
        {ebooks.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{ebooks.map((ebook) => <article key={ebook.id} className="rounded-xl border border-white/10 bg-black/20 p-3"><button className="flex w-full min-w-0 items-start gap-3 text-left" onClick={() => void open(ebook)}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.06]"><FileText className="h-5 w-5 text-indigo-200" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{ebook.title}</span><span className="mt-0.5 block text-xs text-white/45">{ebook.pageCount} pages · {(ebook.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>{ebook.processingStatus === "needs_ocr" ? <span className="mt-1 block text-[11px] text-amber-200">Scanned pages need OCR</span> : null}</span></button><div className="mt-2 flex justify-end"><button aria-label={`Delete ${ebook.title}`} className="grid h-10 w-10 place-items-center rounded-lg text-white/35 hover:bg-white/[.06] hover:text-red-200" onClick={async () => { if (!confirm(`Remove “${ebook.title}”?`)) return; await fetch(`/api/ebooks/${ebook.id}`, { method: "DELETE" }); await refresh(); }}><Trash2 className="h-4 w-4" /></button></div></article>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/40">Your uploaded E-Books will appear here.</p>}
      </section>
      <Dialog open={Boolean(active)} onOpenChange={(openValue) => { if (!openValue) { setActive(null); setLamPageContext({}); } }}>
        <DialogContent className="max-h-[min(88dvh,760px)] max-w-3xl overflow-hidden border-white/15 bg-[#070b12]/95 text-white backdrop-blur-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-cyan-200" />{active?.title}</DialogTitle><DialogDescription>{active?.pageCount} pages · extracted document text</DialogDescription></DialogHeader>
          <div className="max-h-[55dvh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-7 text-white/75">{active?.text}</div>
          <div className="flex flex-col gap-2 sm:flex-row"><a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold" href={active ? `/api/ebooks/${active.id}?file=1` : "#"} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" />Open original PDF</a>{access.has("lam_ai") ? <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black" onClick={() => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "live-tutor" } }))}><Sparkles className="h-4 w-4" />Ask LAM AI about this book</button> : <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black" onClick={() => openScholarPlus({ source: "ebooks", feature: "ai" })}><LockKeyhole className="h-4 w-4" />Unlock LAM AI</button>}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
