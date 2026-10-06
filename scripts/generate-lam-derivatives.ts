import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { LAM_AVATARS } from "../src/lib/lam/identity";

// Mechanical lossless crops only: never redraw, resize or overwrite approved art.
const root = process.cwd();
const destination = path.join(root, "public/lam/identity/avatars");
await mkdir(destination, { recursive: true });
const manifest: { id: string; source: string; sourceSha256: string; crop: readonly [number, number, number, number]; bytes: number }[] = [];
for (const avatar of LAM_AVATARS) {
  const source = await readFile(path.join(root, "public", avatar.asset));
  const [left, top, width, height] = avatar.crop;
  const crop = await sharp(source).extract({ left, top, width, height }).webp({ lossless: true, effort: 6 }).toBuffer();
  await writeFile(path.join(destination, `${avatar.id}.webp`), crop);
  manifest.push({ id: avatar.id, source: avatar.asset, sourceSha256: createHash("sha256").update(source).digest("hex"), crop: avatar.crop, bytes: crop.length });
}
await writeFile(path.join(destination, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ avatars: manifest.length, totalBytes: manifest.reduce((n, a) => n + a.bytes, 0), largest: Math.max(...manifest.map(a => a.bytes)) }));
