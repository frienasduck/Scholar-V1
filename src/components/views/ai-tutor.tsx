"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, Volume2, Plus, Loader2, Sparkles, SquarePen, Eraser, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";

import { chatAI, TEACHER_PERSONAS_CLASS9, TEACHER_PERSONAS_CLASS11, getPersona, type ChatMessage, type Persona } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { Markdown } from "@/lib/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4";

const SERIF_FONT = "'Instrument Serif', 'Times New Roman', Georgia, serif";

const QUICK_SUGGESTIONS: Record<string, string[]> = {
  "dr-meera": [
    "Explain photosynthesis with a diagram in words",
    "Why is the sky blue? Explain with scattering",
    "Difference between atomic mass and mass number",
  ],
  "mr-raj": [
    "Solve: 2x + 5 = 15 and explain each step",
    "Prove that (a+b)² = a² + 2ab + b² geometrically",
    "Explain the remainder theorem with an example",
  ],
  sara: [
    "Explain the difference between simile and metaphor",
    "Help me write a 100-word paragraph on 'A rainy day'",
    "Summarise the poem 'The Road Not Taken'",
  ],
  arjun: [
    "Summarise the French Revolution in 5 bullet points",
    "Explain the monsoon as a climatic phenomenon in India",
    "What is the difference between Lok Sabha and Rajya Sabha?",
  ],
  slayra: [
    "bestie explain meiosis like im 5 fr",
    "help me memorise the periodic table first 20 elements",
    "how do i even start prepping for boards without losing it",
  ],
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// Tiny hooks for Web Speech API with graceful fallbacks.
function useSpeechRecognition(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  });
  const recRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-IN";
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      if (text) onResult(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => {
      try { rec.abort(); } catch { /* noop */ }
    };
  }, [onResult]);

  const start = () => {
    const rec = recRef.current;
    if (!rec) {
      toast.error("Voice not supported", { description: "Your browser doesn't support speech recognition." });
      return;
    }
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };
  const stop = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };
  return { listening, start, stop, supported };
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    toast.error("Speech not supported", { description: "Your browser can't read text aloud." });
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 0.98;
    window.speechSynthesis.speak(u);
  } catch {
    toast.error("Couldn't play audio");
  }
}

function TypingDots({ accent }: { accent: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md w-fit">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full"
          style={{ background: accent }}
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

// Inject the Instrument Serif font once for the whole app.
function useInstrumentSerifFont() {
  useEffect(() => {
    const id = "instrument-serif-font";
    if (typeof document === "undefined") return;
    if (document.getElementById(id)) return;
    const preconnect1 = document.createElement("link");
    preconnect1.rel = "preconnect";
    preconnect1.href = "https://fonts.googleapis.com";
    const preconnect2 = document.createElement("link");
    preconnect2.rel = "preconnect";
    preconnect2.href = "https://fonts.gstatic.com";
    preconnect2.crossOrigin = "anonymous";
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap";
    document.head.appendChild(preconnect1);
    document.head.appendChild(preconnect2);
    document.head.appendChild(link);
  }, []);
}

const GLASS_STYLES = `
.liquid-glass {
  background: rgba(255, 255, 255, 0.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}
.liquid-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.4px;
  background: linear-gradient(180deg,
    rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%,
    rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%,
    rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
@keyframes fade-rise {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-rise { animation: fade-rise 0.8s ease-out both; }
.animate-fade-rise-delay { animation: fade-rise 0.8s ease-out 0.2s both; }
.animate-fade-rise-delay-2 { animation: fade-rise 0.8s ease-out 0.4s both; }
.ai-tutor-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.ai-tutor-scroll::-webkit-scrollbar-track { background: transparent; }
.ai-tutor-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
.ai-tutor-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28); }
.ai-tutor-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.18) transparent; }
.glass-input::placeholder { color: rgba(255,255,255,0.4); }
`;

export function AITutorView() {
  useInstrumentSerifFont();

  const threads = useStore((s) => s.chatThreads);
  const addThread = useStore((s) => s.addChatThread);
  const addMessage = useStore((s) => s.addChatMessage);
  const clearThread = useStore((s) => s.clearChatThread);
  const pushActivity = useStore((s) => s.pushActivity);
  const addXP = useStore((s) => s.addXP);

  const [activePersonaId, setActivePersonaId] = useState<string>("dr-meera");
  const [fullscreen, setFullscreen] = useState(false);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const TEACHER_PERSONAS = scholarClass === 11 ? TEACHER_PERSONAS_CLASS11 : TEACHER_PERSONAS_CLASS9;
  const activePersona = useMemo<Persona>(() => {
    const found = TEACHER_PERSONAS.find((p) => p.id === activePersonaId);
    return found ?? TEACHER_PERSONAS[0];
  }, [activePersonaId, TEACHER_PERSONAS]);

  // Reset active persona when class changes
  useEffect(() => {
    if (!TEACHER_PERSONAS.find((p) => p.id === activePersonaId)) {
      setActivePersonaId(TEACHER_PERSONAS[0]?.id ?? "dr-meera");
    }
  }, [TEACHER_PERSONAS, activePersonaId]);

  const personaThreads = useMemo(
    () => threads.filter((t) => t.persona === activePersonaId).sort((a, b) => b.updatedAt - a.updatedAt),
    [threads, activePersonaId]
  );

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const activeThread = useMemo(() => {
    const explicit = threads.find((t) => t.id === activeThreadId && t.persona === activePersonaId);
    if (explicit) return explicit;
    return personaThreads[0] ?? null;
  }, [threads, activeThreadId, activePersonaId, personaThreads]);

  const selectPersona = (id: string) => {
    setActivePersonaId(id);
    setActiveThreadId(null);
  };

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [activeThread?.messages.length, loading]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const { listening, start: startMic, stop: stopMic } = useSpeechRecognition((text) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  });

  const handleSend = async (override?: string) => {
    const content = (override ?? input).trim();
    if (!content || loading) return;
    setInput("");

    let threadId = activeThread?.id;
    if (!threadId) {
      threadId = addThread({ persona: activePersonaId, title: `Chat with ${activePersona.name}` });
      setActiveThreadId(threadId);
    }

    const priorMessages = threads.find((t) => t.id === threadId)?.messages ?? [];
    const history: ChatMessage[] = priorMessages
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    addMessage(threadId, { role: "user", content, persona: activePersonaId });
    setLoading(true);

    try {
      const reply = await chatAI(content, activePersonaId, history);
      addMessage(threadId, { role: "assistant", content: reply, persona: activePersonaId });
      addXP(2);
      pushActivity({ type: "chat", text: `Chatted with ${activePersona.name}`, icon: "💬" });
    } catch (e: any) {
      toast.error("AI couldn't respond", { description: e?.message ?? "Try again in a moment." });
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    const id = addThread({ persona: activePersonaId, title: `Chat with ${activePersona.name}` });
    setActiveThreadId(id);
    toast.success("Started a new chat", { description: `with ${activePersona.name} ${activePersona.avatar}` });
  };

  const handleClear = () => {
    if (!activeThread) return;
    clearThread(activeThread.id);
    toast.success("Chat cleared");
  };

  const onMicClick = () => (listening ? stopMic() : startMic());

  const suggestions = QUICK_SUGGESTIONS[activePersonaId] ?? QUICK_SUGGESTIONS["dr-meera"];
  const isEmpty = !activeThread || activeThread.messages.length === 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLASS_STYLES }} />

      <div className="view-enter relative w-full min-h-[calc(100vh-9rem)] rounded-3xl overflow-hidden">
        {/* Cinematic video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          poster=""
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 z-[1]" style={{ background: "rgba(0,0,0,0.6)" }} />
        {/* Subtle vignette for cinematic depth */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        {/* Content layer */}
        <div className="relative z-10 flex flex-col min-h-[calc(100vh-9rem)] p-4 md:p-6 text-white">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white/70" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/60 hidden sm:inline">
                Scholar
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFullscreen(true)}
              className="text-white/70 hover:text-white hover:bg-white/10 border border-white/10 backdrop-blur-sm"
            >
              <Maximize2 className="h-3.5 w-3.5 mr-1.5" /> Fullscreen
            </Button>
          </div>

          {isEmpty ? (
            /* ============ HERO (cinematic empty state) ============ */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-2 py-6 overflow-y-auto ai-tutor-scroll">
              <div className="w-full max-w-4xl flex flex-col items-center">
                <h1
                  className="animate-fade-rise text-5xl md:text-7xl leading-[1.05] text-white"
                  style={{ fontFamily: SERIF_FONT, letterSpacing: "-0.02em" }}
                >
                  AI Tutor
                </h1>
                <p
                  className="animate-fade-rise-delay mt-4 text-base md:text-lg text-white/60 max-w-xl"
                  style={{ letterSpacing: "0.01em" }}
                >
                  Five AI teachers. One study buddy. Ask anything.
                </p>

                {/* Persona cards */}
                <div className="animate-fade-rise-delay-2 mt-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 w-full">
                  {TEACHER_PERSONAS.map((p) => {
                    const active = p.id === activePersonaId;
                    return (
                      <motion.button
                        key={p.id}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => selectPersona(p.id)}
                        className="liquid-glass rounded-2xl p-4 text-left"
                        style={
                          active
                            ? { boxShadow: `0 0 0 1.5px ${p.accent}, 0 14px 40px -10px ${p.accent}66` }
                            : undefined
                        }
                      >
                        <div
                          className={cn(
                            "grid place-items-center h-12 w-12 rounded-xl bg-gradient-to-br text-2xl mb-3 shrink-0",
                            p.color
                          )}
                        >
                          <span>{p.avatar}</span>
                        </div>
                        <p className="font-semibold text-sm text-white truncate">{p.name}</p>
                        <p className="text-[11px] text-white/55 truncate mt-0.5">{p.subject}</p>
                        {active && (
                          <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/80">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent }} /> Active
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Active persona tagline */}
                <p className="mt-6 text-xs text-white/50 italic max-w-md" style={{ fontFamily: SERIF_FONT }}>
                  &ldquo;{activePersona.tagline}&rdquo;
                </p>

                {/* Quick suggestions */}
                <div className="mt-6 w-full">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
                    Try asking {activePersona.name}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="liquid-glass rounded-full px-4 py-2 text-xs text-white/80 hover:text-white transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input bar */}
                <div className="mt-8 w-full max-w-2xl">
                  <div className="liquid-glass rounded-2xl p-2 flex items-end gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-10 w-10 shrink-0 text-white/60 hover:text-white hover:bg-white/10",
                        listening && "text-rose-400"
                      )}
                      onClick={onMicClick}
                      title={listening ? "Stop listening" : "Speak"}
                    >
                      {listening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={`Ask ${activePersona.name} anything...`}
                      disabled={loading}
                      rows={1}
                      className="glass-input min-h-[40px] max-h-32 resize-none bg-transparent border-0 text-white shadow-none focus-visible:ring-0 focus-visible:border-0 px-2"
                    />
                    <Button
                      size="icon"
                      onClick={() => handleSend()}
                      disabled={loading || !input.trim()}
                      className="h-10 w-10 shrink-0 bg-white/15 hover:bg-white/25 text-white border border-white/15"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-white/40 mt-2 text-center">
                    Enter to send · Shift+Enter for newline · +2 XP per reply
                  </p>
                </div>

                {/* CTA + recent threads */}
                <div className="mt-7 flex flex-col items-center gap-5 w-full">
                  <Button
                    onClick={() => inputRef.current?.focus()}
                    className="liquid-glass rounded-full px-7 h-11 text-white hover:bg-white/10 font-medium"
                  >
                    Begin Journey <Sparkles className="h-4 w-4 ml-2" />
                  </Button>

                  {personaThreads.length > 0 && (
                    <div className="liquid-glass rounded-2xl p-3 w-full max-w-md">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Recent chats</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] text-white/60 hover:text-white hover:bg-white/10"
                          onClick={handleNewChat}
                        >
                          <Plus className="h-3 w-3 mr-1" /> New
                        </Button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto ai-tutor-scroll">
                        {personaThreads.slice(0, 4).map((t) => {
                          const last = t.messages[t.messages.length - 1];
                          const isActive = t.id === activeThreadId;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setActiveThreadId(t.id)}
                              className={cn(
                                "w-full text-left px-2.5 py-1.5 rounded-lg transition-colors",
                                isActive ? "bg-white/15" : "hover:bg-white/10"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-medium text-white truncate">{t.title}</p>
                                <span className="text-[9px] text-white/40 shrink-0">
                                  {relativeTime(t.updatedAt)}
                                </span>
                              </div>
                              {last && (
                                <p className="text-[10px] text-white/50 truncate mt-0.5">{last.content}</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ============ CHAT MODE ============ */
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 min-h-[600px]">
              {/* LEFT — persona picker + thread list */}
              <div className="flex flex-col gap-3 lg:max-h-[calc(100vh-12rem)]">
                {/* Persona picker */}
                <div className="liquid-glass rounded-2xl p-2.5">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 px-2 pt-1 pb-2">
                    Teachers
                  </p>
                  <div className="space-y-1">
                    {TEACHER_PERSONAS.map((p) => {
                      const active = p.id === activePersonaId;
                      return (
                        <motion.button
                          key={p.id}
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => selectPersona(p.id)}
                          className={cn(
                            "relative w-full text-left rounded-xl p-2.5 flex items-center gap-2.5 transition-colors",
                            active ? "bg-white/15" : "hover:bg-white/10"
                          )}
                          style={
                            active
                              ? { boxShadow: `inset 0 0 0 1px ${p.accent}80` }
                              : undefined
                          }
                        >
                          <div
                            className={cn(
                              "grid place-items-center h-9 w-9 rounded-lg bg-gradient-to-br text-base shrink-0",
                              p.color
                            )}
                          >
                            <span>{p.avatar}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-white/50 truncate">{p.subject}</p>
                          </div>
                          {active && (
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ background: p.accent }}
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Thread list */}
                <div className="liquid-glass rounded-2xl p-2.5 flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between px-1 pb-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Recent chats</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-white/60 hover:text-white hover:bg-white/10"
                      onClick={handleNewChat}
                    >
                      <Plus className="h-3 w-3 mr-0.5" /> New
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto ai-tutor-scroll pr-1 max-h-72 lg:max-h-none">
                    {personaThreads.length === 0 ? (
                      <p className="text-[10px] text-white/40 text-center py-4 px-2">
                        No chats yet. Click <span className="font-medium text-white/60">New</span> to begin.
                      </p>
                    ) : (
                      personaThreads.map((t) => {
                        const last = t.messages[t.messages.length - 1];
                        const isActive = t.id === activeThreadId;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setActiveThreadId(t.id)}
                            className={cn(
                              "w-full text-left px-2.5 py-2 rounded-lg transition-colors mb-1",
                              isActive ? "bg-white/15" : "hover:bg-white/10"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-medium text-white truncate">{t.title}</p>
                              <span className="text-[9px] text-white/40 shrink-0">
                                {relativeTime(t.updatedAt)}
                              </span>
                            </div>
                            {last ? (
                              <p className="text-[10px] text-white/50 truncate mt-0.5">
                                <span className="opacity-70">
                                  {last.role === "user" ? "You: " : activePersona.name + ": "}
                                </span>
                                {last.content}
                              </p>
                            ) : (
                              <p className="text-[10px] text-white/40 italic mt-0.5">
                                Empty chat — say hi 👋
                              </p>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT — chat */}
              <div className="liquid-glass rounded-3xl flex flex-col h-[calc(100vh-12rem)] min-h-[560px] overflow-hidden">
                {/* Chat header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <motion.div
                      className={cn(
                        "grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br text-lg shrink-0",
                        activePersona.color
                      )}
                      animate={{ scale: [1, 1.04, 1] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {activePersona.avatar}
                    </motion.div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-white truncate">{activePersona.name}</p>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full text-white/90 whitespace-nowrap"
                          style={{
                            background: `${activePersona.accent}33`,
                            border: `1px solid ${activePersona.accent}66`,
                          }}
                        >
                          {activePersona.subject}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/50 truncate">{activePersona.tagline}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10"
                      onClick={handleNewChat}
                      title="New chat"
                    >
                      <SquarePen className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-white/60 hover:text-rose-300 hover:bg-white/10"
                      onClick={handleClear}
                      title="Clear chat"
                    >
                      <Eraser className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10"
                      onClick={() => setFullscreen(true)}
                      title="Fullscreen"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 ai-tutor-scroll">
                  <AnimatePresence initial={false}>
                    {activeThread?.messages.map((m) => {
                      const isUser = m.role === "user";
                      return (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}
                        >
                          {!isUser && (
                            <div
                              className={cn(
                                "grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-br text-sm shrink-0 mt-0.5",
                                activePersona.color
                              )}
                            >
                              {activePersona.avatar}
                            </div>
                          )}
                          <div className={cn("max-w-[78%] group", isUser && "flex flex-col items-end")}>
                            <div
                              className={cn(
                                "rounded-2xl px-4 py-2.5 text-sm leading-relaxed border backdrop-blur-md",
                                isUser
                                  ? "bg-white/15 text-white rounded-br-md border-white/15"
                                  : "bg-white/10 text-white/95 rounded-bl-md border-white/10"
                              )}
                            >
                              {isUser ? (
                                <p className="whitespace-pre-wrap">{m.content}</p>
                              ) : (
                                <Markdown content={m.content} />
                              )}
                            </div>
                            {!isUser && (
                              <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 text-[10px] text-white/60 hover:text-white hover:bg-white/10"
                                  onClick={() => speak(m.content)}
                                  title="Read aloud"
                                >
                                  <Volume2 className="h-3 w-3 mr-1" /> Listen
                                </Button>
                                <span className="text-[10px] text-white/40">{relativeTime(m.at)}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                    {loading && (
                      <motion.div
                        key="typing"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex gap-2.5"
                      >
                        <div
                          className={cn(
                            "grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-br text-sm shrink-0 mt-0.5",
                            activePersona.color
                          )}
                        >
                          {activePersona.avatar}
                        </div>
                        <TypingDots accent={activePersona.accent} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Input */}
                <div className="border-t border-white/10 p-3 shrink-0">
                  <div className="flex items-end gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-10 w-10 shrink-0 text-white/60 hover:text-white hover:bg-white/10",
                        listening && "text-rose-400"
                      )}
                      onClick={onMicClick}
                      title={listening ? "Stop listening" : "Speak"}
                    >
                      {listening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={`Ask ${activePersona.name} anything...`}
                      disabled={loading}
                      rows={1}
                      className="glass-input min-h-[40px] max-h-32 resize-none bg-white/10 border-0 text-white shadow-none focus-visible:ring-1 focus-visible:ring-white/20 rounded-xl px-3"
                    />
                    <Button
                      size="icon"
                      onClick={() => handleSend()}
                      disabled={loading || !input.trim()}
                      className="h-10 w-10 shrink-0 bg-white/15 hover:bg-white/25 text-white border border-white/15"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-white/40 mt-1.5 px-1">
                    Enter to send · Shift+Enter for newline · +2 XP per reply
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============ Fullscreen overlay ============ */}
      {fullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex flex-col overflow-hidden"
            >
              {/* Video bg */}
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover z-0"
              >
                <source src={VIDEO_SRC} type="video/mp4" />
              </video>
              <div className="absolute inset-0 z-[1]" style={{ background: "rgba(0,0,0,0.65)" }} />
              <div
                className="absolute inset-0 z-[1] pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.5) 100%)",
                }}
              />

              {/* Header */}
              <div className="relative z-10 flex items-center justify-between px-5 h-14 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br text-lg",
                      activePersona.color
                    )}
                  >
                    {activePersona.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-sm leading-tight text-white">{activePersona.name}</p>
                    <p className="text-xs text-white/60">{activePersona.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:text-white hover:bg-white/10"
                    onClick={() => handleNewChat()}
                  >
                    <Plus className="h-4 w-4 mr-1" /> New chat
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:text-white hover:bg-white/10"
                    onClick={() => clearThread(activeThread?.id ?? "")}
                    disabled={!activeThread}
                  >
                    <Eraser className="h-4 w-4 mr-1" /> Clear
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                    onClick={() => setFullscreen(false)}
                  >
                    <Minimize2 className="h-4 w-4 mr-1" /> Exit
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="relative z-10 flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full ai-tutor-scroll">
                {activeThread?.messages.length === 0 || !activeThread ? (
                  <div className="h-full grid place-items-center">
                    <div className="text-center max-w-md">
                      <div
                        className={cn(
                          "mx-auto grid place-items-center h-16 w-16 rounded-2xl bg-gradient-to-br text-3xl mb-4",
                          activePersona.color
                        )}
                      >
                        {activePersona.avatar}
                      </div>
                      <h2
                        className="text-3xl text-white mb-1"
                        style={{ fontFamily: SERIF_FONT, letterSpacing: "-0.01em" }}
                      >
                        Hi! I&apos;m {activePersona.name}
                      </h2>
                      <p className="text-sm text-white/60 mb-5">{activePersona.description}</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {(QUICK_SUGGESTIONS[activePersonaId] ?? QUICK_SUGGESTIONS["dr-meera"]).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleSend(s)}
                            className="liquid-glass rounded-full px-3 py-1.5 text-sm text-white/80 hover:text-white transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {activeThread.messages.map((m) => (
                        <motion.div
                          key={m.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {m.role === "assistant" && (
                            <div
                              className={cn(
                                "grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br text-base shrink-0",
                                activePersona.color
                              )}
                            >
                              {activePersona.avatar}
                            </div>
                          )}
                          <div
                            className={cn(
                              "max-w-[75%] px-4 py-3 rounded-2xl border backdrop-blur-md",
                              m.role === "user"
                                ? "bg-white/15 text-white rounded-br-sm border-white/15"
                                : "bg-white/10 text-white/95 rounded-bl-sm border-white/10"
                            )}
                          >
                            {m.role === "assistant" ? (
                              <Markdown content={m.content} />
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                            )}
                            {m.role === "assistant" && (
                              <button
                                onClick={() => speak(m.content)}
                                className="mt-2 inline-flex items-center text-xs text-white/60 hover:text-white"
                              >
                                <Volume2 className="h-3 w-3 mr-1" /> Listen
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {loading && (
                      <div className="flex gap-3 justify-start">
                        <div
                          className={cn(
                            "grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br text-base",
                            activePersona.color
                          )}
                        >
                          {activePersona.avatar}
                        </div>
                        <div className="bg-white/10 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 backdrop-blur-md">
                          {[0, 0.15, 0.3].map((d, i) => (
                            <motion.span
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-white/70"
                              animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 0.8, repeat: Infinity, delay: d }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="relative z-10 border-t border-white/10 p-4 shrink-0">
                <div className="max-w-4xl mx-auto flex gap-2 items-end">
                  <button
                    onClick={onMicClick}
                    title="Voice input"
                    className={cn(
                      "h-11 w-11 shrink-0 grid place-items-center rounded-xl border border-white/15 text-white/70 hover:text-white hover:bg-white/10 transition-colors",
                      listening && "text-rose-400"
                    )}
                  >
                    {listening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={`Ask ${activePersona.name} anything...`}
                    rows={1}
                    className="glass-input flex-1 resize-none min-h-[44px] max-h-32 px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/25"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={loading || !input.trim()}
                    title="Send"
                    className="h-11 w-11 shrink-0 grid place-items-center rounded-xl bg-white/15 hover:bg-white/25 border border-white/15 text-white disabled:opacity-50 transition-colors"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-white/40 mt-1.5 text-center max-w-4xl mx-auto">
                  Enter to send · Shift+Enter for newline · +2 XP per reply
                </p>
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
