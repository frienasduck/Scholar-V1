"use client";
import { memo, useEffect, useRef, useState } from "react";
import { sameWorkspace } from "./workspace-memo";
import { Upload, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import type { GroupRoomController } from "./use-room";
import { groupRequest, errorMessage } from "./client";
import { EmptyState } from "./room-ui";
import { PdfPageViewer } from "./pdf-page-viewer";
import type { MaterialContext } from "./lam-workspace";

function MaterialsWorkspaceView({
  controller,
  active,
  askLam,
}: {
  controller: GroupRoomController;
  active: boolean;
  askLam: (context: MaterialContext) => void;
}) {
  const s = controller.snapshot;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [follow, setFollow] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const host = s?.me.role === "host";
  useEffect(() => {
    if (!s || host || !follow || !s.room.followHost || !s.room.activeResourceId)
      return;
    setSelectedId(s.room.activeResourceId);
    setPage(s.room.page);
  }, [
    s?.room.activeResourceId,
    s?.room.page,
    s?.room.followHost,
    host,
    follow,
    s,
  ]);
  const selected = s?.resources.find((r) => r.id === selectedId);
  const url =
    selected && s
      ? `/api/group-study/rooms/${s.room.id}/resources/${selected.id}`
      : "";
  useEffect(() => {
    setText("");
    if (selected?.mimeType !== "text/plain" || !url) return;
    const abort = new AbortController();
    void fetch(url, { credentials: "same-origin", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("This text material is no longer available.");
        setText(await response.text());
      })
      .catch((cause) => {
        if (!abort.signal.aborted) setError(errorMessage(cause));
      });
    return () => abort.abort();
  }, [url, selected?.mimeType]);
  if (!s) return null;
  const canUpload = s.room.pdfEnabled && (host || s.room.participantUploads);
  const upload = async (file: File) => {
    if (!canUpload || uploading) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Choose a file up to 3 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      await groupRequest(
        `/api/group-study/rooms/${s.room.id}/resources`,
        { method: "POST", body: form },
        60_000,
      );
      await controller.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };
  const analyze = async (id: string) => {
    setAnalyzing(true);
    setError("");
    try {
      await groupRequest(
        `/api/group-study/rooms/${s.room.id}/resources/${id}/analysis`,
        { method: "POST", body: JSON.stringify({ operation: "summary" }) },
        60_000,
      );
      await controller.refresh();
      askLam({ resourceId: id });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setAnalyzing(false);
    }
  };
  const turnPage = (next: number) => {
    setPage(Math.max(1, Math.min(selected?.pageCount ?? 1, next)));
    if (!host) setFollow(false);
  };
  return (
    <div className="gs-workspace-stack">
      <section className="gs-glass gs-card">
        <div className="gs-section-head">
          <div>
            <h2>One source. Shared understanding.</h2>
            <p className="gs-muted">
              PDF, PNG, JPEG, or text · Up to 3 MB per file / 80 PDF pages.
            </p>
          </div>
          {canUpload && (
            <button
              className="gs-button gs-button-primary"
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              <Upload />
              {uploading ? "Processing material…" : "Upload material"}
            </button>
          )}
        </div>
        <input
          type="file"
          ref={input}
          className="gs-hidden-input"
          accept="application/pdf,image/png,image/jpeg,text/plain,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        {error && (
          <p className="gs-note gs-error" role="alert">
            {error}
          </p>
        )}
        {!s.room.pdfEnabled ? (
          <EmptyState title="Materials are paused.">
            The host can enable shared materials in Host controls.
          </EmptyState>
        ) : !s.resources.length ? (
          <EmptyState title="No materials yet.">
            Upload a PDF so everyone can study from the same source.
            {!canUpload && (
              <p>
                Ask your host to add a material or enable participant uploads.
              </p>
            )}
          </EmptyState>
        ) : (
          <div className="gs-material-cards">
            {s.resources.map((r) => (
              <article
                className="gs-material-card"
                key={r.id}
                data-selected={selectedId === r.id}
              >
                <FileText aria-hidden="true" />
                <h3>{r.name}</h3>
                <p className="gs-fineprint">
                  {r.pageCount} {r.pageCount === 1 ? "page" : "pages"} ·{" "}
                  {(r.sizeBytes / 1024).toFixed(0)} KB
                  <br />
                  {r.uploadedBy
                    ? `Added by ${r.uploadedBy}`
                    : "Shared material"}
                  {r.createdAt
                    ? ` · ${new Date(r.createdAt).toLocaleDateString()}`
                    : ""}
                </p>
                <span className="gs-tiny-pill">
                  {r.analysisStatus === "ready"
                    ? "Text extracted · LAM ready"
                    : r.analysisStatus === "needs-ocr" ||
                        r.mimeType.startsWith("image/")
                      ? "No readable text · OCR needed"
                      : "Ready for text check"}
                </span>
                <div className="gs-actions">
                  <button
                    className="gs-button"
                    onClick={() => {
                      setFollow(false);
                      setSelectedId(r.id);
                      setPage(1);
                      setError("");
                    }}
                  >
                    Open
                  </button>
                  <button
                    className="gs-button"
                    disabled={
                      !s.room.aiEnabled ||
                      s.room.status !== "active" ||
                      analyzing
                    }
                    onClick={() => void analyze(r.id)}
                  >
                    Analyze
                  </button>
                  <button
                    className="gs-button"
                    onClick={() => askLam({ resourceId: r.id, page: 1 })}
                  >
                    Ask LAM
                  </button>
                  {host && (
                    <button
                      className="gs-button gs-button-danger"
                      onClick={() => {
                        if (window.confirm(`Remove ${r.name} for everyone?`))
                          void controller.action("resource", {
                            resourceId: r.id,
                            remove: true,
                          });
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {selected && s.room.pdfEnabled && (
        <section className="gs-glass gs-card gs-resource-preview">
          <div className="gs-section-head">
            <h2>{selected.name}</h2>
            {!host && (
              <button
                className="gs-button"
                aria-pressed={follow}
                onClick={() => setFollow(!follow)}
              >
                Follow Host: {follow ? "On" : "Off"}
              </button>
            )}
          </div>
          <div className="gs-material-controls">
            <button
              className="gs-button gs-button-icon"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => turnPage(page - 1)}
            >
              <ChevronLeft />
            </button>
            <label className="gs-inline">
              Page{" "}
              <input
                aria-label="Document page"
                className="gs-input"
                type="number"
                min={1}
                max={selected.pageCount}
                value={page}
                onChange={(e) => turnPage(Number(e.target.value) || 1)}
              />{" "}
              of {selected.pageCount}
            </label>
            <button
              className="gs-button gs-button-icon"
              aria-label="Next page"
              disabled={page >= selected.pageCount}
              onClick={() => turnPage(page + 1)}
            >
              <ChevronRight />
            </button>
            {host && (
              <button
                className="gs-button gs-button-primary"
                onClick={async () => {
                  if (
                    s.room.activeResourceId !== selected.id &&
                    !(await controller.action("resource", {
                      resourceId: selected.id,
                    }))
                  )
                    return;
                  await controller.action("page", { page });
                }}
              >
                Share this page
              </button>
            )}
            <button
              className="gs-button"
              onClick={() => askLam({ resourceId: selected.id, page })}
            >
              Ask LAM about page {page}
            </button>
          </div>
          {!host && !s.room.followHost && (
            <p className="gs-fineprint">
              Host page sharing is disabled. You can browse independently.
            </p>
          )}
          {selected.mimeType === "application/pdf" ? (
            <PdfPageViewer url={url} page={page} active={active} />
          ) : selected.mimeType.startsWith("image/") ? (
            <img src={url} alt={selected.name} />
          ) : (
            <pre>{text || "Loading text…"}</pre>
          )}
          <a
            className="gs-button"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open original
          </a>
        </section>
      )}
    </div>
  );
}
export const MaterialsWorkspace = memo(
  MaterialsWorkspaceView,
  (a, b) =>
    a.active === b.active &&
    a.askLam === b.askLam &&
    sameWorkspace(
      a.controller,
      b.controller,
      ["resources"],
      [
        "status",
        "pdfEnabled",
        "aiEnabled",
        "participantUploads",
        "activeResourceId",
        "page",
        "followHost",
      ],
      ["resource", "page"],
    ),
);
