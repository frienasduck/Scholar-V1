import "server-only";
import { SCHOLAR_PRODUCTION_ORIGIN } from "@/lib/site-origin";

/** Never derive recovery links or OAuth callbacks from an untrusted Host header. */
export function authBaseUrl() {
  const url = new URL(process.env.AUTH_BASE_URL?.trim() || (process.env.NODE_ENV === "production" ? SCHOLAR_PRODUCTION_ORIGIN : "http://localhost:3000"));
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && local && url.protocol === "http:"))) {
    throw new Error("Invalid authentication origin configuration");
  }
  return url.origin;
}
export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}
export function authEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
}
export function publicAuthConfig() {
  return { registrationEnabled: true, googleConfigured: googleConfigured(), passwordResetConfigured: authEmailConfigured(), emailVerificationConfigured: authEmailConfigured() };
}
