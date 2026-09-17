"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, ShieldCheck, Plus, Play, ChevronRight, Sparkles } from "lucide-react";
import { groupRequest, errorMessage } from "@/components/group-study/client";
import { RoomShell, storedRoomId } from "@/components/group-study/room-shell";
import "@/components/group-study/group-study.css";

type Overview = { canHost: boolean; roomId?: string; rooms?: Array<{ id: string; name: string; status: string; createdAt: string }> };

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function JoinCard({ onJoined, notice }: { onJoined: (roomId: string) => void; notice?: string }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await groupRequest<{ ok: boolean; roomId: string; role: string; status: string }>("/api/group-study/rooms/join", {
        method: "POST", body: JSON.stringify({ displayName: name, code }),
      });
      onJoined(result.roomId);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally { setBusy(false); }
  };

  return (
    <form className="gs-form" onSubmit={submit}>
      {notice ? <p className="gs-note gs-error" role="alert">{notice}</p> : null}
      <label className="gs-field">Your name
        <input className="gs-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Johan" maxLength={40} required minLength={2} autoComplete="nickname" />
      </label>
      <label className="gs-field">Study code
        <input className="gs-input gs-code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SCH-XXXXXXXX" maxLength={16} required autoComplete="off" spellCheck={false} />
      </label>
      {error ? <p className="gs-note gs-error" role="alert">{error}</p> : null}
      <button className="gs-button gs-button-primary" type="submit" disabled={busy || name.trim().length < 2 || !code.trim()}>
        {busy ? "Joining…" : "Join Study Room"}
      </button>
      <p className="gs-fineprint">No account needed. You appear in the room as your display name, and the host admits you.</p>
    </form>
  );
}

function CreateCard({ onCreated }: { onCreated: (roomId: string) => void }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await groupRequest<{ ok: true; roomId: string }>("/api/group-study/rooms", {
        method: "POST", body: JSON.stringify({ name, subject, topic }),
      });
      onCreated(result.roomId);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally { setBusy(false); }
  };

  return (
    <form className="gs-form" onSubmit={submit}>
      <label className="gs-field">Room name
        <input className="gs-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Physics Revision" maxLength={80} required minLength={2} />
      </label>
      <label className="gs-field">Subject <span className="gs-fineprint">(optional)</span>
        <input className="gs-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Physics" maxLength={80} />
      </label>
      <label className="gs-field">Topic <span className="gs-fineprint">(optional)</span>
        <input className="gs-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Work, Energy and Power" maxLength={160} />
      </label>
      {error ? <p className="gs-note gs-error" role="alert">{error}</p> : null}
      <button className="gs-button gs-button-primary" type="submit" disabled={busy || name.trim().length < 2}>
        {busy ? "Creating…" : "Create Study Room"}
      </button>
      <p className="gs-fineprint">A study code is generated for the room. Share it with your group.</p>
    </form>
  );
}

function EntryView({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [showHostForms, setShowHostForms] = useState(false);
  const now = useNow(30_000);

  useEffect(() => {
    const controller = new AbortController();
    groupRequest<Overview>("/api/group-study/rooms", { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setOverview(value); })
      .catch(() => { if (!controller.signal.aborted) setOverview({ canHost: false }); });
    return () => controller.abort();
  }, []);

  const done = useCallback((roomId: string) => {
    router.push(`/group-study?room=${encodeURIComponent(roomId)}`);
  }, [router]);

  const isHost = overview?.canHost === true;
  return (
    <div className="group-study">
      <div className="gs-shade" />
      <div className="gs-wrap">
        <header className="gs-top">
          <Link className="gs-brand" href="/"><Users aria-hidden="true" /> Group Study</Link>
          <span className="gs-top-note">GROUP STUDY · <strong>BETA</strong></span>
        </header>

        <section className="gs-hero">
          <p className="gs-kicker"><Users aria-hidden="true" /> Group Study</p>
          <h1>Learn <em>together</em>. Think together.</h1>
          <p>Join a room with a study code, share materials, ask LAM questions together, solve quizzes and stay focused as a group.</p>
        </section>

        <div className="gs-entry-grid">
          <section className="gs-glass gs-card" aria-labelledby="gs-join-head">
            <div className="gs-icon"><Users aria-hidden="true" /></div>
            <h2 id="gs-join-head">Join a study room</h2>
            <p>Enter your name and the study code your host shared with you.</p>
            <JoinCard onJoined={done} notice={initialError} />
          </section>

          {isHost ? (
            <section className="gs-glass gs-card" aria-labelledby="gs-host-head">
              <div className="gs-icon"><ShieldCheck aria-hidden="true" /></div>
              <h2 id="gs-host-head">Host a room</h2>
              {showHostForms || overview?.roomId || (overview?.rooms?.length ?? 0) > 0 ? (
                <CreateCard onCreated={done} />
              ) : (
                <>
                  <p>You&apos;re signed in as the authorized beta host. Create a room and invite your group with a code.</p>
                  <div className="gs-actions">
                    <button className="gs-button gs-button-primary" onClick={() => setShowHostForms(true)}><Plus aria-hidden="true" /> Create Study Room</button>
                  </div>
                </>
              )}
              {overview?.roomId ? (
                <div className="gs-actions">
                  <button className="gs-button" onClick={() => done(overview.roomId!)}><Play aria-hidden="true" /> Resume active room</button>
                </div>
              ) : null}
              {overview?.rooms?.length ? (
                <div className="gs-recent">
                  <hr className="gs-divider" />
                  <h3 style={{ fontSize: 13, margin: "0 0 12px" }}>Recent rooms</h3>
                  <div className="gs-list">
                    {overview.rooms.slice(0, 4).map((room) => (
                      <button key={room.id} className="gs-glass gs-list-item" onClick={() => done(room.id)}>
                        <span><strong>{room.name}</strong><small>{new Date(room.createdAt).toLocaleString()} · {room.status}</small></span>
                        <ChevronRight aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="gs-glass gs-card" aria-labelledby="gs-about-head">
              <div className="gs-icon"><Sparkles aria-hidden="true" /></div>
              <h2 id="gs-about-head">What happens inside</h2>
              <p className="gs-muted">Your host shares study material and opens the room. Inside you can follow the shared PDF, ask Group LAM questions, join quizzes and focus sessions, and discuss in the study chat.</p>
              <ul className="gs-muted" style={{ paddingLeft: 18, margin: "14px 0 0", lineHeight: 2 }}>
                <li>Shared PDF materials with page sync</li>
                <li>Group LAM powered study help</li>
                <li>Live quizzes, polls and focus timers</li>
                <li>Study chat with host announcements</li>
              </ul>
              <p className="gs-fineprint" style={{ marginTop: 16 }}>During private beta, room creation is limited to the authorized Scholar account.</p>
            </section>
          )}
        </div>

        <p className="gs-footer">Group Study is a temporary, hosted study session. Display names and room messages are visible to everyone in the room. Materials shared by the host are visible to the room.</p>
      </div>
    </div>
  );
}

export function GroupStudyView({ standalone, initialError }: { standalone?: boolean; initialError?: string }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("room");
    const saved = fromUrl || storedRoomId();
    if (fromUrl) {
      try { window.localStorage.setItem("scholar.group-study.room", fromUrl); } catch { /* ignore */ }
    }
    if (!saved) {
      const idle = window.setTimeout(() => setReady(true), 0);
      return () => window.clearTimeout(idle);
    }
    groupRequest(`/api/group-study/rooms/${encodeURIComponent(saved)}`)
      .then(() => setRoomId(saved))
      .catch(() => { try { window.localStorage.removeItem("scholar.group-study.room"); } catch { /* ignore */ } })
      .finally(() => setReady(true));
  }, []);

  const exit = useCallback(() => {
    try { window.localStorage.removeItem("scholar.group-study.room"); } catch { /* ignore */ }
    setRoomId(null);
  }, []);

  if (!ready) {
    return (
      <div className="group-study">
        <div className="gs-shade" />
        <div className="gs-wrap"><div className="gs-wait gs-glass" role="status"><div className="gs-icon"><Users aria-hidden="true" /></div><h2 style={{ fontWeight: 500 }}>Opening Group Study…</h2></div></div>
      </div>
    );
  }
  if (roomId) return <RoomShell roomId={roomId} onExit={exit} />;
  return <EntryView initialError={initialError} />;
}
