"use client";

import { selectTTSVoice, DEFAULT_TTS_VOICE_PREFERENCE, type TTSVoiceCandidate, type TTSVoicePreference } from "@/lib/v2/tts/score";

/**
 * Browser TTS controller (client-only). One shared speech pipeline for Study
 * Music promotions, Talk Reminders and LAM voice output so speech and music
 * can never accidentally overlap: `stop()` cancels synthesis; the shared
 * audio/ad state machine owns the conflict resolution.
 */

export interface SpeakTTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceURI?: string;
  preference?: TTSVoicePreference;
  /** Reduced spoken detail / privacy setting: speak only a short label. */
  privacyShortened?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

function synthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

export function ttsSupported(): boolean {
  return synthesis() !== null;
}

export function listTTSVoices(): TTSVoiceCandidate[] {
  const synth = synthesis();
  if (!synth) return [];
  return synth.getVoices().map((voice) => ({
    name: voice.name,
    lang: voice.lang,
    voiceURI: voice.voiceURI,
    default: voice.default,
  }));
}

/** Async voice loading with voiceschanged + a delayed refresh fallback. */
export function loadTTSVoices(onVoices: (voices: TTSVoiceCandidate[]) => void): () => void {
  const synth = synthesis();
  if (!synth) return () => undefined;
  const refresh = () => {
    const voices = listTTSVoices();
    if (voices.length) onVoices(voices);
  };
  refresh();
  synth.onvoiceschanged = refresh;
  const timer = window.setTimeout(refresh, 250);
  return () => {
    window.clearTimeout(timer);
    if (synth) synth.onvoiceschanged = null;
  };
}

export function stopTTS(): void {
  synthesis()?.cancel();
}

export function previewTTS(text: string, options: SpeakTTSOptions = {}): void {
  speakTTS(`Preview: ${text}`, options);
}

export function speakTTS(text: string, options: SpeakTTSOptions = {}): { started: boolean } {
  const synth = synthesis();
  if (!synth || !text.trim()) return { started: false };

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate ?? 1;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = options.volume ?? 1;

  const voices = listTTSVoices();
  const selected = selectTTSVoice(voices, options.preference ?? DEFAULT_TTS_VOICE_PREFERENCE, options.voiceURI);
  if (selected) {
    const match = synth.getVoices().find((voice) => voice.voiceURI === selected.voiceURI);
    if (match) utterance.voice = match;
  }

  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = (event) => {
    if (event.error !== "interrupted" && event.error !== "canceled") {
      options.onError?.(event.error || "speech-error");
    } else {
      options.onEnd?.();
    }
  };

  synth.cancel();
  synth.speak(utterance);
  return { started: true };
}
