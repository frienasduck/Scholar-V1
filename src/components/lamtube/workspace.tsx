"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clapperboard,
  FolderOpen,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { getCurriculum } from "@/lib/curriculum-helper";
import {
  settingsSchema,
  generationProgress,
  STYLES,
  VOICES,
} from "@/lib/lamtube/model";
import type { VideoSettings, VideoState } from "@/lib/lamtube/model";
import { previewVideo } from "@/lib/lamtube/preview";
import { clockLabel } from "@/lib/lamtube/timeline";
import type { ResourceRecord } from "@/lib/resources/types";
import { ImportDialog } from "@/components/resources/resource-library";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { navigateTo } from "@/lib/nav-event";
import { useRouter } from "next/navigation";
import { VideoDetail } from "./video-detail";
import { videoRequest } from "@/lib/lamtube/client";
import "./lamtube.css";
type Usage = {
  used: number;
  limit: number | null;
  remaining: number | null;
  period: string;
  timezone: string;
};
export default function LamTubeWorkspace({ onBack }: { onBack: () => void }) {
  const scope = useStore((s) =>
    s.authed && !s.guestMode ? s.user.email || s.user.username : "guest"
  );
  const grade = useStore((s) => s.user.scholarClass);
  return <Workspace key={`${scope}:${grade}`} onBack={onBack} />;
}
function Workspace({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const authed = useStore((s) => s.authed && !s.guestMode);
  const grade = useStore((s) => s.user.scholarClass);
  const curriculum = useMemo(() => getCurriculum(grade), [grade]);
  const [mode, setMode] = useState<"create" | "library" | "watch">("create");
  const [settings, setSettings] = useState<VideoSettings>(() => {
    const subject = curriculum[0];
    const chapter = subject.chapters[0];
    return settingsSchema.parse({
      title: `${chapter.title} · a visual lesson`,
      grade,
      subjectId: subject.id,
      chapters: [{ id: chapter.id, title: chapter.title }],
    });
  });
  const [videos, setVideos] = useState<VideoState[]>([]);
  const [selected, setSelected] = useState<VideoState | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [resourceError, setResourceError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [requestKey, setRequestKey] = useState("");
  const runController = useRef<AbortController | null>(null);
  const subject = curriculum.find((s) => s.id === settings.subjectId)!;
  const update = <K extends keyof VideoSettings>(
    key: K,
    value: VideoSettings[K]
  ) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setRequestKey("");
  };
  const retain = useCallback((v: VideoState) => {
    setSelected(v);
    if (v.id !== "preview")
      setVideos((old) => [v, ...old.filter((x) => x.id !== v.id)]);
  }, []);
  const loadLibrary = useCallback(
    async (signal?: AbortSignal) => {
      if (!authed) return;
      setLoading(true);
      try {
        const data = await videoRequest("/api/lamtube", undefined, signal);
        setVideos(data.videos);
        setUsage(data.usage);
      } catch (e) {
        if (!signal?.aborted) setError((e as Error).message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [authed]
  );
  useEffect(() => {
    const controller = new AbortController();
    void loadLibrary(controller.signal);
    const id = new URLSearchParams(window.location.search).get("aiVideo");
    if (id) {
      setMode("watch");
      if (id === "preview") setSelected(previewVideo());
      else if (authed)
        videoRequest(
          `/api/lamtube/${encodeURIComponent(id)}`,
          undefined,
          controller.signal
        )
          .then((data) => setSelected(data.video))
          .catch((e) => {
            if (!controller.signal.aborted) setError(e.message);
          });
    }
    return () => {
      controller.abort();
      runController.current?.abort();
    };
  }, [authed, loadLibrary]);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      grade: String(grade),
      subjectId: settings.subjectId,
      limit: "24",
      page: "1",
      scope: "all",
    });
    const timer = setTimeout(
      () =>
        videoRequest(`/api/resources?${query}`, undefined, controller.signal)
          .then((data) => {
            setResources(data.resources);
            setResourceError(
              data.privateAvailable === false
                ? "The private resource index is unavailable. Built-in sources remain visible."
                : ""
            );
          })
          .catch((e) => {
            if (!controller.signal.aborted) setResourceError(e.message);
          }),
      100
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [grade, settings.subjectId, refresh]);
  function open(v: VideoState) {
    retain(v);
    setMode("watch");
    setError("");
    const url = new URL(window.location.href);
    url.searchParams.set("aiVideo", v.id);
    window.history.replaceState(window.history.state, "", url);
  }
  function newDraft() {
    runController.current?.abort();
    setRunning(false);
    setRequestKey("");
    setMode("create");
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("aiVideo");
    window.history.replaceState(window.history.state, "", url);
  }
  async function run(id: string) {
    if (runController.current && !runController.current.signal.aborted) return;
    const controller = new AbortController();
    runController.current = controller;
    setRunning(true);
    setError("");
    try {
      let current: VideoState;
      let first = true;
      do {
        const data = await videoRequest(
          `/api/lamtube/${id}`,
          { action: first ? "retry" : "step" },
          controller.signal
        );
        first = false;
        current = data.video;
        retain(current);
      } while (current.status === "generating" && !controller.signal.aborted);
      void loadLibrary();
    } catch (e) {
      if (!controller.signal.aborted) {
        setError((e as Error).message);
        try {
          const data = await videoRequest(`/api/lamtube/${id}`);
          retain(data.video);
        } catch {
          /* The visible error remains, not a fake empty lesson. */
        }
      }
    } finally {
      if (runController.current === controller) {
        runController.current = null;
        setRunning(false);
      }
    }
  }
  async function generate() {
    if (!authed) {
      router.push("/login?next=%2Flamtube");
      return;
    }
    const parsed = settingsSchema.safeParse(settings);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setConfirmOpen(false);
    setError("");
    setLoading(true);
    const key = requestKey || crypto.randomUUID();
    setRequestKey(key);
    try {
      const data =
        selected?.status === "draft" && !selected.outline
          ? await videoRequest(`/api/lamtube/${selected.id}`, {
              action: "edit",
              settings: parsed.data,
            })
          : await videoRequest("/api/lamtube", {
              settings: parsed.data,
              requestKey: key,
            });
      open(data.video);
      await run(data.video.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function cancel(v: VideoState) {
    runController.current?.abort();
    setRunning(false);
    try {
      const data = await videoRequest(`/api/lamtube/${v.id}`, {
        action: "cancel",
      });
      retain(data.video);
      void loadLibrary();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const allPlaylists = [...new Set(videos.flatMap((v) => v.watch.playlists))];
  const visible = videos.filter(
    (v) =>
      `${v.title} ${v.settings.chapters.map((c) => c.title).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "favorites" && v.watch.favorite) ||
        (filter === "continue" &&
          !!v.watch.lastWatched &&
          v.watch.position < (v.timeline?.duration ?? 0) - 1) ||
        filter === v.status ||
        (filter.startsWith("playlist:") &&
          v.watch.playlists.includes(filter.slice(9))))
  );
  return (
    <section className="lt-workspace">
      <header className="lt-top">
        <button className="lt-button lt-back" onClick={onBack}>
          <ArrowLeft size={16} /> All videos
        </button>
        <span className="lt-eyebrow">LAMTube / Visual lessons</span>
        <button
          className="lt-button"
          onClick={() => {
            runController.current?.abort();
            setRunning(false);
            setMode("library");
            void loadLibrary();
          }}
        >
          <FolderOpen size={17} /> My library
        </button>
      </header>
      {mode === "create" && (
        <div className="lt-hero">
          <div>
            <span className="lt-eyebrow">
              YOUR CHAPTERS, EXPLAINED IN MOTION
            </span>
            <h1>
              Don’t just read it.
              <br />
              <em>Watch it make sense.</em>
            </h1>
            <p>
              Your chapters become narrated, evolving visual lessons. Diagrams
              move, ideas connect, and every moment is yours to explore.
            </p>
          </div>
          <div className="lt-hero-visual" aria-hidden="true">
            <div className="lt-orbit" />
            <div className="lt-visual-law">
              F <span>=</span> m a
            </div>
            <div className="lt-visual-caption">
              CONCEPT → MOTION → UNDERSTANDING
            </div>
          </div>
        </div>
      )}
      <div className="lt-modebar">
        <div>
          <button
            className="lt-button"
            aria-pressed={mode === "create"}
            onClick={newDraft}
          >
            <Plus size={16} /> Create a lesson
          </button>
          <button
            className="lt-button"
            aria-pressed={mode === "library"}
            onClick={() => setMode("library")}
          >
            <BookOpen size={16} /> AI video library
          </button>
          <button className="lt-button" onClick={() => open(previewVideo())}>
            <Play size={16} /> Try the preview
          </button>
        </div>
        <span className="lt-quota">
          {!authed
            ? "10 videos / month when signed in · Plus unlimited"
            : usage
            ? usage.limit === null
              ? "Plus · unlimited full generations"
              : `${usage.remaining} of ${usage.limit} monthly generations available`
            : "Checking monthly allowance…"}
        </span>
      </div>
      {error && (
        <p className="lt-notice" role="alert">
          {error}{" "}
          <button
            className="lt-button"
            onClick={() => {
              setError("");
              void loadLibrary();
            }}
          >
            Refresh
          </button>
        </p>
      )}
      {mode === "create" && (
        <div className="lt-create-layout">
          <form
            className="lt-panel lt-generator"
            onSubmit={(e) => {
              e.preventDefault();
              if (authed) setConfirmOpen(true);
              else void generate();
            }}
          >
            <div className="lt-panel-title">
              <span className="lt-step-number">01</span>
              <div>
                <h2>What would you like to understand?</h2>
                <p>
                  Choose one chapter, a connected set, or narrow it to a
                  specific doubt.
                </p>
              </div>
            </div>
            <div className="lt-fields">
              <label>
                Lesson title
                <input
                  value={settings.title}
                  maxLength={120}
                  onChange={(e) => {
                    update("title", e.target.value);
                    setRequestKey("");
                  }}
                />
              </label>
              <label>
                Subject
                <select
                  value={settings.subjectId}
                  onChange={(e) => {
                    const s = curriculum.find((s) => s.id === e.target.value)!;
                    setSettings((old) => ({
                      ...old,
                      subjectId: s.id,
                      chapters: [
                        { id: s.chapters[0].id, title: s.chapters[0].title },
                      ],
                      title: `${s.chapters[0].title} · a visual lesson`,
                      resourceIds: [],
                    }));
                    setRequestKey("");
                  }}
                >
                  {curriculum.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="lt-chapters">
              <legend>Class {grade} · select up to six chapters</legend>
              {subject.chapters.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={settings.chapters.some((x) => x.id === c.id)}
                    disabled={
                      !settings.chapters.some((x) => x.id === c.id) &&
                      settings.chapters.length >= 6
                    }
                    onChange={(e) => {
                      update(
                        "chapters",
                        e.target.checked
                          ? [...settings.chapters, { id: c.id, title: c.title }]
                          : settings.chapters.filter((x) => x.id !== c.id)
                      );
                      setRequestKey("");
                    }}
                  />
                  <span>{c.title}</span>
                </label>
              ))}
            </fieldset>
            <label className="lt-field">
              Topic or doubt <span>Optional</span>
              <input
                value={settings.topic}
                maxLength={1000}
                onChange={(e) => update("topic", e.target.value)}
                placeholder="e.g. Why do heavier objects need more force?"
              />
            </label>
            <div className="lt-fields">
              <label>
                Target length
                <select
                  value={settings.minutes}
                  onChange={(e) =>
                    update(
                      "minutes",
                      Number(e.target.value) as VideoSettings["minutes"]
                    )
                  }
                >
                  {[1, 3, 5, 8, 12].map((m) => (
                    <option key={m} value={m}>
                      Around {m} minute{m > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Visual style
                <select
                  value={settings.style}
                  onChange={(e) =>
                    update("style", e.target.value as VideoSettings["style"])
                  }
                >
                  {STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/-/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <details className="lt-advanced">
              <summary>Advanced · voice, teaching, sources & playback</summary>
              <div className="lt-fields">
                <label>
                  Voice
                  <select
                    value={settings.voice}
                    onChange={(e) =>
                      update("voice", e.target.value as VideoSettings["voice"])
                    }
                  >
                    {VOICES.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Teaching depth
                  <select
                    value={settings.depth}
                    onChange={(e) =>
                      update("depth", e.target.value as VideoSettings["depth"])
                    }
                  >
                    {["beginner", "balanced", "advanced"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Purpose
                  <select
                    value={settings.purpose}
                    onChange={(e) =>
                      update(
                        "purpose",
                        e.target.value as VideoSettings["purpose"]
                      )
                    }
                  >
                    {["learn", "revise", "exam", "solve"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Teaching pace
                  <select
                    value={settings.pace}
                    onChange={(e) =>
                      update("pace", e.target.value as VideoSettings["pace"])
                    }
                  >
                    {["calm", "normal", "brisk"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Aspect ratio
                  <select
                    value={settings.aspect}
                    onChange={(e) =>
                      update(
                        "aspect",
                        e.target.value as VideoSettings["aspect"]
                      )
                    }
                  >
                    {["16:9", "9:16", "1:1"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="lt-field">
                Additional teaching instructions
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={settings.prompt}
                  onChange={(e) => update("prompt", e.target.value)}
                  placeholder="Use everyday examples, build intuition before formulas…"
                />
              </label>
              <div className="lt-toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.captions}
                    onChange={(e) => update("captions", e.target.checked)}
                  />{" "}
                  Captions on by default
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.interactive}
                    onChange={(e) => update("interactive", e.target.checked)}
                  />{" "}
                  Pause-and-check questions
                </label>
              </div>
              <div className="lt-panel-title">
                <Upload size={18} />
                <div>
                  <h3>Ground it in your materials</h3>
                  <p>
                    Choose up to four readable sources. Imports use Scholar’s
                    existing private library.
                  </p>
                </div>
                <button
                  className="lt-button"
                  type="button"
                  onClick={() =>
                    authed
                      ? setImportOpen(true)
                      : router.push("/login?next=%2Flamtube")
                  }
                >
                  <Plus size={16} /> Import
                </button>
              </div>
              {resourceError && <p className="lt-notice">{resourceError}</p>}
              <div className="lt-source-list">
                {resources.map((r) => (
                  <label key={r.id}>
                    <input
                      type="checkbox"
                      checked={settings.resourceIds.includes(r.id)}
                      disabled={
                        !r.canGenerateDerivatives ||
                        !["READY", "NEEDS_REVIEW"].includes(r.state) ||
                        !!r.sourceMetadata?.needsOcr ||
                        (!settings.resourceIds.includes(r.id) &&
                          settings.resourceIds.length >= 4)
                      }
                      onChange={(e) =>
                        update(
                          "resourceIds",
                          e.target.checked
                            ? [...settings.resourceIds, r.id]
                            : settings.resourceIds.filter((id) => id !== r.id)
                        )
                      }
                    />
                    <span>
                      {r.title}
                      <small>
                        {r.publisher} ·{" "}
                        {r.state.toLowerCase().replace(/_/g, " ")}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="lt-button"
                onClick={() => navigateTo("resources")}
              >
                Browse all source material <ArrowRight size={15} />
              </button>
              <label className="lt-source-only">
                <input
                  type="checkbox"
                  checked={settings.strictSources}
                  onChange={(e) => update("strictSources", e.target.checked)}
                />{" "}
                Teach only from the selected sources. Stop if the material is
                missing.
              </label>
            </details>
            <button
              className="lt-button lt-primary lt-generate"
              disabled={
                loading || running || (authed && usage?.remaining === 0)
              }
            >
              <Sparkles size={19} />
              {loading
                ? "Saving your draft…"
                : authed
                ? "Create my AI video"
                : "Sign in to create"}
              <ArrowRight size={18} />
            </button>
            <small className="lt-footnote">
              Target length is approximate. Audio determines the real duration.
              No ads in generated lessons; generation uses one monthly credit
              only after a playable lesson is ready.
            </small>
          </form>
          <aside className="lt-create-aside">
            <div className="lt-panel">
              <span className="lt-eyebrow">NOT A SLIDESHOW</span>
              <h2>A lesson that unfolds.</h2>
              <ol className="lt-process">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Understand the idea</strong>
                    <p>Chapter-aware planning and grounded teaching.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>See it happen</strong>
                    <p>Moving diagrams, drawn graphs and evolving equations.</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Explore any moment</strong>
                    <p>
                      Seek, slow down, ask LAM, bookmark and check your
                      understanding.
                    </p>
                  </div>
                </li>
              </ol>
              <button
                className="lt-button"
                onClick={() => open(previewVideo())}
              >
                <Play size={17} /> Explore a silent preview
              </button>
            </div>
            <div className="lt-panel lt-private">
              <Check size={20} />
              <h3>Private by default.</h3>
              <p>
                Your uploads, lessons, notes and narration stay in your account.
                No public sharing is enabled.
              </p>
            </div>
          </aside>
        </div>
      )}
      {mode === "library" && (
        <section className="lt-panel">
          <div className="lt-panel-title">
            <h2>Your visual learning library</h2>
            {loading && <Loader2 size={18} className="animate-spin" />}
          </div>
          <div className="lt-fields">
            <label>
              Find a lesson
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search titles and chapters…"
              />
            </label>
            <label>
              Collection
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {[
                  "all",
                  "continue",
                  "favorites",
                  "ready",
                  "generating",
                  "failed",
                  "draft",
                  "cancelled",
                ].map((f) => (
                  <option key={f}>{f}</option>
                ))}
                {allPlaylists.map((p) => (
                  <option key={p} value={`playlist:${p}`}>
                    Playlist: {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!authed ? (
            <div className="lt-empty">
              <BookOpen />
              <h3>Your lessons belong to you.</h3>
              <p>Sign in to generate, save and continue across devices.</p>
            </div>
          ) : (
            <div className="lt-library">
              {visible.map((v) => (
                <button
                  className="lt-video-card"
                  key={v.id}
                  onClick={() => open(v)}
                >
                  <div className="lt-thumbnail">
                    <Clapperboard size={34} />
                    <span>
                      {v.status === "ready"
                        ? clockLabel(v.timeline?.duration ?? 0)
                        : v.status}
                    </span>
                  </div>
                  <strong>{v.title}</strong>
                  <small>
                    {v.settings.chapters.map((c) => c.title).join(" · ")}
                  </small>
                  <div>
                    <span>
                      {v.watch.favorite ? "★ Favorite" : "Private AI video"}
                    </span>
                    <span>
                      {v.watch.position > 0
                        ? `${clockLabel(v.watch.position)} watched`
                        : ""}
                    </span>
                  </div>
                  {v.status === "generating" && (
                    <progress
                      value={generationProgress(v)}
                      max={100}
                      aria-label="Generation progress"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
          {authed && !loading && !visible.length && (
            <div className="lt-empty">
              <Clapperboard />
              <h3>No lessons in this collection yet.</h3>
              <p>Build a lesson around a chapter you want to understand.</p>
              <button className="lt-button" onClick={newDraft}>
                <Plus size={16} /> Create a lesson
              </button>
            </div>
          )}
          <p className="lt-footnote">
            Showing the 100 most recently updated lessons. Unlimited Plus
            generation remains subject to normal storage and abuse protection.
          </p>
        </section>
      )}
      {mode === "watch" && selected && (
        <>
          {selected.timeline && selected.status === "ready" ? (
            <VideoDetail
              key={`${selected.id}:${selected.timeline.duration}`}
              video={selected}
              preview={selected.id === "preview"}
              onUpdate={retain}
              onRun={run}
              onDeleted={() => {
                setSelected(null);
                setMode("library");
                void loadLibrary();
              }}
              onError={setError}
            />
          ) : (
            <section className="lt-panel lt-job" aria-live="polite">
              <Clapperboard size={35} />
              <h2>{selected.title}</h2>
              <p>
                {selected.status === "failed"
                  ? "Your work is safe. A stage needs attention."
                  : selected.status === "cancelled"
                  ? "Generation paused by you."
                  : "Building an actual visual lesson."}
              </p>
              <progress
                value={generationProgress(selected)}
                max={100}
                aria-label="Persisted generation progress"
              />
              <strong>
                {generationProgress(selected)}% · {selected.stage}
              </strong>
              <ol className="lt-stages">
                {[
                  "sources",
                  "outline",
                  "scenes",
                  "narration",
                  "assemble",
                  "complete",
                ].map((stage) => (
                  <li key={stage} data-active={selected.stage === stage}>
                    {stage}
                  </li>
                ))}
              </ol>
              <p>
                {selected.plans.length} scene plans saved ·{" "}
                {selected.clips.flat().length} narration phrases cached
              </p>
              {selected.error && (
                <p className="lt-notice" role="alert">
                  {selected.error}
                </p>
              )}
              <div className="lt-action-row">
                {selected.status === "draft" && !selected.outline && (
                  <button
                    className="lt-button"
                    disabled={running}
                    onClick={() => {
                      setSettings(selected.settings);
                      setMode("create");
                    }}
                  >
                    Edit draft settings
                  </button>
                )}
                <button
                  className="lt-button lt-primary"
                  disabled={running}
                  onClick={() => void run(selected.id)}
                >
                  {running ? (
                    <Loader2 className="animate-spin" size={17} />
                  ) : (
                    <Play size={17} />
                  )}{" "}
                  {running
                    ? "Working on the current stage…"
                    : "Resume saved generation"}
                </button>
                <button
                  className="lt-button"
                  onClick={() => void cancel(selected)}
                >
                  <X size={16} /> Cancel safely
                </button>
              </div>
              <small>
                No fabricated countdown. This progress reflects saved work. If
                you leave, return to resume; an optional configured worker can
                continue it in the background.
              </small>
            </section>
          )}
        </>
      )}
      <ImportDialog
        open={importOpen}
        grade={grade}
        onClose={() => setImportOpen(false)}
        onDone={(id) => {
          update(
            "resourceIds",
            [...settings.resourceIds.filter((x) => x !== id), id].slice(-4)
          );
          setImportOpen(false);
          setRefresh((n) => n + 1);
        }}
        onPdfDone={() => {
          setImportOpen(false);
          setRefresh((n) => n + 1);
        }}
      />
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="lt-confirm">
          <DialogTitle>Create “{settings.title}”?</DialogTitle>
          <DialogDescription>
            {settings.chapters.length} chapter
            {settings.chapters.length > 1 ? "s" : ""} · around{" "}
            {settings.minutes} minutes · {settings.voice}. A full ready lesson
            uses one credit. Failed or cancelled work does not. Audio and scene
            generation can take several minutes; saved stages are resumable.
          </DialogDescription>
          <button
            className="lt-button lt-primary"
            onClick={() => void generate()}
          >
            <Sparkles size={17} /> Start generation
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
