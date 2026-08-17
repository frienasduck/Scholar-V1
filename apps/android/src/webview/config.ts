export const SCHOLAR_WEB_URL = "https://scholar-v1.vercel.app";

const TRUSTED_ORIGIN = new URL(SCHOLAR_WEB_URL).origin;

export function isTrustedScholarUrl(value: string): boolean {
  try {
    return new URL(value).origin === TRUSTED_ORIGIN;
  } catch {
    return false;
  }
}

export function isAllowedWebViewUrl(value: string): boolean {
  return value === "about:blank" || isTrustedScholarUrl(value);
}

