import "server-only";

// Private beta stores small, temporary resources in the existing PostgreSQL
// database. No public object URLs or browser-provided extracted text are trusted.
export const MAX_STUDY_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_ROOM_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_STUDY_PAGES = 80;
export class StudyUploadError extends Error {}

export async function parseStudyUpload(bytes: Uint8Array) {
  if (!bytes.byteLength || bytes.byteLength > MAX_STUDY_FILE_BYTES) throw new StudyUploadError("Choose a file up to 3 MB.");
  const prefix = Buffer.from(bytes.subarray(0, 12));
  if (prefix.subarray(0, 5).toString() === "%PDF-") {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({ data: new Uint8Array(bytes), stopAtErrors: true, disableFontFace: true, useSystemFonts: false });
    const timeout = setTimeout(() => { void task.destroy().catch(() => undefined); }, 20_000);
    try {
      const document = await task.promise;
      if (document.numPages > MAX_STUDY_PAGES) throw new StudyUploadError("Choose a PDF with no more than 80 pages.");
      // Active content is not part of a study material and is never executed.
      if (await document.hasJSActions()) throw new StudyUploadError("PDFs containing scripts cannot be shared. Export a plain PDF first.");
      const pageTexts: string[] = [];
      let total = 0;
      for (let number = 1; number <= document.numPages; number++) {
        const page = await document.getPage(number);
        const content = await page.getTextContent();
        const text = content.items.map((item) => "str" in item ? item.str : "").join(" ").slice(0, 12_000);
        total += text.length;
        if (total > 250_000) throw new StudyUploadError("This document has too much text. Split it into smaller study PDFs.");
        pageTexts.push(text);
        page.cleanup();
      }
      return { mimeType: "application/pdf", pageCount: document.numPages, pageTexts, text: pageTexts.map((text, i) => `[Page ${i + 1}] ${text}`).join("\n\n") };
    } catch (error) {
      if (error instanceof StudyUploadError) throw error;
      throw new StudyUploadError("This PDF could not be read. It may be encrypted or damaged. Export a plain PDF and try again.");
    } finally {
      clearTimeout(timeout);
      await task.destroy().catch(() => undefined);
    }
  }
  const png = prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255;
  if (png || jpeg) {
    try {
      const sharp = (await import("sharp")).default;
      const metadata = await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata();
      if (!metadata.width || !metadata.height || !["png", "jpeg"].includes(metadata.format ?? "")) throw new Error("Unsupported image");
      // Re-encode to strip EXIF/private metadata and unexpected container data.
      const sanitized = png ? await sharp(bytes).png().toBuffer() : await sharp(bytes).jpeg().toBuffer();
      if (sanitized.byteLength > MAX_STUDY_FILE_BYTES) throw new StudyUploadError("This image is too large after processing.");
      return { mimeType: png ? "image/png" : "image/jpeg", pageCount: 1, pageTexts: [] as string[], text: "", sanitized };
    } catch (error) {
      if (error instanceof StudyUploadError) throw error;
      throw new StudyUploadError("This image could not be read. Choose a valid PNG or JPEG.");
    }
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.length > 100_000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error("Not plain text");
    return { mimeType: "text/plain", pageCount: 1, pageTexts: [text], text };
  } catch {
    throw new StudyUploadError("Supported materials: PDF, PNG, JPEG, and UTF-8 text notes.");
  }
}
