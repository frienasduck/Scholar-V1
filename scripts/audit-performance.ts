import { readdir, readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

// Read-only source/build inventory. No credentials, user content or API payloads.
const root = process.cwd();
async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]))).flat();
}
const sources = (await files(path.join(root, "src"))).filter(f => /\.(tsx?|css)$/.test(f));
const patterns = { intervals: /\bsetInterval\s*\(/g, timeouts: /\bsetTimeout\s*\(/g, raf: /\brequestAnimationFrame\s*\(/g, mutation: /new MutationObserver\b/g, intersection: /new IntersectionObserver\b/g, resize: /new ResizeObserver\b/g, listeners: /\baddEventListener\s*\(/g, objectURLs: /\bcreateObjectURL\s*\(/g, blur: /backdrop-filter\s*:/g, fontImports: /@import[^;]*fonts\.googleapis/g };
const inventory = await Promise.all(sources.map(async file => {
  const code = await readFile(file, "utf8");
  return { file: path.relative(root, file).replaceAll("\\", "/"), bytes: Buffer.byteLength(code), counts: Object.fromEntries(Object.entries(patterns).map(([name, pattern]) => [name, [...code.matchAll(pattern)].length])) };
}));
const chunks = await Promise.all((await files(path.join(root, ".next/static/chunks"))).filter(f => f.endsWith(".js")).map(async file => {
  const code = await readFile(file);
  return { file: path.basename(file), bytes: (await stat(file)).size, gzip: gzipSync(code).length, features: ["katex", "pdfjs", "pptxgenjs", "Recharts"].filter(s => code.includes(s)) };
}));
const result = { capturedAt: new Date().toISOString(), totals: Object.fromEntries(Object.keys(patterns).map(name => [name, inventory.reduce((n, f) => n + f.counts[name], 0)])), inventory, chunks: chunks.sort((a, b) => b.bytes - a.bytes) };
const label = process.argv[2] ?? "current";
if (!/^[a-z-]+$/.test(label)) throw new Error("Use a simple audit label");
await mkdir(path.join(root, "test-artifacts"), { recursive: true });
await writeFile(path.join(root, `test-artifacts/perf-audit-${label}.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ totals: result.totals, largestChunks: result.chunks.slice(0, 12), mutationObservers: inventory.filter(f => f.counts.mutation) }, null, 2));
