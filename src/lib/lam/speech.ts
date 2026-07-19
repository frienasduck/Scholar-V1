"use client";

export function normalizeWakePhrase(value: string) {
  return value.toLowerCase().replace(/[.,!?\"'\-]/g, "").replace(/\s+/g, " ").trim();
}

export function containsWakePhrase(value: string) {
  const text = normalizeWakePhrase(value);
  return /^(hey|hi|okay|ok|wake up) lam\b/.test(text) || /^lam (are you there|wake up)\b/.test(text);
}

export function isSleepPhrase(value: string) {
  const text = normalizeWakePhrase(value);
  return ["go to sleep", "thats all", "stop listening", "thanks lam", "close lam", "end conversation"].some((phrase) => text.includes(phrase));
}

export function cleanSpeechText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " Code example omitted. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\$+([^$]+)\$+/g, "$1")
    .replace(/\^2\b/g, " squared")
    .replace(/\\sqrt\{([^}]+)\}/g, "the square root of $1")
    .replace(/\\cup/g, " union ")
    .replace(/\\cap/g, " intersection ")
    .replace(/[*_#>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
