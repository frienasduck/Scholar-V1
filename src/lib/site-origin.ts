/** Public canonical origin. Never derive OAuth/recovery destinations from Host. */
export const SCHOLAR_PRODUCTION_ORIGIN = "https://scholarofficial.vercel.app";

/** Server metadata only; staging uses a pinned origin rather than request Host. */
export function scholarCanonicalOrigin() {
  return process.env.SCHOLAR_ENVIRONMENT === "staging"
    ? "https://scholar-staging.vercel.app"
    : SCHOLAR_PRODUCTION_ORIGIN;
}
