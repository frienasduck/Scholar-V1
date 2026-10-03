/** Google authorization must not be started inside an Android embedded WebView. */
export function requiresExternalDriveBrowser(userAgent: string) {
  return /Android/i.test(userAgent) && /\bwv\b/i.test(userAgent);
}
