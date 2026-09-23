"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, BookOpen, BrainCircuit, Check, CircleStop, Copy, Eye, FileText, History, Loader2, MemoryStick, Mic, Plus, Settings2, Sparkles, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { PersonalityBackground } from "@/components/live-tutor/personality-background";
import { LamResponse } from "@/components/lam/lam-response";
import { getLamPageContext, type LamRuntimeContext } from "@/lib/lam-context";
import { parseLocalCommand, type LamAction } from "@/lib/lam/commands";
import { microphoneErrorMessage, requestMicrophoneStream, stopMediaStream } from "@/lib/lam/microphone";
import { loadLamState, updateLamPreferences } from "@/lib/lam/storage";
import type { LamMessage, LamPreferences } from "@/lib/lam/types";
import { LIVE_TUTOR_MODES, LIVE_TUTOR_PERSONALITIES, PERSONALITY_COPY, type LiveTutorMemoryRecord, type LiveTutorMission, type LiveTutorMode, type LiveTutorPersonality, type LiveTutorProvider, type LiveTutorProviderStatus, type LiveTutorState } from "@/lib/live-tutor/types";
import { navigateTo } from "@/lib/nav-event";
import { useStore } from "@/lib/store";
import "@/components/live-tutor/live-tutor.css";

type RecognitionEvent = Event & { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> };
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((event: RecognitionEvent) => void) | null; onerror: ((event: Event & { error: string }) => void) | null; onend: (() => void) | null };
type RecognitionCtor = new () => Recognition;
declare global { interface Window { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor } }

type Panel = "personality" | "settings" | "memory" | "context" | "mission" | "sessions" | null;
type PersonaMessages = Record<LiveTutorPersonality, LamMessage[]>;
type PersonaSessions = Record<LiveTutorPersonality, string>;
type MemorySummary = { relevantMemories: number; weakTopics: Array<{ subject: string; chapter: string; topic: string | null; score: number }>; unresolvedMistakes: number; dueRevision: number };
type SavedSession = { id: string; title: string; personality: LiveTutorPersonality; provider: LiveTutorProvider; mode: LiveTutorMode; lastActivityAt: string; messages: LamMessage[] };

const ids = (): PersonaSessions => ({ calm: "", exam: "", curious: "" });
const chats = (): PersonaMessages => ({ calm: [], exam: [], curious: [] });
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const QUICK: Record<LiveTutorPersonality, Array<{ label: string; mode: LiveTutorMode }>> = {
  calm: [{ label: "Teach me", mode: "tutor" }, { label: "Quiz me", mode: "examiner" }, { label: "Explain material", mode: "tutor" }],
  exam: [{ label: "Viva me", mode: "examiner" }, { label: "Rapid revision", mode: "rapid-revision" }, { label: "Find weak areas", mode: "examiner" }],
  curious: [{ label: "Why does this work?", mode: "tutor" }, { label: "Watch me solve", mode: "tutor" }, { label: "Connect two ideas", mode: "tutor" }],
};

function englishVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => /microsoft/i.test(voice.name) && /^en-GB/i.test(voice.lang)) ?? voices.find((voice) => /^en-GB/i.test(voice.lang)) ?? voices.find((voice) => /^en/i.test(voice.lang));
}

function actionCopy(action: LamAction) {
  if (action.type === "navigate") return { title: `Open ${action.view.replaceAll("-", " ")}`, detail: "LAM will move you to this Scholar workspace." };
  if (action.type === "start-focus") return { title: `Start a ${action.minutes}-minute focus session`, detail: "LAM will open Focus with this timer prepared." };
  if (action.type === "create-note") return { title: `Save “${action.title}”`, detail: "LAM will add this to your real Scholar Notes." };
  if (action.type === "create-quiz") return { title: "Create a Scholar quiz", detail: "LAM will open Quiz with the current learning context." };
  return { title: "Use a Scholar tool", detail: "LAM needs confirmation before changing anything." };
}

export function LiveTutorView() {
  const user = useStore((state) => state.user);
  const addNote = useStore((state) => state.addNote);
  const profileId = `class-${user.scholarClass}`;
  const prefs = useMemo(() => loadLamState(profileId).preferences, [profileId]);
  const [personality, setPersonality] = useState<LiveTutorPersonality>(prefs.liveTutorPersonality);
  const [provider, setProvider] = useState<LiveTutorProvider>(prefs.liveTutorProvider);
  const [mode, setMode] = useState<LiveTutorMode>(prefs.liveTutorMode);
  const [autoSpeak, setAutoSpeak] = useState(prefs.liveTutorAutoSpeak);
  const [captions, setCaptions] = useState(prefs.liveTutorCaptions);
  const [messagesByPersona, setMessagesByPersona] = useState<PersonaMessages>(chats);
  const [sessionIds, setSessionIds] = useState<PersonaSessions>(ids);
  const [history, setHistory] = useState<SavedSession[]>([]);
  const [context, setContext] = useState<LamRuntimeContext>(() => getLamPageContext());
  const [status, setStatus] = useState<LiveTutorState>("preparing");
  const [prepared, setPrepared] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState("");
  const [resolvedModel, setResolvedModel] = useState("");
  const [providers, setProviders] = useState<LiveTutorProviderStatus[]>([]);
  const [memories, setMemories] = useState<LiveTutorMemoryRecord[]>([]);
  const [memorySummary, setMemorySummary] = useState<MemorySummary | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<LamAction | null>(null);
  const [mission, setMission] = useState<LiveTutorMission | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const switchTimer = useRef<number | null>(null);

  const messages = messagesByPersona[personality];
  const copy = PERSONALITY_COPY[personality];
  const busy = ["thinking", "transcribing", "speaking", "using-tool"].includes(status);
  const listening = status === "listening";
  const patchPreferences = useCallback((patch: Partial<LamPreferences>) => updateLamPreferences(profileId, patch), [profileId]);
  const append = useCallback((persona: LiveTutorPersonality, message: LamMessage) => setMessagesByPersona((current) => ({ ...current, [persona]: [...current[persona], message].slice(-100) })), []);

  useEffect(() => {
    const sync = (event: Event) => setContext((event as CustomEvent<LamRuntimeContext>).detail ?? {});
    window.addEventListener("scholar:lam-context", sync);
    return () => window.removeEventListener("scholar:lam-context", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const prepare = async () => {
      setStatus("recalling");
      const requests = await Promise.allSettled([
        fetch("/api/lam/live/providers", { cache: "no-store" }).then((response) => response.json()),
        fetch("/api/lam/live/memory", { cache: "no-store" }).then((response) => response.json()),
        fetch(`/api/lam/live/sessions?profileId=${encodeURIComponent(profileId)}`, { cache: "no-store" }).then((response) => response.json()),
      ]);
      if (cancelled) return;
      const [providerResult, memoryResult, sessionResult] = requests;
      if (providerResult.status === "fulfilled" && providerResult.value.ok) setProviders(providerResult.value.providers);
      if (memoryResult.status === "fulfilled" && memoryResult.value.ok) { setMemories(memoryResult.value.memories); setMemorySummary(memoryResult.value.summary); }
      if (sessionResult.status === "fulfilled" && sessionResult.value.ok) {
        const sessions = (sessionResult.value.sessions ?? []) as SavedSession[];
        const nextChats = chats(); const nextIds = ids();
        for (const persona of LIVE_TUTOR_PERSONALITIES) {
          const latest = sessions.find((session) => session.personality === persona);
          if (latest) { nextChats[persona] = latest.messages; nextIds[persona] = latest.id; }
        }
        setHistory(sessions); setMessagesByPersona(nextChats); setSessionIds(nextIds);
      }
      setPrepared(true); setStatus("idle");
    };
    void prepare();
    return () => { cancelled = true; };
  }, [profileId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages.length, streaming]);
  useEffect(() => () => { abortRef.current?.abort(); recognitionRef.current?.abort(); if (recorderRef.current?.state === "recording") recorderRef.current.stop(); stopMediaStream(streamRef.current); window.speechSynthesis?.cancel(); if (switchTimer.current) window.clearTimeout(switchTimer.current); }, []);

  const switchPersonality = useCallback((value: LiveTutorPersonality) => {
    if (value === personality) return;
    setSwitching(true); setPersonality(value); patchPreferences({ liveTutorPersonality: value });
    if (switchTimer.current) window.clearTimeout(switchTimer.current);
    switchTimer.current = window.setTimeout(() => setSwitching(false), 540);
  }, [patchPreferences, personality]);

  const speak = useCallback((text: string) => {
    if (!autoSpeak || !("speechSynthesis" in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[#*_`>-]/g, " ").slice(0, 3500));
    utterance.lang = "en-GB"; utterance.voice = englishVoice() ?? null; utterance.rate = prefs.speechRate; utterance.pitch = prefs.speechPitch; utterance.volume = prefs.speechVolume;
    utterance.onstart = () => setStatus("speaking"); utterance.onend = () => setStatus("complete"); utterance.onerror = () => setStatus("complete");
    window.speechSynthesis.speak(utterance);
  }, [autoSpeak, prefs.speechPitch, prefs.speechRate, prefs.speechVolume]);

  const stopEverything = useCallback(() => {
    abortRef.current?.abort(); abortRef.current = null; recognitionRef.current?.abort(); recognitionRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop(); recorderRef.current = null;
    stopMediaStream(streamRef.current); streamRef.current = null; window.speechSynthesis?.cancel(); setStreaming(""); setStatus("paused");
  }, []);

  const remember = useCallback(async (content: string) => {
    const response = await fetch("/api/lam/live/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "user_confirmed", content: content.slice(0, 1000), subject: context.subjectTitle, topic: context.chapterTitle }) });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.memory) setMemories((current) => [result.memory, ...current.filter((item) => item.id !== result.memory.id)]);
  }, [context.chapterTitle, context.subjectTitle]);

  const sendMessage = useCallback(async (raw: string, inputMode: "text" | "voice" = "text") => {
    const message = raw.trim(); if (!message || busy) return;
    const persona = personality; setError(""); setDraft(""); window.speechSynthesis?.cancel();
    const action = parseLocalCommand(message);
    if (action) { append(persona, { id: uid(), role: "user", content: message, inputMode, createdAt: now() }); setPendingAction(action); setStatus("waiting-confirmation"); return; }
    if (/\b(create|make|generate) (a )?(quiz|questions?)\b/i.test(message)) { append(persona, { id: uid(), role: "user", content: message, inputMode, createdAt: now() }); setPendingAction({ type: "create-quiz", subject: context.subjectTitle, chapter: context.chapterTitle }); setStatus("waiting-confirmation"); return; }
    if (/\b(create|make|generate) (a )?(slide ?show|presentation|slides?)\b/i.test(message)) { append(persona, { id: uid(), role: "user", content: message, inputMode, createdAt: now() }); setPendingAction({ type: "create-slideshow", subject: context.subjectTitle, chapter: context.chapterTitle }); setStatus("waiting-confirmation"); return; }
    if (/\b(save|add) (this|that|the answer) (as|to) (a )?note(s)?\b/i.test(message)) {
      const latestAnswer = [...messages].reverse().find((item) => item.role === "assistant")?.content;
      append(persona, { id: uid(), role: "user", content: message, inputMode, createdAt: now() });
      if (!latestAnswer) { setError("Ask LAM something first, then save the answer to Notes."); setStatus("error"); return; }
      setPendingAction({ type: "create-note", title: `LAM AI — ${context.chapterTitle ?? context.subjectTitle ?? "study note"}`, content: latestAnswer }); setStatus("waiting-confirmation"); return;
    }
    const missionMatch = message.match(/(?:i have|give me)\s+(?:(\d+)\s*(?:minutes?|mins?)|an?\s+hour).*?(?:take over|study|revise)?/i);
    if (missionMatch) {
      const minutes = missionMatch[1] ? Math.min(180, Number(missionMatch[1])) : 60;
      setMode("mission"); patchPreferences({ liveTutorMode: "mission" });
      setMission({ id: uid(), title: `${minutes}-minute guided study mission`, durationMinutes: minutes, status: "active", steps: [
        { id: uid(), label: "Review learning signals", state: "complete" }, { id: uid(), label: "Build the plan", state: "active" },
        { id: uid(), label: "Teach and practise", state: "upcoming" }, { id: uid(), label: "Finish with recall", state: "upcoming" },
      ] });
    }
    const turnId = uid(); const sessionId = sessionIds[persona] || uid();
    if (!sessionIds[persona]) setSessionIds((current) => ({ ...current, [persona]: sessionId }));
    append(persona, { id: turnId, role: "user", content: message, inputMode, createdAt: now() }); setStatus("thinking"); setStreaming("");
    const controller = new AbortController(); abortRef.current = controller; let full = ""; let sources: Array<{ label: string; route?: string }> = [];
    try {
      const response = await fetch("/api/lam/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({
        profileId, message, inputMode, assistantMode: mode === "examiner" ? "question-coach" : mode === "rapid-revision" ? "revision-coach" : "tutor",
        pageContext: { profileId, profileName: user.name || `Class ${user.scholarClass} learner`, scholarClass: user.scholarClass, currentView: "live-tutor", currentRoute: "/live-tutor", ...context },
        messages: messages.filter((item) => item.role !== "tool").slice(-10).map(({ role, content }) => ({ role: role as "user" | "assistant", content })), responseDetail: prefs.responseDetail,
        liveTutor: { sessionId, turnId, provider, personality: persona, mode },
      }) });
      if (!response.ok || !response.body) { const result = await response.json().catch(() => null); throw new Error(result?.error || "LAM could not start this response."); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break; buffer += decoder.decode(chunk.value, { stream: true }); const events = buffer.split("\n\n"); buffer = events.pop() ?? "";
        for (const event of events) { const line = event.split("\n").find((part) => part.startsWith("data: ")); if (!line) continue; const payload = JSON.parse(line.slice(6)) as { type: string; value?: string; message?: string; provider?: string; model?: string; source?: { label: string; route?: string } };
          if (payload.type === "start") setResolvedModel([payload.provider, payload.model].filter(Boolean).join(" · "));
          if (payload.type === "text-delta" && payload.value) { full += payload.value; setStreaming(full); }
          if (payload.type === "source" && payload.source) sources = [...sources, payload.source];
          if (payload.type === "error") throw new Error(payload.message || "LAM could not finish this response.");
        }
      }
      if (!full.trim()) throw new Error("LAM returned an empty response. Please retry.");
      append(persona, { id: `${turnId}:assistant`, role: "assistant", content: full, createdAt: now(), sources }); setStreaming(""); setStatus("complete"); speak(full);
    } catch (caught) { if (controller.signal.aborted) return; setStreaming(""); setStatus("error"); setError(caught instanceof Error ? caught.message : "LAM could not complete this turn."); }
    finally { if (abortRef.current === controller) abortRef.current = null; }
  }, [append, busy, context, messages, mode, patchPreferences, personality, prefs.responseDetail, profileId, provider, sessionIds, speak, user.name, user.scholarClass]);

  const startRecording = useCallback((stream: MediaStream) => {
    const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined); chunksRef.current = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onerror = () => { setError("The browser could not record this microphone."); stopEverything(); };
    recorder.onstop = async () => { stopMediaStream(stream); streamRef.current = null; if (!chunksRef.current.length) { setStatus("idle"); return; } setStatus("transcribing");
      try { const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); const form = new FormData(); form.set("audio", blob, `live-tutor.${blob.type.includes("mp4") ? "mp4" : "webm"}`); const response = await fetch("/api/lam/transcribe", { method: "POST", body: form }); const result = await response.json().catch(() => null); if (!response.ok || !result?.text) throw new Error(result?.error || "LAM could not transcribe that recording."); await sendMessage(result.text, "voice"); }
      catch (caught) { setError(caught instanceof Error ? caught.message : "LAM could not transcribe that recording."); setStatus("error"); }
    };
    recorderRef.current = recorder; recorder.start(250); setStatus("listening");
  }, [sendMessage, stopEverything]);

  const startListening = useCallback(async () => {
    if (listening) { recognitionRef.current?.stop(); if (recorderRef.current?.state === "recording") recorderRef.current.stop(); return; }
    abortRef.current?.abort(); window.speechSynthesis?.cancel(); setError("");
    try { const media = await requestMicrophoneStream(); streamRef.current = media; const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition; if (!Ctor) { startRecording(media); return; } stopMediaStream(media); streamRef.current = null;
      const recognition = new Ctor(); recognition.lang = "en-GB"; recognition.continuous = false; recognition.interimResults = true; recognitionRef.current = recognition;
      recognition.onresult = (event) => setDraft(Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim());
      recognition.onerror = (event) => { if (event.error !== "aborted") setError(event.error === "not-allowed" ? "Microphone access was blocked. Allow it in site settings, then retry." : `Voice recognition stopped: ${event.error}.`); setStatus(event.error === "aborted" ? "paused" : "error"); };
      recognition.onend = () => { recognitionRef.current = null; setStatus((current) => current === "listening" ? "idle" : current); }; recognition.start(); setStatus("listening");
    } catch (caught) { setError(microphoneErrorMessage(caught)); setStatus("error"); }
  }, [listening, startRecording]);

  const executeAction = useCallback(() => {
    if (!pendingAction) return; setStatus("using-tool");
    if (pendingAction.type === "navigate") navigateTo(pendingAction.view);
    else if (pendingAction.type === "start-focus") navigateTo("focus", { minutes: pendingAction.minutes, autoStart: true });
    else if (pendingAction.type === "create-note") { addNote({ title: pendingAction.title, content: pendingAction.content }); navigateTo("notes"); }
    else if (pendingAction.type === "create-quiz") navigateTo("quiz", { subject: pendingAction.subject, chapter: pendingAction.chapter, source: "live-tutor" });
    else if (pendingAction.type === "create-slideshow") navigateTo("ai-tools", { tool: "slideshow", subject: pendingAction.subject, chapter: pendingAction.chapter, source: "live-tutor" });
    else if (pendingAction.type === "open-ebook-page") navigateTo("ebook", { bookId: pendingAction.bookId, page: pendingAction.page, source: "live-tutor" });
    else if (pendingAction.type === "open-file") navigateTo("files", { fileId: pendingAction.fileId, source: "live-tutor" });
    setPendingAction(null); setStatus("complete");
  }, [addNote, pendingAction]);

  const newConversation = () => { if (!window.confirm(`Start a new ${copy.label} conversation? Other personality sessions are kept.`)) return; setMessagesByPersona((current) => ({ ...current, [personality]: [] })); setSessionIds((current) => ({ ...current, [personality]: uid() })); setResolvedModel(""); setError(""); setPanel(null); };
  const quick = (item: { label: string; mode: LiveTutorMode }) => { setMode(item.mode); patchPreferences({ liveTutorMode: item.mode }); void sendMessage(item.label); };

  return <section className={`lt-root lt-${personality} ${switching ? "is-switching" : ""}`} data-personality={personality} aria-label="LAM AI">
    <PersonalityBackground personality={personality} /><div className="lt-environment-scrim" aria-hidden="true" />
    <nav className="lt-nav" aria-label="LAM AI navigation"><span className="lt-nav-brand"><span className="lt-scholar-mark"><BrainCircuit /></span>Scholar<span className="lt-nav-beta">LAM AI · BETA</span></span><span className="lt-nav-div" /><div className="lt-nav-tabs" role="group" aria-label="Personality">{LIVE_TUTOR_PERSONALITIES.map((item) => <button key={item} className="lt-nav-tab" aria-pressed={personality === item} onClick={() => switchPersonality(item)}>{PERSONALITY_COPY[item].shortLabel}</button>)}</div><span className="lt-nav-div" /><button className="lt-nav-new" onClick={newConversation} aria-label="New conversation"><Plus /></button></nav>
    {(listening || status === "transcribing" || status === "speaking") ? <div className="lt-voice-pill" data-state={status} role="status"><span className="lt-voice-dot" />{status === "listening" ? "Listening" : status === "transcribing" ? "Processing…" : "LAM is speaking…"}</div> : null}

    <div className="lt-canvas">{messages.length || streaming ? <div className="lt-canvas-scroll" ref={scrollRef} role="log" aria-live="polite" aria-label="LAM AI conversation"><div className="lt-convo-col">
      {captions && messages.map((message) => <article className="lt-turn" data-role={message.role} key={message.id}><div className="lt-turn-meta">{message.role === "assistant" ? <><span className="lt-turn-orb"><Sparkles /></span>{copy.label}</> : <>You{message.inputMode === "voice" ? " · voice" : ""}</>}</div><div className="lt-bubble">{message.role === "assistant" ? <LamResponse content={message.content} optimized /> : message.content}</div>{message.role === "assistant" ? <div className="lt-msg-actions"><button className="lt-msg-act" onClick={() => void navigator.clipboard.writeText(message.content)}><Copy />Copy</button><button className="lt-msg-act" onClick={() => void remember(message.content)}><MemoryStick />Remember</button><button className="lt-msg-act" onClick={() => { setPendingAction({ type: "create-note", title: `LAM AI — ${context.chapterTitle ?? context.subjectTitle ?? "study note"}`, content: message.content }); setStatus("waiting-confirmation"); }}><FileText />Save to Notes</button></div> : null}</article>)}
      {captions && streaming ? <article className="lt-turn" data-role="assistant"><div className="lt-turn-meta"><span className="lt-turn-orb"><Sparkles /></span>{copy.label}</div><div className="lt-bubble"><LamResponse content={streaming} optimized streaming /></div></article> : null}
      {status === "thinking" && !streaming ? <article className="lt-turn" data-role="assistant"><div className="lt-turn-meta"><span className="lt-turn-orb"><Sparkles /></span>{copy.label}</div><div className="lt-bubble"><span className="lt-thinking"><span /><span /><span /></span></div></article> : null}
    </div></div> : prepared ? <div className="lt-empty-state"><span className="lt-empty-orb"><Sparkles /></span><h1 className="lt-empty-title">{copy.idleHeading}</h1><p className="lt-empty-sub">{copy.idleSubcopy}</p><div className="lt-empty-chips">{QUICK[personality].map((item) => <button key={item.label} className="lt-empty-chip" onClick={() => quick(item)}>{item.label}</button>)}</div></div> : null}</div>

    {pendingAction ? <div className="lt-confirm"><h4>{actionCopy(pendingAction).title}</h4><p>{actionCopy(pendingAction).detail}</p><div className="lt-confirm-actions"><button className="lt-btn lt-btn-primary" onClick={executeAction}><Check />Approve</button><button className="lt-btn lt-btn-ghost" onClick={() => { setPendingAction(null); setStatus("idle"); }}>Cancel</button></div></div> : null}
    {error ? <div className="lt-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X /></button></div> : null}

    <div className="lt-composer">{busy ? <button className="lt-stop" onClick={stopEverything}><span className="lt-stop-sq" />Stop</button> : null}<form className="lt-composer-card" onSubmit={(event) => { event.preventDefault(); void sendMessage(draft); }}><textarea className="lt-composer-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={copy.prompt} aria-label="Message LAM AI" rows={1} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(draft); } }} /><div className="lt-composer-bar"><div className="lt-composer-chips">{QUICK[personality].slice(0, 2).map((item) => <button key={item.label} type="button" className="lt-composer-chip" aria-pressed={mode === item.mode} onClick={() => quick(item)}>{item.label}</button>)}</div><div className="lt-composer-actions"><select className="lt-cmp-prov" value={provider} onChange={(event) => { const value = event.target.value as LiveTutorProvider; setProvider(value); patchPreferences({ liveTutorProvider: value }); }} aria-label="Model provider">{providers.length ? providers.map((item) => <option key={item.id} value={item.id} disabled={!item.available}>{item.label}{item.available ? "" : " · unavailable"}</option>) : <option value="auto">Auto</option>}</select><button type="button" className="lt-cmp-btn" aria-pressed={listening} onClick={() => void startListening()} aria-label={listening ? "Stop listening" : "Talk to LAM"}>{status === "transcribing" ? <Loader2 className="lt-spin" /> : listening ? <CircleStop /> : <Mic />}</button><button type="submit" className="lt-cmp-btn lt-cmp-send" disabled={!draft.trim() || busy} aria-label="Ask LAM">{busy ? <Loader2 className="lt-spin" /> : <ArrowUp />}</button></div></div></form><div className="lt-composer-meta"><span>{copy.label}</span><span>·</span><span>{provider === "auto" ? "Auto model" : provider}</span>{resolvedModel ? <><span>·</span><span>{resolvedModel}</span></> : null}</div></div>

    <div className="lt-dock" role="toolbar" aria-label="LAM AI panels"><button className="lt-dock-btn lt-dock-spark" onClick={() => setPanel(panel === "personality" ? null : "personality")} aria-label="Switch personality"><Sparkles /></button><button className="lt-dock-btn" onClick={() => setPanel(panel === "memory" ? null : "memory")} aria-label="Memory"><MemoryStick /></button><button className="lt-dock-btn" onClick={() => setPanel(panel === "context" ? null : "context")} aria-label="Learning awareness"><Eye /></button><button className="lt-dock-btn" onClick={() => setPanel(panel === "mission" ? null : "mission")} aria-label="Study mission"><BookOpen /></button><button className="lt-dock-btn" onClick={() => setPanel(panel === "sessions" ? null : "sessions")} aria-label="Sessions"><History /></button><button className="lt-dock-btn" onClick={() => setPanel(panel === "settings" ? null : "settings")} aria-label="LAM AI settings"><Settings2 /></button></div>

    <aside className={`lt-sheet-content ${panel ? "is-open" : ""}`} data-personality={personality} aria-hidden={!panel} aria-label="LAM AI panel"><header className="lt-sheet-header"><h2>{panel === "personality" ? "Teaching personality" : panel === "memory" ? "What LAM remembers" : panel === "context" ? "Learning awareness" : panel === "mission" ? "Study mission" : panel === "sessions" ? "Sessions" : "LAM AI settings"}</h2><button onClick={() => setPanel(null)} aria-label="Close panel"><X /></button></header><div className="lt-sheet-scroll">
      {panel === "personality" ? <div className="lt-sheet">{LIVE_TUTOR_PERSONALITIES.map((item) => <button key={item} className="lt-personality-card" aria-pressed={personality === item} onClick={() => { switchPersonality(item); setPanel(null); }}><strong>{PERSONALITY_COPY[item].label}</strong><span>{PERSONALITY_COPY[item].description}</span></button>)}</div> : null}
      {panel === "memory" ? <div className="lt-sheet"><p className="lt-panel-help">Account-bound learning memory is shared by all three personalities.</p>{memories.length ? memories.map((memory) => <div className="lt-mem-item" key={memory.id}><div><span className="lt-mem-cat">{memory.kind.replaceAll("_", " ")}</span><p className="lt-mem-sum">{memory.content}</p></div><button className="lt-mem-del" onClick={async () => { const response = await fetch(`/api/lam/live/memory?id=${encodeURIComponent(memory.id)}`, { method: "DELETE" }); if (response.ok) setMemories((current) => current.filter((item) => item.id !== memory.id)); }} aria-label="Forget this memory"><Trash2 /></button></div>) : <p className="lt-panel-help">No explicit memories yet. Use Remember on a useful answer.</p>}</div> : null}
      {panel === "context" ? <div className="lt-sheet"><div className="lt-aware-row"><span className="lt-aware-k">Subject</span><span className="lt-aware-v">{context.subjectTitle ?? "Not selected"}</span></div><div className="lt-aware-row"><span className="lt-aware-k">Chapter</span><span className="lt-aware-v">{context.chapterTitle ?? "Not selected"}</span></div><div className="lt-aware-row"><span className="lt-aware-k">Active file</span><span className="lt-aware-v">{context.activeFileName ?? "None"}</span></div><div className="lt-aware-row"><span className="lt-aware-k">Weak topics</span><span className="lt-aware-v">{memorySummary?.weakTopics?.length ? memorySummary.weakTopics.map((item) => item.topic ?? item.chapter).join(", ") : "No signal"}</span></div></div> : null}
      {panel === "mission" ? <div className="lt-sheet">{mission ? <div className="lt-mission-card"><p className="lt-mission-title">{mission.title}</p><p className="lt-mission-obj">Grounded in your current Scholar context and learning memory.</p>{mission.steps.map((step) => <div className="lt-mission-step" data-status={step.state === "complete" ? "done" : step.state === "active" ? "active" : "pending"} key={step.id}><span className="lt-step-dot">{step.state === "complete" ? <Check /> : null}</span>{step.label}</div>)}</div> : <><p className="lt-panel-help">Start a guided plan grounded in your real learning signals.</p><button className="lt-btn lt-btn-primary" onClick={() => void sendMessage("Give me a 60 minute study mission and take over")}>Start 60-minute mission</button></>}</div> : null}
      {panel === "sessions" ? <div className="lt-sheet"><button className="lt-btn lt-btn-primary lt-full-button" onClick={newConversation}><Plus />New {copy.shortLabel} session</button>{history.length ? history.map((session) => <button className="lt-sess-item" key={session.id} onClick={() => { switchPersonality(session.personality); setMessagesByPersona((current) => ({ ...current, [session.personality]: session.messages })); setSessionIds((current) => ({ ...current, [session.personality]: session.id })); setPanel(null); }}><span className="lt-sess-dot" data-p={session.personality} /><span className="lt-sess-meta"><strong className="lt-sess-title">{session.title}</strong><small className="lt-sess-sub">{PERSONALITY_COPY[session.personality].label} · {new Date(session.lastActivityAt).toLocaleDateString()}</small></span></button>) : <p className="lt-panel-help">Your first session appears here after you send a message.</p>}</div> : null}
      {panel === "settings" ? <div className="lt-sheet"><section className="lt-sheet-section"><h3>AI provider</h3><select className="lt-panel-select" value={provider} onChange={(event) => { const value = event.target.value as LiveTutorProvider; setProvider(value); patchPreferences({ liveTutorProvider: value }); }}>{providers.map((item) => <option key={item.id} value={item.id} disabled={!item.available}>{item.label}{item.model ? ` — ${item.model}` : item.available ? "" : " — not configured"}</option>)}</select></section><section className="lt-sheet-section"><h3>Teaching mode</h3><select className="lt-panel-select" value={mode} onChange={(event) => { const value = event.target.value as LiveTutorMode; setMode(value); patchPreferences({ liveTutorMode: value }); }}>{LIVE_TUTOR_MODES.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}</select></section><section className="lt-sheet-section"><h3>Voice and transcript</h3><button className="lt-btn lt-btn-ghost" onClick={() => { const value = !autoSpeak; setAutoSpeak(value); patchPreferences({ liveTutorAutoSpeak: value }); }}>{autoSpeak ? <Volume2 /> : <VolumeX />}Spoken replies {autoSpeak ? "on" : "off"}</button><button className="lt-btn lt-btn-ghost" onClick={() => { const value = !captions; setCaptions(value); patchPreferences({ liveTutorCaptions: value }); }}>{captions ? <FileText /> : <X />}Transcript {captions ? "on" : "off"}</button></section></div> : null}
    </div></aside>

    {!prepared ? <div className="lt-prep" role="dialog" aria-label="Preparing LAM AI memory"><div className="lt-prep-card"><div className="lt-prep-title"><span className="lt-prep-spinner" />Preparing LAM AI…</div><div className="lt-prep-step done"><span className="chk"><Check /></span>Verifying your Scholar session</div><div className="lt-prep-step done"><span className="chk"><Check /></span>Reading recent learning activity</div><div className="lt-prep-step"><span className="chk" />Restoring personality sessions</div></div></div> : null}
  </section>;
}
