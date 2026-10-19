import { EBOOK_CHUNK_BYTES, EBOOK_READ_BYTES, MAX_EBOOK_BYTES } from "./contracts";
async function uploadRequest(body: BodyInit, method: string, query = "") {
  const response = await fetch(`/api/ebooks/uploads${query}`, { method, body, headers: method === "POST" ? { "Content-Type": "application/json" } : undefined, signal: AbortSignal.timeout(55_000) });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.message || "Upload interrupted. Retry the same PDF to resume.");
  return value;
}
export async function transferEbook(file: File, title: string, key: string, progress: (percent: number) => void) {
  const start = await uploadRequest(JSON.stringify({ name: file.name, size: file.size, title, key }), "POST");
  let offset = start.offset;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > file.size || start.chunkBytes !== EBOOK_CHUNK_BYTES || typeof start.uploadId !== "string") throw new Error("Invalid upload response. Retry shortly.");
  while (offset < file.size) {
    const end = Math.min(offset + EBOOK_CHUNK_BYTES, file.size);
    const value = await uploadRequest(file.slice(offset, end), "PUT", `?id=${encodeURIComponent(start.uploadId)}&offset=${offset}`);
    if (value.offset !== end) throw new Error("The upload position changed. Retry the same PDF.");
    offset = end; progress(Math.round(offset / file.size * 100));
  }
  return uploadRequest(JSON.stringify({ finish: start.uploadId }), "POST");
}
/** Response chunks also stay below Vercel's body ceiling; original bytes unchanged. */
export async function fetchEbookPdf(id: string, signal?: AbortSignal) {
  let bytes: Uint8Array | undefined;
  let offset = 0;
  do {
    const response = await fetch(`/api/ebooks/${encodeURIComponent(id)}?file=1&offset=${offset}`, { signal, cache: "no-store" });
    const range = response.headers.get("Content-Range")?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    if (response.status !== 206 || !range) throw new Error("This PDF could not be loaded. Reopen the book to retry.");
    const [start, end, total] = range.slice(1).map(Number);
    if (start !== offset || total < 5 || total > MAX_EBOOK_BYTES || end < start || end - start + 1 > EBOOK_READ_BYTES || end >= total || bytes && bytes.length !== total) throw new Error("Invalid PDF transfer.");
    const chunk = new Uint8Array(await response.arrayBuffer());
    if (chunk.length !== end - start + 1) throw new Error("The PDF transfer was interrupted. Reopen it to retry.");
    bytes ??= new Uint8Array(total); bytes.set(chunk, offset); offset = end + 1;
  } while (offset < bytes.length);
  return bytes;
}
