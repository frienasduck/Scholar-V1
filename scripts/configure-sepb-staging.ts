/** Explicitly invoked, approved staging setup only. No production secret reads. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { STAGING_PROJECT_ID, STAGING_DATABASE_HOST, STAGING_DATABASE_RESOURCE_ID, STAGING_NEON_PROJECT_ID, STAGING_ORIGIN } from "../src/lib/staging/environment";

const cwd = resolve(".sepb-staging");
const team = "team_bwSp2TtAg4dJSB3TZFDwSBP2";
const link = JSON.parse(readFileSync(resolve(cwd, ".vercel/project.json"), "utf8"));
if (link.projectId !== STAGING_PROJECT_ID || link.orgId !== team) throw new Error("STAGING_LINK_MISMATCH");
const local = parseEnv(readFileSync(resolve(cwd, ".env.local"), "utf8"));
if (local.DB_NEON_PROJECT_ID !== STAGING_NEON_PROJECT_ID || new URL(local.DB_DATABASE_URL_UNPOOLED || "").hostname !== STAGING_DATABASE_HOST) throw new Error("STAGING_RESOURCE_MISMATCH");

function vc(args: string[], input?: string) {
  const result = spawnSync("bunx", ["vercel@63.1.0", ...args, "--scope", "scholar-team", "--cwd", cwd, "--non-interactive"], { input, encoding: "utf8", windowsHide: true, timeout: 60_000 });
  // CLI errors can contain inputs. Never forward raw stdout/stderr here.
  if (result.status !== 0) throw new Error(`STAGING_CLI_FAILED_${args[0]}_${result.status ?? "TIMEOUT"}`);
  return result.stdout;
}
function api(path: string, method = "GET", body?: unknown) {
  return JSON.parse(vc(["api", `${path}?teamId=${team}`, "--method", method, "--raw", ...(body ? ["--input", "-"] : [])], body ? JSON.stringify(body) : undefined));
}
const project = api(`/v9/projects/${STAGING_PROJECT_ID}`);
if (project.id !== STAGING_PROJECT_ID || project.name !== "scholar-staging") throw new Error("STAGING_PROJECT_MISMATCH");
const existing = api(`/v10/projects/${STAGING_PROJECT_ID}/env`).envs as { key: string; target: string[] }[];
const configs: Record<string, string> = {
  SCHOLAR_ENVIRONMENT: "staging", SCHOLAR_STAGING_PROJECT_ID: STAGING_PROJECT_ID,
  SCHOLAR_STAGING_DATABASE_RESOURCE_ID: STAGING_DATABASE_RESOURCE_ID,
  SCHOLAR_STAGING_DATABASE_HOST: STAGING_DATABASE_HOST,
  SCHOLAR_STAGING_ORIGIN: STAGING_ORIGIN, AUTH_BASE_URL: STAGING_ORIGIN,
  DEV_MODE_ENABLED: "false", SUBSCRIPTIONS_ENABLED: "true", BILLING_PROVIDER: "placeholder",
};
for (const [key, value] of Object.entries(configs)) {
  const targets = ["production", "preview", "development"].filter(t => !existing.some(e => e.key === key && e.target.includes(t)));
  if (targets.length) vc(["env", "add", key, targets.join(","), "--project", STAGING_PROJECT_ID, "--type", "config", "--yes"], value);
  console.log(JSON.stringify({ configured: key, targets, project: "scholar-staging" }));
}
for (const key of ["AUTH_SESSION_SECRET", "AUDIT_LOG_SALT", "CONNECTOR_TOKEN_SECRET", "RESOURCE_WORKER_SECRET", "LAMTUBE_WORKER_SECRET"]) {
  const targets = ["development", "production", "preview"].filter(t => !existing.some(e => e.key === key && e.target.includes(t)));
  if (!targets.length) continue;
  const value = local[key] || randomBytes(48).toString("base64url");
  if (targets.length !== 3 && !local[key]) throw new Error("PULL_STAGING_DEVELOPMENT_ENV_BEFORE_RESUMING_PARTIAL_SECRET_SETUP");
  if (targets.includes("development")) vc(["env", "add", key, "development", "--project", STAGING_PROJECT_ID, "--type", "config", "--yes"], value);
  const hosted = targets.filter(t => t !== "development");
  if (hosted.length) vc(["env", "add", key, hosted.join(","), "--project", STAGING_PROJECT_ID, "--type", "secret", "--yes"], value);
  console.log(JSON.stringify({ configured: key, targets, valueLogged: false }));
}
const updated = api(`/v9/projects/${STAGING_PROJECT_ID}`, "PATCH", {
  framework: "nextjs", nodeVersion: "24.x", autoExposeSystemEnvs: true,
  installCommand: "bun install --frozen-lockfile",
  buildCommand: "bun run deploy:preflight && bun run db:migrate:deploy && bun run build",
  // Never build main or unrelated feature branches in the staging project.
  commandForIgnoringBuildStep: 'if [ "$VERCEL_GIT_COMMIT_REF" = "sepb-rc" ]; then exit 1; else exit 0; fi',
});
console.log(JSON.stringify({ id: updated.id, name: updated.name, framework: updated.framework, nodeVersion: updated.nodeVersion, buildCommand: updated.buildCommand }));
vc(["env", "pull", ".env.local", "--environment", "development", "--yes"]);
console.log(JSON.stringify({ stagingDevelopmentEnvPulled: true, productionReadOrMutated: false }));
