/** User-approved transfer of existing LOCAL Groq/Gemini keys to staging only. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { STAGING_PROJECT_ID, assertStagingIsolation } from "../src/lib/staging/environment";
const cwd = resolve(".sepb-staging");
const stage = parseEnv(readFileSync(resolve(cwd, ".env.local"), "utf8"));
assertStagingIsolation(stage);
const link = JSON.parse(readFileSync(resolve(cwd, ".vercel/project.json"), "utf8"));
if (link.projectId !== STAGING_PROJECT_ID || link.orgId !== "team_bwSp2TtAg4dJSB3TZFDwSBP2") throw new Error("STAGING_LINK_MISMATCH");
const local = parseEnv(readFileSync(".env.local", "utf8"));
for (const key of ["GROQ_API_KEY", "GEMINI_API_KEY"]) {
  const value = local[key]?.trim();
  if (!value) throw new Error(`LOCAL_${key}_UNAVAILABLE`);
  for (const [target, type] of [["production,preview", "secret"], ["development", "config"]]) {
    const result = spawnSync("bunx", ["vercel@63.1.0", "env", "add", key, target, "--type", type, "--yes", "--project", STAGING_PROJECT_ID, "--scope", "scholar-team", "--cwd", cwd, "--non-interactive"], { input: value, encoding: "utf8", windowsHide: true, timeout: 60_000 });
    if (result.status !== 0) throw new Error(`STAGING_KEY_ADD_FAILED_${key}_${target}`);
  }
  console.log(JSON.stringify({ configured: key, project: "scholar-staging", valueLogged: false }));
}
console.log(JSON.stringify({ authorization: "one video up to 45 seconds and up to five LAM text checks", callsRun: 0, planUpgraded: false }));
