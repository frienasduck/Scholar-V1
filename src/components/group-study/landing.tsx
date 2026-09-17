"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowRight, BarChart3, FileText, Hash, LogIn, MessageSquare, Orbit, Sparkles, Users,
} from "lucide-react";
import { groupRequest, errorMessage } from "@/components/group-study/client";
import { RoomShell } from "@/components/group-study/room-shell";
import { ReadyBackgroundVideo } from "@/components/ready-background-video";
import "./landing.css";

/** Scholar's own login-background film — the same system the auth screen uses. */
const SCHOLAR_BACKGROUND_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4";

const MENU_LINKS: Array<{ label: string; href: string; external?: boolean }> = [
  { label: "Group Study", href: "#join" },
  { label: "About", href: "https://scholar-v1.vercel.app/#features", external: true },
  { label: "Sign in", href: "/?signin=1", external: true },
  { label: "Back to Scholar", href: "/", external: true },
];

const ROOM_STORAGE_KEY = "scholar.group-study.room";

function storedRoomId(): string | null {
  try { return window.localStorage.getItem(ROOM_STORAGE_KEY); } catch { return null; }
}
function rememberRoomId(roomId: string | null) {
  try {
    if (roomId) window.localStorage.setItem(ROOM_STORAGE_KEY, roomId);
    else window.localStorage.removeItem(ROOM_STORAGE_KEY);
  } catch { /* storage unavailable */ }
}

function ScholarBackground() {
  return (
    <div className="hero__media" aria-hidden="true">
      <ReadyBackgroundVideo src={SCHOLAR_BACKGROUND_VIDEO} />
    </div>
  );
}

function MobileMenu({ open, onClose, toggleRef }: { open: boolean; onClose: () => void; toggleRef: React.RefObject<HTMLButtonElement | null> }) {
  const closeButton = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) closeButton.current?.focus();
    else toggleRef.current?.focus();
    return () => { document.body.classList.remove("menu-open"); document.body.style.overflow = ""; };
  }, [open, toggleRef]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 901px)");
    const onChange = () => { if (media.matches && open) onClose(); };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [open, onClose]);

  return (
    <div className="menu" data-open={open} role="dialog" aria-modal="true" aria-label="Site menu" aria-hidden={!open} inert={!open ? true : undefined} id="mobileMenu">
      {MENU_LINKS.map((link, index) => (
        link.external ? (
          <Link key={link.label} className="menu__item" style={{ "--i": index } as React.CSSProperties} href={link.href} ref={index === 0 ? closeButton : undefined} onClick={onClose} tabIndex={open ? 0 : -1}>
            {link.label}
          </Link>
        ) : (
          <a key={link.label} className="menu__item" style={{ "--i": index } as React.CSSProperties} href={link.href} ref={index === 0 ? closeButton : undefined} onClick={onClose} tabIndex={open ? 0 : -1}>
            {link.label}
          </a>
        )
      ))}
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

function JoinForm() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ title: string; detail: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await groupRequest<{ ok: boolean; roomId: string }>("/api/group-study/rooms/join", {
        method: "POST", body: JSON.stringify({ displayName: name, code }),
      });
      rememberRoomId(result.roomId);
      window.location.href = `/group-study?room=${encodeURIComponent(result.roomId)}`;
    } catch (cause) {
      const raw = errorMessage(cause);
      const known: Record<string, { title: string; detail: string }> = {
        "That study room couldn't be found or is unavailable.": { title: "Room unavailable", detail: "Check the study code and try again." },
        "Too many join attempts. Wait a few minutes and try again.": { title: "Too many attempts", detail: "Wait a few minutes before trying this code again." },
        "Display names are 2–40 characters with no control characters.": { title: "Check your name", detail: "Use 2–40 characters with no special control characters." },
        "Enter your name and a study code.": { title: "Details missing", detail: "Enter your name and the study code from your host." },
      };
      setStatus(known[raw] ?? { title: "Couldn't join", detail: "Scholar couldn't complete that request. Please try again." });
      setBusy(false);
    }
  };

  const canSubmit = name.trim().length >= 2 && code.trim().length >= 6 && !busy;

  return (
    <form className="card__form" noValidate onSubmit={submit} id="join">
      <div className="card__field">
        <label className="card__label" htmlFor="gs-name">Your name</label>
        <div className="card__control">
          <Users className="card__control-icon" aria-hidden="true" />
          <input
            className="card__input" id="gs-name" name="displayName" autoComplete="nickname"
            placeholder="e.g. Johan" value={name} maxLength={40}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      </div>
      <div className="card__field">
        <label className="card__label" htmlFor="gs-code">Study code</label>
        <div className="card__control">
          <Hash className="card__control-icon" aria-hidden="true" />
          <input
            className="card__input" id="gs-code" name="code" autoComplete="off" spellCheck={false}
            placeholder="SCH-XXXXXXXX" value={code} maxLength={16}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </div>
      </div>
      {status ? <FormStatus title={status.title} detail={status.detail} /> : null}
      <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
        {busy ? "Joining…" : "Join Study Room"} <ArrowRight aria-hidden="true" />
      </button>
      <Link href="/?signin=1" className="btn btn--glass" role="button">
        Sign in as host
      </Link>
      <p className="card__note">No Scholar account is required to join. Room access is approved by the host.</p>
    </form>
  );
}

const INSIDE_ITEMS = [
  { icon: FileText, label: "Shared PDF materials with page sync" },
  { icon: Sparkles, label: "Group LAM powered study help" },
  { icon: BarChart3, label: "Live quizzes, polls and focus timers" },
  { icon: MessageSquare, label: "Study chat with host announcements" },
];

export function GroupStudyLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const toggleButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("room");
    const saved = fromUrl || storedRoomId();
    if (fromUrl) rememberRoomId(fromUrl);
    if (!saved) {
      const idle = window.setTimeout(() => setReady(true), 0);
      return () => window.clearTimeout(idle);
    }
    groupRequest(`/api/group-study/rooms/${encodeURIComponent(saved)}`)
      .then(() => setRoomId(saved))
      .catch(() => rememberRoomId(null))
      .finally(() => setReady(true));
  }, []);

  const exit = useCallback(() => {
    rememberRoomId(null);
    window.history.replaceState(null, "", "/group-study");
    setRoomId(null);
  }, []);

  if (ready && roomId) return <RoomShell roomId={roomId} onExit={exit} />;

  return (
    <div className="gs-landing">
      <section className="hero" aria-label="Scholar Group Study">
        <ScholarBackground />
        <div className="hero__scrim" aria-hidden="true" />

        <header className="nav">
          <Link className="nav__logo" href="/" aria-label="Scholar home">
            <span className="nav__logo-mark" aria-hidden="true"><Orbit /></span>
            SCHOLAR
          </Link>
          <span className="nav__meta">GROUP STUDY · <strong>BETA</strong></span>
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
        <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} toggleRef={toggleButton} />

        <main className="hero__body">
          <div className="intro">
            <p className="intro__kicker"><Users aria-hidden="true" /> GROUP STUDY</p>
            <h1 className="intro__title">Learn <em>together.</em><br />Think together.</h1>
            <p className="intro__support">Join a live Scholar study room, share materials, ask Group LAM questions, solve quizzes, and stay focused together.</p>
          </div>

          <div className="cards">
            <section className="card gs-glass-card" aria-labelledby="gs-join-title">
              <div className="card__icon"><Users aria-hidden="true" /></div>
              <h2 className="card__title" id="gs-join-title">Join a study room</h2>
              <p className="card__support">Enter your name and the study code your host shared with you.</p>
              <JoinForm />
            </section>

            <section className="card gs-glass-card" aria-labelledby="gs-inside-title">
              <div className="card__icon"><Sparkles aria-hidden="true" /></div>
              <h2 className="card__title" id="gs-inside-title">What happens inside</h2>
              <p className="card__support">Your host shares study material and opens the room. Inside you can follow the shared PDF, ask Group LAM questions, join quizzes and focus sessions, and discuss in the study chat.</p>
              <ul className="card__list">
                {INSIDE_ITEMS.map((item) => (
                  <li key={item.label} className="card__item">
                    <span className="card__item-icon" aria-hidden="true"><item.icon /></span>
                    {item.label}
                  </li>
                ))}
              </ul>
              <hr className="card__divider" />
              <p className="card__fineprint">During private beta, room creation is limited to the authorized Scholar account.</p>
            </section>
          </div>
        </main>

        <footer className="legal">
          <p className="legal__copy">Group Study is a temporary host-controlled Scholar session. Display names, room chat, and shared materials may be visible to other room participants.</p>
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
