import { expect, test } from "bun:test";
import { assertCandidateDeployment, assertStagingIsolation, PRODUCTION_DATABASE_RESOURCE_ID, PRODUCTION_PROJECT_ID, STAGING_ORIGIN, STAGING_PROJECT_ID, STAGING_DATABASE_RESOURCE_ID, STAGING_DATABASE_HOST, STAGING_NEON_PROJECT_ID } from "../src/lib/staging/environment";

const valid = () => ({ SCHOLAR_ENVIRONMENT: "staging", SCHOLAR_STAGING_PROJECT_ID: STAGING_PROJECT_ID, VERCEL_PROJECT_ID: STAGING_PROJECT_ID, VERCEL_GIT_COMMIT_REF: "sepb-rc", SCHOLAR_STAGING_DATABASE_RESOURCE_ID: STAGING_DATABASE_RESOURCE_ID, DB_NEON_PROJECT_ID: STAGING_NEON_PROJECT_ID, SCHOLAR_STAGING_DATABASE_HOST: STAGING_DATABASE_HOST, DB_DATABASE_URL: `postgresql://stage:fixture-only@${STAGING_DATABASE_HOST.replace(".", "-pooler.")}/neondb?sslmode=require`, DB_DATABASE_URL_UNPOOLED: `postgresql://stage:fixture-only@${STAGING_DATABASE_HOST}/neondb?sslmode=require`, AUTH_BASE_URL: STAGING_ORIGIN, SCHOLAR_STAGING_ORIGIN: STAGING_ORIGIN, AUTH_SESSION_SECRET: "synthetic-staging-test-secret-not-a-real-key" });
test("RC preview in the real production project is refused before any migration", () => {
  expect(() => assertCandidateDeployment({ ...valid(), VERCEL_PROJECT_ID: PRODUCTION_PROJECT_ID })).toThrow("RC_FORBIDDEN_IN_PRODUCTION_PROJECT");
  expect(() => assertCandidateDeployment({ VERCEL_PROJECT_ID: PRODUCTION_PROJECT_ID })).toThrow("RC_FORBIDDEN_IN_PRODUCTION_PROJECT");
  expect(() => assertCandidateDeployment({ VERCEL: "1", VERCEL_GIT_COMMIT_REF: "sepb-rc" })).toThrow("VERCEL_DEPLOYMENT_IDENTITY_REQUIRED");
});
test("staging requires project/resource/origin/host pins, not a client flag", () => {
  expect(assertStagingIsolation(valid()).projectId).toBe(STAGING_PROJECT_ID);
  for (const key of ["SCHOLAR_ENVIRONMENT", "SCHOLAR_STAGING_PROJECT_ID", "SCHOLAR_STAGING_DATABASE_RESOURCE_ID", "DB_NEON_PROJECT_ID", "SCHOLAR_STAGING_DATABASE_HOST", "DB_DATABASE_URL", "DB_DATABASE_URL_UNPOOLED", "AUTH_BASE_URL", "SCHOLAR_STAGING_ORIGIN", "AUTH_SESSION_SECRET"] as const) {
    const env = valid(); delete (env as Partial<typeof env>)[key]; expect(() => assertStagingIsolation(env)).toThrow();
  }
});
test("shared production resource, wrong role/database and unsafe fallback fail closed", () => {
  for (const overrides of [
    { SCHOLAR_STAGING_DATABASE_RESOURCE_ID: PRODUCTION_DATABASE_RESOURCE_ID },
    { SCHOLAR_STAGING_DATABASE_RESOURCE_ID: "store-another-stage" },
    { DB_NEON_PROJECT_ID: "wrong-project" },
    { SCHOLAR_STAGING_DATABASE_HOST: "ep-production.neon.tech", DB_DATABASE_URL: "postgresql://stage:fixture-only@ep-production.neon.tech/neondb?sslmode=require", DB_DATABASE_URL_UNPOOLED: "postgresql://stage:fixture-only@ep-production.neon.tech/neondb?sslmode=require" },
    { DB_DATABASE_URL_UNPOOLED: valid().DB_DATABASE_URL },
    { DB_DATABASE_URL: "postgresql://stage:fixture-only@ep-production.neon.tech/neondb?sslmode=require" },
    { DB_DATABASE_URL_UNPOOLED: "postgresql://other:fixture-only@ep-stage-only.neon.tech/other?sslmode=require" },
    { DATABASE_URL: "postgresql://stage:fixture-only@ep-production.neon.tech/neondb?sslmode=require" },
    { AUTH_BASE_URL: "https://scholarofficial.vercel.app" },
    { DB_DATABASE_URL: "postgresql://stage:fixture-only@ep-stage-only.neon.tech/neondb" },
  ]) expect(() => assertStagingIsolation({ ...valid(), ...overrides })).toThrow();
});
test("errors expose only a diagnostic code, never credentials or connection strings", () => {
  try { assertStagingIsolation({ ...valid(), DB_DATABASE_URL: "postgresql://private-person:private-password@ep-production.neon.tech/db?sslmode=require" }); } catch (error) {
    expect(String(error)).not.toContain("private-password"); expect(String(error)).not.toContain("private-person"); expect(String(error)).not.toContain("postgresql://");
  }
});
test("main in the production project and pure local compilation are not hijacked", () => {
  expect(assertCandidateDeployment({ VERCEL_PROJECT_ID: PRODUCTION_PROJECT_ID, VERCEL_GIT_COMMIT_REF: "main" })).toBeNull();
  expect(assertCandidateDeployment({})).toBeNull();
  expect(() => assertCandidateDeployment({ VERCEL_PROJECT_ID: STAGING_PROJECT_ID, VERCEL_GIT_COMMIT_REF: "sepb-rc" })).toThrow();
});
