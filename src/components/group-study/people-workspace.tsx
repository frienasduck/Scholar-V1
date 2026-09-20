"use client";
import { useState } from "react";
import { Hand, Lock, Unlock, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { GroupRoomController } from "./use-room";
import { JoinRequests, Person, type Workspace } from "./room-ui";
import {
  GROUP_FEATURES,
  type FeatureAccess,
  type GroupFeatureId,
} from "@/lib/group-study/features";

export function PeopleWorkspace({
  controller,
}: {
  controller: GroupRoomController;
}) {
  const [removeId, setRemoveId] = useState<string | null>(null);
  const s = controller.snapshot;
  if (!s) return null;
  const host = s.me.role === "host";
  return (
    <div className="gs-workspace-stack">
      <JoinRequests controller={controller} />
      <section className="gs-glass gs-card">
        <div className="gs-section-head">
          <div>
            <h2>Good company. Better learning.</h2>
            <p className="gs-muted">
              {s.participants.filter((p) => p.status === "approved").length}{" "}
              studying · Capacity {s.room.maxParticipants}
            </p>
          </div>
          {!host && (
            <button
              className="gs-button"
              disabled={controller.busyKeys.includes("hand:")}
              aria-pressed={s.me.handRaised}
              onClick={() =>
                void controller.action("hand", { raised: !s.me.handRaised })
              }
            >
              <Hand />
              {s.me.handRaised ? "Lower hand" : "Raise hand"}
            </button>
          )}
        </div>
        <div className="gs-members">
          {s.participants
            .filter((p) => p.status === "approved")
            .map((p) => (
              <article className="gs-glass gs-person-card" key={p.id}>
                <Person person={p} />
                <p className="gs-fineprint">
                  {p.id === s.me.id ? "You · " : ""}
                  {p.joinedAt
                    ? `Joined ${new Date(p.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : "Room member"}
                </p>
                <div className="gs-person-flags">
                  <span>{p.followHost ? "Following host" : "Exploring"}</span>
                  {p.voiceJoined && <span>In voice</span>}
                  {p.cameraActive && <span>Camera on</span>}
                  {p.handRaised && <span>Hand raised</span>}
                </div>
                {host && p.role !== "host" && (
                  <div className="gs-actions">
                    {p.handRaised && (
                      <button
                        className="gs-button"
                        disabled={controller.busyKeys.includes(
                          `clear-hand:${p.id}`,
                        )}
                        onClick={() =>
                          void controller.action("clear-hand", {
                            participantId: p.id,
                          })
                        }
                      >
                        Clear hand
                      </button>
                    )}
                    <button
                      className="gs-button"
                      disabled={controller.busyKeys.includes(`mute:${p.id}`)}
                      onClick={() =>
                        void controller.action("mute", {
                          participantId: p.id,
                          muted: !p.chatMuted,
                        })
                      }
                    >
                      {p.chatMuted ? "Unmute chat" : "Mute chat"}
                    </button>
                    <button
                      className="gs-button"
                      onClick={() =>
                        void controller.action("media-policy", {
                          participantId: p.id,
                          voiceAllowed: !p.voiceAllowed,
                        })
                      }
                    >
                      {p.voiceAllowed ? "Disable voice" : "Allow voice"}
                    </button>
                    <button
                      className="gs-button"
                      onClick={() =>
                        void controller.action("media-policy", {
                          participantId: p.id,
                          cameraAllowed: !p.cameraAllowed,
                        })
                      }
                    >
                      {p.cameraAllowed ? "Disable camera" : "Allow camera"}
                    </button>
                    <button
                      className="gs-button gs-button-danger"
                      onClick={() => setRemoveId(p.id)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </article>
            ))}
        </div>
      </section>
      <Dialog
        open={Boolean(removeId)}
        onOpenChange={(value) => {
          if (!value) setRemoveId(null);
        }}
      >
        <DialogContent className="gs-dialog">
          <DialogTitle>Remove this participant?</DialogTitle>
          <DialogDescription>
            They will lose access to this room immediately.
          </DialogDescription>
          <button
            className="gs-button gs-button-danger"
            onClick={async () => {
              if (
                await controller.action("remove", { participantId: removeId })
              )
                setRemoveId(null);
            }}
          >
            Confirm removal
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function HostWorkspace({
  controller,
  navigate,
}: {
  controller: GroupRoomController;
  navigate: (id: Workspace) => void;
}) {
  const s = controller.snapshot;
  const [confirm, setConfirm] = useState<
    "end" | "clear-chat" | "regenerate-code" | null
  >(null);
  const [announcement, setAnnouncement] = useState("");
  const [details, setDetails] = useState(() => ({
    name: s?.room.name ?? "",
    subject: s?.room.subject ?? "",
    topic: s?.room.topic ?? "",
  }));
  const [pathLabel, setPathLabel] = useState("");
  const [pathFeature, setPathFeature] = useState<GroupFeatureId>("materials");
  if (!s || s.me.role !== "host") return null;
  const settings = [
    [
      "requireApproval",
      "Approve new participants",
      "Every new arrival waits for your approval.",
    ],
    ["aiEnabled", "Group LAM", "Shared answers grounded in the room context."],
    ["chatEnabled", "Study chat", "Let everyone contribute to the discussion."],
    [
      "pdfEnabled",
      "Shared materials",
      "Allow approved members to read room documents.",
    ],
    [
      "participantUploads",
      "Participant uploads",
      "Let members add their own study materials.",
    ],
    [
      "notesEditable",
      "Collaborative notes",
      "Let participants edit the shared notes.",
    ],
    [
      "followHost",
      "Host page sharing",
      "Offer page synchronization; members can opt out.",
    ],
  ] as const;
  return (
    <div className="gs-workspace-stack">
      <section className="gs-glass gs-card">
        <p className="gs-kicker">SESSION CONTROL CENTER</p>
        <h2>One room. One shared direction.</h2>
        <form
          className="gs-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await controller.action("session-details", details);
          }}
        >
          <label className="gs-field">
            Room name
            <input
              className="gs-input"
              value={details.name}
              onChange={(event) =>
                setDetails((value) => ({ ...value, name: event.target.value }))
              }
              maxLength={80}
            />
          </label>
          <div className="gs-form-grid">
            <label className="gs-field">
              Subject
              <input
                className="gs-input"
                value={details.subject}
                onChange={(event) =>
                  setDetails((value) => ({
                    ...value,
                    subject: event.target.value,
                  }))
                }
                maxLength={80}
              />
            </label>
            <label className="gs-field">
              Topic
              <input
                className="gs-input"
                value={details.topic}
                onChange={(event) =>
                  setDetails((value) => ({
                    ...value,
                    topic: event.target.value,
                  }))
                }
                maxLength={160}
              />
            </label>
          </div>
          <button className="gs-button">Save session details</button>
        </form>
        <div
          className="gs-mode-picker"
          role="radiogroup"
          aria-label="Session navigation mode"
        >
          {(
            [
              ["follow", "Follow Host", "Followers move with you."],
              ["guided", "Guided Freedom", "Members choose enabled sections."],
              ["open", "Open Session", "Broad independent movement."],
            ] as const
          ).map(([mode, label, hint]) => (
            <button
              key={mode}
              className="gs-mode-card"
              role="radio"
              aria-checked={s.room.navigationMode === mode}
              onClick={() =>
                void controller.action("navigation-mode", { mode })
              }
            >
              <strong>{label}</strong>
              <small>{hint}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="gs-glass gs-card">
        <div className="gs-section-head">
          <div>
            <p className="gs-kicker">SESSION FEATURES</p>
            <h2>Shape the shared Scholar workspace.</h2>
          </div>
        </div>
        <div className="gs-list">
          {GROUP_FEATURES.map((feature) => (
            <div className="gs-setting" key={feature.id}>
              <div>
                <strong>{feature.label}</strong>
                <p className="gs-fineprint">
                  {feature.supportsSharedContext
                    ? "Room-scoped shared context"
                    : "Room-scoped access"}
                </p>
              </div>
              <select
                className="gs-select"
                aria-label={`${feature.label} access`}
                disabled={feature.id === "overview"}
                value={s.room.featurePolicy[feature.id]}
                onChange={(event) =>
                  void controller.action("feature-policy", {
                    feature: feature.id,
                    access: event.target.value as FeatureAccess,
                  })
                }
              >
                <option value="group">Group available</option>
                <option value="host">Host only</option>
                <option value="off">Off</option>
              </select>
            </div>
          ))}
        </div>
      </section>
      <section className="gs-glass gs-card">
        <p className="gs-kicker">TODAY&apos;S STUDY PATH</p>
        <h2>A lightweight path through the session.</h2>
        <ol className="gs-session-path-editor">
          {s.room.sessionPath.map((step, index) => (
            <li key={step.id}>
              <button
                aria-label={`Mark ${step.label} ${step.done ? "not done" : "done"}`}
                onClick={() =>
                  void controller.action("session-path", {
                    steps: s.room.sessionPath.map((item) =>
                      item.id === step.id
                        ? { ...item, done: !item.done }
                        : item,
                    ),
                  })
                }
              >
                {step.done ? "✓" : index + 1}
              </button>
              <span>
                <strong>{step.label}</strong>
                <small>
                  {
                    GROUP_FEATURES.find(
                      (feature) => feature.id === step.feature,
                    )?.label
                  }
                </small>
              </span>
              <button
                className="gs-button"
                disabled={index === 0}
                onClick={() => {
                  const steps = [...s.room.sessionPath],
                    [item] = steps.splice(index, 1);
                  steps.splice(index - 1, 0, item);
                  void controller.action("session-path", { steps });
                }}
              >
                ↑
              </button>
              <button
                className="gs-button"
                onClick={() =>
                  void controller.action("session-path", {
                    steps: s.room.sessionPath.filter(
                      (item) => item.id !== step.id,
                    ),
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
        <form
          className="gs-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pathLabel.trim()) return;
            void controller.action("session-path", {
              steps: [
                ...s.room.sessionPath,
                {
                  id: crypto.randomUUID(),
                  label: pathLabel.trim(),
                  feature: pathFeature,
                  done: false,
                },
              ],
            });
            setPathLabel("");
          }}
        >
          <input
            className="gs-input"
            aria-label="New session path step"
            value={pathLabel}
            onChange={(event) => setPathLabel(event.target.value)}
            placeholder="Read PDF pages 12–18"
            maxLength={160}
          />
          <select
            className="gs-select"
            aria-label="Step feature"
            value={pathFeature}
            onChange={(event) =>
              setPathFeature(event.target.value as GroupFeatureId)
            }
          >
            {GROUP_FEATURES.map((feature) => (
              <option key={feature.id} value={feature.id}>
                {feature.label}
              </option>
            ))}
          </select>
          <button className="gs-button">Add step</button>
        </form>
      </section>
      <section className="gs-glass gs-card">
        <div className="gs-section-head">
          <div>
            <p className="gs-kicker">
              <ShieldCheck /> YOUR ROOM, THOUGHTFULLY MANAGED
            </p>
            <h2>Host controls</h2>
            <p className="gs-muted">
              Permissions are enforced on the server. Room capacity:{" "}
              {s.room.maxParticipants}.
            </p>
          </div>
          <button
            className="gs-button"
            aria-pressed={s.room.locked}
            disabled={controller.busyKeys.includes("lock:")}
            onClick={() =>
              void controller.action("lock", { locked: !s.room.locked })
            }
          >
            {s.room.locked ? <Lock /> : <Unlock />}
            {s.room.locked ? "Locked" : "Open"}
          </button>
        </div>
        <div className="gs-list">
          {settings.map(([key, label, hint]) => (
            <div className="gs-setting" key={key}>
              <div>
                <strong>{label}</strong>
                <p className="gs-fineprint">{hint}</p>
              </div>
              <button
                className="gs-button"
                aria-label={label}
                aria-pressed={s.room[key]}
                disabled={controller.busyKeys.includes("settings:")}
                onClick={() =>
                  void controller.action("settings", {
                    settings: { [key]: !s.room[key] },
                  })
                }
              >
                {s.room[key] ? "On" : "Off"}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="gs-glass gs-card">
        <p className="gs-kicker">COMMUNICATION</p>
        <h2>Chat, voice, camera & reactions.</h2>
        <div className="gs-list">
          {(
            [
              ["voiceEnabled", "Voice"],
              ["cameraEnabled", "Camera"],
              ["reactionsEnabled", "Reactions"],
            ] as const
          ).map(([key, label]) => (
            <div className="gs-setting" key={key}>
              <div>
                <strong>{label}</strong>
                <p className="gs-fineprint">
                  Devices remain off until each participant explicitly enables
                  them.
                </p>
              </div>
              <button
                className="gs-button"
                aria-pressed={s.room[key]}
                onClick={() =>
                  void controller.action("media-policy", {
                    [key]: !s.room[key],
                  })
                }
              >
                {s.room[key] ? "On" : "Off"}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="gs-glass gs-card">
        <h2>Study controls</h2>
        <div className="gs-actions">
          {s.room.status === "waiting" && (
            <button
              className="gs-button gs-button-primary"
              disabled={controller.busyKeys.includes("start:")}
              onClick={() => void controller.action("start")}
            >
              Start session
            </button>
          )}
          {s.room.status === "active" && (
            <button
              className="gs-button"
              disabled={controller.busyKeys.includes("pause:")}
              onClick={() => void controller.action("pause")}
            >
              Pause session
            </button>
          )}
          {s.room.status === "paused" && (
            <button
              className="gs-button gs-button-primary"
              disabled={controller.busyKeys.includes("resume:")}
              onClick={() => void controller.action("resume")}
            >
              Resume session
            </button>
          )}
          <button
            className="gs-button"
            onClick={() => navigate("participants")}
          >
            Manage participants
          </button>
          <button className="gs-button" onClick={() => navigate("focus")}>
            Focus session
          </button>
          <button className="gs-button" onClick={() => navigate("quiz")}>
            Quiz &amp; polls
          </button>
        </div>
        <form
          className="gs-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await controller.action("announce", { body: announcement }))
              setAnnouncement("");
          }}
        >
          <label className="gs-field">
            Announcement
            <input
              className="gs-input"
              aria-label="Announcement"
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              maxLength={1000}
              placeholder="Let’s solve question 4. You have five minutes."
            />
          </label>
          <button
            className="gs-button"
            disabled={controller.busyKeys.includes("announce:")}
          >
            Post announcement
          </button>
        </form>
      </section>
      <section className="gs-glass gs-card gs-danger-zone">
        <h2>Room lifecycle</h2>
        <p className="gs-muted">
          Ending a room revokes participant access and removes temporary
          materials. Copy your notes first.
        </p>
        <div className="gs-actions">
          <button
            className="gs-button gs-button-danger"
            onClick={() => setConfirm("end")}
          >
            End Group Study
          </button>
          <button
            className="gs-button"
            onClick={() => setConfirm("regenerate-code")}
          >
            New invite code
          </button>
          <button
            className="gs-button"
            onClick={() => setConfirm("clear-chat")}
          >
            Clear chat
          </button>
        </div>
      </section>
      <Dialog
        open={confirm !== null}
        onOpenChange={(value) => {
          if (!value) setConfirm(null);
        }}
      >
        <DialogContent className="gs-dialog">
          <DialogTitle>
            {confirm === "end"
              ? "End this room for everyone?"
              : confirm === "clear-chat"
                ? "Clear the room conversation?"
                : "Replace the invite code?"}
          </DialogTitle>
          <DialogDescription>
            {confirm === "end"
              ? "Everyone will leave and shared materials will be removed. This cannot be undone."
              : confirm === "clear-chat"
                ? "All chat messages and shared LAM responses will be removed."
                : "Old invitations will stop working. Existing participants keep their access."}
          </DialogDescription>
          <div className="gs-actions">
            <button
              className="gs-button gs-button-danger"
              disabled={controller.busyKeys.includes(`${confirm}:`)}
              onClick={async () => {
                if (confirm && (await controller.action(confirm)))
                  setConfirm(null);
              }}
            >
              {confirm === "end" ? "End for everyone" : "Confirm"}
            </button>
            <button className="gs-button" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
