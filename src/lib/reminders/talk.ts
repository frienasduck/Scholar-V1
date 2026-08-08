// ============================================================================
// Smart Reminders 2.0 — Talk Reminder (speech synthesis)
// Voice selection prefers Microsoft female en-GB, then female en-GB,
// then any en-GB, then the system default. Handles async voice loading.
// ============================================================================

import type { SmartReminder } from "./types";

export interface TalkVoice {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
  uri?: string;
  isFemale?: boolean;
}

const FEMALE_HINTS = ["female", "woman", "girl", "zira", "hazel", "susan", "libby", "sonia", "kate", "moira", "sonia", "ava", "emma", "samantha", "victoria", "fiona", "tessa", "serena", "harriet"];

export function isFemaleVoice(voice: Pick<SpeechSynthesisVoice, "name">): boolean {
  const name = voice.name.toLowerCase();
  return FEMALE_HINTS.some((hint) => name.includes(hint));
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Pick the best voice for Talk Reminders.
 * Priority: Microsoft female en-GB → any female en-GB → any en-GB → system default.
 * A stored preferred URI wins when it still exists.
 */
export function selectTalkVoice(preferredURI?: string, preferredLanguage?: string): SpeechSynthesisVoice | null {
  const voices = listVoices();
  if (!voices.length) return null;

  if (preferredURI) {
    const stored = voices.find((voice) => voice.voiceURI === preferredURI);
    if (stored) return stored;
  }

  const enGB = voices.filter((voice) => voice.lang?.toLowerCase().replace("_", "-").startsWith("en-gb"));
  const microsoftFemaleGB = enGB.find((voice) => voice.name.toLowerCase().includes("microsoft") && isFemaleVoice(voice));
  if (microsoftFemaleGB) return microsoftFemaleGB;

  const femaleGB = enGB.find((voice) => isFemaleVoice(voice));
  if (femaleGB) return femaleGB;

  if (enGB.length) return enGB[0];

  if (preferredLanguage) {
    const preferred = voices.find((voice) => voice.lang?.toLowerCase().replace("_", "-").startsWith(preferredLanguage.toLowerCase()));
    if (preferred) return preferred;
  }

  return voices.find((voice) => voice.default) ?? voices[0] ?? null;
}

export function describeVoice(voice: SpeechSynthesisVoice | null): string {
  if (!voice) return "System default voice";
  return `${voice.name} (${voice.lang})`;
}

// ============================================================================
// Spoken content
// ============================================================================

export function spokenTextFor(reminder: Pick<SmartReminder, "title" | "dueAt" | "description" | "spokenContentMode" | "customSpokenMessage" | "speakDetails">): string {
  if (reminder.spokenContentMode === "custom" && reminder.customSpokenMessage?.trim()) {
    return reminder.customSpokenMessage.trim();
  }
  const due = new Date(reminder.dueAt);
  const timeLabel = due.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  switch (reminder.spokenContentMode) {
    case "title":
      return `Reminder. ${reminder.title}.`;
    case "title-time":
      return `Reminder. ${reminder.title}, at ${timeLabel}.`;
    case "title-description":
      return `Reminder. ${reminder.title}. ${reminder.description ?? ""}`.trim();
    default:
      return `Reminder. ${reminder.title}.`;
  }
}

// ============================================================================
// Speech controller — a single active utterance registry so we can stop
// Talk Reminders (and repeated announcements) on demand.
// ============================================================================

interface ActiveSpeech {
  id: string;
  active: boolean;
  timer?: number;
  generation: number;
}

const activeSpeech: ActiveSpeech = { id: "", active: false, generation: 0 };

export function stopTalkSpeech(): void {
  activeSpeech.generation += 1;
  activeSpeech.active = false;
  if (activeSpeech.timer !== undefined) window.clearTimeout(activeSpeech.timer);
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function isTalking(): boolean {
  return activeSpeech.active;
}

export interface SpeakReminderOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceURI?: string;
  voiceLanguage?: string;
  repeatCount?: number;
  repeatDelayMs?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
  /** When false, speech only proceeds while the document is visible. */
  requireVisible?: boolean;
}

export function speakReminder(text: string, options: SpeakReminderOptions = {}): { started: boolean } {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return { started: false };
  if (options.requireVisible && document.visibilityState !== "visible") return { started: false };

  const rate = options.rate ?? 1;
  const pitch = options.pitch ?? 1;
  const volume = options.volume ?? 1;
  const repeatCount = Math.max(1, Math.min(5, options.repeatCount ?? 1));
  const repeatDelayMs = Math.max(500, options.repeatDelayMs ?? 2_000);

  const generation = ++activeSpeech.generation;
  activeSpeech.active = true;

  const speakOnce = (attempt: number) => {
    if (generation !== activeSpeech.generation || !activeSpeech.active) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    const voice = selectTalkVoice(options.voiceURI, options.voiceLanguage);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => {
      if (generation !== activeSpeech.generation || !activeSpeech.active) return;
      if (attempt < repeatCount) {
        activeSpeech.timer = window.setTimeout(() => speakOnce(attempt + 1), repeatDelayMs);
      } else {
        activeSpeech.active = false;
        options.onEnd?.();
      }
    };
    utterance.onerror = () => {
      if (generation !== activeSpeech.generation) return;
      activeSpeech.active = false;
      options.onError?.();
    };
    window.speechSynthesis.speak(utterance);
  };

  speakOnce(1);
  return { started: true };
}

/** Speak a reminder with its Talk Reminder + privacy settings applied. */
export function speakSmartReminder(
  reminder: Pick<SmartReminder, "title" | "dueAt" | "description" | "spokenContentMode" | "customSpokenMessage" | "speakDetails" | "speechRate" | "speechPitch" | "speechVolume" | "voiceURI" | "voiceLanguage">,
  options: { repeatCount?: number; repeatDelayMs?: number; onStart?: () => void; onEnd?: () => void; onError?: () => void; requireVisible?: boolean } = {},
): { started: boolean } {
  const privacyEnabled = reminder.speakDetails;
  const text = privacyEnabled
    ? spokenTextFor(reminder)
    : "You have a Scholar reminder.";
  return speakReminder(text, {
    rate: reminder.speechRate,
    pitch: reminder.speechPitch,
    volume: reminder.speechVolume,
    voiceURI: reminder.voiceURI,
    voiceLanguage: reminder.voiceLanguage,
    repeatCount: options.repeatCount,
    repeatDelayMs: options.repeatDelayMs,
    onStart: options.onStart,
    onEnd: options.onEnd,
    onError: options.onError,
    requireVisible: options.requireVisible,
  });
}
