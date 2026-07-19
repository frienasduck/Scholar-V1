"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Copy, Expand, History, Loader2, Maximize2, Mic, MicOff, Pause, Play, Plus, RotateCcw, Send, Settings, Sparkles, Square, Volume2, VolumeX, X } from "lucide-react";
import { Markdown } from "@/lib/shared";
import { useStore } from "@/lib/store";
import { navigateTo } from "@/lib/nav-event";
import { consumeLamDraft, getLamPageContext, type LamRuntimeContext } from "@/lib/lam-context";
import { cn } from "@/lib/utils";
import { createLamConversation, loadLamState, saveLamState } from "@/lib/lam/storage";
import { cleanSpeechText, containsWakePhrase, isSleepPhrase } from "@/lib/lam/speech";
import { parseLocalCommand, type LamAction } from "@/lib/lam/commands";
import { LAM_MODES, type LamConversation, type LamMessage, type LamMode, type LamPageContext, type LamProfileState } from "@/lib/lam/types";

type RecognitionEvent = Event & { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> };
type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null; onerror: ((event: Event & { error?: string }) => void) | null; onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

const labels: Record<LamMode, string> = {
  general: "General", tutor: "Tutor", "doubt-solver": "Doubt Solver", "current-page": "Current Page", "question-coach": "Question Coach",
  "study-planner": "Study Planner", "revision-coach": "Revision Coach", "quiz-master": "Quiz Master", "focus-companion": "Focus Companion",
  "code-tutor": "Code Tutor", "ebook-companion": "E-Book Companion", "experiment-guide": "Experiment Guide",
};

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const value = window as typeof window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return value.SpeechRecognition ?? value.webkitSpeechRecognition ?? null;
}

function uid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

export function LamWidget({ currentView, subject, chapter, summary, concepts }: { currentView?: string; scholarClass?: 9 | 11; subject?: string; chapter?: string; summary?: string; concepts?: string[] }) {
  const user = useStore((state) => state.user);
  const addNote = useStore((state) => state.addNote);
  const settings = useStore((state) => state.settings);
  const profileId = `class-${user.scholarClass}`;
  const [state, setState] = useState<LamProfileState>(() => loadLamState(profileId));
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"sleeping" | "armed" | "listening" | "thinking" | "speaking" | "error">("sleeping");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [runtimeContext, setRuntimeContext] = useState<LamRuntimeContext>(() => getLamPageContext());
  const [pendingAction, setPendingAction] = useState<LamAction | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const wakeRecognitionRef = useRef<Recognition | null>(null);
  const startListeningRef = useRef<(wakeMode?: boolean) => void>(() => {});
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const conversation = useMemo(() => state.conversations.find((item) => item.id === state.activeConversationId) ?? state.conversations[0], [state]);
  const prefs = state.preferences;
  const context: LamPageContext = useMemo(() => ({
    profileId, profileName: user.name, scholarClass: user.scholarClass,
    currentView: currentView ?? (typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean)[0] : "dashboard") ?? "dashboard",
    currentRoute: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/",
    subjectTitle: runtimeContext.subjectTitle ?? subject, chapterTitle: runtimeContext.chapterTitle ?? chapter,
    ebookTitle: runtimeContext.ebookTitle ?? ((currentView === "ebook") ? "Mathematics Part 1" : undefined),
    sourcePageNumber: runtimeContext.sourcePageNumber,
    selectedQuestionId: runtimeContext.selectedQuestionId,
    selectedText: selectedText || undefined,
  }), [chapter, currentView, profileId, runtimeContext, selectedText, subject, user.name, user.scholarClass]);

  const commit = useCallback((updater: (previous: LamProfileState) => LamProfileState) => {
    setState((previous) => { const next = updater(previous); saveLamState(next); return next; });
  }, []);

  useEffect(() => { setState(loadLamState(profileId)); setStatus("sleeping"); setOpen(false); }, [profileId]);
  useEffect(() => {
    const sync = (event: Event) => {
      const changedProfile = (event as CustomEvent<{ profileId?: string }>).detail?.profileId;
      if (changedProfile === profileId) setState(loadLamState(profileId));
    };
    window.addEventListener("scholar:lam-state", sync);
    return () => window.removeEventListener("scholar:lam-state", sync);
  }, [profileId]);
  useEffect(() => { const draft = consumeLamDraft(); if (draft) { setInput(draft.prompt); setOpen(true); } }, []);
  useEffect(() => { if (open) window.setTimeout(() => composerRef.current?.focus(), 60); }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [conversation?.messages, status]);
  useEffect(() => {
    const onSelection = () => {
      const target = window.getSelection()?.toString().trim() ?? "";
      if (target.length >= 3 && target.length <= 4_000) setSelectedText(target);
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);
  useEffect(() => {
    const sync = (event: Event) => setRuntimeContext((event as CustomEvent<LamRuntimeContext>).detail ?? {});
    window.addEventListener("scholar:lam-context", sync);
    const timer = window.setTimeout(() => setRuntimeContext(getLamPageContext()), 0);
    return () => { window.clearTimeout(timer); window.removeEventListener("scholar:lam-context", sync); };
  }, [currentView]);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    setStatus(prefs.wakeWordEnabled ? "armed" : "sleeping");
  }, [prefs.wakeWordEnabled]);

  const speak = useCallback((text: string) => {
    if (!prefs.voiceRepliesEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanSpeechText(text));
    utterance.rate = prefs.speechRate; utterance.pitch = prefs.speechPitch; utterance.volume = prefs.speechVolume;
    const voice = window.speechSynthesis.getVoices().find((item) => item.name === prefs.selectedVoice);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => {
      setStatus(prefs.wakeWordEnabled ? "armed" : "sleeping");
      if (prefs.followUpListeningEnabled) window.setTimeout(() => startListeningRef.current(false), 250);
    };
    utterance.onerror = () => setStatus("error");
    window.speechSynthesis.speak(utterance);
  }, [prefs]);

  const addMessage = useCallback((message: LamMessage) => {
    commit((previous) => ({ ...previous, conversations: previous.conversations.map((item) => item.id === previous.activeConversationId ? {
      ...item, title: item.messages.length === 0 && message.role === "user" ? message.content.slice(0, 48) : item.title,
      messages: [...item.messages, message].slice(-150), updatedAt: now(),
    } : item) }));
  }, [commit]);

  const executeAction = useCallback((action: LamAction) => {
    try {
      if (action.type === "navigate") navigateTo(action.view);
      else if (action.type === "create-note") addNote({ title: action.title, content: action.content, folder: "LAM" });
      else if (action.type === "start-focus") navigateTo("focus", { minutes: action.minutes, source: "lam" });
      commit((previous) => ({ ...previous, actionHistory: [{ id: uid(), action: action.type, result: "success" as const, at: now() }, ...previous.actionHistory].slice(0, 100) }));
      addMessage({ id: uid(), role: "tool", content: action.type === "navigate" ? `Opened ${action.view}.` : action.type === "create-note" ? `Created note “${action.title}”.` : `Opened Focus with a ${action.minutes}-minute session request.`, createdAt: now() });
      setPendingAction(null);
    } catch {
      setError("Scholar could not complete that action.");
    }
  }, [addMessage, addNote, commit]);

  const send = useCallback(async (preset?: string, inputMode: "text" | "voice" = "text") => {
    const content = (preset ?? input).trim();
    if (!content || status === "thinking") return;
    if (isSleepPhrase(content)) { setInput(""); stopSpeech(); recognitionRef.current?.abort(); setOpen(false); return; }
    setInput(""); setInterim(""); setError(""); setOpen(true);
    addMessage({ id: uid(), role: "user", content, inputMode, createdAt: now() });
    const local = parseLocalCommand(content);
    if (local?.type === "navigate") { executeAction(local); return; }
    if (local?.type === "start-focus") { setPendingAction(local); return; }
    if (/\b(save|add|turn) (this|that|the answer|response) (as|to) (a |my )?note\b/i.test(content)) {
      const answer = [...conversation.messages].reverse().find((message) => message.role === "assistant")?.content;
      if (answer) { setPendingAction({ type: "create-note", title: `LAM · ${context.chapterTitle ?? context.currentView}`, content: answer }); return; }
    }
    setStatus("thinking");
    const controller = new AbortController(); abortRef.current = controller;
    const assistantId = uid(); let full = "";
    addMessage({ id: assistantId, role: "assistant", content: "", createdAt: now() });
    try {
      const response = await fetch("/api/lam/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({
        profileId, message: content, inputMode, assistantMode: conversation.mode, pageContext: context,
        messages: conversation.messages.filter((message) => message.role !== "tool" && message.content).slice(-10).map(({ role, content: value }) => ({ role, content: value })),
      }) });
      if (!response.ok || !response.body) { const data = await response.json().catch(() => null) as { error?: string } | null; throw new Error(data?.error ?? "LAM could not connect to Groq."); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
        const frames = buffer.split("\n\n"); buffer = frames.pop() ?? "";
        for (const frame of frames) for (const line of frame.split("\n")) if (line.startsWith("data:")) {
          const event = JSON.parse(line.slice(5).trim()) as { type: string; value?: string; message?: string };
          if (event.type === "text-delta" && event.value) {
            full += event.value;
            commit((previous) => ({ ...previous, conversations: previous.conversations.map((item) => item.id === previous.activeConversationId ? { ...item, messages: item.messages.map((message) => message.id === assistantId ? { ...message, content: full } : message), updatedAt: now() } : item) }));
          }
          if (event.type === "error") throw new Error(event.message ?? "LAM could not answer.");
        }
      }
      if (!full.trim()) throw new Error("LAM returned an empty response.");
      setStatus("sleeping"); speak(full);
      if (prefs.followUpListeningEnabled && !prefs.voiceRepliesEnabled) window.setTimeout(() => startListeningRef.current(false), 250);
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "LAM could not answer.");
      setStatus("error");
    } finally { abortRef.current = null; }
  }, [addMessage, commit, context, conversation, executeAction, input, prefs.followUpListeningEnabled, prefs.voiceRepliesEnabled, profileId, speak, status, stopSpeech]);

  const startListening = useCallback((wakeMode = false) => {
    const Ctor = recognitionCtor();
    if (!Ctor) { setError("Voice recognition is unavailable in this browser. You can still type to LAM."); setStatus("error"); setOpen(true); return; }
    if (status === "speaking") stopSpeech();
    const recognition = new Ctor(); recognition.continuous = wakeMode; recognition.interimResults = !wakeMode; recognition.lang = "en-IN";
    if (wakeMode) wakeRecognitionRef.current = recognition; else recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      let final = ""; let partial = "";
      for (let index = 0; index < event.results.length; index++) {
        const value = event.results[index][0]?.transcript ?? "";
        if (event.results[index].isFinal) final += value; else partial += value;
      }
      if (wakeMode) {
        if (containsWakePhrase(final || partial)) { recognition.stop(); setOpen(true); setStatus("listening"); window.setTimeout(() => startListening(false), 250); }
      } else {
        setInterim(partial || final);
        if (final.trim()) { recognition.stop(); void send(final, "voice"); }
      }
    };
    recognition.onerror = (event) => { if (event.error !== "aborted" && event.error !== "no-speech") { setError(event.error === "not-allowed" ? "Microphone access is blocked. Enable it in browser permissions or type instead." : "Voice recognition stopped. You can retry or type instead."); setStatus("error"); } };
    recognition.onend = () => { if (wakeMode && prefs.wakeWordEnabled && status !== "speaking") window.setTimeout(() => startListening(true), 600); else if (!wakeMode && status === "listening") setStatus("sleeping"); };
    try { recognition.start(); setStatus(wakeMode ? "armed" : "listening"); if (!wakeMode) setOpen(true); } catch { setError("The microphone is already in use."); setStatus("error"); }
  }, [prefs.wakeWordEnabled, send, status, stopSpeech]);
  startListeningRef.current = startListening;

  useEffect(() => {
    if (!prefs.wakeWordEnabled) { wakeRecognitionRef.current?.abort(); if (status === "armed") setStatus("sleeping"); return; }
    startListening(true);
    return () => wakeRecognitionRef.current?.abort();
  }, [prefs.wakeWordEnabled]); // startListening deliberately excluded to avoid recognition restart loops

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, [contenteditable=true]");
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === "KeyL") { event.preventDefault(); setOpen(true); }
      if (!typing && (event.ctrlKey || event.metaKey) && event.shiftKey && event.code === "Space") { event.preventDefault(); startListening(false); }
      if (event.key === "Escape" && (status === "listening" || status === "speaking")) { recognitionRef.current?.abort(); stopSpeech(); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [startListening, status, stopSpeech]);

  const newChat = () => {
    const created = createLamConversation(profileId);
    commit((previous) => ({ ...previous, activeConversationId: created.id, conversations: [created, ...previous.conversations] }));
    setHistoryOpen(false); setInput(""); setInterim(""); setError(""); setPendingAction(null);
  };
  const updatePrefs = (patch: Partial<LamProfileState["preferences"]>) => commit((previous) => ({ ...previous, preferences: { ...previous.preferences, ...patch } }));
  const setMode = (mode: LamMode) => commit((previous) => ({ ...previous, conversations: previous.conversations.map((item) => item.id === previous.activeConversationId ? { ...item, mode, updatedAt: now() } : item) }));

  const quick = context.currentView === "ebook" ? ["Explain this page", "Quiz me from this page", "What are the key formulas?"] : context.currentView === "dashboard" ? ["Plan my study today", "Show my weakest topic", "What should I continue?"] : ["Explain what I am viewing", "Quiz me", "What should I revise first?"];
  const glass = prefs.reduceTransparency ? "bg-slate-950 border-white/25" : "bg-slate-950/78 backdrop-blur-2xl border-white/20";

  return (
    <aside className="fixed bottom-[calc(5.5rem+var(--safe-area-bottom))] right-3 z-[70] lg:bottom-5 lg:right-5" aria-label="LAM personal assistant">
      {open && !prefs.onboardingComplete && (
        <div className={cn("mb-3 flex h-[min(25rem,62dvh)] w-[min(23rem,calc(100vw-2rem))] flex-col justify-between overflow-y-auto rounded-[1.75rem] border p-5 text-white shadow-2xl sm:h-[28rem] sm:w-[25rem] sm:rounded-[2rem] sm:p-6", glass)}>
          <button className="ml-auto rounded-full p-2 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close LAM"><X className="h-4 w-4" /></button>
          <div className="text-center">
            <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-cyan-300 via-blue-500 to-violet-600 shadow-xl shadow-cyan-400/20"><Sparkles /></div>
            <h2 className="text-2xl font-semibold">{["Meet LAM", "Talk naturally", "LAM understands Scholar", "You stay in control"][onboardingStep]}</h2>
            <p className="mt-3 text-sm leading-6 text-white/65">{[
              "Your personal study assistant inside Scholar.", "Say “Hey Lam,” tap the orb, use push-to-talk, or type.",
              "It can use your current page, chapter, selection, questions, and real progress.", "Important actions are previewed first. Voice activation stays off until you enable it.",
            ][onboardingStep]}</p>
          </div>
          <div className="flex gap-2">
            {onboardingStep > 0 && <button onClick={() => setOnboardingStep((step) => step - 1)} className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm">Back</button>}
            <button onClick={() => onboardingStep < 3 ? setOnboardingStep((step) => step + 1) : updatePrefs({ onboardingComplete: true })} className="flex-1 rounded-xl bg-cyan-300 py-2.5 text-sm font-semibold text-slate-950">{onboardingStep < 3 ? "Continue" : "Start using LAM"}</button>
          </div>
        </div>
      )}

      {open && prefs.onboardingComplete && (
          <div className={cn("mb-3 flex flex-col overflow-hidden border text-white shadow-2xl shadow-cyan-500/10 transition-[width,height]", glass, fullscreen ? "fixed inset-2 h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] rounded-[1.75rem] sm:inset-5 sm:h-[calc(100dvh-2.5rem)] sm:w-[calc(100vw-2.5rem)] sm:rounded-[2rem]" : "h-[min(31rem,62dvh)] w-[min(24rem,calc(100vw-2rem))] rounded-[1.75rem] sm:h-[min(40rem,calc(100dvh-8rem))] sm:w-[28rem] sm:rounded-[2rem]")}>
          <header className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
            <span className={cn("relative grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan-300 via-blue-500 to-violet-600", status !== "sleeping" && "shadow-lg shadow-cyan-400/30")}><Bot className="h-4 w-4" />{status === "armed" && <i className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />}</span>
            <div className="min-w-0 flex-1"><p className="font-semibold">LAM</p><p className="truncate text-[11px] text-white/50">{status === "thinking" ? "Thinking…" : status === "listening" ? "Listening…" : status === "speaking" ? "Speaking…" : `${user.name} · ${context.currentView}`}</p></div>
            <button onClick={() => setHistoryOpen((value) => !value)} className="rounded-full p-2 hover:bg-white/10" aria-label="Conversation history"><History className="h-4 w-4" /></button>
            <button onClick={newChat} className="rounded-full p-2 hover:bg-white/10" aria-label="New LAM chat"><Plus className="h-4 w-4" /></button>
            <button onClick={() => setFullscreen((value) => !value)} className="rounded-full p-2 hover:bg-white/10" aria-label={fullscreen ? "Exit fullscreen LAM" : "Fullscreen LAM"}>{fullscreen ? <Expand className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
            <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Close LAM"><X className="h-4 w-4" /></button>
          </header>

          <div className="flex items-center gap-2 overflow-x-auto border-b border-white/8 px-3 py-2 no-scrollbar">
            <select value={conversation.mode} onChange={(event) => setMode(event.target.value as LamMode)} className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs outline-none" aria-label="LAM mode">
              {LAM_MODES.map((mode) => <option key={mode} value={mode} className="bg-slate-900">{labels[mode]}</option>)}
            </select>
            <span className="whitespace-nowrap rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100">{context.currentView}</span>
            {context.subjectTitle && <span className="whitespace-nowrap rounded-full bg-white/8 px-2.5 py-1 text-[11px]">{context.subjectTitle}</span>}
            {context.chapterTitle && <span className="max-w-44 truncate rounded-full bg-white/8 px-2.5 py-1 text-[11px]">{context.chapterTitle}</span>}
            {selectedText && <button onClick={() => setSelectedText("")} className="whitespace-nowrap rounded-full bg-violet-400/15 px-2.5 py-1 text-[11px] text-violet-100">Selection ×</button>}
          </div>

          {historyOpen && <div className="absolute inset-x-3 top-16 z-20 max-h-72 overflow-y-auto rounded-2xl border border-white/15 bg-slate-950 p-2 shadow-2xl">
            <p className="px-2 py-1 text-xs font-semibold text-white/60">Profile conversations · {user.name}</p>
            {state.conversations.map((item) => <button key={item.id} onClick={() => { commit((previous) => ({ ...previous, activeConversationId: item.id })); setHistoryOpen(false); }} className={cn("block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/8", item.id === state.activeConversationId && "bg-white/10")}>{item.title}<span className="block text-[10px] text-white/40">{labels[item.mode]} · {item.messages.length} messages</span></button>)}
          </div>}

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" aria-busy={status === "thinking"}>
            {!conversation.messages.length && <div className="space-y-4"><p className="text-sm leading-6 text-white/65">Ask naturally. LAM can use this page, switch Scholar sections, and preview changes before saving them.</p><div className="grid gap-2">{quick.map((item) => <button key={item} onClick={() => void send(item)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-xs hover:bg-white/10">{item}</button>)}</div></div>}
            {conversation.messages.map((message) => <article key={message.id} className={cn("group rounded-2xl px-3 py-2.5 text-sm", message.role === "user" ? "ml-10 bg-cyan-300 text-slate-950" : message.role === "tool" ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-50" : "mr-3 bg-white/8")}>
              {message.role === "assistant" ? <Markdown content={message.content || "…"} /> : <p className="whitespace-pre-wrap">{message.content}</p>}
              {message.role === "assistant" && message.content && <div className="mt-2 flex flex-wrap gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100"><button onClick={() => navigator.clipboard.writeText(message.content)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Copy response"><Copy className="h-3 w-3" /></button><button onClick={() => speak(message.content)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Read response aloud"><Volume2 className="h-3 w-3" /></button><button onClick={() => void send("I still don't understand. Explain it more simply with a tiny example, then return to my question.")} className="rounded-lg px-2 py-1 text-[10px] hover:bg-white/10">Still don’t understand?</button></div>}
            </article>)}
            {pendingAction && <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Confirm Scholar action</p><p className="mt-2 text-sm">{pendingAction.type === "create-note" ? `Create note “${pendingAction.title}” in the LAM folder` : pendingAction.type === "start-focus" ? `Open a ${pendingAction.minutes}-minute focus session` : `Open ${pendingAction.view}`}</p><div className="mt-3 flex gap-2"><button onClick={() => { setPendingAction(null); commit((previous) => ({ ...previous, actionHistory: [{ id: uid(), action: pendingAction.type, result: "cancelled" as const, at: now() }, ...previous.actionHistory] })); }} className="rounded-xl border border-white/15 px-3 py-2 text-xs">Cancel</button><button onClick={() => executeAction(pendingAction)} className="rounded-xl bg-amber-200 px-3 py-2 text-xs font-semibold text-slate-950"><Check className="mr-1 inline h-3 w-3" />Confirm</button></div></div>}
            {status === "thinking" && <div className="flex items-center gap-2 text-xs text-white/60"><Loader2 className="h-3.5 w-3.5 animate-spin" />LAM is thinking… <button onClick={() => abortRef.current?.abort()} className="ml-auto rounded-lg px-2 py-1 hover:bg-white/10">Cancel</button></div>}
            {status === "listening" && <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/8 p-3"><div className="flex items-center gap-2 text-sm"><Mic className="h-4 w-4 text-cyan-300" /><span>Listening…</span><span className="ml-auto flex gap-1" aria-hidden="true">{[1,2,3,4].map((bar) => <i key={bar} className="h-4 w-1 animate-pulse rounded-full bg-cyan-300" style={{ animationDelay: `${bar * 90}ms` }} />)}</span></div>{interim && <p className="mt-2 text-xs text-white/60">{interim}</p>}<button onClick={() => { recognitionRef.current?.stop(); setStatus("sleeping"); }} className="mt-2 text-xs text-white/60 underline">Stop listening</button></div>}
            {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100">{error}</div>}
            <div ref={endRef} />
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar">{quick.map((item) => <button key={item} onClick={() => void send(item)} className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] hover:bg-white/10">{item}</button>)}</div>
            <div className="flex items-end gap-1 rounded-2xl border border-white/10 bg-white/7 p-2">
              <button onClick={() => status === "listening" ? (recognitionRef.current?.abort(), setStatus("sleeping")) : startListening(false)} className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", status === "listening" ? "bg-rose-400 text-slate-950" : "hover:bg-white/10")} aria-label={status === "listening" ? "Stop listening" : "Talk to LAM"}>{status === "listening" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
              <textarea ref={composerRef} value={input} maxLength={4000} rows={2} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void send(); } }} placeholder="Message LAM…" className="min-h-10 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-white/35" aria-label="Message LAM" />
              {status === "speaking" ? <button onClick={stopSpeech} className="grid h-10 w-10 place-items-center rounded-xl bg-rose-400 text-slate-950" aria-label="Stop speaking"><Square className="h-4 w-4" /></button> : <button onClick={() => void send()} disabled={!input.trim() || status === "thinking"} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300 text-slate-950 disabled:opacity-35" aria-label="Send message"><Send className="h-4 w-4" /></button>}
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-white/35"><span>Ctrl/⌘ Shift L · Open</span><button onClick={() => navigateTo("settings", { tab: "lam" })} className="flex items-center gap-1 hover:text-white"><Settings className="h-3 w-3" />LAM settings</button></div>
          </div>
        </div>
      )}

      {!open && status === "listening" && <div className={cn("mb-2 flex items-center gap-3 rounded-full border px-4 py-2 text-sm text-white", glass)}><Mic className="h-4 w-4 text-cyan-300" />Listening…<button onClick={() => recognitionRef.current?.abort()} aria-label="Stop listening"><Square className="h-3.5 w-3.5" /></button></div>}
      <button onClick={() => setOpen((value) => !value)} aria-expanded={open} className={cn("ml-auto flex items-center gap-2 rounded-full border px-3 py-2.5 text-sm font-semibold text-white shadow-xl", glass)}>
        <span className={cn("relative grid place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-600", prefs.compactOrb ? "h-7 w-7" : "h-9 w-9", status !== "sleeping" && !settings.reduceMotion && "animate-pulse")}><Sparkles className="h-3.5 w-3.5" />{status === "armed" && <i className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />}</span>
        {!prefs.compactOrb && <>LAM <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} /></>}
      </button>
      <span className="sr-only" role="status" aria-live="assertive">LAM is {status}</span>
    </aside>
  );
}
