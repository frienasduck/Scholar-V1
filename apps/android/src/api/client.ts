/**
 * Centralized Scholar API client.
 *
 * Scholar's backend authenticates via the `scholar_session` httpOnly cookie
 * (src/lib/auth/session.ts). React Native's fetch does not manage a cookie
 * jar, so this client:
 *
 *   1. Restores the stored token into the native cookie store
 *      (react-native-cookies) so OkHttp sends `Cookie: scholar_session=…`
 *      automatically on every request.
 *   2. Normalizes errors into a typed ApiError.
 *   3. Emits a `session-expired` event on HTTP 401 so the auth layer can
 *      sign the user out.
 *
 * All API calls in the app go through this module — no scattered fetch calls.
 */
import CookieManager from "react-native-cookies";
import { apiHostOf, apiOriginOf, getApiUrl } from "./config";
import { getStoredSessionToken } from "@/storage/secure";
import type { ApiErrorBody } from "@/types/api";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** Subscribe to session-expiry events (used by the auth provider). */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) listener();
}

// ---------------------------------------------------------------------------
// Cookie store
// ---------------------------------------------------------------------------

let cookieRestorePromise: Promise<void> | null = null;

/**
 * Push the persisted session token into the native cookie store so OkHttp
 * sends it automatically. Runs once per app lifetime.
 */
export function restoreCookieFromSecureStore(): Promise<void> {
  if (!cookieRestorePromise) {
    cookieRestorePromise = (async () => {
      const token = await getStoredSessionToken();
      if (!token) return;
      const url = await getApiUrl();
      if (!url) return;
      try {
        await CookieManager.set({
          name: "scholar_session",
          value: token,
          domain: apiHostOf(url),
          path: "/",
        });
      } catch {
        // Non-fatal: requests will simply go unauthenticated.
      }
    })();
  }
  return cookieRestorePromise;
}

/** Reset the restore latch (used after login/logout). */
export function resetCookieRestore(): void {
  cookieRestorePromise = null;
}

// ---------------------------------------------------------------------------
// Core request helpers
// ---------------------------------------------------------------------------

/** Low-level request: builds the URL, attaches cookies, returns the Response. */
export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const base = await getApiUrl();
  if (!base) {
    throw new ApiError(
      "Scholar server URL is not configured. Set EXPO_PUBLIC_SCHOLAR_API_URL in apps/android/.env and rebuild.",
      0,
      "CONFIG_MISSING",
    );
  }

  await restoreCookieFromSecureStore();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);
  if (init.body) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      "Cannot reach Scholar. Check the server URL and your internet connection.",
      0,
      "NETWORK_ERROR",
    );
  }
  if (response.status === 401) notifySessionExpired();
  return response;
}

export function apiErrorFrom(response: Response, body: unknown): ApiError {
  const envelope = body as ApiErrorBody | null;
  const message =
    typeof envelope?.error === "string"
      ? envelope.error
      : envelope?.message ?? `Request failed (HTTP ${response.status}).`;
  return new ApiError(message, response.status, typeof envelope?.error === "string" ? envelope.error : undefined);
}

/** Typed JSON request with normalized errors. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await request(path, init);
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) throw apiErrorFrom(response, body);
  return body as T;
}
