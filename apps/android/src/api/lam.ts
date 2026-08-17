/**
 * LAM API client — streams answers from POST /api/lam/chat (server-sent
 * events), mirroring the web implementation in src/components/lam-widget.tsx.
 *
 * Included in Phase 1 as API architecture; the LAM chat screen that consumes
 * it ships in Phase 2.
 */
import { ApiError, apiErrorFrom, request } from "./client";
import type { LamChatRequest, LamStreamEvent } from "@/types/lam";

export interface LamChatOptions {
  signal?: AbortSignal;
  onEvent?: (event: LamStreamEvent) => void;
}

const activeLamControllers = new Set<AbortController>();

/** Cancels in-flight account-bound LAM work during logout/session expiry. */
export function cancelAllLamRequests(): void {
  activeLamControllers.forEach((controller) => controller.abort());
  activeLamControllers.clear();
}

/**
 * Send a LAM chat request and parse the SSE stream. Resolves with the full
 * assistant text. Errors are surfaced as `{ type: "error" }` events and, for
 * non-stream failures, as thrown ApiErrors.
 */
export async function lamChat(payload: LamChatRequest, options: LamChatOptions = {}): Promise<string> {
  const controller = new AbortController();
  activeLamControllers.add(controller);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  let response: Response;
  try {
    response = await request("/api/lam/chat", {
      method: "POST",
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    activeLamControllers.delete(controller);
    options.signal?.removeEventListener("abort", abort);
    throw error;
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    activeLamControllers.delete(controller);
    throw apiErrorFrom(response, body);
  }

  if (!response.body) {
    activeLamControllers.delete(controller);
    throw new ApiError("LAM returned an empty response.", 502, "EMPTY_STREAM");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;

          let event: LamStreamEvent;
          try {
            event = JSON.parse(raw) as LamStreamEvent;
          } catch {
            throw new Error("LAM returned malformed data.");
          }

          options.onEvent?.(event);

          if (event.type === "text-delta") {
            full += event.value;
          } else if (event.type === "error") {
            throw new Error(event.message ?? "LAM could not answer.");
          }
        }
      }
    }
    return full;
  } finally {
    reader.releaseLock();
    activeLamControllers.delete(controller);
    options.signal?.removeEventListener("abort", abort);
  }
}
