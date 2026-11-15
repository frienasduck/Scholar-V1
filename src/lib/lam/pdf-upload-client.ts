"use client";

import {
  hasPdfMagicSignature,
  LAM_PDF_CHUNK_BYTES,
  sanitizePdfFilename,
  validatePdfUploadMeta,
  type LamPdfStage,
  type PdfDocumentIntelligence,
} from "./pdf-contracts";

export interface PdfProcessingProgress {
  stage: LamPdfStage;
  label: string;
  uploadPercent: number;
  uploadedBytes: number;
  totalBytes: number;
  pageCount: number;
  ocrCompleted: number;
  ocrTotal: number;
  scannedPages: number[];
  mixedPages: number[];
  poorQualityPages: number[];
  indexedChunkCount: number;
  docId?: string;
}

export interface CompletedPdfProcessResult {
  docId: string;
  resourceId: string | null;
  title: string;
  fileName: string;
  sizeBytes: number;
  pageCount: number;
  ocrPages: number[];
  scannedPages: number[];
  mixedPages: number[];
  poorQualityPages: number[];
  limitationNote?: string;
  indexedChunkCount: number;
  intelligence: PdfDocumentIntelligence;
}

function stageLabel(
  stage: LamPdfStage,
  ocrCompleted: number,
  ocrTotal: number,
  uploadPercent: number
): string {
  switch (stage) {
    case "uploading":
      return `Uploading PDF safely (${uploadPercent}%)...`;
    case "inspecting":
      return "Inspecting PDF pages, layout, and security...";
    case "extracting":
      return "Extracting selectable text and preserving structure...";
    case "ocr":
      return ocrTotal > 0
        ? `Running OCR on scanned pages (${ocrCompleted}/${ocrTotal})...`
        : "Running OCR on scanned pages...";
    case "structuring":
      return "Structuring chapters, formulas, examples, and diagrams...";
    case "analyzing":
      return "Analyzing document intelligence & learning dependencies...";
    case "indexing":
      return "Preparing searchable knowledge & page citations...";
    case "ready":
      return "Ready to learn with page-level citations";
    case "failed":
      return "PDF processing failed";
  }
}

export async function uploadAndProcessLamPdf(params: {
  file: File;
  goalHint?: string;
  resumeKey?: string;
  existingDocId?: string;
  signal?: AbortSignal;
  onProgress: (progress: PdfProcessingProgress) => void;
}): Promise<CompletedPdfProcessResult> {
  const { file, goalHint, signal, onProgress } = params;

  const metaErr = validatePdfUploadMeta({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (metaErr) {
    throw new Error(metaErr);
  }

  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (!hasPdfMagicSignature(head)) {
    throw new Error(`${file.name} does not start with a valid %PDF- signature.`);
  }

  let docId = params.existingDocId;

  if (!docId) {
    const safeName = sanitizePdfFilename(file.name);
    const key =
      params.resumeKey ||
      `${safeName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20) || "pdf"}-${file.size}-${crypto.randomUUID().slice(0, 12)}`;

    onProgress({
      stage: "uploading",
      label: "Starting secure chunked PDF upload...",
      uploadPercent: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
      pageCount: 0,
      ocrCompleted: 0,
      ocrTotal: 0,
      scannedPages: [],
      mixedPages: [],
      poorQualityPages: [],
      indexedChunkCount: 0,
    });

    const startRes = await fetch("/api/lam/pdf/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        key,
        name: safeName,
        title: safeName.replace(/\.pdf$/i, ""),
        size: file.size,
      }),
    });
    const startJson = (await startRes.json().catch(() => null)) as {
      ok?: boolean;
      uploadId?: string;
      offset?: number;
      chunkBytes?: number;
      error?: { message?: string };
    } | null;

    if (!startRes.ok || !startJson?.uploadId) {
      throw new Error(startJson?.error?.message || "Could not start PDF upload.");
    }

    const uploadId = startJson.uploadId;
    let offset = startJson.offset ?? 0;
    const chunkBytes = startJson.chunkBytes ?? LAM_PDF_CHUNK_BYTES;

    while (offset < file.size) {
      const slice = file.slice(offset, Math.min(file.size, offset + chunkBytes));
      let chunkSent = false;
      let lastErr: Error | null = null;

      // Retry transient chunk network hiccups safely (up to 3 attempts per chunk)
      for (let attempt = 0; attempt < 3 && !chunkSent; attempt++) {
        if (signal?.aborted) throw new Error("Upload cancelled.");
        try {
          const putRes = await fetch(
            `/api/lam/pdf/uploads?id=${encodeURIComponent(uploadId)}&offset=${offset}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/octet-stream" },
              body: slice,
              signal,
            }
          );
          const putJson = (await putRes.json().catch(() => null)) as {
            ok?: boolean;
            offset?: number;
            error?: { code?: string; message?: string };
          } | null;
          if (!putRes.ok || typeof putJson?.offset !== "number") {
            const msg = putJson?.error?.message || `Chunk upload failed (HTTP ${putRes.status}).`;
            if (putRes.status === 400 || putRes.status === 413 || putRes.status === 415) {
              throw new Error(msg);
            }
            lastErr = new Error(msg);
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            continue;
          }
          offset = putJson.offset;
          chunkSent = true;
          const pct = Math.min(100, Math.round((offset / file.size) * 100));
          onProgress({
            stage: "uploading",
            label: stageLabel("uploading", 0, 0, pct),
            uploadPercent: pct,
            uploadedBytes: offset,
            totalBytes: file.size,
            pageCount: 0,
            ocrCompleted: 0,
            ocrTotal: 0,
            scannedPages: [],
            mixedPages: [],
            poorQualityPages: [],
            indexedChunkCount: 0,
          });
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") throw err;
          lastErr = err instanceof Error ? err : new Error("Upload interrupted.");
          if (attempt === 2) throw lastErr;
        }
      }
      if (!chunkSent && lastErr) throw lastErr;
    }

    const finishRes = await fetch("/api/lam/pdf/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        finish: uploadId,
        goalHint: goalHint?.trim().slice(0, 380) || undefined,
      }),
    });
    const finishJson = (await finishRes.json().catch(() => null)) as {
      ok?: boolean;
      doc?: { docId: string };
      error?: { message?: string };
    } | null;

    if (!finishRes.ok || !finishJson?.doc?.docId) {
      throw new Error(finishJson?.error?.message || "Could not finalize uploaded PDF.");
    }
    docId = finishJson.doc.docId;
  }

  // Loop sequential backend processing steps until `ready`
  for (let step = 0; step < 80; step++) {
    if (signal?.aborted) throw new Error("Processing cancelled.");
    const procRes = await fetch(`/api/lam/pdf/${encodeURIComponent(docId)}/process`, {
      method: "POST",
      signal,
    });
    const procJson = (await procRes.json().catch(() => null)) as {
      ok?: boolean;
      docId?: string;
      resourceId?: string | null;
      title?: string;
      fileName?: string;
      sizeBytes?: number;
      pageCount?: number;
      stage?: LamPdfStage;
      ocrTotal?: number;
      ocrCompleted?: number;
      ocrPages?: number[];
      scannedPages?: number[];
      mixedPages?: number[];
      poorQualityPages?: number[];
      limitationNote?: string;
      indexedChunkCount?: number;
      intelligence?: PdfDocumentIntelligence | null;
      error?: { message?: string };
    } | null;

    if (!procRes.ok || !procJson?.ok) {
      throw new Error(procJson?.error?.message || "PDF processing failed.");
    }

    const stage = procJson.stage || "inspecting";
    onProgress({
      stage,
      label: stageLabel(stage, procJson.ocrCompleted ?? 0, procJson.ocrTotal ?? 0, 100),
      uploadPercent: 100,
      uploadedBytes: file.size,
      totalBytes: file.size,
      pageCount: procJson.pageCount ?? 0,
      ocrCompleted: procJson.ocrCompleted ?? 0,
      ocrTotal: procJson.ocrTotal ?? 0,
      scannedPages: procJson.scannedPages ?? [],
      mixedPages: procJson.mixedPages ?? [],
      poorQualityPages: procJson.poorQualityPages ?? [],
      indexedChunkCount: procJson.indexedChunkCount ?? 0,
      docId,
    });

    if (stage === "ready" && procJson.intelligence) {
      return {
        docId,
        resourceId: procJson.resourceId ?? null,
        title: procJson.title || file.name,
        fileName: procJson.fileName || file.name,
        sizeBytes: procJson.sizeBytes ?? file.size,
        pageCount: procJson.pageCount ?? 0,
        ocrPages: procJson.ocrPages ?? [],
        scannedPages: procJson.scannedPages ?? [],
        mixedPages: procJson.mixedPages ?? [],
        poorQualityPages: procJson.poorQualityPages ?? [],
        limitationNote: procJson.limitationNote,
        indexedChunkCount: procJson.indexedChunkCount ?? 0,
        intelligence: procJson.intelligence,
      };
    }
  }

  throw new Error("Document processing exceeded safe step limit. Click Retry to resume from checkpoint.");
}

export const LAM_PDF_CHAT_LAUNCH_EVENT = "scholar:lam-open-pdf-tutor";
const LAM_PDF_CHAT_LAUNCH_KEY = "scholar:lam-pdf-chat-launch";

export interface PdfTutorChatLaunchPayload {
  docId?: string;
  title?: string;
  prompt?: string;
}

export function requestPdfTutorInChat(payload: PdfTutorChatLaunchPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LAM_PDF_CHAT_LAUNCH_KEY, JSON.stringify(payload));
  } catch { /* ignore storage errors */ }
  window.dispatchEvent(new CustomEvent(LAM_PDF_CHAT_LAUNCH_EVENT, { detail: payload }));
}

export function consumePdfTutorChatLaunch(): PdfTutorChatLaunchPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LAM_PDF_CHAT_LAUNCH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(LAM_PDF_CHAT_LAUNCH_KEY);
    return JSON.parse(raw) as PdfTutorChatLaunchPayload;
  } catch {
    return null;
  }
}
