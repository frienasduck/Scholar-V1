import type { AIMode } from "@/lib/ai/schemas";

export interface AIClientMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIClientRequest {
  messages: AIClientMessage[];
  persona?: string;
  mode?: AIMode;
  temperature?: number;
  scholarClass: 9 | 11;
  jeeMode: boolean;
}

type ErrorEnvelope = { ok?: false; error?: { message?: string } | string };

async function readJSON(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    throw new Error("The AI service returned an unsupported response format.");
  }
  const raw = await response.text();
  if (!raw.trim()) throw new Error("The AI service returned an empty response.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("The AI service returned malformed data. Please retry.");
  }
}

function errorMessage(value: unknown, fallback: string): string {
  const envelope = value as ErrorEnvelope;
  if (typeof envelope?.error === "string") return envelope.error;
  if (envelope?.error && typeof envelope.error === "object" && typeof envelope.error.message === "string") {
    return envelope.error.message;
  }
  return fallback;
}

export async function requestAIText(request: AIClientRequest, signal: AbortSignal): Promise<string> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, mode: request.mode ?? "chat" }),
    signal,
  });
  const value = await readJSON(response) as { ok?: boolean; text?: unknown };
  if (!response.ok || value.ok !== true) throw new Error(errorMessage(value, `AI request failed (HTTP ${response.status}).`));
  if (typeof value.text !== "string" || !value.text.trim()) throw new Error("The AI service returned no text.");
  return value.text;
}

export async function requestAIData<T>(request: AIClientRequest, signal: AbortSignal): Promise<T> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, mode: request.mode ?? "json" }),
    signal,
  });
  const value = await readJSON(response) as { ok?: boolean; data?: unknown };
  if (!response.ok || value.ok !== true) throw new Error(errorMessage(value, `AI request failed (HTTP ${response.status}).`));
  if (!("data" in value)) throw new Error("The AI service returned no structured data.");
  return value.data as T;
}

export async function requestAIStream(
  request: AIClientRequest,
  signal: AbortSignal,
  onDelta?: (chunk: string, full: string) => void,
): Promise<string> {
  const response = await fetch("/api/ai?stream=1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, mode: request.mode ?? "stream" }),
    signal,
  });
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok || !response.body) {
    const value = await readJSON(response).catch(() => null);
    throw new Error(errorMessage(value, `AI stream failed (HTTP ${response.status}).`));
  }
  if (!contentType.includes("text/event-stream")) {
    throw new Error("The AI service returned an unsupported stream format.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          let event: { delta?: unknown; done?: unknown; error?: { message?: string } | string };
          try {
            event = JSON.parse(raw);
          } catch {
            throw new Error("The AI stream returned malformed data.");
          }
          if (typeof event.delta === "string") {
            full += event.delta;
            onDelta?.(event.delta, full);
          }
          if (event.error) throw new Error(errorMessage({ error: event.error }, "AI streaming failed."));
          if (event.done === true) return full;
        }
      }
    }
    return full;
  } finally {
    reader.releaseLock();
  }
}
