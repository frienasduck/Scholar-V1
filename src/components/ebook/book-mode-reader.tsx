"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Expand,
  Eye,
  EyeOff,
  FileQuestion,
  List,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sun,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type BookModeChapter = {
  id: string;
  title: string;
  scanPage: number;
  textPage: number;
};
export type BookModeSearchPage = { page: number; title: string; text: string };
export type BookModeBookmark = {
  id: string;
  page: number;
  note?: string;
  createdAt: string;
};

type ReaderPreferences = {
  readerMode: "book" | "scroll";
  spread: "single" | "double";
  animation: boolean;
  speed: number;
  sound: boolean;
  brightness: number;
  theme: "light" | "sepia" | "dark" | "midnight";
  shadows: boolean;
  pageNumbers: boolean;
  autoHide: boolean;
  keepAwake: boolean;
};

const DEFAULT_PREFERENCES: ReaderPreferences = {
  readerMode: "book",
  spread: "single",
  animation: true,
  speed: 650,
  sound: false,
  brightness: 100,
  theme: "midnight",
  shadows: true,
  pageNumbers: true,
  autoHide: true,
  keepAwake: false,
};

type BookModeReaderProps = {
  open: boolean;
  title: string;
  subject: string;
  source: "scan" | "text";
  currentPage: number;
  totalPages: number;
  imageUrl: (page: number, source: "scan" | "text") => string;
  chapters: BookModeChapter[];
  searchPages: BookModeSearchPage[];
  bookmarks: BookModeBookmark[];
  questions?: ReactNode;
  onClose: () => void;
  onPageChange: (page: number) => void;
  onSourceChange?: (source: "scan" | "text") => void;
  onToggleBookmark: (page: number) => void;
  onBookmarkNote: (page: number, note: string) => void;
};

function loadPreferences(): ReaderPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    return {
      ...DEFAULT_PREFERENCES,
      ...JSON.parse(
        localStorage.getItem("scholar:ebook:reader-preferences:v1") ?? "{}",
      ),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function BookModeReader({
  open,
  title,
  subject,
  source,
  currentPage,
  totalPages,
  imageUrl,
  chapters,
  searchPages,
  bookmarks,
  questions,
  onClose,
  onPageChange,
  onSourceChange,
  onToggleBookmark,
  onBookmarkNote,
}: BookModeReaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const turnTimer = useRef<number | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const lastTap = useRef(0);
  const reducedMotion = useReducedMotion();
  const [preferences, setPreferences] =
    useState<ReaderPreferences>(loadPreferences);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState<"page" | "width">("page");
  const [controlsVisible, setControlsVisible] = useState(true);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [turning, setTurning] = useState<{
    target: number;
    direction: "forward" | "backward";
  } | null>(null);
  const [panel, setPanel] = useState<
    "toc" | "search" | "settings" | "bookmarks" | "questions" | null
  >(null);
  const [search, setSearch] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [jumpPage, setJumpPage] = useState(String(currentPage));
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );

  const updatePreference = <K extends keyof ReaderPreferences>(
    key: K,
    value: ReaderPreferences[K],
  ) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      localStorage.setItem(
        "scholar:ebook:reader-preferences:v1",
        JSON.stringify(next),
      );
      return next;
    });
  };

  const playPageSound = useCallback(() => {
    if (!preferences.sound || (reducedMotion && !preferences.sound)) return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const buffer = context.createBuffer(
        1,
        Math.floor(context.sampleRate * 0.12),
        context.sampleRate,
      );
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < channel.length; index += 1)
        channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
      const sourceNode = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = 0.025;
      sourceNode.buffer = buffer;
      sourceNode.connect(gain);
      gain.connect(context.destination);
      sourceNode.start();
      sourceNode.onended = () => void context.close();
    } catch {
      /* sound is an optional enhancement */
    }
  }, [preferences.sound, reducedMotion]);

  const goTo = useCallback(
    (page: number, animate = true) => {
      const target = Math.max(1, Math.min(totalPages, page));
      if (target === currentPage || turning) return;
      const direction = target > currentPage ? "forward" : "backward";
      const shouldAnimate =
        animate &&
        preferences.readerMode === "book" &&
        preferences.animation &&
        !reducedMotion;
      if (!shouldAnimate) {
        setJumpPage(String(target));
        onPageChange(target);
        playPageSound();
        return;
      }
      setTurning({ target, direction });
      playPageSound();
      turnTimer.current = window.setTimeout(() => {
        setJumpPage(String(target));
        onPageChange(target);
        setTurning(null);
      }, preferences.speed);
    },
    [
      currentPage,
      onPageChange,
      playPageSound,
      preferences.animation,
      preferences.readerMode,
      preferences.speed,
      reducedMotion,
      totalPages,
      turning,
    ],
  );

  const step = preferences.spread === "double" && viewportWidth >= 768 ? 2 : 1;
  const previous = useCallback(
    () => goTo(currentPage - step),
    [currentPage, goTo, step],
  );
  const next = useCallback(
    () => goTo(currentPage + step),
    [currentPage, goTo, step],
  );

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (preferences.autoHide && !panel)
      hideTimer.current = window.setTimeout(
        () => setControlsVisible(false),
        2800,
      );
  }, [panel, preferences.autoHide]);

  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const request = root?.requestFullscreen?.();
    if (request) void request.catch(() => undefined);
    const onFullscreen = () =>
      setNativeFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      if (document.fullscreenElement === rootRef.current)
        void document.exitFullscreen().catch(() => undefined);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (turnTimer.current) window.clearTimeout(turnTimer.current);
    };
  }, [open]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open || !preferences.keepAwake || !("wakeLock" in navigator)) return;
    let active = true;
    void (
      navigator as Navigator & {
        wakeLock: {
          request: (
            type: "screen",
          ) => Promise<{ release: () => Promise<void> }>;
        };
      }
    ).wakeLock
      .request("screen")
      .then((sentinel) => {
        if (active) wakeLock.current = sentinel;
        else void sentinel.release();
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (wakeLock.current) void wakeLock.current.release();
      wakeLock.current = null;
    };
  }, [open, preferences.keepAwake]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (
        event.key === "ArrowRight" ||
        (event.key === " " && !event.shiftKey)
      ) {
        event.preventDefault();
        next();
      } else if (
        event.key === "ArrowLeft" ||
        (event.key === " " && event.shiftKey)
      ) {
        event.preventDefault();
        previous();
      } else if (event.key === "Escape") {
        if (panel) setPanel(null);
        else onClose();
      } else if (event.key.toLowerCase() === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void rootRef.current?.requestFullscreen?.();
      } else if (event.key.toLowerCase() === "b") onToggleBookmark(currentPage);
      else if (event.key === "+" || event.key === "=")
        setZoom((value) => Math.min(2.5, value + 0.1));
      else if (event.key === "-")
        setZoom((value) => Math.max(0.6, value - 0.1));
      revealControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    currentPage,
    next,
    onClose,
    onToggleBookmark,
    open,
    panel,
    previous,
    revealControls,
  ]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query || source === "scan") return [];
    return searchPages.filter((page) =>
      page.text.toLowerCase().includes(query),
    );
  }, [search, searchPages, source]);

  const spreadPages = useMemo(() => {
    const basePage = turning?.target ?? currentPage;
    if (
      preferences.spread !== "double" ||
      viewportWidth < 768 ||
      basePage === 1
    )
      return [basePage];
    const left = basePage % 2 === 0 ? basePage : basePage - 1;
    return [left, left + 1].filter((page) => page >= 1 && page <= totalPages);
  }, [currentPage, preferences.spread, totalPages, turning, viewportWidth]);

  if (!open) return null;
  const bookmarked = bookmarks.some(
    (bookmark) => bookmark.page === currentPage,
  );
  const themeClass =
    preferences.theme === "light"
      ? "bg-slate-200 text-slate-950"
      : preferences.theme === "sepia"
        ? "bg-[#352c21] text-amber-50"
        : preferences.theme === "dark"
          ? "bg-[#111318] text-white"
          : "bg-[#05070d] text-white";
  const pageWidth = fit === "width" ? `${Math.max(60, zoom * 100)}vw` : "auto";

  return (
    <div
      ref={rootRef}
      className={cn(
        "fixed inset-0 z-[120] isolate overflow-hidden",
        themeClass,
      )}
      onMouseMove={revealControls}
      onTouchStart={revealControls}
      aria-label={`${title} immersive book reader`}
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(99,102,241,.12),transparent_52%)]"
        style={{ filter: `brightness(${preferences.brightness}%)` }}
      />

      <motion.header
        animate={{ opacity: controlsVisible || panel ? 1 : 0, y: controlsVisible || panel ? 0 : -14 }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
        className="book-mode-safe-top absolute inset-x-0 top-0 z-40 border-b border-white/10 bg-black/75 px-2 pb-2 backdrop-blur-xl sm:hidden"
      >
        <div className="flex h-11 min-w-0 items-center gap-1">
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Exit Book Mode" className="h-10 w-10 shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-xs font-bold">{title}</p>
            <p className="truncate text-[9px] text-white/45">{source === "scan" ? "Original scan" : "Clean text"}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={previous} disabled={currentPage <= 1} aria-label="Previous page" className="h-10 w-9 shrink-0"><ChevronLeft className="h-5 w-5" /></Button>
          <form onSubmit={(event) => { event.preventDefault(); goTo(Number(jumpPage), false); }} className="flex shrink-0 items-center gap-1">
            <Input aria-label="Jump to page" type="number" min={1} max={totalPages} value={jumpPage} onChange={(event) => setJumpPage(event.target.value)} className="h-9 w-12 rounded-xl border-white/15 bg-white/5 px-1 text-center text-base font-semibold" />
            <span className="text-[10px] text-white/45">/{totalPages}</span>
          </form>
          <Button size="icon" variant="ghost" onClick={next} disabled={currentPage >= totalPages} aria-label="Next page" className="h-10 w-9 shrink-0"><ChevronRight className="h-5 w-5" /></Button>
        </div>
        <div className="mt-1 grid grid-cols-8 gap-0.5 rounded-2xl border border-white/[.06] bg-white/[.025] p-1">
          {onSourceChange && <button onClick={() => onSourceChange(source === "scan" ? "text" : "scan")} className="grid h-10 place-items-center rounded-xl text-[9px] font-semibold text-white/75 hover:bg-white/10" aria-label={source === "scan" ? "Switch to clean text" : "Switch to original scan"}>{source === "scan" ? "TEXT" : "SCAN"}</button>}
          <Button size="icon" variant="ghost" onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))} aria-label="Zoom out" className="h-10 w-full"><Minus className="h-5 w-5" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setZoom((value) => Math.min(2.5, value + 0.1))} aria-label="Zoom in" className="h-10 w-full"><Plus className="h-5 w-5" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setPanel(panel === "toc" ? null : "toc")} aria-label="Open table of contents" className="h-10 w-full"><List className="h-5 w-5" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setPanel(panel === "search" ? null : "search")} aria-label="Search inside book" className="h-10 w-full"><Search className="h-5 w-5" /></Button>
          <Button size="icon" variant="ghost" onClick={() => onToggleBookmark(currentPage)} aria-label={bookmarked ? "Remove page bookmark" : "Bookmark page"} className="h-10 w-full">{bookmarked ? <BookmarkCheck className="h-5 w-5 text-amber-300" /> : <Bookmark className="h-5 w-5" />}</Button>
          {questions ? <Button size="icon" variant="ghost" onClick={() => setPanel(panel === "questions" ? null : "questions")} aria-label="Open page questions" className="h-10 w-full"><FileQuestion className="h-5 w-5" /></Button> : <span />}
          <Button size="icon" variant="ghost" onClick={() => setPanel(panel === "settings" ? null : "settings")} aria-label="Reading settings" className="h-10 w-full"><Settings2 className="h-5 w-5" /></Button>
        </div>
      </motion.header>

      <motion.header
        animate={{
          opacity: controlsVisible || panel ? 1 : 0,
          y: controlsVisible || panel ? 0 : -18,
        }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
        className="absolute inset-x-0 top-0 z-40 hidden flex-wrap items-center gap-1 border-b border-white/10 bg-black/65 px-4 py-2 backdrop-blur-xl sm:flex"
      >
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          aria-label="Exit Book Mode"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Exit
        </Button>
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate text-xs font-bold sm:text-sm">{title}</p>
          <p className="text-[10px] opacity-50">
            {subject} · {source === "scan" ? "Original Scan" : "Clean Text"}
          </p>
        </div>
        {onSourceChange && (
          <div className="hidden rounded-xl border border-white/10 bg-white/5 p-1 sm:flex">
            <button
              onClick={() => onSourceChange("scan")}
              className={cn(
                "rounded-lg px-2 py-1 text-xs",
                source === "scan" && "bg-white text-slate-950",
              )}
            >
              Scan
            </button>
            <button
              onClick={() => onSourceChange("text")}
              className={cn(
                "rounded-lg px-2 py-1 text-xs",
                source === "text" && "bg-indigo-500 text-white",
              )}
            >
              Clean
            </button>
          </div>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={previous}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            goTo(Number(jumpPage), false);
          }}
          className="flex items-center gap-1"
        >
          <Input
            aria-label="Jump to page"
            type="number"
            min={1}
            max={totalPages}
            value={jumpPage}
            onChange={(event) => setJumpPage(event.target.value)}
            className="h-8 w-14 border-white/10 bg-white/5 px-1 text-center text-xs"
          />
          <span className="text-[10px] opacity-50">/ {totalPages}</span>
        </form>
        <Button
          size="icon"
          variant="ghost"
          onClick={next}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="hidden w-10 text-center text-[10px] opacity-60 sm:block">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setZoom((value) => Math.min(2.5, value + 0.1))}
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setZoom(1);
            setFit("page");
          }}
          aria-label="Reset zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() =>
            setFit((value) => (value === "page" ? "width" : "page"))
          }
          aria-label={fit === "page" ? "Fit width" : "Fit page"}
        >
          <Expand className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() =>
            updatePreference(
              "spread",
              preferences.spread === "single" ? "double" : "single",
            )
          }
          aria-label="Toggle single or two-page spread"
        >
          <Columns2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onToggleBookmark(currentPage)}
          aria-label={bookmarked ? "Remove page bookmark" : "Bookmark page"}
        >
          {bookmarked ? (
            <BookmarkCheck className="h-4 w-4 text-amber-300" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setPanel(panel === "toc" ? null : "toc")}
          aria-label="Open table of contents"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setPanel(panel === "search" ? null : "search")}
          aria-label="Search inside book"
        >
          <Search className="h-4 w-4" />
        </Button>
        {questions && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPanel(panel === "questions" ? null : "questions")}
            aria-label="Open page questions"
          >
            <FileQuestion className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setPanel(panel === "bookmarks" ? null : "bookmarks")}
          aria-label="View page bookmarks"
        >
          <BookOpen className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setPanel(panel === "settings" ? null : "settings")}
          aria-label="Reading settings"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void rootRef.current?.requestFullscreen?.();
          }}
          aria-label={
            nativeFullscreen
              ? "Exit native fullscreen"
              : "Enter native fullscreen"
          }
        >
          {nativeFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </motion.header>

      <main className="relative z-10 flex h-full items-center justify-center overflow-auto px-3 pb-12 pt-28 sm:px-8 sm:pb-14 sm:pt-20">
        <div
          className="relative flex max-h-full max-w-full items-center justify-center gap-1 [perspective:1800px]"
          onPointerDown={(event) => {
            pointerStart.current = {
              x: event.clientX,
              y: event.clientY,
              time: Date.now(),
            };
          }}
          onPointerUp={(event) => {
            const start = pointerStart.current;
            pointerStart.current = null;
            if (!start) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.35) {
              if (dx < 0) next();
              else previous();
              return;
            }
            if (Date.now() - lastTap.current < 280) {
              setZoom((value) => (value > 1 ? 1 : 1.5));
              lastTap.current = 0;
              return;
            }
            lastTap.current = Date.now();
            const ratio = event.clientX / window.innerWidth;
            if (ratio < 0.3) previous();
            else if (ratio > 0.7) next();
            else setControlsVisible((value) => !value);
          }}
        >
          {spreadPages.map((pageNumber) => (
            <div
              key={`${source}-${pageNumber}`}
              className={cn(
                "relative max-h-[calc(100dvh-11rem)] overflow-hidden bg-white sm:max-h-[calc(100dvh-8rem)]",
                preferences.shadows && "shadow-[0_22px_70px_rgba(0,0,0,.55)]",
                spreadPages.length === 2 && pageNumber === spreadPages[0]
                  ? "rounded-l-lg"
                  : "rounded-r-lg",
              )}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center",
                width: pageWidth,
              }}
            >
              <img
                src={imageUrl(pageNumber, source)}
                alt={`${title} page ${pageNumber}`}
                draggable={false}
                className={cn(
                  "max-h-[calc(100dvh-11rem)] select-none object-contain sm:max-h-[calc(100dvh-8rem)]",
                  fit === "width" ? "h-auto w-full" : "h-full w-auto",
                )}
              />
              {preferences.pageNumbers && (
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white">
                  {pageNumber}
                </span>
              )}
            </div>
          ))}
          <AnimatePresence>
            {turning && (
              <motion.div
                key={`${source}-${currentPage}-${turning.target}`}
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
              >
                <motion.div
                  initial={{ rotateY: 0, opacity: 1 }}
                  animate={{
                    rotateY: turning.direction === "forward" ? -178 : 178,
                    opacity: 0.35,
                  }}
                  transition={{
                    duration: preferences.speed / 1000,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="relative [transform-style:preserve-3d]"
                  style={{
                    transformOrigin:
                      turning.direction === "forward"
                        ? "left center"
                        : "right center",
                  }}
                >
                  <img
                    src={imageUrl(currentPage, source)}
                    alt=""
                    className="max-h-[calc(100dvh-8rem)] w-auto rounded-lg bg-white shadow-[0_18px_60px_rgba(0,0,0,.7)]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/5 via-transparent to-black/55" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="hidden" aria-hidden="true">
            {[-2, -1, 1, 2]
              .map((offset) => currentPage + offset)
              .filter(
                (pageNumber) => pageNumber >= 1 && pageNumber <= totalPages,
              )
              .map((pageNumber) => (
                <img
                  key={`${source}-preload-${pageNumber}`}
                  src={imageUrl(pageNumber, source)}
                  alt=""
                />
              ))}
          </div>
        </div>
      </main>

      <motion.div
        animate={{
          opacity: controlsVisible || panel ? 1 : 0,
          y: controlsVisible || panel ? 0 : 12,
        }}
        className="absolute inset-x-0 bottom-0 z-40 bg-black/60 px-4 py-2 backdrop-blur-xl"
      >
        <div className="mx-auto h-1.5 max-w-4xl overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-indigo-400"
            style={{
              width: `${Math.round((currentPage / totalPages) * 100)}%`,
            }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-white/50">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              updatePreference(
                "readerMode",
                preferences.readerMode === "book" ? "scroll" : "book",
              )
            }
            className="rounded px-2 py-1 hover:bg-white/10"
          >
            {preferences.readerMode === "book" ? "Book Mode" : "Scroll Mode"}
          </button>
          <span>{Math.round((currentPage / totalPages) * 100)}%</span>
        </div>
      </motion.div>

      <AnimatePresence>
        {panel && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              duration: reducedMotion ? 0 : 0.28,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="absolute inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-white/10 bg-[#0a0d14]/98 p-4 pt-5 shadow-2xl sm:w-[390px]"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold">
                {panel === "toc"
                  ? "Table of contents"
                  : panel === "search"
                    ? "Search book"
                    : panel === "settings"
                      ? "Reading settings"
                      : panel === "bookmarks"
                        ? "Page bookmarks"
                        : "Questions"}
              </h2>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setPanel(null)}
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {panel === "toc" && (
              <div className="mt-4 space-y-2">
                {chapters.map((chapter) => {
                  const page =
                    source === "scan" ? chapter.scanPage : chapter.textPage;
                  return (
                    <button
                      key={chapter.id}
                      onClick={() => {
                        goTo(page, false);
                        if (window.innerWidth < 640) setPanel(null);
                      }}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left text-sm",
                        currentPage >= page
                          ? "border-indigo-400/30 bg-indigo-500/10"
                          : "border-white/10 bg-white/[.03]",
                      )}
                    >
                      <b>{chapter.title}</b>
                      <span className="mt-1 block text-xs text-white/45">
                        Page {page}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {panel === "search" && (
              <div className="mt-4">
                <Input
                  autoFocus
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSearchIndex(0);
                  }}
                  placeholder="Find words or phrases…"
                  className="border-white/10 bg-white/5"
                />
                {source === "scan" ? (
                  <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                    Search is unavailable for this scanned version. Switch to
                    the clean version to search.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 text-xs text-white/45">
                      {search
                        ? `${searchResults.length} matching pages`
                        : "Type to search the clean text."}
                    </p>
                    {searchResults.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="outline" disabled={searchIndex <= 0} onClick={() => { const nextIndex = Math.max(0, searchIndex - 1); setSearchIndex(nextIndex); goTo(searchResults[nextIndex].page, false); }} className="border-white/10 bg-white/5">Previous match</Button>
                        <Button size="sm" variant="outline" disabled={searchIndex >= searchResults.length - 1} onClick={() => { const nextIndex = Math.min(searchResults.length - 1, searchIndex + 1); setSearchIndex(nextIndex); goTo(searchResults[nextIndex].page, false); }} className="border-white/10 bg-white/5">Next match</Button>
                      </div>
                    )}
                    <div className="mt-3 space-y-2">
                      {searchResults.slice(0, 60).map((result, index) => (
                        <button
                          key={result.page}
                          onClick={() => {
                            setSearchIndex(index);
                            goTo(result.page, false);
                          }}
                          className={cn(
                            "w-full rounded-xl border p-3 text-left text-sm",
                            index === searchIndex
                              ? "border-indigo-400/40 bg-indigo-500/10"
                              : "border-white/10 bg-white/[.03]",
                          )}
                        >
                          <b>{result.title}</b>
                          <span className="mt-1 block text-xs text-white/45">
                            Clean page {result.page}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {panel === "bookmarks" && (
              <div className="mt-4 space-y-3">
                {bookmarks.length ? (
                  bookmarks.map((bookmark) => (
                    <div
                      key={bookmark.id}
                      className="rounded-xl border border-white/10 bg-white/[.03] p-3"
                    >
                      <button
                        onClick={() => goTo(bookmark.page, false)}
                        className="font-bold"
                      >
                        Page {bookmark.page}
                      </button>
                      <textarea
                        defaultValue={bookmark.note}
                        onBlur={(event) =>
                          onBookmarkNote(bookmark.page, event.target.value)
                        }
                        rows={2}
                        placeholder="Optional note…"
                        className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onToggleBookmark(bookmark.page)}
                        className="mt-1 text-rose-300"
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/40">
                    No bookmarked pages yet.
                  </p>
                )}
              </div>
            )}
            {panel === "questions" && <div className="mt-4">{questions}</div>}
            {panel === "settings" && (
              <div className="mt-4 space-y-4 text-sm">
                <SettingRow label="Page animation">
                  <input
                    type="checkbox"
                    checked={preferences.animation}
                    onChange={(event) =>
                      updatePreference("animation", event.target.checked)
                    }
                  />
                </SettingRow>
                <SettingRow label={`Animation speed (${preferences.speed} ms)`}>
                  <input
                    type="range"
                    min={300}
                    max={1000}
                    step={50}
                    value={preferences.speed}
                    onChange={(event) =>
                      updatePreference("speed", Number(event.target.value))
                    }
                  />
                </SettingRow>
                <SettingRow label="Page-turn sound">
                  {preferences.sound ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                  <input
                    type="checkbox"
                    checked={preferences.sound}
                    onChange={(event) =>
                      updatePreference("sound", event.target.checked)
                    }
                  />
                </SettingRow>
                <SettingRow label="Two-page spread">
                  <input
                    type="checkbox"
                    checked={preferences.spread === "double"}
                    onChange={(event) =>
                      updatePreference(
                        "spread",
                        event.target.checked ? "double" : "single",
                      )
                    }
                  />
                </SettingRow>
                <SettingRow
                  label={`Background brightness (${preferences.brightness}%)`}
                >
                  <input
                    type="range"
                    min={55}
                    max={120}
                    value={preferences.brightness}
                    onChange={(event) =>
                      updatePreference("brightness", Number(event.target.value))
                    }
                  />
                </SettingRow>
                <SettingRow label="Surrounding theme">
                  <select
                    value={preferences.theme}
                    onChange={(event) =>
                      updatePreference(
                        "theme",
                        event.target.value as ReaderPreferences["theme"],
                      )
                    }
                    className="rounded-lg border border-white/10 bg-[#151923] p-2"
                  >
                    <option value="light">Light</option>
                    <option value="sepia">Sepia</option>
                    <option value="dark">Dark</option>
                    <option value="midnight">Midnight</option>
                  </select>
                </SettingRow>
                <SettingRow label="Page shadows">
                  <input
                    type="checkbox"
                    checked={preferences.shadows}
                    onChange={(event) =>
                      updatePreference("shadows", event.target.checked)
                    }
                  />
                </SettingRow>
                <SettingRow label="Page numbers">
                  <input
                    type="checkbox"
                    checked={preferences.pageNumbers}
                    onChange={(event) =>
                      updatePreference("pageNumbers", event.target.checked)
                    }
                  />
                </SettingRow>
                <SettingRow label="Auto-hide controls">
                  <input
                    type="checkbox"
                    checked={preferences.autoHide}
                    onChange={(event) =>
                      updatePreference("autoHide", event.target.checked)
                    }
                  />
                </SettingRow>
                <SettingRow label="Keep screen awake">
                  <input
                    type="checkbox"
                    checked={preferences.keepAwake}
                    onChange={(event) =>
                      updatePreference("keepAwake", event.target.checked)
                    }
                  />
                </SettingRow>
                <div className="rounded-xl border border-white/10 p-3 text-xs text-white/50">
                  <p className="font-bold text-white">Keyboard</p>
                  <p className="mt-1">
                    ←/→ pages · Space next · Shift+Space previous · F fullscreen
                    · B bookmark · +/- zoom · Esc exit
                  </p>
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">
        {nativeFullscreen ? "Full screen book mode active" : "Book mode active"}
        . Page {currentPage} of {totalPages}.
      </span>
    </div>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
      <span>{label}</span>
      <span className="flex items-center gap-2">{children}</span>
    </label>
  );
}
