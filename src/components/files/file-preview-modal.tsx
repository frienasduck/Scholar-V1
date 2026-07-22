"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FileItem } from "@/lib/store";
import { askAI } from "@/lib/ai";
import { setLamPageContext } from "@/lib/lam-context";
import { Button } from "@/components/ui/button";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  File,
  FileAudio,
  FileCode2,
  FileImage,
  FileText,
  FileVideo,
  Fullscreen,
  Info,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
  Sparkles,
  ScanText,
  Send,
} from "lucide-react";

export type PreviewType =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "code"
  | "office"
  | "unsupported";

const IMAGE_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "bmp",
  "svg",
]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v", "ogv"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"]);
const TEXT_EXT = new Set(["txt", "md", "markdown", "csv", "tsv", "log"]);
const CODE_EXT = new Set([
  "json",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "scss",
  "html",
  "xml",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "sql",
  "yaml",
  "yml",
  "sh",
  "ps1",
]);
const OFFICE_EXT = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "rtf",
]);

const extension = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

export function detectPreviewType(
  file: Pick<FileItem, "name" | "type" | "mimeType">,
): PreviewType {
  const ext = extension(file.name);
  const mime = (file.mimeType || file.type || "").toLowerCase();
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || IMAGE_EXT.has(ext)) return "image";
  if (mime.startsWith("video/") || VIDEO_EXT.has(ext)) return "video";
  if (mime.startsWith("audio/") || AUDIO_EXT.has(ext)) return "audio";
  if (
    mime.includes("json") ||
    mime.includes("javascript") ||
    mime.includes("xml") ||
    CODE_EXT.has(ext)
  )
    return "code";
  if (mime.startsWith("text/") || TEXT_EXT.has(ext)) return "text";
  if (
    mime.includes("officedocument") ||
    mime.includes("msword") ||
    mime.includes("ms-excel") ||
    mime.includes("ms-powerpoint") ||
    OFFICE_EXT.has(ext)
  )
    return "office";
  return "unsupported";
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function safeSource(file: FileItem): string | null {
  const source = file.url || file.dataUrl;
  if (!source) return null;
  try {
    const parsed = new URL(source, window.location.href);
    if (["https:", "http:", "blob:", "data:"].includes(parsed.protocol))
      return source;
  } catch {
    /* invalid URL */
  }
  return null;
}

function download(source: string, name: string) {
  const anchor = document.createElement("a");
  anchor.href = source;
  anchor.download = name;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function FilePreviewModal({
  file,
  files,
  onClose,
  onPrevious,
  onNext,
}: {
  file: FileItem;
  files: FileItem[];
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [ocrText, setOcrText] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const type = useMemo(() => detectPreviewType(file), [file]);
  const source = useMemo(() => safeSource(file), [file]);
  const currentIndex = files.findIndex((item) => item.id === file.id);

  useEffect(() => {
    setLamPageContext({
      activeFileId: file.id,
      activeFileName: file.name,
      visibleText: (ocrText || text).slice(0, 8_000),
    });
    return () => setLamPageContext({});
  }, [file.id, file.name, ocrText, text]);

  useEffect(() => {
    setLoading(true);
    setError("");
    setZoom(1);
    setRotation(0);
    setPdfPage(1);
    setText("");
    setMessages([]);
    setAssistantInput("");
    setAssistantOpen(false);
    setOcrText("");
    if (!source) {
      setLoading(false);
      return;
    }
    if (type === "text" || type === "code") {
      fetch(source)
        .then((response) => {
          if (!response.ok)
            throw new Error(`File request failed (${response.status})`);
          return response.text();
        })
        .then((value) => {
          if (extension(file.name) === "json") {
            try {
              value = JSON.stringify(JSON.parse(value), null, 2);
            } catch {
              /* show original */
            }
          }
          setText(value);
          setLoading(false);
        })
        .catch(() => {
          setError(
            "This file could not be read. Its access link may have expired.",
          );
          setLoading(false);
        });
    } else if (type === "office" || type === "unsupported") setLoading(false);
  }, [file, source, type]);

  const close = useCallback(onClose, [onClose]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft" && !event.altKey) onPrevious();
      if (event.key === "ArrowRight" && !event.altKey) onNext();
    };
    const fullscreen = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", keydown);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, [close, onNext, onPrevious]);

  const toggleFullscreen = () =>
    document.fullscreenElement
      ? document.exitFullscreen()
      : containerRef.current?.requestFullscreen();
  const pdfSource = source
    ? `${source}${source.includes("#") ? "&" : "#"}page=${pdfPage}&zoom=${Math.round(zoom * 100)}`
    : "";
  const displayText = query
    ? text
        .split("\n")
        .map((line, index) =>
          line.toLowerCase().includes(query.toLowerCase()) ? `› ${line}` : line,
        )
        .join("\n")
    : text;

  async function runOcr() {
    if (!source || type !== "image") return;
    setOcrBusy(true);
    try {
      const blob = await fetch(source).then((response) => response.blob());
      const form = new FormData();
      form.append(
        "file",
        new globalThis.File([blob], file.name, {
          type: file.mimeType || blob.type,
        }),
      );
      const response = await fetch("/api/ocr", { method: "POST", body: form });
      const result = (await response.json()) as {
        ok?: boolean;
        text?: string;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.text)
        throw new Error(result.error || "OCR could not read this image.");
      setOcrText(result.text);
      window.dispatchEvent(
        new CustomEvent("scholar:open-lam", {
          detail: {
            prompt: "Explain and summarise the OCR text from this file.",
            context: {
              activeFileId: file.id,
              activeFileName: file.name,
              visibleText: result.text.slice(0, 8_000),
            },
          },
        }),
      );
    } catch (cause) {
      setOcrText(
        cause instanceof Error ? `OCR error: ${cause.message}` : "OCR failed.",
      );
    } finally {
      setOcrBusy(false);
    }
  }

  async function askFileAssistant() {
    const question = assistantInput.trim();
    if (!question || assistantBusy) return;
    const context = (ocrText || text).slice(0, 24_000);
    setMessages((current) => [...current, { role: "user", content: question }]);
    setAssistantInput("");
    setAssistantBusy(true);
    try {
      const answer = await askAI(
        `You are Scholar's private assistant for one uploaded file only. File: ${file.name}. MIME: ${file.mimeType || file.type}. Answer only from the supplied file text. If the answer is not present, say so clearly.\n\nFILE TEXT:\n${context || "No extractable text is available. Explain that OCR may be needed for an image, and do not invent file contents."}\n\nQUESTION:\n${question}`,
        "default",
        { history: messages.map((message) => ({ ...message })) },
      );
      setMessages((current) => [
        ...current,
        { role: "assistant", content: answer },
      ]);
    } catch (cause) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            cause instanceof Error
              ? cause.message
              : "The file assistant is unavailable.",
        },
      ]);
    } finally {
      setAssistantBusy(false);
    }
  }

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${file.name}`}
      className="fixed inset-0 z-[9999] flex flex-col bg-background/98 text-foreground backdrop-blur-xl"
    >
      <header className="sticky top-0 z-50 flex min-h-14 shrink-0 items-center gap-1 border-b border-border/70 bg-background px-2 shadow-sm sm:px-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          aria-label="Close file preview"
          className="shrink-0 font-semibold"
        >
          <X className="mr-1.5 h-4 w-4" /> Close
        </Button>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-sm font-semibold">{file.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {currentIndex + 1} of {files.length} · {formatFileSize(file.size)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevious}
          disabled={files.length < 2}
          aria-label="Previous file"
        >
          <ArrowLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={files.length < 2}
          aria-label="Next file"
        >
          <ArrowRight />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowInfo((value) => !value)}
          aria-label="File information"
        >
          <Info />
        </Button>
        {type === "image" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={runOcr}
            disabled={ocrBusy}
            aria-label="Read image with OCR"
          >
            <ScanText className="mr-1.5 h-4 w-4" />{" "}
            <span className="hidden sm:inline">
              {ocrBusy ? "Reading…" : "OCR"}
            </span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("scholar:open-lam", {
                detail: {
                  prompt: "",
                  context: {
                    activeFileId: file.id,
                    activeFileName: file.name,
                    visibleText: (ocrText || text).slice(0, 8_000),
                  },
                },
              }),
            )
          }
          aria-label="Ask LAM about this file"
        >
          <Sparkles className="mr-1.5 h-4 w-4 text-violet-400" />{" "}
          <span className="hidden sm:inline">Ask LAM</span>
        </Button>
        {source && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(source, "_blank", "noopener,noreferrer")}
            aria-label="Open in new tab"
          >
            <ExternalLink />
          </Button>
        )}
        {source && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => download(source, file.name)}
            aria-label="Download"
          >
            <Download />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          aria-label="Fullscreen"
        >
          {isFullscreen ? <Minimize2 /> : <Fullscreen />}
        </Button>
      </header>

      {(type === "image" || type === "pdf") && (
        <div className="flex min-h-12 shrink-0 items-center justify-center gap-1 border-b border-border/60 px-2">
          {type === "pdf" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
              >
                Previous page
              </Button>
              <label className="text-xs">
                Page{" "}
                <input
                  aria-label="PDF page"
                  type="number"
                  min={1}
                  value={pdfPage}
                  onChange={(e) =>
                    setPdfPage(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="mx-1 w-14 rounded border bg-background px-2 py-1"
                />
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPdfPage((p) => p + 1)}
              >
                Next page
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setZoom((v) => Math.max(0.25, v - 0.25))}
            aria-label="Zoom out"
          >
            <ZoomOut />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setZoom((v) => Math.min(4, v + 0.25))}
            aria-label="Zoom in"
          >
            <ZoomIn />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setZoom(1)}>
            Fit width
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRotation((v) => (v + 90) % 360)}
            aria-label="Rotate"
          >
            <RotateCw />
          </Button>
        </div>
      )}

      <main className="relative min-h-0 flex-1 overflow-auto bg-black/20 p-2 sm:p-5">
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center">
            <div className="flex items-center gap-2 rounded-full bg-background px-4 py-2 shadow">
              <Loader2 className="animate-spin" /> Loading preview…
            </div>
          </div>
        )}
        {error && (
          <Fallback
            icon={File}
            title="Preview failed"
            detail={error}
            file={file}
            source={source}
          />
        )}
        {!error && !source && (
          <Fallback
            icon={File}
            title="Preview unavailable"
            detail="This older file has no stored content. Upload it again to enable preview."
            file={file}
            source={null}
          />
        )}
        {!error && source && type === "image" && (
          <div className="grid min-h-full place-items-center">
            <img
              src={source}
              alt={file.name}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError("The image could not be loaded.");
              }}
              className="max-h-full max-w-full origin-center object-contain transition-transform"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            />
          </div>
        )}
        {!error && source && type === "pdf" && (
          <iframe
            key={pdfSource}
            src={pdfSource}
            title={file.name}
            onLoad={() => setLoading(false)}
            className="mx-auto h-full min-h-[70vh] w-full max-w-6xl rounded-lg bg-white"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        )}
        {!error && source && type === "video" && (
          <div className="grid min-h-full place-items-center">
            <video
              src={source}
              controls
              playsInline
              onLoadedData={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError("The video format is not supported by this browser.");
              }}
              className="max-h-full max-w-full rounded-xl"
            />
          </div>
        )}
        {!error && source && type === "audio" && (
          <div className="grid min-h-full place-items-center">
            <div className="w-full max-w-xl rounded-3xl border bg-card p-8 text-center shadow-xl">
              <FileAudio className="mx-auto mb-5 h-16 w-16 text-amber-400" />
              <p className="mb-6 font-medium">{file.name}</p>
              <audio
                src={source}
                controls
                onLoadedData={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(
                    "The audio format is not supported by this browser.",
                  );
                }}
                className="w-full"
              />
            </div>
          </div>
        )}
        {!error && source && (type === "text" || type === "code") && (
          <div className="mx-auto flex min-h-full max-w-6xl flex-col overflow-hidden rounded-xl border bg-[#0c1018] shadow-xl">
            <div className="flex items-center gap-2 border-b border-white/10 p-2">
              <Search className="h-4 w-4 text-white/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find in file"
                className="w-full bg-transparent text-sm text-white outline-none"
              />
            </div>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-slate-200 sm:p-6 sm:text-sm">
              <code>{displayText}</code>
            </pre>
          </div>
        )}
        {!error && source && (type === "office" || type === "unsupported") && (
          <Fallback
            icon={type === "office" ? FileText : File}
            title={
              type === "office"
                ? "Office preview is not available in this browser"
                : "No safe browser preview for this file type"
            }
            detail="You can open the original in a compatible app or download it. Scholar will never execute uploaded files."
            file={file}
            source={source}
          />
        )}
      </main>

      {showInfo && (
        <aside className="absolute right-3 top-16 z-20 w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">File information</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowInfo(false)}
            >
              <X />
            </Button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="break-all text-right">{file.name}</dd>
            <dt className="text-muted-foreground">Type</dt>
            <dd className="text-right">
              {file.mimeType || file.type || "Unknown"}
            </dd>
            <dt className="text-muted-foreground">Size</dt>
            <dd className="text-right">{formatFileSize(file.size)}</dd>
            <dt className="text-muted-foreground">Uploaded</dt>
            <dd className="text-right">
              {new Date(file.uploadedAt).toLocaleString()}
            </dd>
          </dl>
        </aside>
      )}
      {assistantOpen && (
        <aside
          aria-label={`AI assistant for ${file.name}`}
          className="absolute bottom-3 right-3 top-16 z-30 flex w-[calc(100%-1.5rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-violet-400/25 bg-card/95 shadow-2xl backdrop-blur-2xl"
        >
          <div className="flex items-center gap-3 border-b p-4">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/15">
              <Sparkles className="h-5 w-5 text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">File AI</h2>
              <p className="truncate text-xs text-muted-foreground">
                Grounded only in {file.name}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAssistantOpen(false)}
              aria-label="Close file AI"
            >
              <X />
            </Button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {ocrText && (
              <div className="rounded-2xl border bg-muted/40 p-3">
                <p className="mb-2 text-xs font-semibold text-violet-400">
                  OCR reader
                </p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5">
                  {ocrText}
                </pre>
              </div>
            )}
            {messages.length === 0 && (
              <div className="rounded-2xl bg-violet-500/10 p-4 text-sm text-muted-foreground">
                Ask about this file. For photographed notes or scanned images,
                run OCR first so I can read the text.
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-2xl p-3 text-sm leading-6 ${message.role === "user" ? "ml-8 bg-violet-500 text-white" : "mr-8 bg-muted"}`}
              >
                {message.role === "assistant" ? (
                  <ScholarAIContent content={message.content} mode="compact" streaming={assistantBusy && index === messages.length - 1} />
                ) : message.content}
              </div>
            ))}
            {assistantBusy && (
              <div className="text-sm text-muted-foreground">
                Reading the file…
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t p-3">
            <textarea
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void askFileAssistant();
                }
              }}
              placeholder="Ask about this file…"
              aria-label="Ask File AI"
              className="min-h-11 flex-1 resize-none rounded-2xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
            />
            <Button
              size="icon"
              className="h-11 w-11 rounded-2xl"
              onClick={() => void askFileAssistant()}
              disabled={!assistantInput.trim() || assistantBusy}
              aria-label="Send to File AI"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </aside>
      )}
    </div>,
    document.body,
  );
}

function Fallback({
  icon: Icon,
  title,
  detail,
  file,
  source,
}: {
  icon: typeof FileImage;
  title: string;
  detail: string;
  file: FileItem;
  source: string | null;
}) {
  return (
    <div className="grid min-h-full place-items-center">
      <div className="max-w-lg rounded-3xl border bg-card p-8 text-center shadow-xl">
        <Icon className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        <div className="mt-5 text-xs text-muted-foreground">
          {file.name} · {formatFileSize(file.size)}
        </div>
        {source && (
          <div className="mt-6 flex justify-center gap-2">
            <Button
              onClick={() =>
                window.open(source, "_blank", "noopener,noreferrer")
              }
            >
              <ExternalLink className="mr-2 h-4 w-4" /> Open
            </Button>
            <Button
              variant="outline"
              onClick={() => download(source, file.name)}
            >
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
