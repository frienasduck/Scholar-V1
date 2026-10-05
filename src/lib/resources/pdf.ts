import "server-only";
import { MAX_EBOOK_PAGES, MAX_EBOOK_TEXT } from "@/lib/ebooks/contracts";
import { join } from "node:path";
type PdfCheckpoint = { pages: string[]; pageCount: number };

/** Render only an owner-authorized page; no external assets or active PDF scripts. */
export async function renderPdfPage(bytes: Uint8Array, number: number): Promise<Buffer> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Explicitly traced runtime files: Turbopack can turn require.resolve into a numeric module ID.
  const assets = join(process.cwd(), "node_modules", "pdfjs-dist");
  const assetDirectory = (name: string) => join(assets, name).replace(/\\/g, "/") + "/";
  const task = pdfjs.getDocument({ data: Uint8Array.from(bytes), stopAtErrors: true, useWorkerFetch: false, verbosity: 0, standardFontDataUrl: assetDirectory("standard_fonts"), cMapUrl: assetDirectory("cmaps"), cMapPacked: true, wasmUrl: assetDirectory("wasm") });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([(async () => {
      const document = await task.promise;
      if (document.numPages > MAX_EBOOK_PAGES || !Number.isInteger(number) || number < 1 || number > document.numPages) throw new Error("INVALID_PAGE");
      if (await document.hasJSActions()) throw new Error("PDF_ACTIVE_CONTENT");
      const page = await document.getPage(number);
      const original = page.getViewport({ scale: 1 });
      const scale = Math.min(2200 / Math.max(original.width, original.height), 3);
      const viewport = page.getViewport({ scale });
      if (!Number.isFinite(viewport.width * viewport.height) || viewport.width < 1 || viewport.height < 1) throw new Error("PDF_CORRUPT");
      type NativeCanvas = { canvas: HTMLCanvasElement & { toBuffer(type: "image/png"): Buffer }; context: CanvasRenderingContext2D };
      const factory = document.canvasFactory as { create(width: number, height: number): NativeCanvas; destroy(canvas: NativeCanvas): void };
      const canvas = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        await page.render({ canvas: canvas.canvas, canvasContext: canvas.context, viewport }).promise;
        return canvas.canvas.toBuffer("image/png") as Buffer;
      } finally { factory.destroy(canvas); page.cleanup(); }
    })(), new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new Error("PDF_TIMEOUT")); void task.destroy().catch(() => undefined); }, 12_000); })]);
  } finally { if (timer) clearTimeout(timer); await task.destroy().catch(() => undefined); }
}
/** Bounded original PDF adapter shared with Custom E-Books; never fetches external assets. */
export async function extractPdf(bytes: Uint8Array, options?: { pages?: string[]; batchSize?: number; checkpoint?: (value: PdfCheckpoint) => Promise<void> }) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Buffer.slice() aliases memory; Uint8Array.from() also copies Node/Bun Buffers.
  const assets = join(process.cwd(), "node_modules", "pdfjs-dist");
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
