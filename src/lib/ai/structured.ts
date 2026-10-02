import "server-only";
import { generateScholarGroqJSON, parseJSONObject } from "./scholar-groq";
import { getUserAISettings } from "./user-provider";
import { streamLiveTutorText } from "@/lib/live-tutor/providers";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
/** The existing Scholar provider policy, shared by Exam Ready and LAMTube. */
export async function completeJSON(userId: string, prompt: string, signal: AbortSignal) {
  const custom = await getUserAISettings(userId), access = await resolveUserEntitlements(userId);
  if (custom?.scopes.includes("ai-tutor") || access.entitlementsLoaded && ["PLUS", "DEVELOPER", "UNLOCKED"].includes(access.plan)) {
    let text = "";
    await streamLiveTutorText({ provider: custom?.scopes.includes("ai-tutor") ? custom.provider : "auto", credential: custom?.scopes.includes("ai-tutor") ? custom : undefined, messages: [{ role: "system", content: prompt }], temperature: .35, maxTokens: 5000, signal, onDelta: delta => { text += delta; if (text.length > 60000) throw new Error("Structured AI output exceeded its limit."); } });
    return parseJSONObject(text);
  }
  return generateScholarGroqJSON({ messages: [{ role: "system", content: prompt }], temperature: .35, maxTokens: 5000, signal });
}
