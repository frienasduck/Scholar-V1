import { execFileSync } from "node:child_process";
import { assertCandidateDeployment, assertStagingIsolation, StagingBoundaryError } from "../src/lib/staging/environment";

const purpose = process.argv[2] || "build";
try {
  // Compilation-only local checks need no database. Local RC migrations do.
  const proof = assertCandidateDeployment(process.env);
  if (purpose === "migration" && !proof) {
    let branch = "";
    try { branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8", windowsHide: true }).trim(); } catch { /* Cloud deployments use commit-ref environment above. */ }
    if (branch === "sepb-rc") assertStagingIsolation(process.env);
  }
  console.log(JSON.stringify({ check: "deployment-preflight", purpose, target: proof ? "isolated-staging" : "existing-target-or-local-compilation", passed: true }));
} catch (error) {
  console.error(JSON.stringify({ check: "deployment-preflight", passed: false, code: error instanceof StagingBoundaryError ? error.code : "PREFLIGHT_FAILED" }));
  process.exitCode = 1;
}
