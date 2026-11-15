"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  ScanText,
  Sparkles,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ScholarAIContent } from "@/components/ai/lazy-scholar-ai-content";
import type { LamAttachment } from "@/lib/lam/attachments";
import {
  formatPdfBytes,
  MAX_LAM_PDF_BYTES,
  validatePdfUploadMeta,
  type LamPdfStage,
} from "@/lib/lam/pdf-contracts";
import {
  uploadAndProcessLamPdf,
  type CompletedPdfProcessResult,
  type PdfProcessingProgress,
} from "@/lib/lam/pdf-upload-client";
import type { LamPluginPdfTutorData } from "@/lib/lam/types";
import { toast } from "@/lib/notifications/notification-api";

export interface LearnWithPdfWidgetProps {
  data: LamPluginPdfTutorData;
  pendingPdfFile?: File | null;
  pendingAttachmentName?: string;
  activeDocId?: string;
  onActivateDocument: (docId: string, title: string, triggerAnalysis?: boolean) => void;
  onAskDocumentQuestion: (docId: string, question: string) => void;
  onDeleteDocument?: (docId: string) => void;
}

interface SavedPdfItem {
  id: string;
  title: string;
  originalFileName: string;
  sizeBytes: number;
  pageCount: number;
  processingStatus: string;
}

const PIPELINE_STEPS: Array<{ key: LamPdfStage; label: string }> = [
  { key: "uploading", label: "Uploading PDF" },
  { key: "inspecting", label: "Inspecting document" },
  { key: "extracting", label: "Extracting text" },
  { key: "ocr", label: "OCR on scanned pages" },
  { key: "structuring", label: "Structuring chapters" },
  { key: "analyzing", label: "Analyzing intelligence" },
  { key: "indexing", label: "Preparing knowledge index" },
  { key: "ready", label: "Ready to learn" },
];

function stepOrder(stage: LamPdfStage): number {
  const idx = PIPELINE_STEPS.findIndex((s) => s.key === stage);
  return idx === -1 ? 0 : idx;
}

function PdfPageViewerModal({
  docId,
  title,
  pageCount,
  initialPage,
  onClose,
}: {
  docId: string;
  title: string;
  pageCount: number;
  initialPage: number;
  onClose: () => void;
}) {
  const total = Math.max(1, pageCount);
  const [page, setPage] = useState(() => Math.max(1, Math.min(total, initialPage)));
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<"page" | "text">("page");
  const [pageText, setPageText] = useState<string>("");
  const [textLoading, setTextLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageErr, setImageErr] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setPage(Math.max(1, Math.min(total, initialPage)));
  }, [initialPage, total]);

  useEffect(() => {
    setImageLoading(true);
    setImageErr("");
  }, [docId, page]);

  useEffect(() => {
    if (viewMode !== "text") return;
    let cancelled = false;
    setTextLoading(true);
    fetch(`/api/lam/pdf/${encodeURIComponent(docId)}?page=${page}`)
      .then((r) => r.json())
      .then((json: { text?: string }) => {
        if (!cancelled) setPageText(json.text ?? "");
      })
      .catch(() => {
        if (!cancelled) setPageText("Unable to load extracted text for this page.");
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [docId, page, viewMode]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const metaRes = await fetch(`/api/lam/pdf/${encodeURIComponent(docId)}`);
      const meta = (await metaRes.json().catch(() => null)) as {
        sizeBytes?: number;
        fileName?: string;
      } | null;
      const totalBytes = meta?.sizeBytes ?? 0;
      const fileName = meta?.fileName || `${title}.pdf`;

      if (totalBytes <= 4 * 1024 * 1024) {
        const res = await fetch(`/api/lam/pdf/${encodeURIComponent(docId)}?file=1`);
        if (!res.ok) throw new Error("Download failed.");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Range-stream up to 25 MB PDFs cleanly in 1 MB chunks
        const parts: Uint8Array[] = [];
        let offset = 0;
        while (offset < totalBytes) {
          const r = await fetch(`/api/lam/pdf/${encodeURIComponent(docId)}?file=1&offset=${offset}`);
          if (!r.ok) throw new Error("Chunked PDF download interrupted.");
          const buf = new Uint8Array(await r.arrayBuffer());
          if (!buf.byteLength) break;
          parts.push(buf);
          offset += buf.byteLength;
        }
        const blob = new Blob(
          parts.map((p) => Uint8Array.from(p)),
          { type: "application/pdf" }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const dialogContent = (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-2 backdrop-blur-md sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`PDF Viewer: ${title}`}
    >
      <div className="flex h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b1019] text-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0 text-cyan-300" />
            <span className="truncate text-xs font-semibold sm:text-sm">{title}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/80 hover:bg-white/10 disabled:opacity-40"
              aria-label="Previous PDF page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 text-xs text-white/80">
              <span>Page</span>
              <input
                type="number"
                min={1}
                max={total}
                value={page}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (Number.isInteger(val) && val >= 1 && val <= total) setPage(val);
                }}
                aria-label="PDF Page Number"
                className="w-12 rounded-md border border-white/15 bg-black/40 px-1.5 py-0.5 text-center text-xs text-white"
              />
              <span className="text-white/50">/ {total}</span>
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(total, p + 1))}
              disabled={page >= total}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/80 hover:bg-white/10 disabled:opacity-40"
              aria-label="Next PDF page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <span className="mx-1 h-4 w-px bg-white/10" />

            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(60, z - 20))}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/80 hover:bg-white/10"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[42px] text-center text-[11px] text-white/75">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(220, z + 20))}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/80 hover:bg-white/10"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setViewMode((m) => (m === "page" ? "text" : "page"))}
              className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-400/20"
            >
              {viewMode === "page" ? "Extracted Text" : "Page View"}
            </button>

            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={downloading}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/85 hover:bg-white/10 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-white/80 hover:bg-white/15"
              aria-label="Close PDF viewer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#070b12] p-3 sm:p-5">
          {viewMode === "page" ? (
            <div className="flex min-h-full flex-col items-center justify-start">
              {imageLoading && !imageErr ? (
                <div className="flex items-center gap-2 py-12 text-xs text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                  Rendering page {page}...
                </div>
              ) : null}
              {imageErr ? (
                <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                  {imageErr}
                </div>
              ) : (
                <img
                  src={`/api/lam/pdf/${encodeURIComponent(docId)}?pageImage=${page}`}
                  alt={`${title} — Page ${page}`}
                  style={{ width: `${zoom}%`, maxWidth: zoom <= 100 ? "820px" : "none" }}
                  className="rounded-lg border border-white/10 bg-white shadow-xl transition-[width] duration-150"
                  onLoad={() => setImageLoading(false)}
                  onError={() => {
                    setImageLoading(false);
                    setImageErr(`Could not render page ${page}. Try switching to Extracted Text view.`);
                  }}
                />
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-3xl rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-white/85 whitespace-pre-wrap">
              {textLoading ? (
                <div className="flex items-center gap-2 text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading extracted text...
                </div>
              ) : (
                pageText || "No extracted text stored for this page."
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(dialogContent, document.body) : dialogContent;
}

export function LearnWithPdfWidget({
  data,
  pendingPdfFile,
  onActivateDocument,
  onAskDocumentQuestion,
  onDeleteDocument,
}: LearnWithPdfWidgetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoStartedFileRef = useRef<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(pendingPdfFile ?? null);
  const [progress, setProgress] = useState<PdfProcessingProgress | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedDocs, setSavedDocs] = useState<SavedPdfItem[]>([]);
  const [viewerPage, setViewerPage] = useState<number | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(data.mode === "workspace");
  const [customPrompt, setCustomPrompt] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (pendingPdfFile && data.mode === "workspace") {
      setSelectedFile(pendingPdfFile);
    }
  }, [pendingPdfFile, data.mode]);

  useEffect(() => {
    if (data.mode !== "workspace" && !showUploadPanel) return;
    fetch("/api/lam/pdf")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { docs?: SavedPdfItem[] } | null) => {
        if (json?.docs) setSavedDocs(json.docs.filter((d) => d.processingStatus === "ready"));
      })
      .catch(() => undefined);
  }, [data.mode, showUploadPanel]);

  const startProcessingFile = useCallback(
    async (file: File) => {
      setError("");
      const metaErr = validatePdfUploadMeta({ name: file.name, type: file.type, size: file.size });
      if (metaErr) {
        setError(metaErr);
        return;
      }

      const canResume = Boolean(
        progress?.docId &&
          progress.stage === "failed" &&
          selectedFile &&
          selectedFile.name === file.name &&
          selectedFile.size === file.size
      );
      setSelectedFile(file);
      if (!canResume) {
        setProgress(null);
      }
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result: CompletedPdfProcessResult = await uploadAndProcessLamPdf({
          file,
          goalHint: data.learningGoal,
          existingDocId: canResume ? progress?.docId : undefined,
          signal: controller.signal,
          onProgress: (p) => setProgress(p),
        });
        setShowUploadPanel(false);
        onActivateDocument(result.docId, result.title, true);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setError("Upload/processing was cancelled.");
        } else {
          setError(err instanceof Error ? err.message : "Could not process this PDF.");
        }
      } finally {
        setBusy(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [data.learningGoal, onActivateDocument, progress, selectedFile]
  );

  useEffect(() => {
    if (
      pendingPdfFile &&
      data.mode === "workspace" &&
      !data.docId &&
      !busy &&
      !progress &&
      autoStartedFileRef.current !== pendingPdfFile
    ) {
      autoStartedFileRef.current = pendingPdfFile;
      void startProcessingFile(pendingPdfFile);
    }
  }, [busy, data.docId, data.mode, pendingPdfFile, progress, startProcessingFile]);

  const handleDelete = async (docId: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/lam/pdf/${encodeURIComponent(docId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete this PDF.");
      setSavedDocs((prev) => prev.filter((d) => d.id !== docId));
      onDeleteDocument?.(docId);
      setShowUploadPanel(true);
      toast.success("PDF and all extracted index data deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  if (showUploadPanel || data.mode === "workspace") {
    const currentStepIdx = progress ? stepOrder(progress.stage) : -1;

    return (
      <div className="space-y-3 rounded-2xl border border-cyan-300/20 bg-white/[0.04] p-3.5 text-white backdrop-blur-xl sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/15 text-cyan-200">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Learn with PDF</p>
              <p className="text-[11px] text-white/65">
                PDF only · Max {formatPdfBytes(MAX_LAM_PDF_BYTES)} · Native text + scanned OCR + page-cited tutor
              </p>
            </div>
          </div>
          {data.docId ? (
            <button
              type="button"
              onClick={() => setShowUploadPanel(false)}
              className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/10"
            >
              Back to PDF
            </button>
          ) : null}
        </div>

        {/* Drag and Drop Upload Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) void startProcessingFile(dropped);
          }}
          onClick={() => !busy && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
          }}
          aria-label="Upload a PDF document up to 25 MB"
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
            dragging
              ? "border-cyan-300 bg-cyan-400/15"
              : "border-white/20 bg-black/25 hover:border-cyan-300/50 hover:bg-white/[0.06]"
          } ${busy ? "pointer-events-none opacity-80" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            data-testid="learn-with-pdf-file-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void startProcessingFile(f);
              e.target.value = "";
            }}
          />
          <Upload className="mb-2 h-6 w-6 text-cyan-300" />
          <p className="text-xs font-semibold text-white">
            Drop your PDF here, or click to select from device
          </p>
          <p className="mt-1 text-[11px] text-white/60">
            Supports textbooks, scanned handwritten/photographed notes (OCR), mixed diagrams & problem sets · Max 25 MB
          </p>
        </div>

        {/* Pending attachment offer (if already attached in conversation) */}
        {selectedFile && !busy && !progress ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <FileText className="h-4 w-4 shrink-0 text-cyan-300" />
              <span className="truncate font-medium">{selectedFile.name}</span>
              <span className="shrink-0 text-white/60">({formatPdfBytes(selectedFile.size)})</span>
            </div>
            <button
              type="button"
              onClick={() => void startProcessingFile(selectedFile)}
              className="rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Upload & Study PDF
            </button>
          </div>
        ) : null}

        {/* Honest Real-Time Progress Pipeline */}
        {progress ? (
          <div className="space-y-2.5 rounded-xl border border-white/15 bg-black/35 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-cyan-200">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />}
                {progress.label}
              </span>
              {selectedFile ? (
                <span className="text-[11px] text-white/60">
                  {selectedFile.name} · {formatPdfBytes(selectedFile.size)}
                  {progress.pageCount > 0 ? ` · ${progress.pageCount}p` : ""}
                </span>
              ) : null}
            </div>

            {progress.stage === "uploading" ? (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all duration-200"
                  style={{ width: `${progress.uploadPercent}%` }}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {PIPELINE_STEPS.map((st, idx) => {
                const done = idx < currentStepIdx || progress.stage === "ready";
                const active = idx === currentStepIdx && progress.stage !== "ready";
                return (
                  <div
                    key={st.key}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10.5px] ${
                      done
                        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                        : active
                          ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100"
                          : "border-white/10 bg-white/[0.02] text-white/45"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                    ) : active ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                    ) : (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-white/25" />
                    )}
                    <span className="truncate">{st.label}</span>
                  </div>
                );
              })}
            </div>

            {busy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-300" />
              {error}
            </span>
            {selectedFile ? (
              <button
                type="button"
                onClick={() => void startProcessingFile(selectedFile)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-300/30 bg-rose-400/20 px-2.5 py-1 text-[11px] font-semibold hover:bg-rose-400/30"
              >
                <RefreshCw className="h-3 w-3" /> Retry safely
              </button>
            ) : null}
          </div>
        ) : null}

        {/* User's Saved Ready PDFs */}
        {savedDocs.length > 0 && !busy ? (
          <div className="space-y-1.5 border-t border-white/10 pt-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/55">
              Your Indexed PDFs
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {savedDocs.slice(0, 4).map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => onActivateDocument(doc.id, doc.title, true)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-cyan-200"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                    <span className="truncate font-medium">{doc.title}</span>
                    <span className="shrink-0 text-[10px] text-white/50">
                      {doc.pageCount}p
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(doc.id)}
                    aria-label={`Delete ${doc.title}`}
                    className="rounded p-1 text-white/45 hover:bg-rose-500/20 hover:text-rose-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-cyan-300/20 bg-white/[0.04] p-3.5 text-white backdrop-blur-xl sm:p-4">
      {/* Document Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/15 text-cyan-200">
            <BookOpen className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white sm:text-sm">
              {data.documentTitle || data.fileName || "PDF Tutor"}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-white/65">
              {data.subject ? <span>{data.subject}</span> : null}
              {data.pageCount ? <span>· {data.pageCount} {data.pageCount === 1 ? "page" : "pages"}</span> : null}
              {data.indexedChunkCount ? <span>· {data.indexedChunkCount} indexed {data.indexedChunkCount === 1 ? "section" : "sections"}</span> : null}
              {data.ocrPages?.length ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/15 px-1.5 py-0.5 text-amber-200">
                  <ScanText className="h-2.5 w-2.5" /> OCR ({data.ocrPages.length}p)
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {data.docId ? (
            <button
              type="button"
              onClick={() => setViewerPage(data.citations?.[0]?.page ?? 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/15 px-2.5 py-1 text-[11px] font-medium text-cyan-100 hover:bg-cyan-400/25"
            >
              <Eye className="h-3.5 w-3.5" /> Open PDF
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setError("");
              setProgress(null);
              setShowUploadPanel(true);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/10"
          >
            <Upload className="h-3 w-3" /> New PDF
          </button>
          {data.docId ? (
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete(data.docId!)}
              aria-label="Delete uploaded PDF"
              className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-white/60 hover:bg-rose-500/20 hover:text-rose-200 disabled:opacity-40"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Grounded Tutor Answer */}
      {data.answerMarkdown ? (
        <div className="prose prose-invert prose-sm max-w-none text-white/90">
          <ScholarAIContent content={data.answerMarkdown} />
        </div>
      ) : null}

      {/* Page-Level Clickable Citations */}
      {data.citations?.length && data.docId ? (
        <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/25 p-2.5">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-cyan-200/80">
            <Layers className="h-3 w-3" /> Source Page Citations (Click to view page)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.citations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setViewerPage(c.page)}
                title={c.snippet}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2 py-1 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-400/25"
              >
                <span>p. {c.page}</span>
                {c.section && !c.section.startsWith(`Page ${c.page}`) ? (
                  <span className="max-w-[140px] truncate text-white/60">· {c.section}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Collapsible Structured Document Intelligence */}
      {data.chapters?.length || data.keyConcepts?.length ? (
        <details className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-white/80 hover:text-white">
            Document Structure & Intelligence ({data.chapters?.length ?? 0} chapters · {data.keyConcepts?.length ?? 0} key concepts)
          </summary>
          <div className="mt-2.5 space-y-2 border-t border-white/10 pt-2 text-[11.5px] text-white/75">
            {data.chapters?.length ? (
              <div>
                <p className="font-semibold text-white/90">Chapters / Sections</p>
                <div className="mt-1 space-y-1">
                  {data.chapters.map((ch, idx) => (
                    <div key={`${ch.title}-${idx}`} className="flex items-start justify-between gap-2">
                      <span>{ch.title}: <span className="text-white/60">{ch.summary}</span></span>
                      {data.docId ? (
                        <button
                          type="button"
                          onClick={() => setViewerPage(ch.startPage)}
                          className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-cyan-200 hover:bg-cyan-400/20"
                        >
                          p. {ch.startPage}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {data.keyConcepts?.length ? (
              <div>
                <p className="font-semibold text-white/90">Key Concepts</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {data.keyConcepts.slice(0, 12).map((concept) => (
                    <span
                      key={concept}
                      className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10.5px]"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {/* Limitation / Grounding Notice */}
      {data.limitationNote || data.groundingNote ? (
        <div className="space-y-1 text-[10.5px] text-white/55">
          {data.limitationNote ? <p className="text-amber-200/80">Note: {data.limitationNote}</p> : null}
          {data.groundingNote ? <p>{data.groundingNote}</p> : null}
        </div>
      ) : null}

      {/* Interactive Next-Step Tutor Actions & Quick Prompt */}
      {data.docId ? (
        <div className="space-y-2 border-t border-white/10 pt-2.5">
          {data.suggestedActions?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {data.suggestedActions.map((actionText) => (
                <button
                  key={actionText}
                  type="button"
                  onClick={() => onAskDocumentQuestion(data.docId!, actionText)}
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white/85 transition hover:border-cyan-300/40 hover:bg-cyan-400/15"
                >
                  <Sparkles className="h-3 w-3 text-cyan-300" />
                  {actionText}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const q = customPrompt.trim();
              if (!q) return;
              setCustomPrompt("");
              onAskDocumentQuestion(data.docId!, q);
            }}
          >
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Ask about any page, formula, concept, notes, or quiz..."
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/35 px-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!customPrompt.trim()}
              className="rounded-xl bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40"
            >
              Ask Tutor
            </button>
          </form>
        </div>
      ) : null}

      {viewerPage !== null && data.docId ? (
        <PdfPageViewerModal
          docId={data.docId}
          title={data.documentTitle || data.fileName || "PDF Document"}
          pageCount={data.pageCount ?? 1}
          initialPage={viewerPage}
          onClose={() => setViewerPage(null)}
        />
      ) : null}
    </div>
  );
}
