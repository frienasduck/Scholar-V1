export class GroupStudyClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export type CreatedStudyRoom = {
  ok: true;
  roomId: string;
  name: string;
  code: string;
};
export function formatRoomCode(code: string) {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.startsWith("SCH") ? `SCH-${normalized.slice(3)}` : code;
}
export async function copyRoomCode(code: string) {
  if (!navigator.clipboard?.writeText)
    throw new Error(
      "Copy unavailable. Select the room code and copy it manually.",
    );
  await navigator.clipboard.writeText(formatRoomCode(code));
}

export async function groupRequest<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  if (init.signal?.aborted) controller.abort();
  try {
    const response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        ...(init.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...init.headers,
      },
    });
    const value = await response.json().catch(() => null);
    if (!response.ok) {
      const fallback =
        response.status === 401
          ? "Your room session has expired. Join again to continue."
          : response.status === 403
            ? "You don't have permission to do that in this room."
            : response.status === 429
              ? "Please wait a moment before trying again."
              : "Scholar couldn't complete that request. Please try again.";
      throw new GroupStudyClientError(
        typeof value?.message === "string" ? value.message : fallback,
        response.status,
        value?.code ?? value?.error,
      );
    }
    if (!value)
      throw new GroupStudyClientError(
        "Scholar returned an incomplete response. Please try again.",
        502,
      );
    return value as T;
  } catch (error) {
    if (error instanceof GroupStudyClientError) throw error;
    if (controller.signal.aborted)
      throw new GroupStudyClientError(
        "The request took too long. Please try again.",
        408,
      );
    throw new GroupStudyClientError(
      "Connection lost. Check your connection and try again.",
      0,
    );
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
