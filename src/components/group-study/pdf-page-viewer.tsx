"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { errorMessage } from "./client";

export function PdfPageViewer({
  url,
  page,
  active,
}: {
  url: string;
  page: number;
  active: boolean;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(600);
  const [rendered, setRendered] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const value = entries[0]?.contentRect.width;
      if (value && value > 0) setWidth(Math.floor(value));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let disposed = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    setDocument(null);
    setError("");
    setRendered(0);
    void import("pdfjs-dist")
      .then(async (pdfjs) => {
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = `/api/group-study/pdf-worker?v=${pdfjs.version}`;
        task = pdfjs.getDocument({ url, withCredentials: true });
        const pdf = await task.promise;
        if (!disposed) setDocument(pdf);
      })
      .catch((cause) => {
        if (!disposed) setError(errorMessage(cause));
      });
    return () => {
      disposed = true;
      void task?.destroy().catch(() => undefined);
    };
  }, [url]);
  useEffect(() => {
    if (!document || !canvas.current || !active) return;
    let disposed = false,
      render: RenderTask | undefined;
    const element = canvas.current;
    void document
      .getPage(page)
      .then(async (pdfPage) => {
        if (disposed) return;
        const original = pdfPage.getViewport({ scale: 1 });
        const availableHeight = Math.min(740, Math.max(220, window.innerHeight * .64));
        const viewport = pdfPage.getViewport({ scale: Math.max(0.1, Math.min(width / original.width, availableHeight / original.height)) });
        const ratio = Math.min(devicePixelRatio || 1, 2);
        element.width = Math.floor(viewport.width * ratio);
        element.height = Math.floor(viewport.height * ratio);
        element.style.width = `${Math.floor(viewport.width)}px`;
        element.style.height = `${Math.floor(viewport.height)}px`;
        render = pdfPage.render({
          canvas: element,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        await render.promise;
        if (!disposed) {
          setRendered(page);
          setError("");
        }
      })
      .catch((cause) => {
        if (!disposed && cause?.name !== "RenderingCancelledException")
          setError(errorMessage(cause));
      });
    return () => {
      disposed = true;
      render?.cancel();
    };
  }, [document, page, width, active]);
  return (
    <div className="gs-pdf-canvas" ref={container}>
      {error ? (
        <p className="gs-note gs-error" role="alert">
          The PDF could not be rendered: {error}. You can open the original
          below.
        </p>
      ) : !document || rendered !== page ? (
        <p className="gs-muted" role="status">
          Rendering page {page}…
        </p>
      ) : null}
      <canvas
        ref={canvas}
        aria-label={`PDF page ${page}`}
        data-rendered-page={rendered}
      />
    </div>
  );
}
