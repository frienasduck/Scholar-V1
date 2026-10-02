import "server-only";
/** Bounded original PDF adapter shared with Custom E-Books; never fetches external assets. */
export async function extractPdf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Buffer.slice() aliases memory; Uint8Array.from() also copies Node/Bun Buffers.
  const task = pdfjs.getDocument({ data: Uint8Array.from(bytes), stopAtErrors: true, disableFontFace: true, useSystemFonts: false });
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => { reject(new Error("PDF_TIMEOUT")); void task.destroy().catch(() => undefined); }, 35_000);
  });
  try {
    return await Promise.race([deadline, (async () => {
    const document = await task.promise;
    if (document.numPages < 1 || document.numPages > 500) throw new Error("PDF_PAGE_LIMIT");
    if (await document.hasJSActions()) throw new Error("PDF_ACTIVE_CONTENT");
    const pages: string[] = []; let size = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map(item => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
      size += text.length;
      if (size > 2_000_000) throw new Error("PDF_TEXT_LIMIT");
      pages.push(text); page.cleanup();
    }
    return { pageCount: pages.length, pages, text: pages.map((p, i) => `Page ${i + 1}\n${p}`).join("\n\n"), needsOcr: pages.filter(p => p.length < 30).length >= Math.max(1, Math.ceil(pages.length * .2)) };
    })()]);
  } finally { clearTimeout(timeout!); void task.destroy().catch(() => undefined); }
}
