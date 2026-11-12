/**
 * LAM composer attachments.
 *
 * We only accept material we can actually read in the browser: plain text and
 * PDF text layers. Images are deliberately rejected instead of being sent as
 * pretend context that the text model cannot inspect.
 */

export interface LamAttachment {
  id: string;
  name: string;
  kind: "text" | "pdf" | "image";
  size: number;
  chars: number;
  pages?: number;
  excerpt: string;
  mimeType?: string;
  dataUrl?: string;
  file?: File;
}

export const LAM_ATTACHMENT_ACCEPT = ".txt,.md,.markdown,.csv,.json,.pdf,text/plain,text/markdown,application/pdf";
export const LAM_IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
export const LAM_PLUGIN_ATTACHMENT_ACCEPT = `${LAM_ATTACHMENT_ACCEPT},${LAM_IMAGE_ACCEPT}`;
export const LAM_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
export const LAM_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const LAM_ATTACHMENT_EXCERPT_CHARS = 6_000;
const MAX_PDF_PAGES = 30;

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function cleanText(value: string): string {
  return value.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

async function readPdf(file: File): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const document = await task.promise;
  try {
    const pageCount = document.numPages;
    const chunks: string[] = [];
    let length = 0;
    const pagesToRead = Math.min(pageCount, MAX_PDF_PAGES);
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text) {
          chunks.push(`Page ${pageNumber}: ${text}`);
          length += text.length;
        }
        if (length >= LAM_ATTACHMENT_EXCERPT_CHARS) break;
      } finally {
        page.cleanup();
      }
    }
    return { text: cleanText(chunks.join("\n")), pages: pageCount };
  } finally {
    await task.destroy();
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsDataURL(file);
  });
}

export async function readLamAttachment(
  file: File,
  options: { allowImages?: boolean } = {},
): Promise<LamAttachment> {
  const ext = extension(file.name);
  const isImage =
    ["png", "jpg", "jpeg", "webp"].includes(ext) ||
    ["image/png", "image/jpeg", "image/webp"].includes(file.type.toLowerCase());

  if (isImage) {
    if (!options.allowImages) {
      throw new Error(
        `${file.name}: select @Image Analysis to inspect question photos, or attach a text file/PDF instead.`,
      );
    }
    if (file.size === 0) throw new Error(`${file.name} is empty.`);
    if (file.size > LAM_IMAGE_MAX_BYTES) {
      throw new Error(`${file.name} exceeds the 10 MB Homework Scanner image limit.`);
    }
    const mimeType = file.type && file.type.startsWith("image/") ? file.type : `image/${ext === "jpg" ? "jpeg" : ext}`;
    const dataUrl = await readFileAsDataUrl(file);
    return {
      id: crypto.randomUUID(),
      name: file.name.slice(0, 120),
      kind: "image",
      size: file.size,
      chars: 0,
      excerpt: "",
      mimeType,
      dataUrl,
      file,
    };
  }

  if (file.size > LAM_ATTACHMENT_MAX_BYTES) {
    throw new Error(`${file.name} is larger than 15 MB. Please attach a smaller file.`);
  }
  const isPdf = ext === "pdf" || file.type === "application/pdf";
  const isText = ["txt", "md", "markdown", "csv", "json"].includes(ext) || file.type.startsWith("text/");
  if (!isPdf && !isText) {
    throw new Error(
      /^image\//.test(file.type)
        ? `${file.name}: use a PNG, JPEG, or WebP image with @Image Analysis, or attach a text file or PDF.`
        : `${file.name}: only text files and PDFs (or PNG/JPEG/WebP for @Image Analysis) can be attached.`,
    );
  }

  const pdf = isPdf ? await readPdf(file) : null;
  const text = pdf ? pdf.text : cleanText(await file.text());
  const pages = pdf?.pages;
  if (!text.trim()) {
    throw new Error(`${file.name} has no readable text. Scanned image-only PDFs need OCR first.`);
  }
  const excerpt = text.slice(0, LAM_ATTACHMENT_EXCERPT_CHARS);
  return {
    id: crypto.randomUUID(),
    name: file.name.slice(0, 120),
    kind: isPdf ? "pdf" : "text",
    size: file.size,
    chars: text.length,
    pages,
    excerpt,
  };
}

/**
 * Build a bounded message body. /api/lam/chat accepts 4,000 characters, so we
 * reserve room for the user's own question and trim attachment excerpts.
 */
export function composeLamMessage(message: string, attachments: LamAttachment[], limit = 4_000): string {
  const question = message.trim();
  const readableAttachments = attachments.filter((item) => item.kind !== "image" && item.excerpt.trim().length > 0);
  if (!readableAttachments.length) return question.slice(0, limit);
  const header = "\n\nAttached study material:";
  let body = question;
  for (const attachment of readableAttachments) {
    const label = `\n\n--- ${attachment.name}${attachment.pages ? ` (${attachment.pages} pages)` : ""} ---\n`;
    const remaining = limit - body.length - header.length - label.length;
    if (remaining <= 200) break;
    body += `${header}${label}${attachment.excerpt.slice(0, remaining - 20)}`;
  }
  return body.slice(0, limit);
}
