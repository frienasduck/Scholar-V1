/** Fail-closed staging boundaries. Never return/log credentials or raw URLs. */
export const PRODUCTION_PROJECT_ID = "prj_iqaYcEZ8dM5exaqw3F7XtnyiY2sI";
export const PRODUCTION_DATABASE_RESOURCE_ID = "store_ODPDj9wEwSpUaJMP";
export const STAGING_PROJECT_ID = "prj_qEKBWcZ7hIglNnAzTq5eEDCrxEzI";
export const STAGING_DATABASE_RESOURCE_ID = "store_TFiUnWEoUMyWPdh2";
export const STAGING_NEON_PROJECT_ID = "fancy-block-60401397";
// Public endpoint metadata, not a connection string or credential.
export const STAGING_DATABASE_HOST = "ep-polished-paper-b3qzxsg2.c-4.ap-southeast-1.aws.neon.tech";
export const STAGING_ORIGIN = "https://scholar-staging.vercel.app";
export type EnvironmentValues = Readonly<Record<string, string | undefined>>;
export class StagingBoundaryError extends Error {
  constructor(public code: string) { super(`Staging isolation check failed: ${code}. No database mutation is authorized.`); }
}
function reject(code: string): never { throw new StagingBoundaryError(code); }
export function stagingRequested(env: EnvironmentValues) {
  return env.SCHOLAR_ENVIRONMENT === "staging" || env.VERCEL_GIT_COMMIT_REF === "sepb-rc";
}
export function normalizedDatabaseHost(host: string) {
  return host.toLowerCase().replace(/-pooler(?=\.)/, "");
}
function databaseUrl(value: string | undefined, name: string) {
  let url: URL;
  try { url = new URL(value?.trim() || ""); } catch { return reject(`${name}_MISSING_OR_INVALID`); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.username || !url.password || url.pathname === "/") reject(`${name}_INVALID_DATABASE`);
  if (!["require", "verify-full"].includes(url.searchParams.get("sslmode") || "")) reject(`${name}_TLS_REQUIRED`);
  return url;
}
/** Evidence comes from the newly provisioned, connected staging resource. */
export function assertStagingIsolation(env: EnvironmentValues) {
  if (env.SCHOLAR_ENVIRONMENT !== "staging") reject("STAGING_ENVIRONMENT_REQUIRED");
  if (env.SCHOLAR_STAGING_PROJECT_ID !== STAGING_PROJECT_ID) reject("STAGING_PROJECT_PIN_REQUIRED");
  if (env.VERCEL_PROJECT_ID && env.VERCEL_PROJECT_ID !== STAGING_PROJECT_ID) reject("WRONG_VERCEL_PROJECT");
  if (env.SCHOLAR_STAGING_DATABASE_RESOURCE_ID !== STAGING_DATABASE_RESOURCE_ID || env.DB_NEON_PROJECT_ID !== STAGING_NEON_PROJECT_ID) reject("ISOLATED_DATABASE_RESOURCE_REQUIRED");
  const expectedHost = env.SCHOLAR_STAGING_DATABASE_HOST?.trim();
  if (expectedHost !== STAGING_DATABASE_HOST) reject("STAGING_HOST_PIN_REQUIRED");
  const pooled = databaseUrl(env.DB_DATABASE_URL, "DB_DATABASE_URL");
  const direct = databaseUrl(env.DB_DATABASE_URL_UNPOOLED, "DB_DATABASE_URL_UNPOOLED");
  if (direct.hostname.includes("-pooler.")) reject("DIRECT_MIGRATION_CONNECTION_REQUIRED");
  if ([pooled, direct].some(url => normalizedDatabaseHost(url.hostname) !== normalizedDatabaseHost(expectedHost))) reject("DATABASE_HOST_MISMATCH");
  if (pooled.pathname !== direct.pathname || pooled.username !== direct.username) reject("DATABASE_ROLE_OR_NAME_MISMATCH");
  if (env.DATABASE_URL) {
    const fallback = databaseUrl(env.DATABASE_URL, "DATABASE_URL");
    if (normalizedDatabaseHost(fallback.hostname) !== normalizedDatabaseHost(expectedHost) || fallback.pathname !== pooled.pathname) reject("UNSAFE_DATABASE_FALLBACK");
  }
  if (env.AUTH_BASE_URL?.replace(/\/$/, "") !== STAGING_ORIGIN || env.SCHOLAR_STAGING_ORIGIN !== STAGING_ORIGIN) reject("STAGING_ORIGIN_MISMATCH");
  if ((env.AUTH_SESSION_SECRET?.length || 0) < 32 || /replace-with|change.?me/i.test(env.AUTH_SESSION_SECRET || "")) reject("UNIQUE_STAGING_SESSION_SECRET_REQUIRED");
  return { projectId: STAGING_PROJECT_ID, databaseResourceId: env.SCHOLAR_STAGING_DATABASE_RESOURCE_ID, origin: STAGING_ORIGIN };
}
export function assertCandidateDeployment(env: EnvironmentValues) {
  if (env.VERCEL === "1" && (!env.VERCEL_PROJECT_ID || !env.VERCEL_GIT_COMMIT_REF)) reject("VERCEL_DEPLOYMENT_IDENTITY_REQUIRED");
  if (env.VERCEL_PROJECT_ID === PRODUCTION_PROJECT_ID && env.VERCEL_GIT_COMMIT_REF !== "main") reject("RC_FORBIDDEN_IN_PRODUCTION_PROJECT");
  if (stagingRequested(env)) return assertStagingIsolation(env);
  return null; // Existing main/production behavior is not changed by this branch.
}
