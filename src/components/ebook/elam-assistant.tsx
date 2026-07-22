"use client";

import { useEffect, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { setLamPageContext } from "@/lib/lam-context";
import { cn } from "@/lib/utils";
import { LamMark } from "@/components/lam/lam-mark";

type ElamAssistantProps = {
  bookId: string;
  bookTitle: string;
  subject: string;
  page: number;
  chapter?: string;
  pageText?: string;
  resolvePageText?: () => Promise<string>;
};

/**
 * Page-aware ebook entry point for the single global LAM system.
 * It deliberately owns no conversation or AI request state: page context is
 * handed to LamWidget so navigation, history, voice and privacy stay unified.
 */
export function ElamAssistant({ bookId, bookTitle, subject, page, chapter, pageText = "", resolvePageText }: ElamAssistantProps) {
  const enabled = useStore((state) => state.settings.elamEnabled !== false);
  const compact = useStore((state) => state.settings.elamCompact === true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLamPageContext({ ebookTitle: bookTitle, subjectTitle: subject, chapterTitle: chapter, sourcePageNumber: page, visibleText: pageText });
  }, [bookTitle, chapter, enabled, page, pageText, subject]);

  if (!enabled) return null;

  async function openLam() {
    setLoading(true);
    let visibleText = pageText;
    if (!visibleText.trim() && resolvePageText) {
      try { visibleText = await resolvePageText(); } catch { visibleText = ""; }
    }
    const context = { ebookTitle: bookTitle, subjectTitle: subject, chapterTitle: chapter, sourcePageNumber: page, visibleText };
    setLamPageContext(context);
    window.dispatchEvent(new CustomEvent("scholar:open-lam", { detail: { context } }));
    setLoading(false);
  }

  return <button onClick={() => void openLam()} disabled={loading} aria-label={`Ask LAM about ${bookTitle} page ${page}`} className={cn("lam-liquid-glass lam-liquid-glass--idle fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-40 flex min-h-12 items-center gap-2 rounded-full px-3 text-xs font-semibold text-white shadow-2xl lg:bottom-5 lg:right-5", compact && "h-12 w-12 justify-center px-0")}>
    <span className="grid h-8 w-8 place-items-center rounded-full bg-cyan-300/10 text-cyan-100">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LamMark />}</span>
    {!compact && <span className="flex items-center gap-1.5">ELAM <span className="text-white/42">·</span><BookOpen className="h-3.5 w-3.5 text-white/55" /> Page {page}</span>}
  </button>;
}
