import { createHash } from "node:crypto";

// Small valid PDFs generated in memory. No copyrighted material or user files.
const md5 = (value: Uint8Array) => createHash("md5").update(value).digest();
function rc4(key: Uint8Array, data: Uint8Array) {
  const s = Array.from({ length: 256 }, (_, i) => i); let j = 0;
  for (let i = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) % 256; [s[i], s[j]] = [s[j], s[i]]; }
  let i = 0; j = 0;
  return Buffer.from(data.map(byte => { i = (i + 1) % 256; j = (j + s[i]) % 256; [s[i], s[j]] = [s[j], s[i]]; return byte ^ s[(s[i] + s[j]) % 256]; }));
}
export function ebookFixture(count: number, options: { scan?: boolean; mixed?: boolean; padding?: number; encrypted?: boolean } = {}) {
  const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const pages: number[] = [];
  for (let i = 0; i < count; i++) {
    const text = options.scan || options.mixed && i % 2 ? "q 10 0 0 10 40 40 cm BI /W 1 /H 1 /CS /RGB /BPC 8 /F /AHx ID FFFFFF> EI Q" : `BT /F1 12 Tf 40 720 Td (Page ${i + 1}: Newton's second law relates net force, mass and acceleration. F = ma.) Tj ET`;
    const stream = objects.length + 1;
    objects.push(`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`);
    const page = objects.length + 1; pages.push(page);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents ${stream} 0 R >>`);
  }
  objects[1] = `<< /Type /Pages /Count ${count} /Kids [${pages.map(p => `${p} 0 R`).join(" ")}] >>`;
  objects.push('<< /Title (Mechanics fixture) >>'); const info = objects.length;
  if (options.padding) objects.push(`<< /Length ${options.padding} >>\nstream\n${" ".repeat(options.padding)}\nendstream`);
  let encrypt = "";
  if (options.encrypted) {
    const pad = Buffer.from("28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a", "hex");
    const padded = (password: string) => Buffer.concat([Buffer.from(password), pad]).subarray(0, 32);
    const owner = rc4(md5(padded("owner-secret")).subarray(0, 5), padded("test-secret"));
    const permission = Buffer.alloc(4); permission.writeInt32LE(-4);
    const fileKey = md5(Buffer.concat([padded("test-secret"), owner, permission, Buffer.alloc(16)])).subarray(0, 5);
    const user = rc4(fileKey, pad);
    objects.push(`<< /Filter /Standard /V 1 /R 2 /O <${owner.toString("hex")}> /U <${user.toString("hex")}> /P -4 >>`);
    encrypt = `/Encrypt ${objects.length} 0 R /ID [<${"0".repeat(32)}> <${"0".repeat(32)}>]`;
  }
  let result = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(result)); result += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R ${encrypt} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(result);
}
