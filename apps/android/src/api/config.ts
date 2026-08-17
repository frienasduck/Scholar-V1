/**
 * Centralized Scholar backend URL configuration.
 *
 * The primary source is the Expo public environment variable
 * `EXPO_PUBLIC_SCHOLAR_API_URL` (inlined at build time from apps/android/.env).
 * A runtime override can be set on-device (stored in AsyncStorage) for
 * testing against a local dev server without rebuilding.
 *
 * No component should ever hardcode localhost or a production URL.
 */
import { getApiUrlOverride, setApiUrlOverride as persistOverride } from "@/storage/app-storage";

const DEFAULT_API_URL = (process.env.EXPO_PUBLIC_SCHOLAR_API_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

/** URL baked in at build time via .env (EXPO_PUBLIC_SCHOLAR_API_URL). */
export function configuredApiUrl(): string {
  return DEFAULT_API_URL;
}

export function hasConfiguredApiUrl(): boolean {
  return DEFAULT_API_URL.length > 0;
}

/** Effective API base URL (build-time env or runtime override). */
export async function getApiUrl(): Promise<string> {
  if (hasConfiguredApiUrl()) return DEFAULT_API_URL;
  const override = await getApiUrlOverride();
  return (override ?? "").trim().replace(/\/+$/, "");
}

/** Persist a runtime override (e.g. from the Profile screen). */
export async function setRuntimeApiUrl(url: string): Promise<void> {
  await persistOverride(url);
}

/** Origin (scheme + host) of a URL — used for cookie store scoping. */
export function apiOriginOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/** Host used for cookie domain matching (no scheme, no port). */
export function apiHostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//, "").split(":")[0];
  }
}
