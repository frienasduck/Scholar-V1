import { readdir, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

// Existing tests mock shared modules. Process isolation prevents one security
// fixture from leaking its mocked database/provider into an unrelated file.
const files = (await readdir("tests")).filter(name => /\.test\.tsx?$/.test(name)).sort();
const results: {file:string;passed:number;failed:number;skipped:number;exit:number|null;timedOut:boolean;failures:string}[] = [];
let next = 0;
async function worker() {
  while (next < files.length) {
    const file = files[next++];
    await new Promise<void>(resolve => {
      const child = spawn("bun", ["test", `tests/${file}`], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      let output = "", timedOut = false;
      child.stdout.on("data", data => output += data); child.stderr.on("data", data => output += data);
      const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 60000);
      child.on("close", exit => {
        clearTimeout(timeout);
        const count = (kind:string) => Number(output.match(new RegExp(`(?:^|\\n)\\s*(\\d+) ${kind}\\b`))?.[1] ?? 0);
        const row = {file,passed:count("pass"),failed:count("fail"),skipped:count("skip"),exit,timedOut,failures:exit ? output.slice(-14000) : ""};
        results.push(row); console.log(`${results.length}/${files.length} ${file}: ${row.passed} pass, ${row.failed} fail, ${row.skipped} skip${timedOut?" TIMEOUT":""}`); resolve();
      });
    });
  }
}
await Promise.all([worker(),worker()]);
const summary = {files:files.length,passed:results.reduce((n,r)=>n+r.passed,0),failed:results.reduce((n,r)=>n+r.failed,0),skipped:results.reduce((n,r)=>n+r.skipped,0),unsuccessful:results.filter(r=>r.exit!==0),results};
const artifact = process.argv[2] ?? "test-artifacts/perf-regression-results.json";
// Keep command-selected reports in the artifact directory, not arbitrary paths.
const artifactRoot = resolve("test-artifacts");
const outputPath = resolve(artifact);
if (!outputPath.startsWith(artifactRoot + (process.platform === "win32" ? "\\" : "/")) || !outputPath.endsWith(".json")) throw new Error("Choose a JSON report inside test-artifacts");
await mkdir(artifactRoot,{recursive:true}); await writeFile(outputPath,JSON.stringify(summary,null,2));
console.log(JSON.stringify({files:summary.files,passed:summary.passed,failed:summary.failed,skipped:summary.skipped,unsuccessful:summary.unsuccessful.map(r=>({file:r.file,exit:r.exit,timedOut:r.timedOut}))}));
process.exitCode = summary.unsuccessful.length ? 1 : 0;
