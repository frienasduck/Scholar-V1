"use client";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { GroupRoomController } from "./use-room";
import { sameWorkspace } from "./workspace-memo";

function NotesWorkspaceView({
  controller,
}: {
  controller: GroupRoomController;
}) {
  const s = controller.snapshot;
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "saved" | "pending" | "saving" | "error" | "conflict"
  >("saved");
  const [copyStatus, setCopyStatus] = useState("");
  const base = useRef(0),
    saving = useRef(false),
    draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const editable = Boolean(s && (s.me.role === "host" || s.room.notesEditable));
  const save = useCallback(async () => {
    const snapshot = controller.getSnapshot(),
      text = draftRef.current;
    if (!snapshot || text === null || saving.current) return;
    if (text === snapshot.notes) {
      setDraft(null);
      setStatus("saved");
      return;
    }
    saving.current = true;
    setStatus("saving");
    const ok = await controller.action("notes", {
      text,
      revision: snapshot.revision,
      notesRevision: base.current,
    });
    saving.current = false;
    if (ok) {
      base.current =
        controller.getSnapshot()?.notesRevision ?? base.current + 1;
      if (draftRef.current === text) {
        setDraft(null);
        setStatus("saved");
      } else setStatus("pending");
    } else
      setStatus(
        controller.getSnapshot()?.notesRevision !== base.current
          ? "conflict"
          : "error",
      );
  }, [controller.action, controller.getSnapshot]);
  useEffect(() => {
    if (draft === null) base.current = s?.notesRevision ?? 0;
    // Incoming remote revisions must stop autosave without replacing a local draft.
    else if (
      !saving.current &&
      (s?.notesRevision ?? 0) !== base.current &&
      draft !== s?.notes
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("conflict");
    }
  }, [s?.notesRevision, s?.notes, draft]);
  useEffect(() => {
    if (!editable || status !== "pending") return;
    const timer = setTimeout(() => void save(), 900);
    return () => clearTimeout(timer);
  }, [draft, status, editable, save]);
  if (!s) return null;
  return (
    <section className="gs-glass gs-card">
      <div className="gs-section-head">
        <div>
          <h2>Your shared thinking space.</h2>
          <p className="gs-muted">
            Capture ideas together. Notes autosave after a short pause.
          </p>
        </div>
        <span className="gs-status" role="status">
          {!editable
            ? "Read-only"
            : status === "saved"
              ? "Saved"
              : status === "pending"
                ? "Unsaved changes"
                : status === "saving"
                  ? "Saving…"
                  : status === "conflict"
                    ? "Compare versions"
                    : "Save failed"}
        </span>
      </div>
      {status === "conflict" && (
        <div className="gs-notes-conflict">
          <h3>Someone else updated the notes.</h3>
          <p className="gs-muted">
            Your draft is preserved below. Compare it with the latest shared
            version, then merge deliberately.
          </p>
          <pre>{s.notes || "(Empty shared notes)"}</pre>
          <div className="gs-actions">
            <button
              className="gs-button"
              onClick={() => {
                setDraft(null);
                base.current = s.notesRevision ?? 0;
                setStatus("saved");
              }}
            >
              Use shared version
            </button>
            <button
              className="gs-button"
              onClick={() => {
                base.current = s.notesRevision ?? 0;
                setStatus("pending");
              }}
            >
              Save my merged draft
            </button>
          </div>
        </div>
      )}
      <textarea
        className="gs-textarea gs-notes-editor"
        aria-label="Shared study notes"
        value={draft ?? s.notes}
        readOnly={!editable}
        maxLength={20_000}
        placeholder="Capture the explanation that finally made sense…"
        onChange={(e) => {
          if (draft === null) base.current = s.notesRevision ?? 0;
          setDraft(e.target.value);
          if (status !== "conflict") setStatus("pending");
        }}
      />
      <div className="gs-actions">
        <button
          className="gs-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(draft ?? s.notes);
              setCopyStatus("Notes copied.");
            } catch {
              setCopyStatus("Copy unavailable. Select the notes manually.");
            }
          }}
        >
          Copy notes
        </button>
        {editable && (status === "error" || status === "pending") && (
          <button
            className="gs-button gs-button-primary"
            onClick={() => void save()}
          >
            Save now
          </button>
        )}
      </div>
      <p className="gs-fineprint" role="status">
        {copyStatus ||
          "Notes belong to this room. Copy anything you want to keep before it ends."}
      </p>
    </section>
  );
}
export const NotesWorkspace = memo(NotesWorkspaceView, (a, b) =>
  sameWorkspace(
    a.controller,
    b.controller,
    ["notes", "notesRevision"],
    ["notesEditable"],
  ),
);
