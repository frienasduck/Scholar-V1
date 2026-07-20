"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  Bot,
  Eraser,
  Loader2,
  MessageCircleHeart,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { askAI, type ChatMessage } from "@/lib/ai";
import { Markdown } from "@/lib/shared";
import { useStore } from "@/lib/store";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { cn } from "@/lib/utils";

type ElamMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ElamAssistantProps = {
  bookId: string;
  bookTitle: string;
  subject: string;
  page: number;
  chapter?: string;
  pageText?: string;
  resolvePageText?: () => Promise<string>;
};

const SUGGESTIONS = [
  "Explain this page simply",
  "What should I remember?",
  "Quiz me from this page",
];

function storageKey(bookId: string, page: number) {
  return `elam:v2:${bookId}:page-${page}`;
}

export function ElamAssistant({
  bookId,
  bookTitle,
  subject,
  page,
  chapter,
  pageText = "",
  resolvePageText,
}: ElamAssistantProps) {
  const scholarClass = useStore((state) => state.user.scholarClass);
  const reduceMotionSetting = useStore((state) => state.settings.reduceMotion);
  const enabled = useStore((state) => state.settings.elamEnabled !== false);
  const compact = useStore((state) => state.settings.elamCompact === true);
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = reduceMotionSetting || prefersReducedMotion;
  const pageStorageKey = useMemo(() => storageKey(bookId, page), [bookId, page]);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ElamMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvedText, setResolvedText] = useState(pageText);
  const [contextState, setContextState] = useState<"ready" | "loading" | "error">(
    pageText.trim() ? "ready" : "loading",
  );
  const requestRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) {
      requestRef.current?.abort();
      setOpen(false);
      return;
    }
    requestRef.current?.abort();
    setLoading(false);
    setInput("");
    setMessages(profileGetJSON<ElamMessage[]>(scholarClass, pageStorageKey, []));
    setResolvedText(pageText);
    if (pageText.trim()) {
      setContextState("ready");
      return;
    }
    if (!resolvePageText) {
      setContextState("error");
      return;
    }

    let active = true;
    setContextState("loading");
    resolvePageText()
      .then((text) => {
        if (!active) return;
        setResolvedText(text);
        setContextState(text.trim() ? "ready" : "error");
      })
      .catch(() => {
        if (active) setContextState("error");
      });
    return () => {
      active = false;
    };
  }, [enabled, pageStorageKey, pageText, resolvePageText, scholarClass]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  }, [messages, loading, open, reducedMotion]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const persistMessages = (next: ElamMessage[]) => {
    setMessages(next);
    profileSetJSON(scholarClass, pageStorageKey, next.slice(-20));
  };

  const ask = async (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading || contextState !== "ready") return;
    const userMessage: ElamMessage = { id: `user-${Date.now()}`, role: "user", content: cleanQuestion };
    const nextMessages = [...messages, userMessage];
    persistMessages(nextMessages);
    setInput("");
    setLoading(true);
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;

    const history: ChatMessage[] = messages.slice(-6).map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4_000),
    }));
    const prompt = [
      `You are ELAM, Scholar's gentle page companion for CBSE Class ${scholarClass}.`,
      `You are attached only to ${bookTitle}, ${subject}, page ${page}${chapter ? `, chapter "${chapter}"` : ""}.`,
      "Ground every response in the authoritative CURRENT PAGE TEXT below. Do not switch to another page, book, chapter, or class.",
      "A question printed on the page is valid page context. If the student asks to solve or explain that visible question, use your subject expertise to give the complete answer even when the printed page contains only the question and not its solution.",
      "Only say that something is absent when neither the topic nor the question appears in the current page text. Never claim a visibly printed question lacks enough information merely because its answer is not printed beside it.",
      "Keep explanations warm, accurate, concise, and easy to study. Preserve equations and notation.",
      `CURRENT PAGE TEXT:\n${resolvedText.slice(0, 12_000)}`,
      `STUDENT QUESTION:\n${cleanQuestion}`,
    ].join("\n\n");

    try {
      const answer = await askAI(prompt, subject === "Physics" ? "physics-11" : subject === "Chemistry" ? "chemistry-11" : "mr-raj", {
        history,
        temperature: 0.3,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      persistMessages([...nextMessages, { id: `elam-${Date.now()}`, role: "assistant", content: answer }]);
    } catch (error) {
      if (controller.signal.aborted) return;
      persistMessages([
        ...nextMessages,
        {
          id: `elam-error-${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? error.message : "I couldn't answer from this page just now. Please try again.",
        },
      ]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(input);
  };

  const clearPageChat = () => {
    requestRef.current?.abort();
    setLoading(false);
    persistMessages([]);
  };

  if (!enabled) return null;

  return (
    <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-[160] sm:bottom-5 sm:right-5" style={{ fontFamily: '"Nunito", "Quicksand", ui-rounded, system-ui, sans-serif' }}>
      <AnimatePresence>
        {open && (
          <motion.section
            key={`${bookId}-${page}`}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: reducedMotion ? 0.08 : 0.24, ease: [0.16, 1, 0.3, 1] }}
            className={cn("absolute right-0 flex flex-col overflow-hidden border border-white/20 bg-[linear-gradient(145deg,rgba(20,22,37,.82),rgba(7,9,18,.9))] text-white shadow-[0_26px_90px_rgba(49,46,129,.48)] backdrop-blur-2xl", compact ? "bottom-13 h-[min(27rem,58dvh)] w-[min(19rem,calc(100vw-1.5rem))] rounded-[1.4rem]" : "bottom-16 h-[min(34rem,68dvh)] w-[min(23rem,calc(100vw-1.5rem))] rounded-[1.75rem]")}
            role="dialog"
            aria-label={`ELAM assistant for ${bookTitle} page ${page}`}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_2%,rgba(129,140,248,.24),transparent_36%),radial-gradient(circle_at_4%_90%,rgba(45,212,191,.13),transparent_34%)]" />
            <header className="relative flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
              <div className="relative grid h-10 w-10 place-items-center rounded-2xl border border-indigo-300/30 bg-indigo-400/15 shadow-[0_0_24px_rgba(129,140,248,.35)]">
                <MessageCircleHeart className="h-5 w-5 text-indigo-200" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#141625] bg-emerald-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><h2 className="font-extrabold tracking-wide">ELAM</h2><Sparkles className="h-3.5 w-3.5 text-amber-200" /></div>
                <p className="truncate text-[11px] text-white/50">{subject} · Page {page}{chapter ? ` · ${chapter}` : ""}</p>
              </div>
              <button onClick={clearPageChat} className="rounded-full p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white" aria-label="Clear ELAM chat for this page"><Eraser className="h-4 w-4" /></button>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close ELAM"><X className="h-4 w-4" /></button>
            </header>

            <div ref={scrollRef} className="relative flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              <div className="rounded-2xl rounded-tl-md border border-indigo-300/15 bg-indigo-300/10 p-3 text-sm leading-6 text-indigo-50/90">
                Hi! I’m ELAM ✨ I’ve been given only this page, so we can understand it together without wandering into another chapter.
              </div>

              {contextState === "loading" && (
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60" role="status"><Loader2 className="h-4 w-4 animate-spin text-indigo-300" /> Reading every line on page {page}…</div>
              )}
              {contextState === "error" && (
                <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-xs leading-5 text-rose-100">I couldn’t read this page’s text yet, so I won’t guess about its contents.</div>
              )}

              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={reducedMotion ? false : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={message.role === "user" ? "ml-8 rounded-2xl rounded-tr-md bg-white px-3.5 py-2.5 text-sm text-slate-900" : "mr-3 rounded-2xl rounded-tl-md border border-indigo-300/15 bg-indigo-300/10 px-3.5 py-2.5 text-sm leading-6 text-indigo-50/90"}
                >
                  {message.role === "assistant" ? <Markdown content={message.content} /> : message.content}
                </motion.div>
              ))}
              {loading && <div className="mr-auto flex w-fit items-center gap-1.5 rounded-2xl rounded-tl-md bg-indigo-300/10 px-3 py-2 text-xs text-indigo-100/65"><Loader2 className="h-3.5 w-3.5 animate-spin" /> ELAM is thinking from this page…</div>}
            </div>

            {messages.length === 0 && contextState === "ready" && (
              <div className="relative flex gap-2 overflow-x-auto px-4 pb-2">
                {SUGGESTIONS.map((suggestion) => <button key={suggestion} onClick={() => void ask(suggestion)} className="shrink-0 rounded-full border border-white/12 bg-white/[.06] px-3 py-1.5 text-[11px] text-white/65 transition-colors hover:bg-white/10 hover:text-white">{suggestion}</button>)}
              </div>
            )}

            <form onSubmit={submit} className="relative border-t border-white/10 p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-white/12 bg-black/20 p-1.5 focus-within:border-indigo-300/35">
                <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(input); } }} disabled={contextState !== "ready" || loading} rows={1} placeholder={contextState === "loading" ? "ELAM is reading this page…" : "Ask only about this page…"} aria-label="Ask ELAM about this page" className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/30 disabled:cursor-wait" />
                <button type="submit" disabled={!input.trim() || loading || contextState !== "ready"} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-35" aria-label="Send message to ELAM"><Send className="h-4 w-4" /></button>
              </div>
              <p className="mt-1.5 flex items-center justify-center gap-1 text-[9px] text-white/30"><BookOpen className="h-2.5 w-2.5" /> Grounded only in page {page}</p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((value) => !value)}
        whileHover={reducedMotion ? undefined : { scale: 1.06 }}
        whileTap={reducedMotion ? undefined : { scale: 0.94 }}
        className={cn("group relative grid place-items-center rounded-full border border-white/30 bg-[linear-gradient(145deg,rgba(129,140,248,.36),rgba(45,212,191,.16))] text-white shadow-[0_0_18px_rgba(129,140,248,.58),0_12px_38px_rgba(0,0,0,.45)] backdrop-blur-2xl", compact ? "h-11 w-11" : "h-14 w-14")}
        aria-label={open ? "Close ELAM page assistant" : `Open ELAM for page ${page}`}
        aria-expanded={open}
      >
        {!reducedMotion && <span className="absolute inset-0 animate-ping rounded-full border border-indigo-300/35 opacity-35" aria-hidden="true" />}
        <Bot className={cn("text-indigo-100 transition-transform group-hover:rotate-6", compact ? "h-5 w-5" : "h-6 w-6")} />
        {!compact && <span className="absolute -right-1 -top-1 rounded-full border border-white/25 bg-[#17182a] px-1.5 py-0.5 text-[8px] font-black tracking-wide text-indigo-100">ELAM</span>}
      </motion.button>
    </div>
  );
}
