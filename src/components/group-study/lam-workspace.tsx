"use client";
import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { groupRequest, errorMessage } from "./client";
import type { GroupRoomController } from "./use-room";
import { EmptyState } from "./room-ui";

export type MaterialContext = { resourceId: string; page?: number } | null;
export function LamWorkspace({
  controller,
  context,
  onContext,
}: {
  controller: GroupRoomController;
  context: MaterialContext;
  onContext: (value: MaterialContext) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("explain");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const s = controller.snapshot;
  if (!s) return null;
  const enabled = s.room.status === "active" && s.room.aiEnabled;
  const modes = [
    ["explain", "Explain"],
    ["summary", "Summarize"],
    ["socratic", "Quiz me"],
    ["teach", "Solve"],
    ["revision", "Key points"],
    ["formula", "Formulas"],
    ...(s.me.role === "host" ? [["quiz-us", "Create room quiz"]] : []),
  ];
  const ask = async () => {
    if (!prompt.trim() || busy || !enabled) return;
    setBusy(true);
    setError("");
    const guidance =
      mode === "teach"
        ? "Solve step by step, explaining assumptions and units. "
        : mode === "revision"
          ? "Give concise key points for revision. "
          : mode === "socratic"
            ? "Quiz me interactively: ask one question and wait for my answer. "
            : "";
    try {
      await groupRequest(
        `/api/group-study/rooms/${s.room.id}/ai`,
        {
          method: "POST",
          body: JSON.stringify({
            prompt: guidance + prompt.trim(),
            mode,
            ...(context ?? {}),
          }),
        },
        60_000,
      );
      setPrompt("");
      await controller.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const answers = s.messages.filter((m) => m.kind === "ai");
  return (
    <div className="gs-workspace-stack">
      <section className="gs-glass gs-card gs-lam-intro">
        <p className="gs-kicker">
          <Sparkles /> YOUR SHARED STUDY ASSISTANT
        </p>
        <h2>Learn it. Together.</h2>
        <p className="gs-muted">
          Grounded in your room topic, shared notes, discussion, and selected
          material. Answers are shared with everyone.
        </p>
        <div className="gs-mode-pills" aria-label="Study modes">
          {modes.map(([id, label]) => (
            <button
              className="gs-button"
              key={id}
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="gs-lam-context">
          <label className="gs-field">
            Material context
            <select
              className="gs-select"
              aria-label="LAM material context"
              value={context?.resourceId ?? ""}
              onChange={(e) =>
                onContext(
                  e.target.value
                    ? { resourceId: e.target.value, page: 1 }
                    : null,
                )
              }
            >
              <option value="">Room topic / host-selected material</option>
              {s.resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {context && (
            <label className="gs-field">
              Page
              <input
                className="gs-input"
                aria-label="LAM context page"
                type="number"
                min={1}
                max={
                  s.resources.find((r) => r.id === context.resourceId)
                    ?.pageCount ?? 1
                }
                value={context.page ?? 1}
                onChange={(e) =>
                  onContext({ ...context, page: Number(e.target.value) || 1 })
                }
              />
            </label>
          )}
        </div>
        <form
          className="gs-lam-capsule"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <textarea
            className="gs-textarea"
            rows={2}
            aria-label="Ask Group LAM"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={1800}
            disabled={!enabled || busy}
            placeholder={
              enabled
                ? "What should we understand next?"
                : "The host needs to start the session and enable LAM."
            }
          />
          <button
            className="gs-button gs-button-primary"
            disabled={!enabled || busy || !prompt.trim()}
          >
            <Send />
            {busy ? "Working…" : "Ask LAM"}
          </button>
        </form>
        {busy && (
          <p className="gs-muted" role="status">
            LAM is preparing a shared answer. You can keep using the other
            workspaces.
          </p>
        )}
        {error && (
          <p className="gs-note gs-error" role="alert">
            {error}
          </p>
        )}
      </section>
      {!answers.length ? (
        <section className="gs-glass">
          <EmptyState title="Make something click.">
            Ask for an explanation, a worked solution, or a summary of your
            shared PDF.
          </EmptyState>
        </section>
      ) : (
        answers
          .slice(-12)
          .reverse()
          .map((m) => (
            <article className="gs-glass gs-card gs-ai-output" key={m.id}>
              <div className="gs-message-meta">
                <strong>Group LAM</strong>
                <time>
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <ScholarAIContent content={m.body} />
            </article>
          ))
      )}
    </div>
  );
}
