// Client-side AI helpers. Provider secrets and SDK calls stay behind /api/ai.

import { useStore } from "@/lib/store";
import { requestAIData, requestAIStream, requestAIText } from "@/lib/ai/client";
import type { AIMode } from "@/lib/ai/schemas";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  subject: string;
  avatar: string;
  color: string;
  accent: string;
  tagline: string;
  description: string;
}

export const TEACHER_PERSONAS_CLASS9: Persona[] = [
  { id: "dr-meera", name: "Dr. Meera", role: "Science Tutor", subject: "Science", avatar: "🔬", color: "from-emerald-500 to-teal-500", accent: "#10b981", tagline: "Physics, Chemistry & Biology", description: "Warm, patient, brilliant. Explains with real-world analogies and clear step-by-step reasoning." },
  { id: "mr-raj", name: "Mr. Raj", role: "Maths Tutor", subject: "Mathematics", avatar: "📐", color: "from-indigo-500 to-violet-500", accent: "#6366f1", tagline: "Numbers, logic & proofs", description: "Sharp, methodical, encouraging. Breaks every problem into clean steps and explains the why." },
  { id: "sara", name: "Sara", role: "English Tutor", subject: "English", avatar: "📚", color: "from-rose-500 to-pink-500", accent: "#f43f5e", tagline: "Grammar, writing & literature", description: "Kind, literary-minded. Helps with Beehive & Moments, grammar, and your own writing voice." },
  { id: "arjun", name: "Arjun", role: "Social Science Tutor", subject: "Social Science", avatar: "🌍", color: "from-amber-500 to-orange-500", accent: "#f59e0b", tagline: "History, Geo, Civics & Eco", description: "Engaging storyteller. Makes history, geography, civics & economics feel alive and relevant." },
  { id: "slayra", name: "slayra", role: "Bestie Study Buddy", subject: "Everything", avatar: "💅", color: "from-fuchsia-500 to-purple-500", accent: "#d946ef", tagline: "Gen Z bestie who knows CBSE", description: "Casual, upbeat, and accurate across the active CBSE syllabus." },
];

export const TEACHER_PERSONAS_CLASS11: Persona[] = [
  { id: "physics-11", name: "Prof. Rao", role: "Physics Tutor", subject: "Physics", avatar: "⚛️", color: "from-blue-500 to-cyan-500", accent: "#3b82f6", tagline: "Mechanics, Thermodynamics & Waves", description: "Rigorous and derivation-focused, with clear numerical solutions." },
  { id: "chemistry-11", name: "Dr. Kaur", role: "Chemistry Tutor", subject: "Chemistry", avatar: "🧪", color: "from-emerald-500 to-green-500", accent: "#10b981", tagline: "Physical, Organic & Inorganic", description: "Systematic explanations of reactions, structures, and numericals." },
  { id: "mr-raj", name: "Mr. Raj", role: "Maths Tutor", subject: "Mathematics", avatar: "📐", color: "from-indigo-500 to-violet-500", accent: "#6366f1", tagline: "Algebra, Trigonometry & Calculus", description: "Methodical solutions with the intuition behind each formula." },
  { id: "cs-11", name: "Ms. Priya", role: "CS Tutor", subject: "Computer Science", avatar: "💻", color: "from-purple-500 to-fuchsia-500", accent: "#a855f7", tagline: "Python & Programming Concepts", description: "Clean code examples and practical algorithm explanations." },
  { id: "sara", name: "Sara", role: "English Tutor", subject: "English", avatar: "📚", color: "from-rose-500 to-pink-500", accent: "#f43f5e", tagline: "Hornbill, Snapshots & Writing", description: "Precise, supportive help with prose, poetry, and writing." },
];

export const TEACHER_PERSONAS = TEACHER_PERSONAS_CLASS9;

export function getPersona(id: string): Persona | undefined {
  return [...TEACHER_PERSONAS_CLASS9, ...TEACHER_PERSONAS_CLASS11].find((persona) => persona.id === id);
}

function getClassContext(): { scholarClass: 9 | 11; jeeMode: boolean } {
  try {
    const state = useStore.getState();
    return {
      scholarClass: state.user.scholarClass ?? 9,
      jeeMode: state.user.jeeMode ?? false,
    };
  } catch {
    return { scholarClass: 9, jeeMode: false };
  }
}

const DEFAULT_TIMEOUT_MS = 240_000;

function makeAbort(timeoutMs = DEFAULT_TIMEOUT_MS, externalSignal?: AbortSignal): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromExternal = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  return {
    controller,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    },
  };
}

type AIOptions = {
  temperature?: number;
  history?: ChatMessage[];
  timeoutMs?: number;
  mode?: AIMode;
  signal?: AbortSignal;
  feature?: "aisig" | "homework_scanner";
  usage?: "quiz_generation" | "slideshow_generation";
};

export async function askAI(
  message: string,
  persona = "default",
  opts: AIOptions = {},
): Promise<string> {
  const messages = [...(opts.history ?? []), { role: "user" as const, content: message }];
  const abort = makeAbort(opts.timeoutMs, opts.signal);
  try {
    return await requestAIText({
      messages,
      persona,
      mode: opts.mode ?? "chat",
      temperature: opts.temperature ?? 0.6,
      feature: opts.feature,
      usage: opts.usage,
      ...getClassContext(),
    }, abort.controller.signal);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI request timed out. Please try again.");
    }
    throw error instanceof Error ? error : new Error("Network error reaching the AI service.");
  } finally {
    abort.cleanup();
  }
}

export async function askAIJSON<T = unknown>(
  message: string,
  persona = "default",
  opts: AIOptions = {},
): Promise<T | null> {
  const messages = [...(opts.history ?? []), { role: "user" as const, content: message }];
  const abort = makeAbort(opts.timeoutMs, opts.signal);
  try {
    return await requestAIData<T>({
      messages,
      persona,
      mode: opts.mode ?? "json",
      temperature: opts.temperature ?? 0.4,
      feature: opts.feature,
      usage: opts.usage,
      ...getClassContext(),
    }, abort.controller.signal);
  } catch {
    return null;
  } finally {
    abort.cleanup();
  }
}

export async function chatAI(
  userMessage: string,
  persona: string,
  history: ChatMessage[],
): Promise<string> {
  const isFriend = persona.startsWith("friend-");
  const isCommunity = persona.startsWith("classmate-");
  return askAI(userMessage, persona, {
    history,
    mode: isFriend ? "friend-chat" : isCommunity ? "community-persona" : "chat",
  });
}

export async function askAIStream(
  message: string,
  persona = "default",
  opts: AIOptions & { onDelta?: (chunk: string, fullSoFar: string) => void } = {},
): Promise<string> {
  const messages = [...(opts.history ?? []), { role: "user" as const, content: message }];
  const abort = makeAbort(opts.timeoutMs, opts.signal);
  try {
    return await requestAIStream({
      messages,
      persona,
      mode: opts.mode ?? "stream",
      temperature: opts.temperature ?? 0.6,
      feature: opts.feature,
      usage: opts.usage,
      ...getClassContext(),
    }, abort.controller.signal, opts.onDelta);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI request timed out. Please try again.");
    }
    throw error instanceof Error ? error : new Error("Network error reaching the AI service.");
  } finally {
    abort.cleanup();
  }
}
