"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, Copy, Expand, FileText, History, Maximize2, Mic, MicOff, Pencil, Pin, Plus, Search, Send, Settings, Sparkles, Square, Trash2, Volume2, X } from "lucide-react";
import { Markdown } from "@/lib/shared";
import { useStore } from "@/lib/store";
import { navigateTo } from "@/lib/nav-event";
import { consumeLamDraft, getLamPageContext, type LamRuntimeContext } from "@/lib/lam-context";
import { cn } from "@/lib/utils";
import { createLamConversation, loadLamState, saveLamState } from "@/lib/lam/storage";
import { cleanSpeechText, containsWakePhrase, isSleepPhrase } from "@/lib/lam/speech";
import { parseLocalCommand, type LamAction } from "@/lib/lam/commands";
import { type LamConversation, type LamMessage, type LamMode, type LamPageContext, type LamProfileState } from "@/lib/lam/types";
import { LiquidGlassSurface } from "@/components/lam/liquid-glass-surface";
import { LamMark } from "@/components/lam/lam-mark";
import { LamResponse } from "@/components/lam/lam-response";
import { GlassModeMenu } from "@/components/lam/glass-mode-menu";
import { GlassWaveListening, LamQuickActionChip, LamThinkingState } from "@/components/lam/lam-glass-states";
import { microphoneEnvironmentError, microphoneErrorMessage, queryMicrophonePermission, requestMicrophoneStream, stopMediaStream, type MicrophonePermissionState } from "@/lib/lam/microphone";
import { useLamRenderQuality } from "@/lib/lam/render-quality";
import { animateLamWakeReveal } from "@/lib/animation/lam-animations";
import { resolveScholarAnimationQuality } from "@/lib/animation/animation-preferences";

type RecognitionEvent = Event & { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> };
type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null; onerror: ((event: Event & { error?: string }) => void) | null; onend: (() => void) | null;
  onstart: (() => void) | null;
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

function playLamActivationSound() {
  try {
    const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const audio = new AudioContextCtor();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.setValueAtTime(620, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, audio.currentTime + 0.11);
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.14);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + 0.15);
    oscillator.onended = () => void audio.close();
  } catch { /* activation sound is optional */ }
}

type LamWidgetProps = { currentView?: string; scholarClass?: 9 | 11; subject?: string; chapter?: string; summary?: string; concepts?: string[] };

export function LamWidget(props: LamWidgetProps) {
  const mobileMode = useStore((state) => state.settings.mobileLamMode ?? "off");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  if (isMobile && mobileMode === "off") return null;
  return <LamWidgetRuntime {...props} compactMobile={isMobile && mobileMode === "compact"} />;
}

function LamWidgetRuntime({ currentView, subject, chapter, summary, concepts, compactMobile }: LamWidgetProps & { compactMobile: boolean }) {
  const user = useStore((state) => state.user);
  const addNote = useStore((state) => state.addNote);
  const settings = useStore((state) => state.settings);
  const mastery = useStore((state) => state.mastery);
  const quizAttempts = useStore((state) => state.quizAttempts);
  const notes = useStore((state) => state.notes);
  const files = useStore((state) => state.files);
  const profileId = `class-${user.scholarClass}`;
  const [state, setState] = useState<LamProfileState>(() => loadLamState(profileId));
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"sleeping" | "armed" | "listening" | "transcribing" | "suspended" | "thinking" | "speaking" | "performing" | "completed" | "error">("sleeping");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [runtimeContext, setRuntimeContext] = useState<LamRuntimeContext>(() => getLamPageContext());
  const [pendingAction, setPendingAction] = useState<LamAction | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [historyQuery, setHistoryQuery] = useState("");
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number } | null>(null);
  const [microphonePermission, setMicrophonePermission] = useState<MicrophonePermissionState>("unsupported");
  const [handsFreeNeedsResume, setHandsFreeNeedsResume] = useState(false);
  const renderQuality = useLamRenderQuality();
  const renderQualityRef = useRef(renderQuality);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const voiceTransitionTimerRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wakeHeaderRef = useRef<HTMLElement>(null);
  const wakeContextRef = useRef<HTMLDivElement>(null);
  const internalSaveRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const wakeRecognitionRef = useRef<Recognition | null>(null);
  const recognitionGenerationRef = useRef(0);
  const wakeRestartTimerRef = useRef<number | null>(null);
  const startListeningRef = useRef<(wakeMode?: boolean) => void>(() => {});
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const conversation = useMemo(() => state.conversations.find((item) => item.id === state.activeConversationId) ?? state.conversations[0], [state]);
  const prefs = state.preferences;
  useEffect(() => { if (!prefs.assistantEnabled) setOpen(false); }, [prefs.assistantEnabled]);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-lam-docked", prefs.assistantEnabled);
    return () => document.documentElement.removeAttribute("data-lam-docked");
  }, [prefs.assistantEnabled]);
  useEffect(() => { renderQualityRef.current = renderQuality; }, [renderQuality]);
  const weakTopics = useMemo(() => Object.entries(mastery).filter(([, value]) => value < 45).sort((a, b) => a[1] - b[1]).slice(0, 4).map(([topic]) => topic), [mastery]);
  const recentQuiz = quizAttempts[0];
  const context: LamPageContext = useMemo(() => ({
    profileId, profileName: settings.includeProfileInAI === false ? `Class ${user.scholarClass} student` : user.name, scholarClass: user.scholarClass,
    currentView: currentView ?? (typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean)[0] : "dashboard") ?? "dashboard",
    currentRoute: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/",
    subjectTitle: settings.lamPageContext === false || !prefs.currentScreenContext ? undefined : runtimeContext.subjectTitle ?? subject,
    chapterTitle: settings.lamPageContext === false || !prefs.currentScreenContext ? undefined : runtimeContext.chapterTitle ?? chapter,
    ebookTitle: settings.lamPageContext === false || !prefs.currentScreenContext ? undefined : runtimeContext.ebookTitle ?? ((currentView === "ebook") ? "Mathematics Part 1" : undefined),
    sourcePageNumber: settings.lamPageContext === false || !prefs.currentScreenContext ? undefined : runtimeContext.sourcePageNumber,
    selectedQuestionId: settings.lamPageContext === false || !prefs.currentScreenContext ? undefined : runtimeContext.selectedQuestionId,
    selectedText: settings.lamSelectedText === false ? undefined : selectedText || undefined,
    visibleText: prefs.currentScreenContext && settings.lamPageContext !== false ? runtimeContext.visibleText?.slice(0, 8_000) : undefined,
    activeFileId: prefs.currentScreenContext ? runtimeContext.activeFileId : undefined,
    activeFileName: prefs.currentScreenContext ? runtimeContext.activeFileName : undefined,
    activeSlideshowId: prefs.currentScreenContext ? runtimeContext.activeSlideshowId : undefined,
    activeQuizId: prefs.currentScreenContext ? runtimeContext.activeQuizId : undefined,
    weakTopics: prefs.studyHistoryEnabled ? weakTopics : undefined,
    recentQuizScore: prefs.quizHistoryEnabled && recentQuiz ? `${recentQuiz.score}/${recentQuiz.total} in ${recentQuiz.title}` : undefined,
  }), [chapter, currentView, prefs.currentScreenContext, prefs.quizHistoryEnabled, prefs.studyHistoryEnabled, profileId, recentQuiz, runtimeContext, selectedText, settings.includeProfileInAI, settings.lamPageContext, settings.lamSelectedText, subject, user.name, user.scholarClass, weakTopics]);

  const commit = useCallback((updater: (previous: LamProfileState) => LamProfileState) => {
    setState((previous) => { const next = updater(previous); internalSaveRef.current = true; saveLamState(next); queueMicrotask(() => { internalSaveRef.current = false; }); return next; });
  }, []);

  useEffect(() => { setState(loadLamState(profileId)); setStatus("sleeping"); setOpen(false); }, [profileId]);
  useEffect(() => () => {
    abortRef.current?.abort();
    recognitionRef.current?.abort();
    wakeRecognitionRef.current?.abort();
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
    if (voiceTransitionTimerRef.current) window.clearTimeout(voiceTransitionTimerRef.current);
    if (wakeRestartTimerRef.current) window.clearTimeout(wakeRestartTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopMediaStream(mediaStreamRef.current);
    mediaStreamRef.current = null;
    window.speechSynthesis?.cancel();
  }, []);
  useEffect(() => {
    if (renderQuality !== "mobile-optimized" || !window.visualViewport) return;
    let frame = 0;
    const viewport = window.visualViewport;
    const sync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        document.documentElement.style.setProperty("--lam-mobile-vh", `${viewport.height}px`);
      });
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      if (frame) window.cancelAnimationFrame(frame);
      document.documentElement.style.removeProperty("--lam-mobile-vh");
    };
  }, [renderQuality]);
  useEffect(() => {
    void queryMicrophonePermission().then(setMicrophonePermission);
    if (!navigator.permissions?.query) return;
    let permission: PermissionStatus | undefined;
    let sync: (() => void) | undefined;
    navigator.permissions.query({ name: "microphone" as PermissionName }).then((statusValue) => {
      permission = statusValue;
      sync = () => setMicrophonePermission(statusValue.state === "granted" || statusValue.state === "denied" ? statusValue.state : "prompt");
      statusValue.addEventListener("change", sync);
    }).catch(() => undefined);
    return () => { if (permission && sync) permission.removeEventListener("change", sync); };
  }, []);
  useEffect(() => {
    const sync = (event: Event) => {
      const changedProfile = (event as CustomEvent<{ profileId?: string }>).detail?.profileId;
      if (changedProfile === profileId && !internalSaveRef.current) setState(loadLamState(profileId));
    };
    window.addEventListener("scholar:lam-state", sync);
    return () => window.removeEventListener("scholar:lam-state", sync);
  }, [profileId]);
  useEffect(() => { const draft = consumeLamDraft(); if (draft) { setInput(draft.prompt); setOpen(true); } }, []);
  useEffect(() => {
    if (focusTimerRef.current) { window.clearTimeout(focusTimerRef.current); focusTimerRef.current = null; }
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      focusTimerRef.current = window.setTimeout(() => { focusTimerRef.current = null; composerRef.current?.focus(); }, 220);
    } else previousFocusRef.current?.focus?.();
    return () => { if (focusTimerRef.current) { window.clearTimeout(focusTimerRef.current); focusTimerRef.current = null; } };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    body.style.overflow = "hidden";
    if (scrollbarWidth) body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [conversation?.messages, status]);
  useEffect(() => {
    const onSelection = () => {
      const target = window.getSelection()?.toString().trim() ?? "";
      if (target.length >= 3 && target.length <= 4_000) {
        setSelectedText(target);
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        const rect = range?.getBoundingClientRect();
        if (rect?.width) setSelectionMenu({ x: Math.min(window.innerWidth - 170, Math.max(12, rect.left + rect.width / 2 - 80)), y: Math.max(72, rect.top - 48) });
      } else setSelectionMenu(null);
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
  useEffect(() => {
    const openLam = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string; context?: LamRuntimeContext }>).detail;
      if (detail?.context) setRuntimeContext((previous) => ({ ...previous, ...detail.context }));
      if (detail?.prompt) setInput(detail.prompt);
      setOpen(true);
    };
    window.addEventListener("scholar:open-lam", openLam);
    return () => window.removeEventListener("scholar:open-lam", openLam);
  }, []);

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
      if (prefs.followUpListeningEnabled) { if (voiceTransitionTimerRef.current) window.clearTimeout(voiceTransitionTimerRef.current); voiceTransitionTimerRef.current = window.setTimeout(() => { voiceTransitionTimerRef.current = null; startListeningRef.current(false); }, 250); }
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
      setStatus("performing");
      if (action.type === "navigate") navigateTo(action.view);
      else if (action.type === "create-note") addNote({ title: action.title, content: action.content, folder: "LAM" });
      else if (action.type === "start-focus") navigateTo("focus", { minutes: action.minutes, source: "lam" });
      else if (action.type === "open-ebook-page") navigateTo("ebook", { bookId: action.bookId, page: action.page, source: "lam" });
      else if (action.type === "open-file") navigateTo("files", { fileId: action.fileId, source: "lam" });
      else if (action.type === "create-quiz") navigateTo("quiz", { subject: action.subject, chapter: action.chapter, source: "lam" });
      else if (action.type === "create-slideshow") navigateTo("ai-tools", { tool: "slideshow", subject: action.subject, chapter: action.chapter, source: "lam" });
      commit((previous) => ({ ...previous, actionHistory: [{ id: uid(), action: action.type, result: "success" as const, at: now() }, ...previous.actionHistory].slice(0, 100) }));
      const result = action.type === "navigate" ? `Opened ${action.view}.`
        : action.type === "create-note" ? `Created note “${action.title}”.`
        : action.type === "start-focus" ? `Opened Focus with a ${action.minutes}-minute session request.`
        : action.type === "open-ebook-page" ? `Opened page ${action.page}.`
        : action.type === "open-file" ? "Opened the file."
        : action.type === "create-quiz" ? "Opened Quiz with this context attached."
        : "Opened the slideshow maker with this context attached.";
      addMessage({ id: uid(), role: "tool", content: result, createdAt: now() });
      setPendingAction(null);
      setStatus("completed");
      window.setTimeout(() => setStatus(prefs.wakeWordEnabled ? "armed" : "sleeping"), 1_600);
    } catch {
      setError("Scholar could not complete that action.");
    }
  }, [addMessage, addNote, commit, prefs.wakeWordEnabled]);

  const send = useCallback(async (preset?: string, inputMode: "text" | "voice" = "text") => {
    const content = (preset ?? input).trim();
    if (!content || status === "thinking" || abortRef.current) return;
    if (isSleepPhrase(content)) { setInput(""); stopSpeech(); recognitionRef.current?.abort(); setOpen(false); return; }
    setInput(""); setInterim(""); setError(""); setOpen(true);
    addMessage({ id: uid(), role: "user", content, inputMode, createdAt: now() });
    const local = parseLocalCommand(content);
    if (local?.type === "navigate") { executeAction(local); return; }
    if (local?.type === "start-focus") { setPendingAction(local); return; }
    const scholarSearch = content.match(/(?:search scholar for|where did i (?:read|save|ask about)|find in scholar)\s+(.+)/i);
    if (scholarSearch) {
      const query = scholarSearch[1].trim().toLowerCase();
      const sources = [
        ...notes.filter((note) => `${note.title} ${note.content}`.toLowerCase().includes(query)).slice(0, 4).map((note) => ({ label: `Note · ${note.title}`, route: "/notes" })),
        ...files.filter((file) => `${file.name} ${file.tags.join(" ")}`.toLowerCase().includes(query)).slice(0, 4).map((file) => ({ label: `File · ${file.name}`, route: "/files" })),
        ...state.conversations.filter((item) => `${item.title} ${item.messages.map((message) => message.content).join(" ")}`.toLowerCase().includes(query)).slice(0, 4).map((item) => ({ label: `LAM history · ${item.title}`, route: "lam:history" })),
      ];
      addMessage({ id: uid(), role: "assistant", content: sources.length ? `I found ${sources.length} matching Scholar item${sources.length === 1 ? "" : "s"} for **${scholarSearch[1]}**.` : `I couldn’t find **${scholarSearch[1]}** in your saved notes, uploaded-file metadata, or LAM history.`, sources, createdAt: now() });
      return;
    }
    if (/\b(create|make|generate) (a )?(quiz|questions?)\b/i.test(content)) { setPendingAction({ type: "create-quiz", subject: context.subjectTitle, chapter: context.chapterTitle }); return; }
    if (/\b(create|make|generate) (a )?(slide ?show|presentation|slides?)\b/i.test(content)) { setPendingAction({ type: "create-slideshow", subject: context.subjectTitle, chapter: context.chapterTitle }); return; }
    if (/\b(save|add|turn) (this|that|the answer|response) (as|to) (a |my )?note\b/i.test(content)) {
      const answer = [...conversation.messages].reverse().find((message) => message.role === "assistant")?.content;
      if (answer) { setPendingAction({ type: "create-note", title: `LAM · ${context.chapterTitle ?? context.currentView}`, content: answer }); return; }
    }
    setStatus("thinking");
    const controller = new AbortController(); abortRef.current = controller;
    const assistantId = uid(); let full = ""; let streamFlushTimer: number | null = null; let lastFlushed = "";
    const flushStream = () => {
      streamFlushTimer = null;
      if (full === lastFlushed) return;
      lastFlushed = full;
      commit((previous) => ({ ...previous, conversations: previous.conversations.map((item) => item.id === previous.activeConversationId ? { ...item, messages: item.messages.map((message) => message.id === assistantId ? { ...message, content: full } : message), updatedAt: now() } : item) }));
    };
    addMessage({ id: assistantId, role: "assistant", content: "", createdAt: now() });
    try {
      const response = await fetch("/api/lam/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({
        profileId, message: content, inputMode, assistantMode: conversation.mode, pageContext: context, responseDetail: prefs.responseDetail,
        messages: conversation.messages.filter((message) => message.role !== "tool" && message.content).slice(-10).map(({ role, content: value }) => ({ role, content: value })),
      }) });
      if (!response.ok || !response.body) { const data = await response.json().catch(() => null) as { error?: string } | null; throw new Error(data?.error ?? "LAM could not connect to Groq."); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
        const frames = buffer.split("\n\n"); buffer = frames.pop() ?? "";
        for (const frame of frames) for (const line of frame.split("\n")) if (line.startsWith("data:")) {
          const event = JSON.parse(line.slice(5).trim()) as { type: string; value?: string; message?: string; source?: { label: string; route?: string } };
           if (event.type === "text-delta" && event.value) {
             full += event.value;
             if (renderQualityRef.current === "mobile-optimized") {
               if (streamFlushTimer === null) streamFlushTimer = window.setTimeout(flushStream, 64);
             } else flushStream();
          }
          if (event.type === "source" && event.source) commit((previous) => ({ ...previous, conversations: previous.conversations.map((item) => item.id === previous.activeConversationId ? { ...item, messages: item.messages.map((message) => message.id === assistantId ? { ...message, sources: [...(message.sources ?? []), event.source!] } : message) } : item) }));
          if (event.type === "error") throw new Error(event.message ?? "LAM could not answer.");
        }
       }
      if (streamFlushTimer !== null) window.clearTimeout(streamFlushTimer);
      flushStream();
      if (!full.trim()) throw new Error("LAM returned an empty response.");
      setStatus("sleeping"); speak(full);
      if (prefs.followUpListeningEnabled && !prefs.voiceRepliesEnabled) { if (voiceTransitionTimerRef.current) window.clearTimeout(voiceTransitionTimerRef.current); voiceTransitionTimerRef.current = window.setTimeout(() => { voiceTransitionTimerRef.current = null; startListeningRef.current(false); }, 250); }
    } catch (caught) {
      if (streamFlushTimer !== null) window.clearTimeout(streamFlushTimer);
      if ((caught as Error).name === "AbortError") setStatus("sleeping");
      else { setError(caught instanceof Error ? caught.message : "LAM could not answer."); setStatus("error"); }
    } finally { abortRef.current = null; }
  }, [addMessage, commit, context, conversation, executeAction, files, input, notes, prefs.followUpListeningEnabled, prefs.responseDetail, prefs.voiceRepliesEnabled, profileId, speak, state.conversations, status, stopSpeech]);

  const stopCapturedAudio = useCallback(() => {
    recognitionGenerationRef.current += 1;
    if (wakeRestartTimerRef.current) { window.clearTimeout(wakeRestartTimerRef.current); wakeRestartTimerRef.current = null; }
    recognitionRef.current?.abort();
    wakeRecognitionRef.current?.abort();
    recognitionRef.current = null;
    wakeRecognitionRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopMediaStream(mediaStreamRef.current);
    mediaStreamRef.current = null;
    setStatus("sleeping");
  }, []);

  const startRecordedFallback = useCallback((stream: MediaStream) => {
    if (!("MediaRecorder" in window)) {
      stopMediaStream(stream);
      setError("Voice recognition and audio recording are unavailable in this browser. You can still type to LAM.");
      setStatus("error"); setOpen(true); return;
    }
    mediaStreamRef.current = stream;
    audioChunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size) audioChunksRef.current.push(event.data); };
    recorder.onerror = () => { stopMediaStream(stream); mediaStreamRef.current = null; setError("LAM could not record audio. You can still type your question."); setStatus("error"); };
    recorder.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      stopMediaStream(stream); mediaStreamRef.current = null; recorderRef.current = null;
      if (!blob.size) { setError("No audio was recorded. Tap the microphone and try again."); setStatus("error"); return; }
      setStatus("transcribing");
      try {
        const form = new FormData(); form.set("audio", new File([blob], "lam-recording.webm", { type: blob.type || "audio/webm" }));
        const response = await fetch("/api/lam/transcribe", { method: "POST", body: form });
        const result = await response.json() as { ok?: boolean; text?: string; error?: string };
        if (!response.ok || !result.text) throw new Error(result.error || "The recording could not be transcribed.");
        setInterim(result.text); await send(result.text, "voice");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "The recording could not be transcribed."); setStatus("error"); }
    };
    recorder.start(250); setStatus("listening"); setOpen(true);
  }, [send]);

  const startListening = useCallback((wakeMode = false) => {
    if (!prefs.voiceInputEnabled) { setError("Voice input is disabled in LAM settings. You can still type your question."); setStatus("error"); setOpen(true); return; }
    const Ctor = recognitionCtor();
    if (!Ctor) { setError("Voice recognition is unavailable in this browser. Tap the microphone to record audio for server transcription, or type to LAM."); setStatus("error"); setOpen(true); return; }
    const generation = ++recognitionGenerationRef.current;
    if (wakeRestartTimerRef.current) { window.clearTimeout(wakeRestartTimerRef.current); wakeRestartTimerRef.current = null; }
    recognitionRef.current?.abort(); wakeRecognitionRef.current?.abort();
    recognitionRef.current = null; wakeRecognitionRef.current = null;
    if (status === "speaking") stopSpeech();
    const recognition = new Ctor(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = prefs.voiceLanguage;
    if (wakeMode) wakeRecognitionRef.current = recognition; else recognitionRef.current = recognition;
    recognition.onstart = () => { setStatus(wakeMode ? "armed" : "listening"); if (!wakeMode) setOpen(true); };
    recognition.onresult = (event) => {
      if (generation !== recognitionGenerationRef.current) return;
      let final = ""; let partial = "";
      for (let index = 0; index < event.results.length; index++) {
        const value = event.results[index][0]?.transcript ?? "";
        if (event.results[index].isFinal) final += value; else partial += value;
      }
      if (wakeMode) {
        const spoken = (final || partial).trim();
        if (containsWakePhrase(spoken)) {
          recognition.stop(); playLamActivationSound(); setOpen(true);
          const command = spoken.replace(/^(?:hey|okay)\s+lam\b[\s,.:;-]*/i, "").trim();
          if (command) void send(command, "voice");
          else { if (voiceTransitionTimerRef.current) window.clearTimeout(voiceTransitionTimerRef.current); voiceTransitionTimerRef.current = window.setTimeout(() => { voiceTransitionTimerRef.current = null; startListeningRef.current(false); }, 180); }
        }
      } else {
        setInterim(partial || final);
        if (final.trim()) { recognition.stop(); void send(final, "voice"); }
      }
    };
    recognition.onerror = (event) => { if (generation !== recognitionGenerationRef.current) return; if (event.error !== "aborted" && event.error !== "no-speech") { if (event.error === "not-allowed") setMicrophonePermission("denied"); setError(event.error === "not-allowed" ? "Microphone access was blocked. Allow microphone access in your browser’s site settings." : "Voice recognition stopped. You can retry or type instead."); setStatus("error"); } };
    recognition.onend = () => {
      if (generation !== recognitionGenerationRef.current) return;
      if (wakeMode) wakeRecognitionRef.current = null; else recognitionRef.current = null;
      if (wakeMode && prefs.wakeWordEnabled && document.visibilityState === "visible" && !handsFreeNeedsResume && status !== "speaking") {
        const delay = renderQualityRef.current === "mobile-optimized" ? 900 : 600;
        wakeRestartTimerRef.current = window.setTimeout(() => { wakeRestartTimerRef.current = null; if (generation === recognitionGenerationRef.current) startListeningRef.current(true); }, delay);
      } else if (!wakeMode && status === "listening") setStatus("sleeping");
    };
    try { recognition.start(); } catch { setError("The microphone is already in use or recognition could not start."); setStatus("error"); }
  }, [handsFreeNeedsResume, prefs.voiceInputEnabled, prefs.voiceLanguage, prefs.wakeWordEnabled, send, status, stopSpeech]);
  startListeningRef.current = startListening;

  const requestMicrophoneAndListen = useCallback(async (wakeMode = false) => {
    setError("");
    const environmentError = microphoneEnvironmentError();
    if (environmentError) { setMicrophonePermission("unsupported"); setError(environmentError); setStatus("error"); setOpen(true); return; }
    if (microphonePermission === "denied") { setError("Microphone access was blocked. Allow microphone access in your browser’s site settings."); setStatus("error"); setOpen(true); return; }
    try {
      // Intentionally the first asynchronous browser call in this user-triggered path.
      const stream = await requestMicrophoneStream();
      setMicrophonePermission("granted"); setHandsFreeNeedsResume(false);
      if (recognitionCtor()) { stopMediaStream(stream); startListening(wakeMode); }
      else if (wakeMode) { stopMediaStream(stream); setError("Hands-Free “Hey LAM” requires browser speech recognition, which is unavailable here. Push-to-talk recording still works."); setStatus("error"); setOpen(true); }
      else startRecordedFallback(stream);
    } catch (cause) { setMicrophonePermission(cause instanceof DOMException && cause.name === "NotAllowedError" ? "denied" : microphonePermission); setError(microphoneErrorMessage(cause)); setStatus("error"); setOpen(true); }
  }, [microphonePermission, startListening, startRecordedFallback]);

  useEffect(() => {
    if (!prefs.wakeWordEnabled || !prefs.voiceInputEnabled) { wakeRecognitionRef.current?.abort(); setHandsFreeNeedsResume(false); if (status === "armed" || status === "suspended") setStatus("sleeping"); return; }
    setHandsFreeNeedsResume(true);
    return () => wakeRecognitionRef.current?.abort();
  }, [prefs.voiceInputEnabled, prefs.wakeWordEnabled]); // startListening deliberately excluded to avoid recognition restart loops

  useEffect(() => {
    const suspend = () => {
      if (document.visibilityState !== "hidden" && document.hasFocus()) return;
      recognitionGenerationRef.current += 1;
      if (wakeRestartTimerRef.current) { window.clearTimeout(wakeRestartTimerRef.current); wakeRestartTimerRef.current = null; }
      if (voiceTransitionTimerRef.current) { window.clearTimeout(voiceTransitionTimerRef.current); voiceTransitionTimerRef.current = null; }
      wakeRecognitionRef.current?.abort(); recognitionRef.current?.abort();
      wakeRecognitionRef.current = null; recognitionRef.current = null;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopMediaStream(mediaStreamRef.current); mediaStreamRef.current = null;
      if (prefs.wakeWordEnabled) { setHandsFreeNeedsResume(true); setStatus("suspended"); }
      else setStatus("sleeping");
    };
    const resumeAvailable = () => { if (prefs.wakeWordEnabled) { setHandsFreeNeedsResume(true); setStatus("suspended"); } };
    const visibility = () => document.visibilityState === "hidden" ? suspend() : resumeAvailable();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", suspend); window.addEventListener("focus", resumeAvailable);
    window.addEventListener("pagehide", suspend); window.addEventListener("pageshow", resumeAvailable);
    return () => { document.removeEventListener("visibilitychange", visibility); window.removeEventListener("blur", suspend); window.removeEventListener("focus", resumeAvailable); window.removeEventListener("pagehide", suspend); window.removeEventListener("pageshow", resumeAvailable); };
  }, [prefs.wakeWordEnabled]);

  useEffect(() => {
    const resume = () => { setHandsFreeNeedsResume(false); startListeningRef.current(true); };
    window.addEventListener("scholar:lam-resume-hands-free", resume);
    return () => window.removeEventListener("scholar:lam-resume-hands-free", resume);
  }, []);

  const closeLam = useCallback(() => {
    abortRef.current?.abort(); abortRef.current = null;
    if (voiceTransitionTimerRef.current) { window.clearTimeout(voiceTransitionTimerRef.current); voiceTransitionTimerRef.current = null; }
    stopCapturedAudio(); stopSpeech(); setInterim(""); setOpen(false);
    if (prefs.wakeWordEnabled && !prefs.assistantEnabled && document.visibilityState === "visible") { setHandsFreeNeedsResume(false); window.setTimeout(() => startListeningRef.current(true), 250); }
    else if (prefs.wakeWordEnabled) { setHandsFreeNeedsResume(true); setStatus("suspended"); }
    else setStatus("sleeping");
  }, [prefs.assistantEnabled, prefs.wakeWordEnabled, stopCapturedAudio, stopSpeech]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, [contenteditable=true]");
      const invokes = prefs.keyboardShortcut === "ctrl-space" ? (event.ctrlKey || event.metaKey) && !event.shiftKey && event.code === "Space"
        : prefs.keyboardShortcut === "alt-space" ? event.altKey && event.code === "Space"
        : (event.ctrlKey || event.metaKey) && event.shiftKey && event.code === "KeyL";
      if (invokes) { event.preventDefault(); setOpen(true); }
      if (!typing && (event.ctrlKey || event.metaKey) && event.shiftKey && event.code === "Space") { event.preventDefault(); void requestMicrophoneAndListen(false); }
      if (event.key === "Escape" && open) closeLam();
      if (event.key === "Tab" && open && fullscreen && panelRef.current) {
        const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')];
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [closeLam, fullscreen, open, prefs.keyboardShortcut, requestMicrophoneAndListen]);

  const newChat = () => {
    const created = createLamConversation(profileId);
    commit((previous) => ({ ...previous, activeConversationId: created.id, conversations: [created, ...previous.conversations] }));
    setHistoryOpen(false); setInput(""); setInterim(""); setError(""); setPendingAction(null);
  };
  const updatePrefs = (patch: Partial<LamProfileState["preferences"]>) => commit((previous) => ({ ...previous, preferences: { ...previous.preferences, ...patch } }));
  const setMode = (mode: LamMode) => commit((previous) => ({ ...previous, conversations: previous.conversations.map((item) => item.id === previous.activeConversationId ? { ...item, mode, updatedAt: now() } : item) }));

  const quick = context.currentView === "ebook" ? ["Explain this page", "Quiz me from this page", "What are the key formulas?"] : context.currentView === "dashboard" ? ["Plan my study today", "Show my weakest topic", "What should I continue?"] : ["Explain what I am viewing", "Quiz me", "What should I revise first?"];
  const latestUserRequest = [...conversation.messages].reverse().find((message) => message.role === "user")?.content;
  const glass = prefs.reduceTransparency ? "bg-slate-950 border-white/25" : "bg-slate-950/78 backdrop-blur-2xl border-white/20";
  const visualState = !open ? "closed" : historyOpen ? "history" : status === "suspended" ? "suspended" : pendingAction ? "action-preview" : status === "performing" ? "performing-action" : status === "completed" ? "completed" : status === "thinking" || status === "transcribing" ? "thinking" : status === "listening" ? "listening" : status === "error" ? "error" : conversation.messages.length ? "answering" : "idle";
  const surfaceState = status === "completed" ? "success" : status === "thinking" || status === "transcribing" || status === "performing" ? "thinking" : status === "listening" ? "listening" : status === "error" ? "error" : conversation.messages.length ? "answering" : "idle";
  const isTransientCapsule = status === "listening" || status === "thinking" || status === "transcribing";
  const needsExpanded = fullscreen || historyOpen || (!isTransientCapsule && (conversation.messages.length > 2 || conversation.messages.some((message) => message.content.length > 520)));
  const contextualPlaceholder = selectedText ? "Ask about the selected text" : context.activeFileName ? `Ask about ${context.activeFileName}` : context.ebookTitle ? "Ask about this ebook page" : context.activeSlideshowId ? "Ask about this slideshow" : "Ask about anything in Scholar";
  const visibleConversations = state.conversations.filter((item) => !historyQuery.trim() || `${item.title} ${item.mode} ${item.messages.map((message) => message.content).join(" ")}`.toLowerCase().includes(historyQuery.toLowerCase()));
  const mobileOptimized = renderQuality === "mobile-optimized";
  const animationQuality = useMemo(() => resolveScholarAnimationQuality({
    reduceMotion: settings.reduceMotion,
    forceQuality: mobileOptimized ? "mobile-optimized" : "desktop-high",
  }), [mobileOptimized, settings.reduceMotion]);
  useEffect(() => {
    const header = wakeHeaderRef.current;
    if (!open || !prefs.onboardingComplete || !header) return;
    const mark = header.querySelector<HTMLElement>("span");
    if (!mark) return;
    const details = [header.querySelector<HTMLElement>("div"), wakeContextRef.current].filter((item): item is HTMLElement => Boolean(item));
    return animateLamWakeReveal(mark, details, animationQuality);
  }, [animationQuality, open, prefs.onboardingComplete]);
  const renderedMessages = mobileOptimized && conversation.messages.length > 8 ? conversation.messages.slice(-8) : conversation.messages;
  const pendingDescription = !pendingAction ? "" : pendingAction.type === "create-note" ? `Save “${pendingAction.title}” in the LAM notes folder?` : pendingAction.type === "start-focus" ? `Start a ${pendingAction.minutes}-minute focus session?` : pendingAction.type === "create-quiz" ? `Create a quiz${pendingAction.chapter ? ` for ${pendingAction.chapter}` : ""}?` : pendingAction.type === "create-slideshow" ? `Create a slideshow${pendingAction.chapter ? ` for ${pendingAction.chapter}` : ""}?` : pendingAction.type === "open-ebook-page" ? `Open page ${pendingAction.page}?` : pendingAction.type === "open-file" ? "Open this uploaded file?" : `Open ${pendingAction.view}?`;

  if (!prefs.assistantEnabled && !open) return null;

  return createPortal(
    <aside className="lam-system-root fixed inset-x-0 top-0 z-[10000] flex flex-col items-center px-3" data-state={visualState} data-quality={renderQuality} data-intensity={settings.reduceMotion ? "minimal" : prefs.animationIntensity} aria-label="LAM personal assistant">
      {open && needsExpanded && !fullscreen && <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeLam} className="lam-mobile-scrim fixed inset-0 bg-black/20 backdrop-blur-[2px]" aria-label="Dismiss LAM" />}
      {open && !prefs.onboardingComplete && (
        <div className={cn("mb-3 flex h-[min(25rem,62dvh)] w-[min(23rem,calc(100vw-2rem))] flex-col justify-between overflow-y-auto rounded-[1.75rem] border p-5 text-white shadow-2xl sm:h-[28rem] sm:w-[25rem] sm:rounded-[2rem] sm:p-6", glass)}>
          <button className="ml-auto rounded-full p-2 hover:bg-white/10" onClick={closeLam} aria-label="Close LAM"><X className="h-4 w-4" /></button>
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
          <motion.div ref={panelRef} layoutId="lam-system-surface" initial={settings.reduceMotion ? { opacity: 0 } : mobileOptimized ? { opacity: 0, y: -10, scale: .94 } : { opacity: 0, y: -24, scale: .82, filter: "blur(18px)" }} animate={mobileOptimized ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={mobileOptimized ? { opacity: 0, y: -6, scale: .96 } : { opacity: 0, y: -10, scale: .92, filter: "blur(10px)" }} transition={mobileOptimized ? { duration: .28, ease: [0.16, 1, 0.3, 1] } : { type: "spring", stiffness: 330, damping: 34 }} className={cn("lam-liquid-glass lam-premium-panel relative z-10 mb-3 flex flex-col overflow-hidden text-white", `lam-liquid-glass--${surfaceState}`, prefs.reduceTransparency && "lam-liquid-glass--reduced", fullscreen ? "fixed inset-2 h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] rounded-[1.75rem] sm:inset-5 sm:h-[calc(100dvh-2.5rem)] sm:w-[calc(100vw-2.5rem)] sm:rounded-[2rem]" : needsExpanded ? "h-[min(43rem,calc(100dvh-5.5rem))] w-[min(46rem,calc(100vw-1.5rem))] rounded-[2rem]" : isTransientCapsule ? "max-h-[min(25rem,calc(100dvh-5.5rem))] min-h-[11.5rem] w-[min(43rem,calc(100vw-1.5rem))] rounded-[2rem]" : "max-h-[min(32rem,calc(100dvh-5.5rem))] min-h-[9rem] w-[min(38rem,calc(100vw-1.5rem))] rounded-[1.8rem]")}>
          <span className="lam-glass-reflection" aria-hidden="true" />
          <header ref={wakeHeaderRef} className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
            <span className={cn("relative grid h-10 w-10 place-items-center rounded-full bg-white/8 text-cyan-100", status !== "sleeping" && "shadow-lg shadow-cyan-400/20")}><LamMark active={status !== "sleeping"} />{status === "armed" && <i className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />}</span>
            <div className="min-w-0 flex-1"><p className="font-semibold">LAM</p><p className="truncate text-[11px] text-white/50">{status === "thinking" ? "Thinking…" : status === "transcribing" ? "Transcribing your recording…" : status === "suspended" ? "Hands-Free LAM suspended" : status === "performing" ? "Completing Scholar action…" : status === "completed" ? "Done" : status === "listening" ? "Listening…" : status === "speaking" ? "Speaking…" : `${user.name} · ${context.currentView}`}</p></div>
            <button onClick={() => setHistoryOpen((value) => !value)} className="rounded-full p-2 hover:bg-white/10" aria-label={historyOpen ? "Back to chat" : "Conversation history"}><History className="h-4 w-4" /></button>
            <button onClick={newChat} className="rounded-full p-2 hover:bg-white/10" aria-label="New LAM chat"><Plus className="h-4 w-4" /></button>
            <button onClick={() => setFullscreen((value) => !value)} className="rounded-full p-2 hover:bg-white/10" aria-label={fullscreen ? "Exit fullscreen LAM" : "Fullscreen LAM"}>{fullscreen ? <Expand className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
            <button onClick={closeLam} className="rounded-full p-2 hover:bg-white/10" aria-label="Close LAM"><X className="h-4 w-4" /></button>
          </header>

          <div ref={wakeContextRef} className="lam-context-strip relative z-30 flex items-center gap-2 overflow-x-auto border-b border-white/8 px-3 py-2 no-scrollbar">
            <GlassModeMenu value={conversation.mode} labels={labels} onChange={setMode} reducedMotion={settings.reduceMotion} />
            <span className="whitespace-nowrap rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100">{context.currentView}</span>
            {context.subjectTitle && <span className="whitespace-nowrap rounded-full bg-white/8 px-2.5 py-1 text-[11px]">{context.subjectTitle}</span>}
            {context.chapterTitle && <span className="max-w-44 truncate rounded-full bg-white/8 px-2.5 py-1 text-[11px]">{context.chapterTitle}</span>}
            {context.ebookTitle && <span className="flex max-w-48 items-center gap-1 truncate rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-50"><BookOpen className="h-3 w-3 shrink-0" />{context.ebookTitle}{context.sourcePageNumber ? ` · p.${context.sourcePageNumber}` : ""}</span>}
            {context.activeFileName && <span className="flex max-w-48 items-center gap-1 truncate rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-50"><FileText className="h-3 w-3 shrink-0" />{context.activeFileName}</span>}
            {selectedText && settings.lamSelectedText !== false && <button onClick={() => setSelectedText("")} className="whitespace-nowrap rounded-full bg-violet-400/15 px-2.5 py-1 text-[11px] text-violet-100">Selection ×</button>}
          </div>

          {historyOpen && <section className="lam-history-panel mx-3 my-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.4rem]" aria-label="LAM conversation history">
            <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-bold tracking-tight text-white">Conversation history</p><p className="mt-0.5 text-[10px] text-white/40">{visibleConversations.length} chats · {user.name} · Class {user.scholarClass}</p></div><button onClick={newChat} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/7 px-3 py-2 text-[11px] font-semibold text-white/75 transition hover:bg-white/12 hover:text-white" aria-label="New conversation"><Plus className="h-3.5 w-3.5" />New</button><button onClick={() => setHistoryOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white" aria-label="Close conversation history"><X className="h-4 w-4" /></button></div>
            <label className="mx-3 my-3 flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 focus-within:border-cyan-200/25 focus-within:bg-white/7"><Search className="h-3.5 w-3.5 text-white/40" /><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search conversations" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30" /></label>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 pb-3">{visibleConversations.map((item) => <div key={item.id} className={cn("group flex items-center gap-1 rounded-2xl border border-transparent px-2 py-1 transition hover:border-white/8 hover:bg-white/6", item.id === state.activeConversationId && "border-cyan-200/10 bg-gradient-to-r from-cyan-300/9 to-violet-300/7")}><button onClick={() => { commit((previous) => ({ ...previous, activeConversationId: item.id })); setHistoryOpen(false); }} className="min-w-0 flex-1 px-2 py-2.5 text-left"><span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white/86">{item.pinned && <Pin className="h-3 w-3 shrink-0 text-cyan-200" />}{item.title}</span><span className="mt-1 block truncate text-[10px] text-white/38">{labels[item.mode]} · {item.messages.length} messages · {new Date(item.updatedAt).toLocaleDateString()}</span></button><div className="flex shrink-0 items-center opacity-65 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"><button onClick={() => commit((previous) => ({ ...previous, conversations: previous.conversations.map((entry) => entry.id === item.id ? { ...entry, pinned: !entry.pinned } : entry) }))} className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white" aria-label={item.pinned ? "Unpin conversation" : "Pin conversation"}><Pin className="h-3.5 w-3.5" /></button><button onClick={() => { const title = window.prompt("Rename conversation", item.title); if (title?.trim()) commit((previous) => ({ ...previous, conversations: previous.conversations.map((entry) => entry.id === item.id ? { ...entry, title: title.trim().slice(0, 80) } : entry) })); }} className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white" aria-label="Rename conversation"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => { if (!window.confirm(`Delete “${item.title}”?`)) return; commit((previous) => { const kept = previous.conversations.filter((entry) => entry.id !== item.id); const conversations = kept.length ? kept : [createLamConversation(profileId)]; return { ...previous, conversations, activeConversationId: previous.activeConversationId === item.id ? conversations[0].id : previous.activeConversationId }; }); }} className="rounded-lg p-2 text-white/45 hover:bg-rose-500/15 hover:text-rose-200" aria-label="Delete conversation"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}{visibleConversations.length === 0 && <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-white/10"><div className="text-center"><History className="mx-auto h-5 w-5 text-white/25" /><p className="mt-2 text-xs text-white/45">No matching conversations</p></div></div>}</div>
          </section>}

          <div className={cn("relative z-0 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4", historyOpen && "hidden")} aria-live="polite" aria-busy={status === "thinking" || status === "transcribing"}>
            <AnimatePresence mode="wait" initial={false}>
              {status === "listening" && <GlassWaveListening key="listening" transcript={interim} onStop={stopCapturedAudio} optimized={mobileOptimized} />}
              {(status === "thinking" || status === "transcribing") && <LamThinkingState key="thinking" request={latestUserRequest} transcribing={status === "transcribing"} onStop={status === "thinking" ? () => abortRef.current?.abort() : undefined} optimized={mobileOptimized} />}
            </AnimatePresence>
            {!isTransientCapsule && !conversation.messages.length && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="py-2"><p className="text-lg font-bold tracking-tight text-white">How can I help you study?</p><p className="mt-1 text-sm leading-6 text-white/52">I can use the current Scholar screen and your attached context. Ask naturally or choose a suggestion below.</p></motion.div>}
            {!isTransientCapsule && renderedMessages.map((message) => <motion.article initial={mobileOptimized ? { opacity: 0, y: 4 } : { opacity: 0, y: 8, filter: "blur(5px)" }} animate={mobileOptimized ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, filter: "blur(0px)" }} key={message.id} className={cn("lam-message-entry group rounded-[1.4rem] px-4 py-3 text-sm", message.role === "user" ? "lam-request-card ml-8 text-white/90" : message.role === "tool" ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-50" : "lam-response-card mr-1")}>
                    {message.role === "assistant" ? <LamResponse content={message.content || "…"} optimized={mobileOptimized} streaming={Boolean(abortRef.current) && message.id === conversation.messages.at(-1)?.id} /> : <p className="whitespace-pre-wrap">{message.content}</p>}
              {message.role === "assistant" && message.sources?.length ? <div className="mt-2 flex flex-wrap gap-1">{message.sources.map((source) => <button key={`${message.id}-${source.label}`} onClick={() => { if (source.route === "lam:history") setHistoryOpen(true); else if (source.route?.startsWith("/")) navigateTo(source.route.split("/").filter(Boolean)[0] || "dashboard"); else navigateTo(context.currentView, context.sourcePageNumber ? { page: context.sourcePageNumber } : undefined); }} className="flex items-center gap-1 rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-300/15"><BookOpen className="h-3 w-3" />{source.label}</button>)}</div> : null}
              {message.role === "assistant" && message.content && <div className="mt-2 flex flex-wrap gap-1 opacity-90 sm:opacity-60 sm:group-hover:opacity-100"><button onClick={() => navigator.clipboard.writeText(message.content)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Copy response"><Copy className="h-3 w-3" /></button><button onClick={() => speak(message.content)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Read response aloud"><Volume2 className="h-3 w-3" /></button><button onClick={() => void send("Explain that more simply with one small example.")} className="rounded-full border border-white/8 px-2 py-1 text-[10px] hover:bg-white/10">Explain simply</button><button onClick={() => setPendingAction({ type: "create-note", title: `LAM · ${context.chapterTitle ?? context.activeFileName ?? context.currentView}`, content: message.content })} className="rounded-full border border-white/8 px-2 py-1 text-[10px] hover:bg-white/10">Save to notes</button><button onClick={() => setPendingAction({ type: "create-quiz", subject: context.subjectTitle, chapter: context.chapterTitle })} className="rounded-full border border-white/8 px-2 py-1 text-[10px] hover:bg-white/10">Quiz me</button></div>}
            </motion.article>)}
            {pendingAction && <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Confirm Scholar action</p><p className="mt-2 text-sm">{pendingDescription}</p><div className="mt-3 flex gap-2"><button onClick={() => { setPendingAction(null); commit((previous) => ({ ...previous, actionHistory: [{ id: uid(), action: pendingAction.type, result: "cancelled" as const, at: now() }, ...previous.actionHistory] })); }} className="rounded-xl border border-white/15 px-3 py-2 text-xs">Cancel</button><button onClick={() => executeAction(pendingAction)} className="rounded-xl bg-amber-200 px-3 py-2 text-xs font-semibold text-slate-950"><Check className="mr-1 inline h-3 w-3" />Confirm</button></div></div>}
            {status === "suspended" && prefs.wakeWordEnabled && <button onClick={() => void requestMicrophoneAndListen(true)} className="w-full rounded-2xl border border-amber-300/20 bg-amber-300/8 p-3 text-left text-sm text-amber-50"><Mic className="mr-2 inline h-4 w-4" />Tap to resume Hands-Free LAM</button>}
            {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100">{error}</div>}
            <div ref={endRef} />
          </div>

          <div className={cn("border-t border-white/10 p-3", historyOpen && "hidden")}>
            <div className="mb-2 flex gap-2 overflow-x-auto py-0.5 no-scrollbar">{quick.map((item) => <LamQuickActionChip key={item} onClick={() => void send(item)}>{item}</LamQuickActionChip>)}</div>
            <div className="lam-mini-composer flex items-end gap-1 rounded-2xl p-2">
              <button disabled={!prefs.voiceInputEnabled || status === "transcribing"} onClick={() => status === "listening" ? stopCapturedAudio() : void requestMicrophoneAndListen(false)} className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl disabled:opacity-30", status === "listening" ? "bg-rose-400 text-slate-950" : "hover:bg-white/10")} aria-label={status === "listening" ? "Stop listening" : "Talk to LAM"}>{status === "listening" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
              <textarea ref={composerRef} value={input} maxLength={4000} rows={1} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void send(); } }} placeholder={contextualPlaceholder} className="min-h-10 max-h-28 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-white/35" aria-label="Message LAM" />
              {status === "speaking" ? <button onClick={stopSpeech} className="grid h-10 w-10 place-items-center rounded-xl bg-rose-400 text-slate-950" aria-label="Stop speaking"><Square className="h-4 w-4" /></button> : <button onClick={() => void send()} disabled={!input.trim() || status === "thinking"} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300 text-slate-950 disabled:opacity-35" aria-label="Send message"><Send className="h-4 w-4" /></button>}
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-white/35"><span>{prefs.keyboardShortcut === "ctrl-space" ? "Ctrl/⌘ Space" : prefs.keyboardShortcut === "alt-space" ? "Alt Space" : "Ctrl/⌘ Shift L"} · Open</span><button onClick={() => navigateTo("settings", { tab: "lam" })} className="flex items-center gap-1 hover:text-white"><Settings className="h-3 w-3" />LAM settings</button></div>
          </div>
        </motion.div>
      )}

      {!open && status === "listening" && <div className={cn("mb-2 flex items-center gap-3 rounded-full border px-4 py-2 text-sm text-white", glass)}><Mic className="h-4 w-4 text-cyan-300" />Listening…<button onClick={stopCapturedAudio} aria-label="Stop listening"><Square className="h-3.5 w-3.5" /></button></div>}
      {!open && status === "suspended" && prefs.wakeWordEnabled && <button onClick={() => void requestMicrophoneAndListen(true)} className={cn("mb-2 rounded-full border px-4 py-2 text-sm text-amber-50", glass)}><Mic className="mr-2 inline h-4 w-4" />Tap to resume Hands-Free LAM</button>}
      {!open && !context.activeFileId && <motion.button layoutId="lam-system-surface" transition={{ type: "spring", stiffness: 350, damping: 32 }} onPointerDown={() => { holdTimerRef.current = window.setTimeout(() => void requestMicrophoneAndListen(false), 480); }} onPointerUp={() => { if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current); }} onPointerCancel={() => { if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current); }} onClick={() => setOpen(true)} aria-label="LAM" aria-expanded={false} className={cn("lam-liquid-glass lam-liquid-glass--idle lam-docked-capsule flex min-h-13 items-center gap-3 rounded-[1.35rem] px-3 text-sm font-medium text-white", prefs.compactOrb ? "w-13 justify-center" : compactMobile ? "h-12 w-[min(10.5rem,calc(100vw-2rem))]" : "w-[min(25rem,calc(100vw-1.5rem))]")}>
        <span className={cn("relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/8 text-cyan-100", status !== "sleeping" && !settings.reduceMotion && "animate-pulse")}><LamMark active={status !== "sleeping"} />{status === "armed" && <i className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />}</span>
        {!prefs.compactOrb && <><span className="flex-1 text-left text-white/78">Ask LAM</span><Mic className="h-4 w-4 text-white/45" /></>}
      </motion.button>}
      {selectionMenu && selectedText && !open && <LiquidGlassSurface className="fixed z-[10020] flex items-center gap-1 rounded-full p-1.5 text-xs" style={{ left: selectionMenu.x, top: selectionMenu.y }}><button onClick={() => { setOpen(true); setSelectionMenu(null); }} className="rounded-full px-3 py-2 hover:bg-white/10">Ask LAM</button><button onClick={() => { setOpen(true); setSelectionMenu(null); void send("Explain the selected text clearly."); }} className="rounded-full px-3 py-2 hover:bg-white/10">Explain</button></LiquidGlassSurface>}
      <span className="sr-only" role="status" aria-live="assertive">LAM is {status}</span>
    </aside>
  , document.body);
}
