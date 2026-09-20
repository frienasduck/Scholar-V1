"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  FileText,
  Hash,
  MessageSquare,
  Orbit,
  Sparkles,
  Users,
} from "lucide-react";
import {
  groupRequest,
  errorMessage,
  formatRoomCode,
  copyRoomCode,
  type CreatedStudyRoom,
} from "@/components/group-study/client";
import { RoomShell } from "@/components/group-study/room-shell";
import { ReadyBackgroundVideo } from "@/components/ready-background-video";
import "./landing.css";

/** Scholar's own login-background film — the same system the auth screen uses. */
const SCHOLAR_BACKGROUND_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4";

const MENU_LINKS: Array<{ label: string; href: string; external?: boolean }> = [
  { label: "Group Study", href: "#join" },
  {
    label: "About",
    href: "https://scholar-v1.vercel.app/#features",
    external: true,
  },
  { label: "Sign in", href: "/?signin=1", external: true },
  { label: "Back to Scholar", href: "/", external: true },
];

const ROOM_STORAGE_KEY = "scholar.group-study.room";

function rememberRoomId(roomId: string | null) {
  try {
    if (roomId) window.localStorage.setItem(ROOM_STORAGE_KEY, roomId);
    else window.localStorage.removeItem(ROOM_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

function ScholarBackground() {
  return (
    <div className="hero__media" aria-hidden="true">
      <ReadyBackgroundVideo src={SCHOLAR_BACKGROUND_VIDEO} />
    </div>
  );
}

function MobileMenu({
  open,
  onClose,
  toggleRef,
}: {
  open: boolean;
  onClose: () => void;
  toggleRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const closeButton = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) closeButton.current?.focus();
    else toggleRef.current?.focus();
    return () => {
      document.body.classList.remove("menu-open");
      document.body.style.overflow = "";
    };
  }, [open, toggleRef]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 901px)");
    const onChange = () => {
      if (media.matches && open) onClose();
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [open, onClose]);

  return (
    <div
      className="menu"
      data-open={open}
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      aria-hidden={!open}
      inert={!open ? true : undefined}
      id="mobileMenu"
    >
      {MENU_LINKS.map((link, index) =>
        link.external ? (
          <Link
            key={link.label}
            className="menu__item"
            style={{ "--i": index } as React.CSSProperties}
            href={link.href}
            ref={index === 0 ? closeButton : undefined}
            onClick={onClose}
            tabIndex={open ? 0 : -1}
          >
            {link.label}
          </Link>
        ) : (
          <a
            key={link.label}
            className="menu__item"
            style={{ "--i": index } as React.CSSProperties}
            href={link.href}
            ref={index === 0 ? closeButton : undefined}
            onClick={onClose}
            tabIndex={open ? 0 : -1}
          >
            {link.label}
          </a>
        ),
      )}
    </div>
  );
}

/** Refined compact glass status — never raw backend text floating in the form. */
function FormStatus({ title, detail }: { title: string; detail: string }) {
  return (
    <p className="card__status" role="alert">
      <AlertCircle aria-hidden="true" />
      <span>
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
    </p>
  );
}

function JoinForm({
  canHost,
  onHost,
  onJoined,
}: {
  canHost: boolean | null;
  onHost: () => void;
  onJoined: (roomId: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    title: string;
    detail: string;
  } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await groupRequest<{ ok: boolean; roomId: string }>(
        "/api/group-study/rooms/join",
        {
          method: "POST",
          body: JSON.stringify({ displayName: name, code }),
        },
      );
      onJoined(result.roomId);
    } catch (cause) {
      const raw = errorMessage(cause);
      const known: Record<string, { title: string; detail: string }> = {
        "That study room couldn't be found or is unavailable.": {
          title: "Study room not found",
          detail: "Check the code and try again.",
        },
        "Too many join attempts. Wait a few minutes and try again.": {
          title: "Too many attempts",
          detail: "Wait a few minutes before trying this code again.",
        },
        "Display names are 2–40 characters with no control characters.": {
          title: "Check your name",
          detail: "Use 2–40 characters with no special control characters.",
        },
        "Enter your name and a study code.": {
          title: "Details missing",
          detail: "Enter your name and the study code from your host.",
        },
      };
      setStatus(
        known[raw] ?? {
          title: "Couldn't join",
          detail: "Scholar couldn't complete that request. Please try again.",
        },
      );
      setBusy(false);
    }
  };

  const canSubmit = name.trim().length >= 2 && code.trim().length >= 6 && !busy;

  return (
    <form className="card__form" noValidate onSubmit={submit} id="join">
      <div className="card__field">
        <label className="card__label" htmlFor="gs-name">
          Your name
        </label>
        <div className="card__control">
          <Users className="card__control-icon" aria-hidden="true" />
          <input
            className="card__input"
            id="gs-name"
            name="displayName"
            autoComplete="nickname"
            placeholder="e.g. Johan"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      </div>
      <div className="card__field">
        <label className="card__label" htmlFor="gs-code">
          Study code
        </label>
        <div className="card__control">
          <Hash className="card__control-icon" aria-hidden="true" />
          <input
            className="card__input"
            id="gs-code"
            name="code"
            autoComplete="off"
            spellCheck={false}
            placeholder="SCH-XXXXXXXX"
            value={code}
            maxLength={16}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </div>
      </div>
      {status ? (
        <FormStatus title={status.title} detail={status.detail} />
      ) : null}
      <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
        {busy ? "Joining…" : "Join Study Room"}{" "}
        <ArrowRight aria-hidden="true" />
      </button>
      {canHost ? (
        <button type="button" className="btn btn--glass" onClick={onHost}>
          Create Study Room <ArrowRight aria-hidden="true" />
        </button>
      ) : canHost === false ? (
        <Link href="/?signin=1" className="btn btn--glass" role="button">
          Sign in as host
        </Link>
      ) : null}
      <p className="card__note">
        No Scholar account is required to join. Room access is approved by the
        host.
      </p>
    </form>
  );
}

function CreateForm({
  onCreated,
  onBack,
}: {
  onCreated: (room: CreatedStudyRoom) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const room = await groupRequest<CreatedStudyRoom>(
        "/api/group-study/rooms",
        { method: "POST", body: JSON.stringify({ name, subject, topic }) },
      );
      if (!room.ok || !room.roomId || !room.code)
        throw new Error(
          "The room response was incomplete. Please check your connection and try again.",
        );
      // Preserve the real creation response before any navigation occurs.
      rememberRoomId(room.roomId);
      onCreated(room);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card__form" onSubmit={submit}>
      {[
        {
          label: "Room name",
          value: name,
          update: setName,
          limit: 80,
          placeholder: "Physics Revision",
          required: true,
        },
        {
          label: "Subject (optional)",
          value: subject,
          update: setSubject,
          limit: 80,
          placeholder: "Physics",
        },
        {
          label: "Topic (optional)",
          value: topic,
          update: setTopic,
          limit: 160,
          placeholder: "Work, Energy and Power",
        },
      ].map((field, i) => (
        <div className="card__field" key={field.label}>
          <label className="card__label" htmlFor={`gs-create-${i}`}>
            {field.label}
          </label>
          <div className="card__control">
            <input
              className="card__input"
              style={{ paddingLeft: 16 }}
              id={`gs-create-${i}`}
              value={field.value}
              onChange={(event) => field.update(event.target.value)}
              maxLength={field.limit}
              minLength={field.required ? 2 : undefined}
              required={field.required}
              placeholder={field.placeholder}
            />
          </div>
        </div>
      ))}
      {error ? (
        <FormStatus title="Couldn't create the room" detail={error} />
      ) : null}
      <button
        className="btn btn--primary"
        type="submit"
        disabled={busy || name.trim().length < 2}
      >
        {busy ? "Creating…" : "Create Study Room"}{" "}
        <ArrowRight aria-hidden="true" />
      </button>
      <button
        className="btn btn--glass"
        type="button"
        disabled={busy}
        onClick={onBack}
      >
        Back to join
      </button>
    </form>
  );
}

function RoomCreated({
  room,
  onEnter,
}: {
  room: CreatedStudyRoom;
  onEnter: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const copy = async () => {
    setError("");
    try {
      await copyRoomCode(room.code);
      setCopied(true);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <div className="card__form" role="region" aria-label="Room created">
      <p className="card__label">ROOM CODE</p>
      <code
        className="card__room-code"
        aria-label={`Room code ${formatRoomCode(room.code)}`}
      >
        {formatRoomCode(room.code)}
      </code>
      <p className="card__support">Share this code with your study group.</p>
      <button
        type="button"
        className="btn btn--glass"
        onClick={() => void copy()}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Code copied" : "Copy Code"}
      </button>
      <span role="status" className="card__note">
        {copied ? "Room code copied to clipboard." : ""}
      </span>
      {error ? <FormStatus title="Copy unavailable" detail={error} /> : null}
      <button type="button" className="btn btn--primary" onClick={onEnter}>
        Enter Study Room <ArrowRight aria-hidden="true" />
      </button>
    </div>
  );
}

const INSIDE_ITEMS = [
  { icon: FileText, label: "Shared PDF materials with page sync" },
  { icon: Sparkles, label: "Group LAM powered study help" },
  { icon: BarChart3, label: "Live quizzes, polls and focus timers" },
  { icon: MessageSquare, label: "Study chat with host announcements" },
];

export function GroupStudyLanding({
  initialRoomId,
  initialFeature,
}: {
  initialRoomId?: string;
  initialFeature?: import("@/lib/group-study/features").GroupFeatureId;
} = {}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [overview, setOverview] = useState<{
    canHost: boolean;
    roomId?: string;
  } | null>(null);
  const [accessError, setAccessError] = useState("");
  const [form, setForm] = useState<"join" | "create">("join");
  const [created, setCreated] = useState<CreatedStudyRoom | null>(null);
  const toggleButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = initialRoomId ?? params.get("room");
    // A sidebar/landing visit stays on the landing. Only an explicit room URL
    // restores a room; a saved room remains available through Resume instead.
    const saved = fromUrl;
    if (fromUrl) rememberRoomId(fromUrl);
    if (!saved) {
      const idle = window.setTimeout(() => setReady(true), 0);
      return () => window.clearTimeout(idle);
    }
    const idle = window.setTimeout(() => {
      setRoomId(saved);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(idle);
  }, [initialRoomId]);

  const checkAccess = useCallback(async (signal?: AbortSignal) => {
    try {
      const value = await groupRequest<{ canHost: boolean; roomId?: string }>(
        "/api/group-study/rooms",
        { signal },
      );
      if (!signal?.aborted) {
        setOverview(value);
        setAccessError("");
      }
    } catch {
      if (!signal?.aborted)
        setAccessError("Couldn't check hosting access. Try again.");
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    // State updates in checkAccess happen only after awaiting the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkAccess(controller.signal);
    return () => controller.abort();
  }, [checkAccess]);

  const enter = useCallback((id: string) => {
    rememberRoomId(id);
    window.history.replaceState(
      window.history.state,
      "",
      `/group-study/${encodeURIComponent(id)}/overview`,
    );
    setRoomId(id);
    setReady(true);
  }, []);

  const exit = useCallback(() => {
    rememberRoomId(null);
    window.history.replaceState(null, "", "/group-study");
    setRoomId(null);
    setCreated(null);
    setForm("join");
    void checkAccess();
  }, [checkAccess]);

  if (ready && roomId)
    return (
      <RoomShell
        roomId={roomId}
        initialFeature={initialFeature}
        onExit={exit}
      />
    );

  return (
    <div className="gs-landing">
      <section className="hero" aria-label="Scholar Group Study">
        <ScholarBackground />
        <div className="hero__scrim" aria-hidden="true" />

        <header className="nav">
          <Link className="nav__logo" href="/" aria-label="Scholar home">
            <span className="nav__logo-mark" aria-hidden="true">
              <Orbit />
            </span>
            SCHOLAR
          </Link>
          <span className="nav__meta">
            GROUP STUDY · <strong>BETA</strong>
          </span>
          <button
            type="button"
            className="nav__toggle"
            aria-expanded={menuOpen}
            aria-controls="mobileMenu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            ref={toggleButton}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className="nav__toggle-bar" aria-hidden="true" />
            <span className="nav__toggle-bar" aria-hidden="true" />
            <span className="nav__toggle-bar" aria-hidden="true" />
          </button>
        </header>
        <MobileMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          toggleRef={toggleButton}
        />

        <main className="hero__body">
          <div className="intro">
            <p className="intro__kicker">
              <Users aria-hidden="true" /> GROUP STUDY
            </p>
            <h1 className="intro__title">
              Learn <em>together.</em>
              <br />
              Think together.
            </h1>
            <p className="intro__support">
              Join a live Scholar study room, share materials, ask Group LAM
              questions, solve quizzes, and stay focused together.
            </p>
          </div>

          <div className="cards">
            <section
              className="card gs-glass-card"
              aria-labelledby="gs-join-title"
            >
              <div className="card__icon">
                <Users aria-hidden="true" />
              </div>
              <h2 className="card__title" id="gs-join-title">
                {created
                  ? "Your study room is ready"
                  : form === "create"
                    ? "Host a study room"
                    : "Join a study room"}
              </h2>
              <p className="card__support">
                {created
                  ? created.name
                  : form === "create"
                    ? "Create a room and invite your group. Your host access is already active."
                    : "Enter your name and the study code your host shared with you."}
              </p>
              {created ? (
                <RoomCreated
                  room={created}
                  onEnter={() => enter(created.roomId)}
                />
              ) : form === "create" && overview?.canHost ? (
                <CreateForm
                  onCreated={setCreated}
                  onBack={() => setForm("join")}
                />
              ) : (
                <JoinForm
                  canHost={overview?.canHost ?? null}
                  onHost={() => setForm("create")}
                  onJoined={enter}
                />
              )}
              {accessError ? (
                <>
                  <FormStatus title="Connection issue" detail={accessError} />
                  <button
                    type="button"
                    className="btn btn--glass"
                    onClick={() => void checkAccess()}
                  >
                    Retry access check
                  </button>
                </>
              ) : null}
              {!created && overview?.roomId ? (
                <button
                  type="button"
                  className="btn btn--glass"
                  onClick={() => enter(overview.roomId!)}
                >
                  Resume active room
                </button>
              ) : null}
            </section>

            <section
              className="card gs-glass-card"
              aria-labelledby="gs-inside-title"
            >
              <div className="card__icon">
                <Sparkles aria-hidden="true" />
              </div>
              <h2 className="card__title" id="gs-inside-title">
                What happens inside
              </h2>
              <p className="card__support">
                Your host shares study material and opens the room. Inside you
                can follow the shared PDF, ask Group LAM questions, join quizzes
                and focus sessions, and discuss in the study chat.
              </p>
              <ul className="card__list">
                {INSIDE_ITEMS.map((item) => (
                  <li key={item.label} className="card__item">
                    <span className="card__item-icon" aria-hidden="true">
                      <item.icon />
                    </span>
                    {item.label}
                  </li>
                ))}
              </ul>
              <hr className="card__divider" />
              <p className="card__fineprint">
                During private beta, room creation is limited to the authorized
                Scholar account.
              </p>
            </section>
          </div>
        </main>

        <footer className="legal">
          <p className="legal__copy">
            Group Study is a temporary host-controlled Scholar session. Display
            names, room chat, and shared materials may be visible to other room
            participants.
          </p>
          <span className="legal__links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <span>Beta</span>
          </span>
        </footer>
      </section>
    </div>
  );
}
