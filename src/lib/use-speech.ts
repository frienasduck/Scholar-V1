"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ============================================================================
// Speech synthesis hook — wraps the browser's speechSynthesis API
// ============================================================================

export interface VoiceInfo {
  uri: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

export interface SpeakOpts {
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
  onStart?: () => void;
  onBoundary?: (charIndex: number, charLength: number) => void;
  onError?: (err: string) => void;
}

export function useSpeechSynthesis() {
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load voices (async in some browsers)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length) {
        setVoices(
          v.map((voice) => ({
            uri: voice.voiceURI,
            name: voice.name,
            lang: voice.lang,
            localService: voice.localService,
            default: voice.default,
          }))
        );
      }
    };

    loadVoices();
    // voiceschanged event is the standard way to get voices in Chrome
    window.speechSynthesis.onvoiceschanged = loadVoices;
    // Some browsers need a delay
    const t = setTimeout(loadVoices, 250);
    return () => {
      clearTimeout(t);
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch { /* ignore */ }
    setSpeaking(false);
    setPaused(false);
    utteranceRef.current = null;
  }, [supported]);

  const speak = useCallback((text: string, opts: SpeakOpts = {}) => {
    if (!supported || !text.trim()) {
      opts.onEnd?.();
      return;
    }
    // Cancel any in-flight speech
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }

    const u = new SpeechSynthesisUtterance(text);
    if (opts.voiceURI) {
      const v = window.speechSynthesis.getVoices().find((x) => x.voiceURI === opts.voiceURI);
      if (v) u.voice = v;
    }
    u.rate = opts.rate ?? 1.0;
    u.pitch = opts.pitch ?? 1.0;
    u.volume = opts.volume ?? 1.0;

    u.onstart = () => {
      setSpeaking(true);
      setPaused(false);
      opts.onStart?.();
    };
    u.onend = () => {
      setSpeaking(false);
      setPaused(false);
      utteranceRef.current = null;
      opts.onEnd?.();
    };
    u.onerror = (e) => {
      setSpeaking(false);
      setPaused(false);
      utteranceRef.current = null;
      // "interrupted" and "canceled" are normal during skip/pause — don't surface as errors
      if (e.error !== "interrupted" && e.error !== "canceled") {
        opts.onError?.(e.error || "speech-error");
      } else {
        opts.onEnd?.();
      }
    };
    u.onboundary = (e) => {
      if (e.name === "word" || !e.name) {
        opts.onBoundary?.(e.charIndex, e.charLength || 0);
      }
    };
    u.onpause = () => setPaused(true);
    u.onresume = () => setPaused(false);

    utteranceRef.current = u;
    try {
      window.speechSynthesis.speak(u);
    } catch {
      opts.onError?.("speak-failed");
    }
  }, [supported]);

  const pause = useCallback(() => {
    if (!supported) return;
    try { window.speechSynthesis.pause(); setPaused(true); } catch { /* ignore */ }
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    try { window.speechSynthesis.resume(); setPaused(false); } catch { /* ignore */ }
  }, [supported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
      }
    };
  }, []);

  // Pause speech when tab loses focus (prevents audio after user leaves)
  useEffect(() => {
    if (!supported) return;
    const onVis = () => {
      if (document.hidden && speaking && !paused) {
        try { window.speechSynthesis.pause(); setPaused(true); } catch { /* ignore */ }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [supported, speaking, paused]);

  return {
    supported,
    voices,
    speaking,
    paused,
    speak,
    cancel,
    pause,
    resume,
  };
}
