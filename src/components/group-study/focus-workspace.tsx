"use client";
import { memo, useEffect, useState } from "react";
import { sameWorkspace } from "./workspace-memo";
import { Timer, Play, Pause, Square } from "lucide-react";
import type { GroupRoomController } from "./use-room";

function FocusWorkspaceView({
  controller,
  active,
}: {
  controller: GroupRoomController;
  active: boolean;
}) {
  const [now, setNow] = useState(Date.now);
  const [custom, setCustom] = useState(30);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const frame = requestAnimationFrame(tick);
    const id = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, [active]);
  const s = controller.snapshot;
  if (!s) return null;
  const f = s.focus,
    host = s.me.role === "host",
    enabled = s.room.status === "active";
  const remaining =
    f?.status === "running" && f.endsAt
      ? Math.min(
          f.durationSeconds,
          Math.max(0, Math.ceil((Date.parse(f.endsAt) - now) / 1000)),
        )
      : (f?.remainingSeconds ?? 0);
  const busy = controller.busyKeys.includes("focus:");
  return (
    <section className="gs-glass gs-card gs-focus-workspace">
      <p className="gs-kicker">
        <Timer /> ONE ROOM. ONE RHYTHM.
      </p>
      <h2>Focus session</h2>
      <p className="gs-muted">
        Settle into one task. Everyone in this room sees the same countdown.
      </p>
      <div className="gs-focus-orbit">
        <p className="gs-timer" role="timer" aria-live="off">
          {String(Math.floor(remaining / 60)).padStart(2, "0")}:
          {String(remaining % 60).padStart(2, "0")}
        </p>
        <span className="gs-status">
          {!f
            ? "Ready when you are"
            : remaining <= 0
              ? "Session complete"
              : f.status === "paused"
                ? "Paused"
                : "Time to concentrate"}
        </span>
      </div>
      {host ? (
        <>
          <div className="gs-actions">
            {f?.status === "running" && remaining > 0 && (
              <button
                className="gs-button"
                disabled={!enabled || busy}
                onClick={() =>
                  void controller.action("focus", { operation: "pause" })
                }
              >
                <Pause />
                Pause timer
              </button>
            )}
            {f?.status === "paused" && (
              <button
                className="gs-button gs-button-primary"
                disabled={!enabled || busy}
                onClick={() =>
                  void controller.action("focus", { operation: "resume" })
                }
              >
                <Play />
                Resume timer
              </button>
            )}
            {f && remaining > 0 && (
              <button
                className="gs-button"
                disabled={!enabled || busy}
                onClick={() =>
                  void controller.action("focus", { operation: "stop" })
                }
              >
                <Square />
                End timer
              </button>
            )}
          </div>
          <div className="gs-actions">
            {[10, 15, 25, 45].map((min) => (
              <button
                key={min}
                className="gs-button"
                disabled={!enabled || busy}
                onClick={() =>
                  void controller.action("focus", {
                    operation: "start",
                    durationSeconds: min * 60,
                  })
                }
              >
                {min} min
              </button>
            ))}
          </div>
          <form
            className="gs-inline gs-custom-focus"
            onSubmit={(e) => {
              e.preventDefault();
              void controller.action("focus", {
                operation: "start",
                durationSeconds: custom * 60,
              });
            }}
          >
            <label className="gs-inline">
              Custom minutes
              <input
                className="gs-input"
                aria-label="Custom focus minutes"
                type="number"
                min={1}
                max={120}
                step={1}
                value={custom}
                onChange={(e) => setCustom(Number(e.target.value))}
              />
            </label>
            <button
              className="gs-button gs-button-primary"
              disabled={
                !enabled ||
                busy ||
                !Number.isInteger(custom) ||
                custom < 1 ||
                custom > 120
              }
            >
              Start focus
            </button>
          </form>
          {!enabled && (
            <p className="gs-muted">
              Start or resume the room session to control focus.
            </p>
          )}
        </>
      ) : (
        <p className="gs-fineprint">
          The host controls the shared timer. Keep your attention on the task in
          front of you.
        </p>
      )}
    </section>
  );
}
export const FocusWorkspace = memo(FocusWorkspaceView, (a, b) => {
  const x = a.controller.snapshot?.focus,
    y = b.controller.snapshot?.focus;
  const focusSame =
    x === y ||
    Boolean(
      x &&
      y &&
      x.status === y.status &&
      x.endsAt === y.endsAt &&
      x.durationSeconds === y.durationSeconds &&
      (x.status === "running" || x.remainingSeconds === y.remainingSeconds),
    );
  return (
    a.active === b.active &&
    focusSame &&
    sameWorkspace(a.controller, b.controller, [], ["status"], ["focus"])
  );
});
