/**
 * Authentication API — connects to Scholar's existing backend
 * (POST /api/auth/login|register|logout, GET /api/auth/session).
 *
 * Scholar auth is cookie-based (`scholar_session`). On login we capture the
 * Set-Cookie value (header first, native cookie store as fallback), persist
 * the raw token in secure storage, and rely on the native cookie store to
 * send it on subsequent requests. Passwords are never stored.
 */
import CookieManager from "react-native-cookies";
import { apiFetch, apiErrorFrom, request } from "./client";
import { apiOriginOf, getApiUrl } from "./config";
import { clearStoredSessionToken, saveSessionToken } from "@/storage/secure";
import type {
  ApiErrorBody,
  AuthUser,
  LoginResponse,
  RegisterResponse,
  SessionResponse,
} from "@/types/api";

function parseTokenFromSetCookie(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/(?:^|;\s*)scholar_session=([^;]+)/);
  return match?.[1] ?? null;
}

/** Capture the session token from a login/register response and persist it. */
async function persistSessionToken(response: Response, origin: string): Promise<string | null> {
  let token = parseTokenFromSetCookie(response.headers.get("set-cookie"));
  if (!token) {
    try {
      const cookies = await CookieManager.get(origin);
      token = cookies?.scholar_session?.value ?? null;
    } catch {
      token = null;
    }
  }
  if (token) await saveSessionToken(token);
  return token;
}

function readUser(body: unknown): AuthUser {
  const value = body as { user?: AuthUser } | null;
  if (!value?.user) throw new Error("Scholar returned an unexpected response.");
  return value.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const body = (await response.json().catch(() => null)) as (LoginResponse & ApiErrorBody) | null;
  if (!response.ok) throw apiErrorFrom(response, body);
  const origin = apiOriginOf(await getApiUrl());
  await persistSessionToken(response, origin);
  return readUser(body);
}

export async function register(name: string, email: string, password: string): Promise<AuthUser> {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
  });
  const body = (await response.json().catch(() => null)) as (RegisterResponse & ApiErrorBody) | null;
  if (!response.ok) throw apiErrorFrom(response, body);
  const origin = apiOriginOf(await getApiUrl());
  await persistSessionToken(response, origin);
  return readUser(body);
}

/** Revoke the server session, clear the cookie store and secure storage. */
export async function logout(): Promise<void> {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } catch {
    // Best-effort: the local session must still be cleared.
  }
  try {
    await CookieManager.clearAll();
  } catch {
    // Ignore — SecureStore cleanup below is authoritative.
  }
  await clearStoredSessionToken();
}

/** Clear Android's local authentication material without making a request. */
export async function clearLocalSession(): Promise<void> {
  try { await CookieManager.clearAll(); } catch { /* SecureStore remains authoritative. */ }
  await clearStoredSessionToken();
}

/** Fetch the current session (authenticated:false when signed out). */
export function getSession(): Promise<SessionResponse> {
  return apiFetch<SessionResponse>("/api/auth/session");
}
