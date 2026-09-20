"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ShieldCheck, Menu, PanelRight, Hand } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ReadyBackgroundVideo } from "@/components/ready-background-video";
import {
  GroupSessionProvider,
  useGroupSession,
} from "./group-session-provider";
import {
  CodeChip,
  InviteDialog,
  JoinRequests,
  Person,
  type Workspace,
} from "./room-ui";
import { OverviewWorkspace } from "./overview-workspace";
import { ChatWorkspace } from "./chat-workspace";
import { LamWorkspace, type MaterialContext } from "./lam-workspace";
import { MaterialsWorkspace } from "./materials-workspace";
import { QuizWorkspace } from "./quiz-workspace";
import { FocusWorkspace } from "./focus-workspace";
import { NotesWorkspace } from "./notes-workspace";
import { PeopleWorkspace, HostWorkspace } from "./people-workspace";
import {
  GROUP_FEATURES,
  canAccessFeature,
  groupHref,
  type GroupFeatureId,
} from "@/lib/group-study/features";
import { MediaDock } from "./media-dock";
import "./group-study.css";
import "./room-v2.css";

const sections = [
  ...GROUP_FEATURES,
  { id: "host" as const, label: "Host controls", icon: ShieldCheck },
];
const STORAGE_KEY = "scholar.group-study.room";
export function storedRoomId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
export function rememberRoomId(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* optional resume storage */
  }
}

type GroupSessionShellProps = {
  roomId: string;
  initialFeature?: GroupFeatureId;
  onExit: () => void;
};

export function GroupSessionShell(props: GroupSessionShellProps) {
  return (
    <GroupSessionProvider roomId={props.roomId}>
      <GroupSessionView {...props} />
    </GroupSessionProvider>
  );
}

function GroupSessionView({
  roomId,
  initialFeature = "overview",
  onExit,
}: GroupSessionShellProps) {
  const controller = useGroupSession();
  const { snapshot: s, connection, error } = controller;
  const [tab, setTab] = useState<Workspace>(initialFeature);
  const [visited, setVisited] = useState<Workspace[]>([initialFeature]);
  const [drawer, setDrawer] = useState(false);
  const [contextPanel, setContextPanel] = useState(false);
  const [invite, setInvite] = useState(false);
  const [materialContext, setMaterialContext] = useState<MaterialContext>(null);
  const [unread, setUnread] = useState(0);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [sectionNotice, setSectionNotice] = useState("");
  const lastRead = useRef("");
  const lastSeen = useRef("");
  const heading = useRef<HTMLHeadingElement>(null);
  const navigate = useCallback(
    (id: Workspace, takeGroup = false) => {
      setTab(id);
      setVisited((items) => (items.includes(id) ? items : [...items, id]));
      setDrawer(false);
      if (id !== "host") {
        window.history.replaceState(
          window.history.state,
          "",
          groupHref(roomId, id),
        );
        void controller.action("navigate", {
          feature: id,
          ...(takeGroup ? { takeGroup: true } : {}),
        });
      }
    },
    [controller.action, roomId],
  );
  const askLam = useCallback(
    (context: MaterialContext) => {
      setMaterialContext(context);
      navigate("lam");
    },
    [navigate],
  );
  useEffect(() => {
    rememberRoomId(roomId);
  }, [roomId]);
  useEffect(() => {
    if (!s || s.me.role === "host") return;
    const allowed = canAccessFeature(
      s.room.featurePolicy,
      tab === "host" ? "overview" : tab,
      s.me.role,
    );
    if (!allowed) {
      const timer = window.setTimeout(() => {
        setSectionNotice("The host has closed this section.");
        navigate("overview");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (s.me.followHost && s.room.activeFeature !== tab) {
      const timer = window.setTimeout(() => navigate(s.room.activeFeature), 0);
      return () => window.clearTimeout(timer);
    }
  }, [
    s?.room.navigationRevision,
    s?.room.featurePolicy,
    s?.room.activeFeature,
    s?.me.followHost,
    s?.me.role,
    tab,
    navigate,
  ]);
  useEffect(() => {
    const messages = controller.messages,
      id = messages.at(-1)?.id ?? "";
    if (!id) return;
    // Synchronize the unread cursor with incoming external room messages.
    if (tab === "chat") {
      lastRead.current = id;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnread(0);
    } else if (lastSeen.current && id !== lastSeen.current) {
      const index = messages.findIndex((m) => m.id === lastRead.current);
      setUnread(
        messages.slice(index + 1).filter((m) => m.authorId !== s?.me.id).length,
      );
    } else if (!lastSeen.current) lastRead.current = id;
    lastSeen.current = id;
  }, [controller.messages, tab, s?.me.id]);
  const back = () => {
    rememberRoomId(null);
    onExit();
  };
  const background = (
    <>
      <div className="gs-v2-background" aria-hidden="true">
        <ReadyBackgroundVideo src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4" />
      </div>
      <div className="gs-v2-shade" aria-hidden="true" />
    </>
  );
  const connectionText =
    connection === "offline"
      ? "Offline — updates resume when you reconnect."
      : connection === "lost"
        ? "Connection lost — retrying."
        : connection === "connecting"
          ? "Connecting…"
          : null;
  const ended =
    connection === "ended" ||
    s?.room.status === "ended" ||
    (s && ["removed", "denied", "left"].includes(s.me.status));
  if (ended || !s || s.me.status === "pending")
    return (
      <div className="group-study gs-v2">
        {background}
        <div className="gs-wrap">
          <button
            className="gs-brand gs-plain-button"
            onClick={() => setLeaveOpen(true)}
          >
            <ArrowLeft /> Group Study
          </button>
          <section className="gs-wait gs-glass">
            <p className="gs-kicker">SCHOLAR GROUP STUDY · BETA</p>
            <h2>
              {ended
                ? "Your Group Study session has ended."
                : s?.me.status === "pending"
                  ? "Waiting for the host"
                  : "Opening your study room…"}
            </h2>
            <p className="gs-muted">
              {ended
                ? error ||
                  (s?.room.status === "ended"
                    ? "The host ended this study session for everyone."
                    : "You left this room.")
                : s
                  ? `Your request has been sent, ${s.me.displayName}. You’ll enter automatically when approved.`
                  : connectionText}
            </p>
            {s?.me.status === "pending" && !ended ? (
              <button
                className="gs-button"
                onClick={async () => {
                  if (await controller.action("leave")) back();
                }}
              >
                Leave waiting room
              </button>
            ) : ended ? (
              <button className="gs-button gs-button-primary" onClick={back}>
                Back to Group Study
              </button>
            ) : null}
          </section>
        </div>
      </div>
    );
  const host = s.me.role === "host",
    approved = s.participants.filter((p) => p.status === "approved");
  const featureAllowed = (id: Workspace) =>
    id === "host"
      ? host
      : canAccessFeature(s.room.featurePolicy, id, s.me.role);
  const nav = (
    <nav className="gs-v2-nav" role="tablist" aria-label="Room sections">
      {sections
        .filter(
          (item) => (host || item.id !== "host") && featureAllowed(item.id),
        )
        .map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-label={item.label}
            aria-description={
              item.id === "chat" && unread > 0
                ? `${unread} unread messages`
                : undefined
            }
            aria-selected={tab === item.id}
            aria-controls={`gs-workspace-${item.id}`}
            className="gs-v2-nav-item"
            onClick={() => navigate(item.id)}
          >
            <item.icon aria-hidden="true" />
            <span>{item.label}</span>
            {item.id === "chat" && unread > 0 && (
              <span
                className="gs-nav-count"
                aria-label={`${unread} unread messages`}
              >
                {unread}
              </span>
            )}
            {item.id === "participants" &&
              s.participants.some((p) => p.handRaised) && (
                <Hand aria-label="Raised hands" />
              )}
          </button>
        ))}
    </nav>
  );
  return (
    <div className="group-study gs-v2">
      {background}
      <div className="gs-v2-layout">
        <aside className="gs-v2-left gs-glass">
          <button
            className="gs-brand gs-plain-button"
            onClick={() => setLeaveOpen(true)}
          >
            <ArrowLeft /> SCHOLAR
          </button>
          <div className="gs-v2-room-identity">
            <span className="gs-tiny-pill">GROUP STUDY · BETA</span>
            <strong>{s.room.name}</strong>
            <p className="gs-muted">{s.room.subject || "Your study space"}</p>
            {s.room.code && <CodeChip code={s.room.code} />}
            <p className="gs-fineprint">
              {approved.length} studying ·{" "}
              {approved.filter((p) => p.online).length} online
            </p>
          </div>
          {nav}
          <div className="gs-v2-self">
            <div className="gs-avatar">
              {s.me.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong>{s.me.displayName}</strong>
              <small>
                {host
                  ? "Room host"
                  : s.me.followHost
                    ? "Following host"
                    : "Exploring"}
              </small>
            </div>
          </div>
        </aside>
        <div className="gs-v2-center">
          <header className="gs-v2-header gs-glass">
            <div className="gs-v2-header-title">
              <button
                className="gs-button gs-button-icon gs-v2-mobile-menu"
                aria-label="Room menu"
                onClick={() => setDrawer(true)}
              >
                <Menu />
              </button>
              <div>
                <h1 ref={heading}>{s.room.name}</h1>
                <p>
                  {[s.room.subject, s.room.topic].filter(Boolean).join(" · ") ||
                    "A shared space for better learning"}
                </p>
              </div>
            </div>
            <div className="gs-v2-header-tools">
              <span className="gs-status">
                <span className="gs-status-dot" />
                {s.room.status === "active"
                  ? "LIVE"
                  : s.room.status.toUpperCase()}
              </span>
              <span className="gs-status" aria-label="Participant count">
                {approved.length} studying
              </span>
              {s.room.code && (
                <div className="gs-v2-header-code">
                  <CodeChip code={s.room.code} />
                </div>
              )}
              {host ? (
                <button className="gs-button" onClick={() => setInvite(true)}>
                  Invite
                </button>
              ) : (
                <button
                  className="gs-button gs-button-icon"
                  aria-label={s.me.handRaised ? "Lower hand" : "Raise hand"}
                  aria-pressed={s.me.handRaised}
                  onClick={() =>
                    void controller.action("hand", { raised: !s.me.handRaised })
                  }
                >
                  <Hand />
                </button>
              )}
              <button
                className="gs-button gs-button-icon"
                aria-label="Toggle room panel"
                aria-expanded={contextPanel}
                onClick={() => setContextPanel(!contextPanel)}
              >
                <PanelRight />
              </button>
            </div>
          </header>
          {connectionText && (
            <p className="gs-connection-note" role="status">
              {connectionText}
            </p>
          )}
          {sectionNotice && (
            <div className="gs-note" role="status">
              {sectionNotice}
              <button
                className="gs-button"
                onClick={() => setSectionNotice("")}
              >
                Dismiss
              </button>
            </div>
          )}
          {!host && !s.me.followHost && s.room.activeFeature !== tab && (
            <div className="gs-follow-prompt gs-glass">
              Host moved to{" "}
              {
                GROUP_FEATURES.find((item) => item.id === s.room.activeFeature)
                  ?.label
              }
              .
              <button
                className="gs-button"
                onClick={async () => {
                  if (
                    await controller.action("follow-host", { following: true })
                  )
                    navigate(s.room.activeFeature);
                }}
              >
                Follow
              </button>
            </div>
          )}
          <div className="gs-session-toolbar">
            {!host && (
              <button
                className="gs-button"
                aria-pressed={s.me.followHost}
                onClick={() =>
                  void controller.action("follow-host", {
                    following: !s.me.followHost,
                  })
                }
              >
                {s.me.followHost ? "Following host ✓" : "Explore independently"}
              </button>
            )}
            {host && tab !== "host" && (
              <button
                className="gs-button gs-button-primary"
                onClick={() => navigate(tab, true)}
              >
                Take group here
              </button>
            )}
            {s.room.reactionsEnabled && (
              <div className="gs-reactions" aria-label="Study reactions">
                {["👍", "✅", "❓", "👏"].map((emoji) => (
                  <button
                    key={emoji}
                    aria-label={`React ${emoji}`}
                    onClick={() =>
                      void controller.action("reaction", { emoji })
                    }
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <MediaDock
            roomId={roomId}
            controller={controller}
            expanded={mediaOpen}
            onExpanded={setMediaOpen}
          />
          {s.reactions?.map((reaction, index) => (
            <span
              key={`${reaction.participantId}-${reaction.createdAt}`}
              className="gs-floating-reaction"
              style={{ "--reaction-index": index } as React.CSSProperties}
            >
              {reaction.emoji}
              <small>{reaction.displayName}</small>
            </span>
          ))}
          <JoinRequests controller={controller} />
          {error && (
            <div className="gs-note gs-error" role="alert">
              <span>{error}</span>
              <button
                className="gs-button"
                onClick={() => controller.setError(null)}
              >
                Dismiss
              </button>
            </div>
          )}
          <main className="gs-v2-main">
            {visited.filter(featureAllowed).map((id) => (
              <div
                key={id}
                id={`gs-workspace-${id}`}
                role="tabpanel"
                aria-label={sections.find((item) => item.id === id)?.label}
                hidden={tab !== id}
              >
                {id === "overview" ? (
                  <OverviewWorkspace
                    controller={controller}
                    navigate={navigate}
                  />
                ) : id === "chat" ? (
                  <ChatWorkspace controller={controller} active={tab === id} />
                ) : id === "lam" ? (
                  <LamWorkspace
                    controller={controller}
                    context={materialContext}
                    onContext={setMaterialContext}
                  />
                ) : id === "materials" ? (
                  <MaterialsWorkspace
                    controller={controller}
                    active={tab === id}
                    askLam={askLam}
                  />
                ) : id === "quiz" ? (
                  <QuizWorkspace controller={controller} />
                ) : id === "focus" ? (
                  <FocusWorkspace controller={controller} active={tab === id} />
                ) : id === "notes" ? (
                  <NotesWorkspace controller={controller} />
                ) : id === "participants" ? (
                  <PeopleWorkspace controller={controller} />
                ) : host ? (
                  <HostWorkspace controller={controller} navigate={navigate} />
                ) : null}
              </div>
            ))}
          </main>
          <p className="gs-v2-footer">
            A private room. Shared ideas. Names, notes, chat and materials are
            visible to approved members.
          </p>
        </div>
        {contextPanel && (
          <aside className="gs-v2-right gs-glass" aria-label="Room panel">
            <div className="gs-section-head">
              <h2>Study circle</h2>
              <button
                className="gs-button gs-button-icon"
                aria-label="Close room panel"
                onClick={() => setContextPanel(false)}
              >
                ×
              </button>
            </div>
            {approved.map((p) => (
              <Person key={p.id} person={p} />
            ))}
            <button
              className="gs-button"
              onClick={() => navigate("participants")}
            >
              Open participants
            </button>
            <hr className="gs-divider" />
            <h3>Now in the room</h3>
            <p className="gs-muted">
              {s.focus
                ? `Focus ${s.focus.status} · ${s.focus.durationSeconds / 60} min`
                : "No focus session"}
            </p>
            <p className="gs-muted">
              {s.quiz
                ? `${s.quiz.responseCount} quiz responses`
                : "No active quiz"}
            </p>
            {s.room.activeResourceId && (
              <button
                className="gs-button"
                onClick={() => navigate("materials")}
              >
                Shared PDF · page {s.room.page}
              </button>
            )}
            {s.room.announcement && (
              <p className="gs-note">{s.room.announcement}</p>
            )}
            {host && (
              <button className="gs-button" onClick={() => navigate("host")}>
                Host controls
              </button>
            )}
          </aside>
        )}
      </div>
      <div
        className="gs-v2-bottom-nav gs-glass"
        aria-label="Quick room navigation"
      >
        {sections
          .filter((item) => ["overview", "chat", "materials"].includes(item.id))
          .map((item) => (
            <button
              key={item.id}
              className="gs-v2-nav-item"
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon />
              <span>{item.label}</span>
              {item.id === "chat" && unread > 0 && (
                <span className="gs-nav-count">{unread}</span>
              )}
            </button>
          ))}
        <button className="gs-v2-nav-item" onClick={() => setDrawer(true)}>
          <Menu />
          <span>More</span>
        </button>
      </div>
      <Dialog open={drawer} onOpenChange={setDrawer}>
        <DialogContent className="gs-dialog gs-v2-drawer">
          <DialogTitle>Your study workspace</DialogTitle>
          <DialogDescription>
            Choose where to take your next step.
          </DialogDescription>
          {nav}
        </DialogContent>
      </Dialog>
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="gs-dialog">
          <DialogTitle>Leave Group Study?</DialogTitle>
          <DialogDescription>
            You will exit the shared Scholar workspace. Your microphone and
            camera stop immediately.
          </DialogDescription>
          <div className="gs-actions">
            <button
              className="gs-button gs-button-danger"
              onClick={async () => {
                if (!host) await controller.action("leave");
                back();
              }}
            >
              Leave Group Study
            </button>
            <button className="gs-button" onClick={() => setLeaveOpen(false)}>
              Stay
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {s.room.code && (
        <InviteDialog
          code={s.room.code}
          open={invite}
          onClose={() => setInvite(false)}
        />
      )}
    </div>
  );
}

export const RoomShell = GroupSessionShell;
