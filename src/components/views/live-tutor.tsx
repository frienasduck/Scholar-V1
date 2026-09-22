"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, BrainCircuit, Check, CircleStop, Clock3, Eye, FileText,
  MemoryStick, Mic,
  Send, Settings2, Sparkles, Trash2, Volume2, VolumeX, X,
} from "lucide-react";
import { PersonalityBackground } from "@/components/live-tutor/personality-background";
import { LamResponse } from "@/components/lam/lam-response";
import { getLamPageContext, type LamRuntimeContext } from "@/lib/lam-context";
import { parseLocalCommand, type LamAction } from "@/lib/lam/commands";
import { microphoneErrorMessage, requestMicrophoneStream, stopMediaStream } from "@/lib/lam/microphone";
import { createLamConversation, loadLamState, saveLamState } from "@/lib/lam/storage";
import type { LamMessage, LamProfileState } from "@/lib/lam/types";
import {
  LIVE_TUTOR_MODES, PERSONALITY_COPY, type LiveTutorMemoryRecord, type LiveTutorMission,
  type LiveTutorMode, type LiveTutorPersonality, type LiveTutorProvider,
  type LiveTutorProviderStatus, type LiveTutorState,
} from "@/lib/live-tutor/types";
import { navigateTo } from "@/lib/nav-event";
import { useStore } from "@/lib/store";
import "@/components/live-tutor/live-tutor.css";

type SpeechRecognitionResultEventLike = Event & { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> };
type SpeechRecognitionErrorEventLike = Event & { error: string };
type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type Panel = "settings" | "memory" | "context" | null;
type MemorySummary = { relevantMemories: number; weakTopics: Array<{ subject: string; chapter: string; topic: string | null; score: number }>; unresolvedMistakes: number; dueRevision: number };

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function stateLabel(state: LiveTutorState) {
  const labels: Record<LiveTutorState, string> = {
    idle: "Ready", preparing: "Preparing LAM", recalling: "Recalling what matters", listening: "Listening",
    transcribing: "Transcribing", thinking: "Thinking", "using-tool": "Using Scholar",
    "waiting-confirmation": "Waiting for you", speaking: "Speaking", paused: "Paused", complete: "Ready", error: "Needs attention",
  };
  return labels[state];
}

function actionCopy(action: LamAction) {
  if (action.type === "navigate") return { title: `Open ${action.view.replaceAll("-", " ")}`, detail: "LAM will move you to this Scholar workspace." };
  if (action.type === "start-focus") return { title: `Start a ${action.minutes}-minute focus session`, detail: "LAM will open Focus with this timer prepared." };
  return { title: "Use a Scholar tool", detail: "LAM needs confirmation before changing anything." };
}

function englishVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => /microsoft/i.test(voice.name) && /^en-GB/i.test(voice.lang))
    ?? voices.find((voice) => /^en-GB/i.test(voice.lang))
    ?? voices.find((voice) => /^en/i.test(voice.lang));
}

export function LiveTutorView() {
  const user = useStore((store) => store.user);
  const addNote = useStore((store) => store.addNote);
  const profileId = `class-${user.scholarClass}`;
  const [lamState, setLamState] = useState<LamProfileState>(() => loadLamState(profileId));
  const [runtimeContext, setRuntimeContext] = useState<LamRuntimeContext>(() => getLamPageContext());
  const [personality, setPersonality] = useState<LiveTutorPersonality>(() => loadLamState(profileId).preferences.liveTutorPersonality);
  const [provider, setProvider] = useState<LiveTutorProvider>(() => loadLamState(profileId).preferences.liveTutorProvider);
  const [mode, setMode] = useState<LiveTutorMode>(() => loadLamState(profileId).preferences.liveTutorMode);
  const [autoSpeak, setAutoSpeak] = useState(() => loadLamState(profileId).preferences.liveTutorAutoSpeak);
  const [captions, setCaptions] = useState(() => loadLamState(profileId).preferences.liveTutorCaptions);
  const [status, setStatus] = useState<LiveTutorState>("preparing");
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [resolvedModel, setResolvedModel] = useState("");
  const [providerStatuses, setProviderStatuses] = useState<LiveTutorProviderStatus[]>([]);
  const [memories, setMemories] = useState<LiveTutorMemoryRecord[]>([]);
  const [memorySummary, setMemorySummary] = useState<MemorySummary | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<LamAction | null>(null);
  const [mission, setMission] = useState<LiveTutorMission | null>(null);
  const [sessionId] = useState(() => {
    const key = `scholar-live-tutor-session-${profileId}`;
    if (typeof window === "undefined") return `pending-${profileId}`;
    const stored = sessionStorage.getItem(key);
    const value = stored ?? id();
    sessionStorage.setItem(key, value);
    return value;
  });
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const conversation = useMemo(() => lamState.conversations.find((item) => item.id === lamState.activeConversationId) ?? lamState.conversations[0], [lamState]);
  const visibleMessages = useMemo(() => conversation?.messages.filter((message) => message.role !== "tool").slice(-8) ?? [], [conversation]);
  const copy = PERSONALITY_COPY[personality];
  const isBusy = ["thinking", "transcribing", "speaking", "using-tool"].includes(status);
  const isListening = status === "listening";

  const commitState = useCallback((updater: (state: LamProfileState) => LamProfileState) => {
    setLamState((current) => {
      const next = updater(current);
      saveLamState(next);
      return next;
    });
  }, []);

  const appendMessage = useCallback((message: LamMessage) => {
    commitState((current) => {
      const active = current.conversations.find((item) => item.id === current.activeConversationId) ?? createLamConversation(current.profileId);
      const updated = {
        ...active,
        title: active.messages.length ? active.title : message.content.slice(0, 54),
        messages: [...active.messages, message].slice(-100),
        updatedAt: now(),
      };
      const conversations = current.conversations.some((item) => item.id === updated.id)
        ? current.conversations.map((item) => item.id === updated.id ? updated : item)
        : [updated, ...current.conversations];
      return { ...current, activeConversationId: updated.id, conversations };
    });
  }, [commitState]);

  const patchPreferences = useCallback((patch: Partial<LamProfileState["preferences"]>) => {
    commitState((current) => ({ ...current, preferences: { ...current.preferences, ...patch } }));
  }, [commitState]);

  useEffect(() => {
    const onContext = (event: Event) => setRuntimeContext((event as CustomEvent<LamRuntimeContext>).detail ?? {});
    window.addEventListener("scholar:lam-context", onContext);
    return () => window.removeEventListener("scholar:lam-context", onContext);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const prepare = async () => {
      setStatus("preparing");
      const providerRequest = fetch("/api/lam/live/providers", { cache: "no-store" }).then((response) => response.json());
      setStatus("recalling");
      const memoryRequest = fetch("/api/lam/live/memory", { cache: "no-store" }).then((response) => response.json());
      const [providerResult, memoryResult] = await Promise.allSettled([providerRequest, memoryRequest]);
      if (cancelled) return;
      if (providerResult.status === "fulfilled" && providerResult.value.ok) setProviderStatuses(providerResult.value.providers);
      if (memoryResult.status === "fulfilled" && memoryResult.value.ok) {
        setMemories(memoryResult.value.memories);
        setMemorySummary(memoryResult.value.summary);
      }
      setStatus("idle");
    };
    void prepare();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [streamingText, visibleMessages.length]);

  useEffect(() => () => {
    abortRef.current?.abort();
    recognitionRef.current?.abort();
    recorderRef.current?.stop();
    stopMediaStream(mediaStreamRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  const speak = useCallback((text: string) => {
    if (!autoSpeak || !("speechSynthesis" in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[#*_`>-]/g, " ").slice(0, 3500));
    utterance.lang = "en-GB";
    utterance.voice = englishVoice() ?? null;
    utterance.rate = lamState.preferences.speechRate;
    utterance.pitch = lamState.preferences.speechPitch;
    utterance.volume = lamState.preferences.speechVolume;
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => setStatus("complete");
    utterance.onerror = () => setStatus("complete");
    window.speechSynthesis.speak(utterance);
  }, [autoSpeak, lamState.preferences.speechPitch, lamState.preferences.speechRate, lamState.preferences.speechVolume]);

  const stopEverything = useCallback(() => {
    abortRef.current?.abort(); abortRef.current = null;
    recognitionRef.current?.abort(); recognitionRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    stopMediaStream(mediaStreamRef.current); mediaStreamRef.current = null;
    window.speechSynthesis?.cancel();
    setStreamingText("");
    setStatus("paused");
  }, []);

  const rememberExplicitly = useCallback(async (text: string) => {
    const match = text.match(/^remember(?: that)?\s+(.+)/i);
    if (!match) return;
    const response = await fetch("/api/lam/live/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "user_confirmed", content: match[1].trim(), subject: runtimeContext.subjectTitle, topic: runtimeContext.chapterTitle }) });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.memory) setMemories((current) => [result.memory, ...current.filter((item) => item.id !== result.memory.id)]);
  }, [runtimeContext.chapterTitle, runtimeContext.subjectTitle]);

  const sendMessage = useCallback(async (raw: string, inputMode: "text" | "voice" = "text") => {
    const message = raw.trim();
    if (!message || isBusy) return;
    setError("");
    setDraft("");
    window.speechSynthesis?.cancel();

    const action = parseLocalCommand(message);
    if (action) {
      appendMessage({ id: id(), role: "user", content: message, inputMode, createdAt: now() });
      setPendingAction(action);
      setStatus("waiting-confirmation");
      return;
    }
    if (/\b(create|make|generate) (a )?(quiz|questions?)\b/i.test(message)) {
      appendMessage({ id: id(), role: "user", content: message, inputMode, createdAt: now() });
      setPendingAction({ type: "create-quiz", subject: runtimeContext.subjectTitle, chapter: runtimeContext.chapterTitle });
      setStatus("waiting-confirmation");
      return;
    }
    if (/\b(create|make|generate) (a )?(slide ?show|presentation|slides?)\b/i.test(message)) {
      appendMessage({ id: id(), role: "user", content: message, inputMode, createdAt: now() });
      setPendingAction({ type: "create-slideshow", subject: runtimeContext.subjectTitle, chapter: runtimeContext.chapterTitle });
      setStatus("waiting-confirmation");
      return;
    }
    if (/\b(save|add|turn) (this|that|the answer|response) (as|to) (a |my )?note\b/i.test(message)) {
      const answer = [...(conversation?.messages ?? [])].reverse().find((item) => item.role === "assistant")?.content;
      if (answer) {
        appendMessage({ id: id(), role: "user", content: message, inputMode, createdAt: now() });
        setPendingAction({ type: "create-note", title: `LAM · ${runtimeContext.chapterTitle ?? runtimeContext.subjectTitle ?? "Live Tutor"}`, content: answer });
        setStatus("waiting-confirmation");
        return;
      }
    }

    const missionMatch = message.match(/(?:i have|give me)\s+(?:(\d+)\s*(?:minutes?|mins?)|an?\s+hour).*?(?:take over|study|revise)?/i);
    if (missionMatch) {
      const minutes = missionMatch[1] ? Math.min(180, Number(missionMatch[1])) : 60;
      setMode("mission");
      patchPreferences({ liveTutorMode: "mission" });
      setMission({
        id: id(), title: `${minutes}-minute guided study mission`, durationMinutes: minutes, status: "active",
        steps: [
          { id: id(), label: "Review learning signals", state: "complete" },
          { id: id(), label: "Build the plan", state: "active" },
          { id: id(), label: "Teach and practise", state: "upcoming" },
          { id: id(), label: "Finish with recall", state: "upcoming" },
        ],
      });
    }

    void rememberExplicitly(message).catch(() => undefined);
    const userMessage: LamMessage = { id: id(), role: "user", content: message, inputMode, createdAt: now() };
    appendMessage(userMessage);
    setStatus("thinking");
    setStreamingText("");
    const controller = new AbortController();
    abortRef.current = controller;
    let full = "";
    let sources: Array<{ label: string; route?: string }> = [];
    const context = {
      profileId,
      profileName: user.name || `Class ${user.scholarClass} learner`,
      scholarClass: user.scholarClass,
      currentView: "live-tutor",
      currentRoute: "/live-tutor",
      ...runtimeContext,
    };
    try {
      const response = await fetch("/api/lam/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({
          profileId, message, inputMode, assistantMode: mode === "examiner" ? "question-coach" : mode === "rapid-revision" ? "revision-coach" : "tutor",
          pageContext: context,
          messages: (conversation?.messages ?? []).filter((item) => item.role !== "tool").slice(-10).map(({ role, content }) => ({ role: role as "user" | "assistant", content })),
          responseDetail: lamState.preferences.responseDetail,
          liveTutor: { sessionId, turnId: userMessage.id, provider, personality, mode },
        }),
      });
      if (!response.ok || !response.body) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "LAM could not start this response.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const line = event.split("\n").find((part) => part.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6)) as { type: string; value?: string; message?: string; provider?: string; model?: string; source?: { label: string; route?: string } };
          if (payload.type === "start") setResolvedModel([payload.provider, payload.model].filter(Boolean).join(" · "));
          if (payload.type === "text-delta" && payload.value) { full += payload.value; setStreamingText(full); }
          if (payload.type === "source" && payload.source) sources = [...sources, payload.source];
          if (payload.type === "error") throw new Error(payload.message || "LAM could not finish this response.");
        }
      }
      if (!full.trim()) throw new Error("LAM returned an empty response. Please retry.");
      appendMessage({ id: `${userMessage.id}:assistant`, role: "assistant", content: full, createdAt: now(), sources });
      setStreamingText("");
      setStatus("complete");
      speak(full);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setStreamingText("");
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "LAM could not complete this turn.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [appendMessage, conversation?.messages, isBusy, lamState.preferences.responseDetail, mode, patchPreferences, personality, profileId, provider, rememberExplicitly, runtimeContext, sessionId, speak, user.name, user.scholarClass]);

  const startFallbackRecording = useCallback((stream: MediaStream) => {
    const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onerror = () => { setError("The browser could not record this microphone."); stopEverything(); };
    recorder.onstop = async () => {
      stopMediaStream(stream); mediaStreamRef.current = null;
      if (!chunksRef.current.length) { setStatus("idle"); return; }
      setStatus("transcribing");
      try {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const form = new FormData(); form.set("audio", blob, `live-tutor.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
        const response = await fetch("/api/lam/transcribe", { method: "POST", body: form });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.text) throw new Error(result?.error || "LAM could not transcribe that recording.");
        await sendMessage(result.text, "voice");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "LAM could not transcribe that recording.");
        setStatus("error");
      }
    };
    recorderRef.current = recorder;
    recorder.start(250);
    setStatus("listening");
  }, [sendMessage, stopEverything]);

  const startListening = useCallback(async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      return;
    }
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    setError("");
    try {
      const stream = await requestMicrophoneStream();
      mediaStreamRef.current = stream;
      const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!Recognition) { startFallbackRecording(stream); return; }
      stopMediaStream(stream); mediaStreamRef.current = null;
      const recognition = new Recognition();
      recognition.lang = "en-GB"; recognition.continuous = false; recognition.interimResults = true;
      recognitionRef.current = recognition;
      recognition.onresult = (event) => {
        const parts = Array.from(event.results).map((result) => result[0]?.transcript ?? "");
        setDraft(parts.join(" ").trim());
      };
      recognition.onerror = (event) => {
        if (event.error !== "aborted") setError(event.error === "not-allowed" ? "Microphone access was blocked. Allow it in your site settings, then try again." : `Voice recognition stopped: ${event.error}.`);
        setStatus(event.error === "aborted" ? "paused" : "error");
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        setStatus((current) => current === "listening" ? "idle" : current);
      };
      recognition.start();
      setStatus("listening");
    } catch (caught) {
      setError(microphoneErrorMessage(caught));
      setStatus("error");
    }
  }, [isListening, startFallbackRecording]);

  const executeAction = useCallback(() => {
    if (!pendingAction) return;
    setStatus("using-tool");
    if (pendingAction.type === "navigate") navigateTo(pendingAction.view);
    else if (pendingAction.type === "start-focus") navigateTo("focus", { minutes: pendingAction.minutes, autoStart: true });
    else if (pendingAction.type === "create-note") { addNote({ title: pendingAction.title, content: pendingAction.content }); navigateTo("notes"); }
    else if (pendingAction.type === "create-quiz") navigateTo("quiz", { subject: pendingAction.subject, chapter: pendingAction.chapter, source: "live-tutor" });
    else if (pendingAction.type === "create-slideshow") navigateTo("ai-tools", { tool: "slideshow", subject: pendingAction.subject, chapter: pendingAction.chapter, source: "live-tutor" });
    else if (pendingAction.type === "open-ebook-page") navigateTo("ebook", { bookId: pendingAction.bookId, page: pendingAction.page, source: "live-tutor" });
    else if (pendingAction.type === "open-file") navigateTo("files", { fileId: pendingAction.fileId, source: "live-tutor" });
    setPendingAction(null);
    setStatus("complete");
  }, [addNote, pendingAction]);

  const deleteMemory = useCallback(async (memoryId: string) => {
    const response = await fetch(`/api/lam/live/memory?id=${encodeURIComponent(memoryId)}`, { method: "DELETE" });
    if (response.ok) setMemories((current) => current.filter((item) => item.id !== memoryId));
  }, []);

  const setPersonalityAndPersist = (value: LiveTutorPersonality) => { setPersonality(value); patchPreferences({ liveTutorPersonality: value }); };
  const setProviderAndPersist = (value: LiveTutorProvider) => { setProvider(value); patchPreferences({ liveTutorProvider: value }); };
  const setModeAndPersist = (value: LiveTutorMode) => { setMode(value); patchPreferences({ liveTutorMode: value }); };

  return (
    <section className="liveTutorRoot" data-personality={personality} aria-label="LAM Live Tutor">
      <PersonalityBackground personality={personality} />
      <div className="liveTutorShade" aria-hidden="true" />

      <header className="liveTutorTopbar liveTutorGlass">
        <div className="liveTutorBrand">
          <span className="liveTutorBrandMark"><BrainCircuit size={18} /></span>
          <span className="liveTutorBrandText"><strong>LAM LIVE</strong></span>
          <span className="liveTutorBadge">BETA</span>
        </div>
        <div className="liveTutorTopActions">
          <button className="liveTutorPill" type="button" onClick={() => setPanel(panel === "memory" ? null : "memory")}><MemoryStick size={13} /> {memorySummary?.relevantMemories ?? 0}<span className="sr-only"> memories</span></button>
          <button className="liveTutorIconButton" type="button" onClick={() => setPanel(panel === "context" ? null : "context")} aria-label="View learning awareness"><Eye size={17} /></button>
          <button className="liveTutorIconButton" type="button" onClick={() => setPanel(panel === "settings" ? null : "settings")} aria-label="Live Tutor settings"><Settings2 size={17} /></button>
        </div>
      </header>

      <div className="liveTutorStage">
        <div className="liveTutorCenter">
          <div className="liveTutorKicker liveTutorGlass"><span className="liveTutorStatusDot" />{stateLabel(status)}</div>
          <h1 className="liveTutorTitle">{copy.idleHeading}</h1>
          <p className="liveTutorSubtitle">{copy.idleSubcopy}</p>
          <div className="liveTutorOrb" data-active={isBusy || isListening} aria-label={`LAM is ${stateLabel(status).toLowerCase()}`}><Sparkles size={28} /></div>

          {mission ? (
            <div className="liveTutorMission liveTutorGlass">
              <div className="liveTutorStatus"><Clock3 size={16} /><strong>{mission.title}</strong><span className="liveTutorBadge">ACTIVE</span></div>
              <div className="liveTutorMissionSteps" aria-label="Mission progress">{mission.steps.map((step) => <span key={step.id} title={step.label} className="liveTutorMissionStep" data-state={step.state} />)}</div>
            </div>
          ) : null}

          {captions && (visibleMessages.length || streamingText) ? (
            <div className="liveTutorTranscript liveTutorGlass" ref={transcriptRef} aria-live="polite">
              {visibleMessages.map((message) => (
                <article className="liveTutorMessage" key={message.id}>
                  <span className="liveTutorMessageRole">{message.role === "assistant" ? <Bot size={15} /> : <span aria-hidden="true">{user.name?.[0]?.toUpperCase() || "Y"}</span>}</span>
                  <div className="liveTutorMessageBody">{message.role === "assistant" ? <LamResponse content={message.content} optimized /> : message.content}</div>
                </article>
              ))}
              {streamingText ? <article className="liveTutorMessage"><span className="liveTutorMessageRole"><Bot size={15} /></span><div className="liveTutorMessageBody"><LamResponse content={streamingText} optimized streaming /></div></article> : null}
              {status === "thinking" && !streamingText ? <div className="liveTutorStreaming" aria-label="LAM is thinking"><i /><i /><i /></div> : null}
            </div>
          ) : null}

          {pendingAction ? (
            <div className="liveTutorActionCard liveTutorGlass">
              <div><p>{actionCopy(pendingAction).title}</p><span>{actionCopy(pendingAction).detail}</span></div>
              <div className="liveTutorControlRow"><button className="liveTutorControlButton" type="button" onClick={() => { setPendingAction(null); setStatus("idle"); }}>Cancel</button><button className="liveTutorControlButton liveTutorPrimary" type="button" onClick={executeAction}><Check size={15} /> Confirm</button></div>
            </div>
          ) : null}

          {error ? <div className="liveTutorError" role="alert">{error}</div> : null}

          <form className="liveTutorComposer liveTutorGlass" onSubmit={(event) => { event.preventDefault(); void sendMessage(draft); }}>
            <textarea className="liveTutorTextarea" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={copy.prompt} aria-label="Message LAM Live Tutor" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(draft); } }} />
            <div className="liveTutorComposerFooter">
              <div className="liveTutorControlRow">
                <button className="liveTutorControlButton" data-listening={isListening} type="button" aria-label={isListening ? "Finish voice input" : "Talk to LAM"} onClick={() => void startListening()}>{isListening ? <CircleStop size={17} /> : <Mic size={17} />}<span className="optional">{isListening ? "Finish" : "Talk"}</span></button>
                {(isBusy || isListening || status === "speaking") ? <button className="liveTutorControlButton" type="button" onClick={stopEverything}><CircleStop size={16} /><span className="optional">Stop</span></button> : null}
              </div>
              <button className="liveTutorControlButton liveTutorPrimary" type="submit" disabled={!draft.trim() || isBusy}><Send size={16} /> Ask LAM</button>
            </div>
          </form>
          <div className="liveTutorMeta"><span>{copy.label}</span><span>·</span><span>{provider === "auto" ? "Auto model" : provider}</span>{resolvedModel ? <><span>·</span><span>{resolvedModel}</span></> : null}<span>·</span><span>English (UK)</span></div>
        </div>
      </div>

      <aside className={`liveTutorDrawer liveTutorGlass ${panel ? "isOpen" : ""}`} aria-hidden={!panel}>
        <div className="liveTutorDrawerHeader"><h2>{panel === "memory" ? "What LAM remembers" : panel === "context" ? "Learning awareness" : "Live Tutor settings"}</h2><button className="liveTutorIconButton" type="button" onClick={() => setPanel(null)} aria-label="Close panel"><X size={17} /></button></div>
        {panel === "settings" ? (
          <>
            <div className="liveTutorSection"><h3>Personality</h3><div className="liveTutorChoiceGrid">{(["calm", "exam", "curious"] as LiveTutorPersonality[]).map((item) => <button type="button" key={item} className={`liveTutorChoice ${personality === item ? "isSelected" : ""}`} onClick={() => setPersonalityAndPersist(item)}>{PERSONALITY_COPY[item].shortLabel}</button>)}</div></div>
            <div className="liveTutorSection"><h3>AI provider</h3><select className="liveTutorSelect" value={provider} onChange={(event) => setProviderAndPersist(event.target.value as LiveTutorProvider)}>{providerStatuses.length ? providerStatuses.map((item) => <option key={item.id} value={item.id} disabled={!item.available}>{item.label}{item.available ? item.model ? ` — ${item.model}` : "" : " — not configured"}</option>) : <><option value="auto">Auto</option><option value="groq">Groq</option></>}</select></div>
            <div className="liveTutorSection"><h3>Teaching mode</h3><select className="liveTutorSelect" value={mode} onChange={(event) => setModeAndPersist(event.target.value as LiveTutorMode)}>{LIVE_TUTOR_MODES.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}</select></div>
            <div className="liveTutorSection"><h3>Voice and transcript</h3><button type="button" className="liveTutorControlButton" onClick={() => { const next = !autoSpeak; setAutoSpeak(next); patchPreferences({ liveTutorAutoSpeak: next }); }}>{autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />} Spoken replies {autoSpeak ? "on" : "off"}</button><button type="button" className="liveTutorControlButton" style={{ marginLeft: 8 }} onClick={() => { const next = !captions; setCaptions(next); patchPreferences({ liveTutorCaptions: next }); }}>{captions ? <FileText size={16} /> : <X size={16} />} Transcript {captions ? "on" : "off"}</button></div>
          </>
        ) : null}
        {panel === "memory" ? (
          <div className="liveTutorSection"><h3>User-controlled memory</h3>{memories.length ? memories.map((memory) => <div className="liveTutorMemory" key={memory.id}><small>{memory.kind.replaceAll("_", " ")}</small><p>{memory.content}</p><button className="liveTutorIconButton" type="button" onClick={() => void deleteMemory(memory.id)} aria-label="Forget this memory"><Trash2 size={14} /></button></div>) : <p style={{ color: "var(--lt-muted)", fontSize: 13 }}>No explicit memories yet. Say “Remember that…” and LAM will save it to your account.</p>}</div>
        ) : null}
        {panel === "context" ? (
          <><div className="liveTutorSection"><h3>Current context</h3><p>{runtimeContext.subjectTitle ?? "No subject selected"}{runtimeContext.chapterTitle ? ` · ${runtimeContext.chapterTitle}` : ""}</p></div><div className="liveTutorSection"><h3>Study signals</h3><div className="liveTutorMemory"><small>Weak topics</small><p>{memorySummary?.weakTopics?.length ? memorySummary.weakTopics.map((item) => `${item.subject}: ${item.topic ?? item.chapter}`).join(", ") : "No weak-topic signal available."}</p></div><div className="liveTutorMemory"><small>Revision</small><p>{memorySummary?.dueRevision ?? 0} due · {memorySummary?.unresolvedMistakes ?? 0} unresolved mistakes</p></div></div></>
        ) : null}
      </aside>
    </section>
  );
}
