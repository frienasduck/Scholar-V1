"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Copy,
  Download,
  Heart,
  Loader2,
  MessageCircle,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import type { VideoState, WatchState } from "@/lib/lamtube/model";
import { VOICES } from "@/lib/lamtube/model";
import { clockLabel, contextAt } from "@/lib/lamtube/timeline";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { TimelinePlayer } from "./player";
import { videoRequest } from "@/lib/lamtube/client";
export function VideoDetail({
  video,
  preview,
  onUpdate,
  onRun,
  onDeleted,
  onError,
}: {
  video: VideoState;
  preview: boolean;
  onUpdate: (v: VideoState) => void;
  onRun: (id: string) => Promise<void>;
  onDeleted: () => void;
  onError: (error: string) => void;
}) {
  const [watch, setWatch] = useState<WatchState>(video.watch);
  const watchRef = useRef(watch);
  const [moment, setMoment] = useState(video.watch.position);
  const [question, setQuestion] = useState("");
  const player = useRef<{ seek: (time: number) => void }>(null);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [localError, setLocalError] = useState("");
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(video.title);
  const [playlist, setPlaylist] = useState("");
  const [voice, setVoice] = useState(video.settings.voice);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const pending = useRef<WatchState | null>(null);
  const posting = useRef(false);
  const flush = useCallback(
    async function sync() {
      if (preview || posting.current || !pending.current) return;
      posting.current = true;
      const next = pending.current;
      pending.current = null;
      setSaving(true);
      let success = false;
      try {
        const payload = {
          position: next.position,
          favorite: next.favorite,
          playlists: next.playlists,
          bookmarks: next.bookmarks,
          notes: next.notes,
        };
        const data = await videoRequest(`/api/lamtube/${video.id}`, {
          action: "edit",
          watch: payload,
        });
        success = true;
        if (alive.current) {
          onUpdate(data.video);
          setLocalError("");
        }
      } catch (e) {
        pending.current = pending.current ?? next;
        if (alive.current)
          setLocalError(
            `Your local edits are retained but not synced: ${
              (e as Error).message
            }`
          );
      } finally {
        posting.current = false;
        if (alive.current) setSaving(false);
      }
      if (success && pending.current && alive.current) void sync();
    },
    [preview, video.id, onUpdate]
  );
  const changeWatch = useCallback(
    (patch: Partial<WatchState>) => {
      const next = { ...watchRef.current, ...patch };
      watchRef.current = next;
      setWatch(next);
      if (preview) return;
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 700);
    },
    [preview, flush]
  );
  const updatePosition = useCallback(
    (position: number) => {
      if (alive.current) changeWatch({ position, lastWatched: Date.now() });
    },
    [changeWatch]
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);
  async function action(body: unknown) {
    if (preview) {
      setLocalError(
        "This is an authored silent preview. Sign in and create a lesson for account edits and live AI."
      );
      return;
    }
    setBusy(true);
    setLocalError("");
    try {
      const data = await videoRequest(`/api/lamtube/${video.id}`, body);
      onUpdate(data.video);
      if (data.insight) setAnswer(data.insight.text);
      return data.video as VideoState;
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function ask(mode: "ask" | "simpler" | "example" | "quiz" | "notes") {
    await action({ action: "ask", time: moment, mode, question });
  }
  async function remove() {
    if (
      !window.confirm(
        "Delete this private lesson and its audio? Completed generation usage is not refunded."
      )
    )
      return;
    try {
      await videoRequest(
        `/api/lamtube/${video.id}`,
        undefined,
        undefined,
        "DELETE"
      );
      onDeleted();
    } catch (e) {
      onError((e as Error).message);
    }
  }
  function downloadNotes() {
    const text = `# ${video.title}\n\n${
      watch.notes
    }\n\n## Bookmarks\n${watch.bookmarks
      .map((b) => `- ${clockLabel(b.time)} ${b.label}`)
      .join("\n")}\n\n## Transcript\n${video
      .timeline!.scenes.map(
        (s) => `### ${clockLabel(s.start)} ${s.title}\n${s.phrases.join(" ")}`
      )
      .join("\n\n")}`;
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "lamtube-study-notes.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const context = contextAt(video.timeline!, moment);
  const playerKey = `${video.id}:${video
    .timeline!.scenes.flatMap((s) => s.clips.map((c) => c.id))
    .join(":")}`;
  return (
    <div className="lt-watch-layout">
      <div className="lt-main-watch">
        <div className="lt-watch-title">
          <div>
            <span className="lt-eyebrow">
              {preview
                ? "AUTHORED PREVIEW · NO AUDIO"
                : "PRIVATE AI-GENERATED LESSON"}
            </span>
            <h2>{video.title}</h2>
            <p>
              {video.settings.chapters.map((c) => c.title).join(" · ")} ·{" "}
              {clockLabel(video.timeline!.duration)} ·{" "}
              {video.settings.style.replace(/-/g, " ")}
            </p>
          </div>
          <button
            className="lt-button"
            aria-pressed={watch.favorite}
            onClick={() => changeWatch({ favorite: !watch.favorite })}
          >
            <Heart size={17} fill={watch.favorite ? "currentColor" : "none"} />
            {watch.favorite ? "Saved" : "Favorite"}
          </button>
        </div>
        {preview && (
          <p className="lt-notice">
            This preview demonstrates deterministic motion, seeking and captions
            without calling AI or speech services. Generated account lessons use
            real, cached, seekable narration.
          </p>
        )}
        <TimelinePlayer
          key={playerKey}
          video={video}
          preview={preview}
          seekRef={player}
          onMoment={setMoment}
          onWatch={updatePosition}
          onBookmark={(time) =>
            changeWatch({
              bookmarks: [
                ...watchRef.current.bookmarks.slice(-99),
                { time, label: contextAt(video.timeline!, time).title },
              ],
            })
          }
        />
        <div className="lt-panel lt-notebook">
          <div className="lt-panel-title">
            <Pencil size={18} />
            <h3>Your lesson notes</h3>
            <span>
              {preview
                ? "Preview only"
                : saving
                ? "Saving…"
                : localError
                ? "Not synced"
                : "Account notes"}
            </span>
            <button className="lt-button" onClick={downloadNotes}>
              <Download size={15} /> Export
            </button>
          </div>
          <label className="lt-field">
            <span className="sr-only">Study notes</span>
            <textarea
              rows={5}
              value={watch.notes}
              maxLength={20000}
              onChange={(e) => changeWatch({ notes: e.target.value })}
              placeholder="Key ideas, formulas, questions to revisit…"
            />
          </label>
          {watch.bookmarks.length > 0 && (
            <div className="lt-bookmarks">
              {watch.bookmarks.map((b, i) => (
                <span key={`${b.time}:${i}`}>
                  <Bookmark size={13} />
                  <button
                    className="lt-bookmark-jump"
                    onClick={() => player.current?.seek(b.time)}
                  >
                    {clockLabel(b.time)} · {b.label}
                  </button>
                  <button
                    aria-label={`Remove bookmark at ${clockLabel(b.time)}`}
                    onClick={() =>
                      changeWatch({
                        bookmarks: watch.bookmarks.filter((_, n) => n !== i),
                      })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <aside className="lt-watch-aside">
        <section className="lt-panel lt-tutor">
          <div className="lt-panel-title">
            <MessageCircle size={20} />
            <div>
              <h3>Ask LAM at this moment</h3>
              <p>
                {clockLabel(moment)} · {context.title}
              </p>
            </div>
          </div>
          <blockquote>{context.narration}</blockquote>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask("ask");
            }}
          >
            <label className="sr-only" htmlFor="lt-doubt">
              Your doubt
            </label>
            <textarea
              id="lt-doubt"
              rows={3}
              maxLength={2000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Why does this happen?"
            />
            <button
              className="lt-button lt-primary"
              disabled={busy || !question.trim()}
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Ask about {clockLabel(moment)}
            </button>
          </form>
          <div className="lt-tutor-actions">
            {(["simpler", "example", "quiz", "notes"] as const).map((mode) => (
              <button
                className="lt-button"
                key={mode}
                disabled={busy}
                onClick={() => void ask(mode)}
              >
                {mode === "simpler"
                  ? "Explain simpler"
                  : mode === "example"
                  ? "Another example"
                  : mode === "quiz"
                  ? "Quiz me"
                  : "Make notes"}
              </button>
            ))}
          </div>
          {answer && (
            <div className="lt-tutor-answer">
              <ScholarAIContent content={answer} />
              <button
                className="lt-button"
                onClick={() =>
                  changeWatch({
                    notes: `${watchRef.current.notes}\n\n${clockLabel(
                      moment
                    )} · LAM\n${answer}`.slice(0, 20000),
                  })
                }
              >
                <PlusIcon /> Add to notes
              </button>
            </div>
          )}
          {!answer && video.insights.length > 0 && (
            <details>
              <summary>Saved tutor answers ({video.insights.length})</summary>
              {video.insights.map((a) => (
                <button
                  className="lt-saved-answer"
                  key={a.id}
                  onClick={() => setAnswer(a.text)}
                >
                  {clockLabel(a.time)} · {a.question || a.action}
                </button>
              ))}
            </details>
          )}
        </section>
        {localError && (
          <p className="lt-notice" role="alert">
            {localError}
            {pending.current && (
              <button className="lt-button" onClick={() => void flush()}>
                Retry note sync
              </button>
            )}
          </p>
        )}
        {!preview && (
          <details className="lt-panel lt-edit">
            <summary>Lesson settings & edits</summary>
            <label className="lt-field">
              Rename
              <input
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <button
              className="lt-button"
              disabled={busy || !title.trim()}
              onClick={() => void action({ action: "edit", title })}
            >
              Save title
            </button>
            <label className="lt-field">
              Playlist name
              <input
                value={playlist}
                maxLength={60}
                onChange={(e) => setPlaylist(e.target.value)}
                placeholder="e.g. Mechanics revision"
              />
            </label>
            <button
              className="lt-button"
              onClick={() => {
                if (playlist.trim()) {
                  changeWatch({
                    playlists: [
                      ...new Set([...watch.playlists, playlist.trim()]),
                    ].slice(0, 12),
                  });
                  setPlaylist("");
                }
              }}
            >
              Add to playlist
            </button>
            <div className="lt-playlist-tags">
              {watch.playlists.map((p) => (
                <button
                  key={p}
                  onClick={() =>
                    changeWatch({
                      playlists: watch.playlists.filter((x) => x !== p),
                    })
                  }
                >
                  {p} ×
                </button>
              ))}
            </div>
            <label className="lt-field">
              Narration voice
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value as typeof voice)}
              >
                {VOICES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <button
              className="lt-button"
              disabled={busy}
              onClick={async () => {
                const v = await action({ action: "voice", voice });
                if (v) void onRun(v.id);
              }}
            >
              Regenerate narration · no full credit
            </button>
            <button
              className="lt-button"
              disabled={busy}
              onClick={async () => {
                const instruction = window.prompt(
                  `Refine scene ${context.title}. What should change?`
                );
                if (instruction === null) return;
                const v = await action({
                  action: "scene",
                  scene: video.timeline!.scenes.findIndex(
                    (s) => s.title === context.title
                  ),
                  instruction,
                });
                if (v) void onRun(v.id);
              }}
            >
              Refine current scene · no full credit
            </button>
            <button
              className="lt-button"
              disabled={busy}
              onClick={() =>
                void action({
                  action: "duplicate",
                  requestKey: crypto.randomUUID(),
                })
              }
            >
              <Copy size={15} /> Duplicate settings as a draft
            </button>
            <button
              className="lt-button lt-danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2 size={15} /> Delete lesson
            </button>
            <p className="lt-footnote">
              Minor edits and cached playback do not use full-generation
              credits. Voice and scene regeneration remain rate- and
              storage-limited. To change the whole lesson, duplicate its
              settings and start a new generation.
            </p>
          </details>
        )}
      </aside>
    </div>
  );
}
function PlusIcon() {
  return <span aria-hidden="true">+</span>;
}
