import "server-only";
import { MAX_EBOOK_PAGES, MAX_EBOOK_TEXT } from "@/lib/ebooks/contracts";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
type PdfCheckpoint = { pages: string[]; pageCount: number };
/** Bounded original PDF adapter shared with Custom E-Books; never fetches external assets. */
export async function extractPdf(bytes: Uint8Array, options?: { pages?: string[]; batchSize?: number; checkpoint?: (value: PdfCheckpoint) => Promise<void> }) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Buffer.slice() aliases memory; Uint8Array.from() also copies Node/Bun Buffers.
  const assets = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
  const assetDirectory = (name: string) => join(assets, name).replace(/\\/g, "/") + "/";
  const task = pdfjs.getDocument({ data: Uint8Array.from(bytes), stopAtErrors: true, disableFontFace: true, useSystemFonts: false, useWorkerFetch: false, verbosity: 0, standardFontDataUrl: assetDirectory("standard_fonts"), cMapUrl: assetDirectory("cmaps"), cMapPacked: true, wasmUrl: assetDirectory("wasm") });
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => { reject(new Error("PDF_TIMEOUT")); void task.destroy().catch(() => undefined); }, 35_000);
  });
  try {
    return await Promise.race([deadline, (async () => {
    const document = await task.promise;
    if (document.numPages < 1 || document.numPages > MAX_EBOOK_PAGES) throw new Error("PDF_PAGE_LIMIT");
    if (await document.hasJSActions()) throw new Error("PDF_ACTIVE_CONTENT");
    const pages = options?.pages?.slice(0, document.numPages) ?? [];
    let size = pages.reduce((sum, page) => sum + page.length, 0);
    const startedAt = Date.now();
    const end = Math.min(document.numPages, pages.length + (options?.batchSize ?? document.numPages));
    for (let pageNumber = pages.length + 1; pageNumber <= end; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      size += text.length;
      if (size > MAX_EBOOK_TEXT) throw new Error("PDF_TEXT_LIMIT");
      pages.push(text); page.cleanup();
      if (options?.checkpoint && (pages.length % 10 === 0 || pageNumber === end)) await options.checkpoint({ pages: [...pages], pageCount: document.numPages });
      if (options && Date.now() - startedAt > 18_000) break;
    }
    const complete = pages.length === document.numPages;
    const info = complete && typeof document.getMetadata === "function" ? await document.getMetadata().catch(() => null) : null;
    const title = (info?.info as { Title?: string } | undefined)?.Title?.trim().slice(0, 120);
    const outline: { title: string; page: number }[] = [];
    if (complete && typeof document.getOutline === "function") {
      const items = await document.getOutline().catch(() => null);
      for (const item of items?.slice(0, 60) ?? []) {
        const dest = typeof item.dest === "string" ? await document.getDestination(item.dest).catch(() => null) : item.dest;
        if (Array.isArray(dest) && dest[0]) {
          const page = typeof dest[0] === "number" ? dest[0] + 1 : await document.getPageIndex(dest[0]).then(n => n + 1).catch(() => 0);
          if (page >= 1 && page <= document.numPages) outline.push({ title: item.title.slice(0, 160), page });
        }
      }
    }
    return { pageCount: document.numPages, pages, complete: pages.length === document.numPages, title: title && !/^(untitled|document|microsoft|pdf)/i.test(title) ? title : undefined, outline, text: pages.map((p, i) => `Page ${i + 1}\n${p}`).join("\n\n"), needsOcr: pages.some(p => p.length < 30) };
    })()]);
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "PasswordException") throw new Error("PDF_PASSWORD_PROTECTED");
    if (name === "InvalidPDFException" || name === "FormatError") throw new Error("PDF_CORRUPT");
    throw error;
  } finally { clearTimeout(timeout!); void task.destroy().catch(() => undefined); }
}
