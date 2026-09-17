"use client";
import {
  BookOpen,
  FileText,
  Sparkles,
  ListChecks,
  Timer,
  MessageSquare,
} from "lucide-react";
import type { GroupRoomController } from "./use-room";
import { EmptyState, Person, type Workspace } from "./room-ui";

const eventNames: Record<string, string> = {
  room_created: "The study room opened",
  participant_join_requested: "A participant requested access",
  joined: "A participant requested access",
  participant_joined: "A participant joined",
  approve: "A participant was admitted",
  deny: "A join request was declined",
  remove: "A participant was removed",
  start: "Study session started",
  pause: "Room paused",
  resume: "Room resumed",
  focus: "Focus session updated",
  quiz: "A quiz was started",
  quiz_started: "LAM created a room quiz",
  reveal: "Quiz answers revealed",
  poll: "A quick poll opened",
  resource_added: "A study material was added",
  resource: "Shared material updated",
  ai_message: "Group LAM shared an answer",
  announce: "A host announcement was posted",
  lock: "Room lock updated",
  settings: "Room permissions updated",
  hand: "A participant changed their raised hand",
  "clear-hand": "A raised hand was cleared",
  mute: "Participant chat permissions updated",
  "regenerate-code": "A new invite code was generated",
  "clear-chat": "The room chat was cleared",
  leave: "A participant left",
};
export function OverviewWorkspace({
  controller,
  navigate,
}: {
  controller: GroupRoomController;
  navigate: (id: Workspace) => void;
}) {
  const s = controller.snapshot;
  if (!s) return null;
  const host = s.me.role === "host",
    participants = s.participants.filter((p) => p.status === "approved"),
    material = s.resources.find((r) => r.id === s.room.activeResourceId);
  const quick: Array<{
    id: Workspace;
    icon: typeof Sparkles;
    title: string;
    text: string;
  }> = [
    {
      id: "lam",
      icon: Sparkles,
      title: "Ask Group LAM",
      text: "Untangle a difficult idea.",
    },
    {
      id: "materials",
      icon: FileText,
      title:
        host || s.room.participantUploads
          ? "Upload material"
          : "Study materials",
      text: "Bring everyone onto the same page.",
    },
    {
      id: "quiz",
      icon: ListChecks,
      title: host ? "Start a quiz" : "Open quiz",
      text: "Find out what really clicked.",
    },
    {
      id: "focus",
      icon: Timer,
      title: host ? "Start focus" : "Focus together",
      text: "A little less distraction.",
    },
    ...(host
      ? [
          {
            id: "host" as const,
            icon: MessageSquare,
            title: "Send announcement",
            text: "Give the room a clear next step.",
          },
        ]
      : []),
  ];
  return (
    <div className="gs-workspace-stack">
      <section className="gs-glass gs-card gs-overview-hero">
        <p className="gs-kicker">
          <BookOpen /> A SPACE TO MAKE PROGRESS
        </p>
        <h2>
          Great minds.
          <br />
          <em>Shared momentum.</em>
        </h2>
        <p className="gs-muted">
          {s.room.topic || "Bring a question. Leave with understanding."}
        </p>
        <div className="gs-stats">
          <div className="gs-stat">
            <strong>{participants.filter((p) => p.online).length}</strong>
            <span>Online now</span>
          </div>
          <div className="gs-stat">
            <strong>{s.resources.length}</strong>
            <span>Shared materials</span>
          </div>
          <div className="gs-stat">
            <strong>{s.quiz?.responseCount ?? 0}</strong>
            <span>Quiz completions</span>
          </div>
        </div>
        {host && s.room.status === "waiting" && (
          <button
            className="gs-button gs-button-primary"
            disabled={controller.busyKeys.includes("start:")}
            onClick={() => void controller.action("start")}
          >
            Start study session
          </button>
        )}
        {s.room.status === "paused" && (
          <p className="gs-note">
            The room is paused.
            {host && (
              <button
                className="gs-button"
                onClick={() => void controller.action("resume")}
              >
                Resume session
              </button>
            )}
          </p>
        )}
      </section>
      <section className="gs-quick-grid" aria-label="Quick actions">
        {quick.map((a) => (
          <button
            className="gs-glass gs-quick-action"
            key={a.id}
            onClick={() => navigate(a.id)}
          >
            <a.icon aria-hidden="true" />
            <strong>{a.title}</strong>
            <span>{a.text}</span>
          </button>
        ))}
      </section>
      <div className="gs-overview-grid">
        <section className="gs-glass gs-card">
          <h2>In the room</h2>
          <div className="gs-list gs-room-context">
            <button
              className="gs-context-item"
              onClick={() => navigate("materials")}
            >
              <FileText />
              <span>
                <strong>
                  {material?.name ?? "No shared document selected"}
                </strong>
                <small>
                  {material
                    ? `Host is on page ${s.room.page}`
                    : "Open a material and share a page."}
                </small>
              </span>
            </button>
            <button
              className="gs-context-item"
              onClick={() => navigate("focus")}
            >
              <Timer />
              <span>
                <strong>
                  {s.focus ? `Focus ${s.focus.status}` : "A moment to focus"}
                </strong>
                <small>
                  {s.focus
                    ? `${s.focus.durationSeconds / 60} minute shared sprint`
                    : "Start a quiet study sprint."}
                </small>
              </span>
            </button>
            <button
              className="gs-context-item"
              onClick={() => navigate("quiz")}
            >
              <ListChecks />
              <span>
                <strong>{s.quiz?.title ?? "No quiz running"}</strong>
                <small>
                  {s.quiz
                    ? `${s.quiz.responseCount} completed · ${s.quiz.revealed ? "Revealed" : "Accepting answers"}`
                    : "Check understanding together."}
                </small>
              </span>
            </button>
          </div>
          {s.room.announcement && (
            <div className="gs-note gs-announcement">
              <MessageSquare />
              <div>
                <small>HOST ANNOUNCEMENT</small>
                <p>{s.room.announcement}</p>
              </div>
            </div>
          )}
        </section>
        <section className="gs-glass gs-card">
          <div className="gs-section-head">
            <h2>Your study circle</h2>
            <button
              className="gs-button"
              onClick={() => navigate("participants")}
            >
              See all
            </button>
          </div>
          {participants.slice(0, 6).map((p) => (
            <Person person={p} key={p.id} />
          ))}
        </section>
      </div>
      <section className="gs-glass gs-card">
        <h2>Room activity</h2>
        {!s.activity?.length ? (
          <EmptyState title="A fresh start.">
            Admit a friend, share a document, or begin your first study sprint.
          </EmptyState>
        ) : (
          <ol className="gs-activity-list">
            {s.activity.slice(0, 8).map((e) => (
              <li key={e.id}>
                <span className="gs-activity-dot" />
                <span>{eventNames[e.type] ?? "Room activity updated"}</span>
                <time dateTime={e.createdAt}>
                  {new Date(e.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
