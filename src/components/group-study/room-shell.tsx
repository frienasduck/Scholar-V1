"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Users, ArrowLeft, Copy, Share2, Upload, FileText, Send, Sparkles, Timer, ListChecks,
  StickyNote, MessageSquare, Play, Pause, Square, Hand, Lock, Unlock, Trash2, Check, X,
  Plus, RotateCcw, Eye, CircleStop, ChevronLeft, ChevronRight, BookOpen, ShieldCheck,
} from "lucide-react";
import { useGroupRoom, type GroupRoomController } from "@/components/group-study/use-room";
import { groupRequest, errorMessage, formatRoomCode, copyRoomCode } from "@/components/group-study/client";
import "./group-study.css";
import type { RoomSnapshot } from "@/lib/group-study/types";

const ROOM_TABS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "materials", label: "Materials", icon: FileText },
  { id: "lam", label: "Group LAM", icon: Sparkles },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "quiz", label: "Quiz", icon: ListChecks },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "participants", label: "People", icon: Users },
] as const;
type RoomTabId = (typeof ROOM_TABS)[number]["id"] | "host";

const STORAGE_KEY = "scholar.group-study.room";

export function storedRoomId(): string | null {
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
export function rememberRoomId(roomId: string | null) {
  try {
    if (roomId) window.localStorage.setItem(STORAGE_KEY, roomId);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* storage unavailable */ }
}
function initials(name: string) { return name.trim().slice(0, 2).toUpperCase() || "?"; }
const formatCode = formatRoomCode;

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* ============================== Room shell ============================== */

function ShareRow({ code }: { code: string }) {
  const [copied, setCopied] = useState<"code" | "message" | null>(null);
  const [copyError, setCopyError] = useState("");
  const shareText = `Join my Scholar Group Study room.\n\nCode: ${formatCode(code)}`;
  const copy = async (kind: "code" | "message") => {
    try {
      setCopyError("");
      if (kind === "code") await copyRoomCode(code);
      else await navigator.clipboard.writeText(shareText);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch { setCopied(null); setCopyError("Copy unavailable. Select the room code and copy it manually."); }
  };
  const share = async () => {
    const navigatorWithShare = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof navigatorWithShare.share === "function") {
      try { await navigatorWithShare.share({ title: "Scholar Group Study", text: shareText }); return; } catch { /* cancelled */ }
    }
    await copy("message");
  };
  return (
    <div className="gs-inline">
      <code className="gs-code-chip" aria-label={`Study code ${formatCode(code)}`}>{formatCode(code)}</code>
      <button className="gs-button gs-button-icon" onClick={() => void copy("code")} aria-label="Copy code" title="Copy code">
        {copied === "code" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
      <button className="gs-button" onClick={() => void share()}><Share2 aria-hidden="true" /> Share</button>
      {copyError ? <span role="status" className="gs-fineprint">{copyError}</span> : null}
    </div>
  );
}

function PendingView({ snapshot, onLeave }: { snapshot: RoomSnapshot; onLeave: () => void }) {
  return (
    <div className="gs-wait gs-glass">
      <div className="gs-icon"><Users aria-hidden="true" /></div>
      <h2 style={{ margin: "0 0 8px", fontWeight: 500 }}>Waiting for host approval…</h2>
      <p className="gs-muted">You joined as <strong>{snapshot.me.displayName}</strong>. {snapshot.me.status === "denied" ? "The host declined your request." : "The host will admit you shortly."} Keep this page open — you&apos;ll enter automatically once approved.</p>
      {snapshot.me.status !== "denied" ? <div className="gs-status" data-state="reconnecting" style={{ margin: "18px auto 0" }}><span className="gs-status-dot" /> Request pending</div> : null}
      <div className="gs-actions" style={{ justifyContent: "center" }}>
        <button className="gs-button" onClick={onLeave}><ArrowLeft aria-hidden="true" /> Leave</button>
      </div>
    </div>
  );
}

function EndedView({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="gs-wait gs-glass">
      <div className="gs-icon"><CircleStop aria-hidden="true" /></div>
      <h2 style={{ margin: "0 0 8px", fontWeight: 500 }}>Your Group Study session has ended.</h2>
      <p className="gs-muted">{message}</p>
      <div className="gs-actions" style={{ justifyContent: "center" }}>
        <button className="gs-button gs-button-primary" onClick={onBack}><ArrowLeft aria-hidden="true" /> Back to Group Study</button>
      </div>
    </div>
  );
}

function Conversation({ controller }: { controller: GroupRoomController }) {
  const { snapshot, action, error, busy, setError } = controller;
  const [draft, setDraft] = useState("");
  const feedRef = useRef<HTMLDivElement | null>(null);
  const messages = snapshot?.messages ?? [];
  const meId = snapshot?.me.id;

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [messages.length]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setDraft("");
    const ok = await action("chat", { body });
    if (!ok) setDraft(body);
  };

  if (!snapshot) return null;
  return (
    <section className="gs-glass gs-conversation" aria-label="Study chat">
      <div className="gs-messages" ref={feedRef}>
        {messages.length === 0 ? <p className="gs-empty gs-muted">No messages yet. Keep it about the study material.</p> : null}
        {messages.map((message) => {
          const mine = message.id.startsWith(meId ?? "\u0000");
          return (
            <article key={message.id} className="gs-message" data-mine={mine} data-kind={message.kind}>
              <div className="gs-message-meta"><strong>{mine ? "You" : message.author}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
              <p className="gs-message-body">{message.body}</p>
            </article>
          );
        })}
      </div>
      {snapshot.room.announcement ? (
        <p className="gs-note" style={{ margin: "0 16px" }} role="status"><Sparkles aria-hidden="true" /> {snapshot.room.announcement}</p>
      ) : null}
      <form className="gs-composer" onSubmit={send}>
        <textarea aria-label="Message" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={snapshot.me.chatMuted ? "The host muted chat for you." : snapshot.room.chatEnabled ? "Message the room…" : "Chat is off."} disabled={!snapshot.room.chatEnabled || snapshot.me.chatMuted} maxLength={2000} rows={1} />
        <button className="gs-button gs-button-icon gs-button-primary" type="submit" disabled={busy || !draft.trim() || !snapshot.room.chatEnabled || snapshot.me.chatMuted} aria-label="Send">
          <Send aria-hidden="true" />
        </button>
      </form>
      {error ? <p className="gs-note gs-error" style={{ margin: "0 16px 12px" }} role="alert">{error} <button type="button" className="gs-button" style={{ minHeight: 30 }} onClick={() => setError(null)}>Dismiss</button></p> : null}
    </section>
  );
}

function LamPanel({ controller }: { controller: GroupRoomController }) {
  const { snapshot, refresh } = controller;
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("explain");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = prompt.trim();
    if (!body || busy) return;
    setBusy(true);
    setError("");
    try {
      await groupRequest(`/api/group-study/rooms/${encodeURIComponent(snapshot!.room.id)}/ai`, { method: "POST", body: JSON.stringify({ prompt: body, mode }) });
      setPrompt("");
      await refresh();
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  };

  const askMaterial = async (operation: string, resourceId: string) => {
    setBusy(true); setError("");
    try {
      await groupRequest(`/api/group-study/rooms/${encodeURIComponent(snapshot!.room.id)}/resources/${encodeURIComponent(resourceId)}/analysis`, { method: "POST", body: JSON.stringify({ operation }) });
      await refresh();
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  };

  if (!snapshot) return null;
  const aiMessages = snapshot.messages.filter((m) => m.kind === "ai" || m.kind === "chat");
  return (
    <div className="gs-room-main">
      <section className="gs-glass gs-card">
        <div className="gs-lam gs-glass" style={{ margin: 0 }}>
          <span className="gs-lam-mark"><Sparkles aria-hidden="true" /></span>
          <label>Ask Group LAM
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={snapshot.room.aiEnabled ? "e.g. Explain work-energy theorem" : "The host paused Group LAM."} disabled={!snapshot.room.aiEnabled} maxLength={2000} />
            <small>Answers appear in the room chat for everyone.</small>
          </label>
          <select className="gs-select" style={{ maxWidth: 150 }} value={mode} onChange={(e) => setMode(e.target.value)} aria-label="LAM mode" disabled={!snapshot.room.aiEnabled}>
            <option value="explain">Explain</option>
            <option value="teach">Teach</option>
            <option value="socratic">Socratic</option>
            <option value="summary">Summarize</option>
            <option value="revision">Revision</option>
            <option value="formula">Formula</option>
          </select>
          <button className="gs-button gs-button-primary" onClick={ask} disabled={busy || !prompt.trim() || !snapshot.room.aiEnabled}>{busy ? "Thinking…" : "Ask"}</button>
        </div>
        {error ? <p className="gs-note gs-error" role="alert">{error}</p> : null}
      </section>
      {snapshot.resources.length ? (
        <section className="gs-glass gs-card" style={{ marginTop: 16 }}>
          <h2>Quick material tools</h2>
          <p className="gs-muted">Grounded in the room&apos;s shared material.</p>
          <div className="gs-actions">
            {snapshot.resources.map((resource) => (
              <span key={resource.id} className="gs-inline">
                <button className="gs-button" disabled={busy || !snapshot.room.aiEnabled} onClick={() => void askMaterial("summary", resource.id)}><FileText aria-hidden="true" /> Summarize {resource.name.slice(0, 22)}</button>
                {snapshot.me.role === "host" ? (
                  <button className="gs-button" disabled={busy || !snapshot.room.aiEnabled} onClick={() => void askMaterial("quiz", resource.id)}><ListChecks aria-hidden="true" /> Quiz from {resource.name.slice(0, 16)}</button>
                ) : null}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      <section className="gs-glass gs-card gs-ai-output" style={{ marginTop: 16 }}>
        {aiMessages.length === 0 ? <p className="gs-muted">Group LAM answers will appear here and in chat.</p> : aiMessages.slice().reverse().slice(0, 12).map((message) => (
          <article key={message.id} style={{ marginBottom: 18 }}>
            <p className="gs-message-meta"><strong>{message.kind === "ai" ? "Group LAM" : message.author}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></p>
            <p className="gs-message-body">{message.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function MaterialsPanel({ controller }: { controller: GroupRoomController }) {
  const { snapshot, action, refresh } = controller;
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [viewer, setViewer] = useState<{ url: string; name: string; mimeType: string } | null>(null);
  const [localPage, setLocalPage] = useState<number | null>(null);

  if (!snapshot) return null;
  const roomId = snapshot.room.id;
  const canUpload = snapshot.me.role === "host" || snapshot.room.participantUploads;

  const upload = async (file: File) => {
    setUploading(true); setError("");
    try {
      const data = new FormData();
      data.append("file", file);
      await groupRequest(`/api/group-study/rooms/${encodeURIComponent(roomId)}/resources`, { method: "POST", body: data });
      await refresh();
    } catch (cause) { setError(errorMessage(cause)); } finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  };

  const open = (resource: { id: string; name: string; mimeType: string }) => {
    const url = `/api/group-study/rooms/${encodeURIComponent(roomId)}/resources/${encodeURIComponent(resource.id)}`;
    if (resource.mimeType === "application/pdf" || resource.mimeType.startsWith("image/")) {
      setViewer({ url, name: resource.name, mimeType: resource.mimeType });
    } else {
      window.open(url, "_blank", "noopener");
    }
  };

  const activeResource = snapshot.resources.find((r) => r.id === snapshot.room.activeResourceId);
  const following = snapshot.room.followHost && snapshot.me.role === "participant";
  const page = following ? snapshot.room.page : (localPage ?? snapshot.room.page);

  return (
    <div className="gs-room-main">
      <section className="gs-glass gs-card">
        <div className="gs-section-head">
          <div><h2>Shared materials</h2><p className="gs-muted">{activeResource ? `Active: ${activeResource.name} · page ${snapshot.room.page}` : "No material is active yet."}</p></div>
          {canUpload ? (
            <>
              <input ref={fileInput} type="file" accept=".pdf,image/png,image/jpeg,.txt,text/plain" className="gs-hidden-input" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
              <button className="gs-button" onClick={() => fileInput.current?.click()} disabled={uploading}><Upload aria-hidden="true" /> {uploading ? "Uploading…" : "Upload PDF"}</button>
            </>
          ) : null}
        </div>
        {error ? <p className="gs-note gs-error" role="alert">{error}</p> : null}
        {snapshot.resources.length === 0 ? (
          <div className="gs-empty"><FileText aria-hidden="true" /><h3>No materials yet</h3><p className="gs-muted">{canUpload ? "Upload a PDF or image to study together." : "The host hasn't shared any material yet."}</p></div>
        ) : (
          <div className="gs-list">
            {snapshot.resources.map((resource) => (
              <div key={resource.id} className="gs-glass gs-list-item" style={{ cursor: "default" }}>
                <span><strong>{resource.name}</strong><small>{resource.mimeType} · {(resource.sizeBytes / 1024).toFixed(0)} KB{resource.pageCount > 1 ? ` · ${resource.pageCount} pages` : ""}</small></span>
                <span className="gs-inline">
                  <button className="gs-button" onClick={() => open(resource)}><Eye aria-hidden="true" /> Open</button>
                  {snapshot.me.role === "host" ? (
                    <button className={snapshot.room.activeResourceId === resource.id ? "gs-button gs-button-primary" : "gs-button"} onClick={() => void action("resource", { resourceId: resource.id })} disabled={resource.id === snapshot.room.activeResourceId}>
                      {snapshot.room.activeResourceId === resource.id ? <Check aria-hidden="true" /> : <BookOpen aria-hidden="true" />} {snapshot.room.activeResourceId === resource.id ? "Active" : "Set active"}
                    </button>
                  ) : null}
                  {resource.id === snapshot.room.activeResourceId ? (
                    <button className="gs-button gs-button-icon" onClick={() => void action("page", { page: Math.max(1, page - 1) })} aria-label="Previous page" disabled={page <= 1}><ChevronLeft aria-hidden="true" /></button>
                  ) : null}
                  {resource.id === snapshot.room.activeResourceId && resource.pageCount > 1 ? (
                    <input className="gs-input" style={{ width: 64 }} type="number" min={1} max={resource.pageCount} value={page} onChange={(e) => setLocalPage(Math.max(1, Math.min(resource.pageCount, Number(e.target.value) || 1)))} aria-label="Page number" />
                  ) : null}
                  {resource.id === snapshot.room.activeResourceId ? (
                    <button className="gs-button gs-button-icon" onClick={() => void action("page", { page: Math.min(resource.pageCount, page + 1) })} aria-label="Next page" disabled={page >= resource.pageCount}><ChevronRight aria-hidden="true" /></button>
                  ) : null}
                  {snapshot.me.role === "host" ? (
                    <button className="gs-button gs-button-danger" onClick={() => void action("resource", { resourceId: resource.id, remove: true })} aria-label={`Remove ${resource.name}`}><Trash2 aria-hidden="true" /></button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
        {snapshot.room.activeResourceId ? (
          <p className="gs-fineprint" style={{ marginTop: 14 }}>{following ? "Following the host's page. " : "You are reading independently."} Host controls page sync with Follow Host.</p>
        ) : null}
      </section>

      {viewer ? (
        <section className="gs-glass gs-card" style={{ marginTop: 16 }}>
          <div className="gs-section-head">
            <h2>{viewer.name}</h2>
            <button className="gs-button" onClick={() => { setViewer(null); }}><X aria-hidden="true" /> Close</button>
          </div>
          {viewer.mimeType === "application/pdf" ? (
            <object className="gs-document" data={viewer.url} type="application/pdf" aria-label={`PDF viewer for ${viewer.name}`}>
              <p className="gs-muted">Inline PDF display isn&apos;t available here. <a href={viewer.url} target="_blank" rel="noopener" className="gs-button">Open the PDF</a></p>
            </object>
          ) : (
            <div className="gs-resource-preview"><img src={viewer.url} alt={viewer.name} /></div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function QuizPanel({ controller }: { controller: GroupRoomController }) {
  const { snapshot, action, busy } = controller;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  if (!snapshot) return null;
  const quiz = snapshot.quiz;
  const isHost = snapshot.me.role === "host";

  if (!quiz) {
    return (
      <div className="gs-room-main">
        <section className="gs-glass gs-card">
          <div className="gs-empty"><ListChecks aria-hidden="true" /><h3>No quiz running</h3><p className="gs-muted">{isHost ? "Start one from Group LAM (Quiz us) or from a material's Quiz action." : "When the host starts a quiz, it appears here."}</p></div>
        </section>
      </div>
    );
  }
  const answeredAll = quiz.questions.every((question) => answers[question.id] !== undefined || quiz.myAnswers[question.id] !== undefined);

  return (
    <div className="gs-room-main">
      <section className="gs-glass gs-card">
        <div className="gs-section-head">
          <div><h2>{quiz.title}</h2><p className="gs-muted">{quiz.revealed ? "Answers revealed." : `${quiz.responseCount} of ${snapshot.participants.filter((p) => p.status === "approved").length} answered`}</p></div>
          {isHost && !quiz.revealed ? <button className="gs-button gs-button-primary" disabled={busy} onClick={() => void action("reveal", { quizId: quiz.id })}><Eye aria-hidden="true" /> Reveal answers</button> : null}
        </div>
        {quiz.questions.map((question, index) => {
          const my = quiz.myAnswers[question.id] ?? answers[question.id];
          return (
            <fieldset key={question.id} style={{ border: 0, margin: "0 0 22px", padding: 0 }}>
              <legend style={{ padding: 0, marginBottom: 10, fontSize: 14, fontWeight: 550 }}>{index + 1}. {question.question}</legend>
              <div style={{ display: "grid", gap: 8 }}>
                {question.options.map((option, optionIndex) => {
                  const selected = my === optionIndex;
                  const showCorrect = quiz.revealed && question.correctAnswer === optionIndex;
                  const showWrongPick = quiz.revealed && selected && question.correctAnswer !== optionIndex;
                  return (
                    <button key={optionIndex} type="button" className="gs-quiz-option" data-selected={selected}
                      style={showCorrect ? { borderColor: "#7fc79f", background: "rgb(127 199 159 / .12)" } : showWrongPick ? { borderColor: "rgb(255 169 155 / .4)" } : undefined}
                      disabled={busy || quiz.revealed || quiz.myAnswers[question.id] !== undefined}
                      onClick={() => { setAnswers((previous) => ({ ...previous, [question.id]: optionIndex })); void action("answer", { quizId: quiz.id, questionId: question.id, answer: optionIndex }); }}>
                      <span aria-hidden="true">{"ABCD"[optionIndex] ?? optionIndex + 1}</span>
                      <span>{option}{showCorrect ? " ✓" : ""}{showWrongPick ? " ✗" : ""}</span>
                    </button>
                  );
                })}
              </div>
              {quiz.revealed && question.explanation ? <p className="gs-fineprint" style={{ marginTop: 8 }}>{question.explanation}</p> : null}
            </fieldset>
          );
        })}
        {!quiz.revealed && !isHost ? <p className="gs-fineprint">{answeredAll ? "All answered. Waiting for the host to reveal." : "Your answers are private until the host reveals."}</p> : null}
        {quiz.revealed && quiz.results?.length ? (
          <>
            <hr className="gs-divider" />
            <h3 style={{ fontSize: 13, margin: "0 0 12px" }}>Results</h3>
            <div className="gs-list">
              {quiz.results.map((result) => (
                <div key={result.participantId} className="gs-glass gs-list-item" style={{ cursor: "default" }}>
                  <span><strong>{result.displayName}</strong></span><span>{result.score} / {result.total}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>
      {snapshot.poll ? (
        <section className="gs-glass gs-card" style={{ marginTop: 16 }}>
          <div className="gs-section-head"><h2>Poll</h2><p className="gs-muted">{snapshot.poll.counts.reduce((a, b) => a + b, 0)} votes</p></div>
          <p style={{ fontWeight: 550 }}>{snapshot.poll.question}</p>
          <div style={{ display: "grid", gap: 8 }}>
            {snapshot.poll.options.map((option, index) => {
              const total = Math.max(1, snapshot.poll!.counts.reduce((a, b) => a + b, 0));
              const percent = Math.round((snapshot.poll!.counts[index] / total) * 100);
              return (
                <button key={index} className="gs-quiz-option" data-selected={snapshot.poll!.myVote === index} disabled={busy}
                  onClick={() => void action("vote", { pollId: snapshot.poll!.id, option: index })}>
                  <span>{index + 1}</span>
                  <span style={{ flex: 1, textAlign: "left" }}>{option}</span>
                  <span aria-label={`${percent} percent`}>{percent}%</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FocusPanel({ controller }: { controller: GroupRoomController }) {
  const { snapshot, action, busy } = controller;
  const now = useNow(1000);
  if (!snapshot) return null;
  const focus = snapshot.focus;
  const isHost = snapshot.me.role === "host";
  const remaining = focus ? (focus.status === "running" && focus.endsAt ? Math.max(0, Math.ceil((Date.parse(focus.endsAt) - now) / 1000)) : focus.remainingSeconds) : null;
  const minutes = remaining === null ? null : String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = remaining === null ? null : String(remaining % 60).padStart(2, "0");

  return (
    <div className="gs-room-main">
      <section className="gs-glass gs-card" style={{ textAlign: "center" }}>
        <p className="gs-kicker" style={{ justifyContent: "center" }}><Timer aria-hidden="true" /> Focus session</p>
        {focus && remaining !== null ? (
          <>
            <p className="gs-timer" role="timer" aria-live="off">{minutes}:{seconds}</p>
            <p className="gs-muted">{focus.status === "running" ? "Studying — stay on task." : focus.status === "paused" ? "Paused." : "Session complete."}</p>
            <div className="gs-actions" style={{ justifyContent: "center" }}>
              {isHost ? (
                <>
                  {focus.status === "running" ? <button className="gs-button" disabled={busy} onClick={() => void action("focus", { operation: "pause" })}><Pause aria-hidden="true" /> Pause</button> : null}
                  {focus.status === "paused" ? <button className="gs-button gs-button-primary" disabled={busy} onClick={() => void action("focus", { operation: "resume" })}><Play aria-hidden="true" /> Resume</button> : null}
                  {focus.status !== "completed" ? <button className="gs-button gs-button-danger" disabled={busy} onClick={() => void action("focus", { operation: "stop" })}><Square aria-hidden="true" /> End</button> : null}
                </>
              ) : <span className="gs-fineprint">The host controls the timer.</span>}
            </div>
          </>
        ) : (
          <>
            <p className="gs-muted" style={{ margin: "10px auto 0" }}>A synchronized study sprint. The host starts it; everyone sees the same clock.</p>
            {isHost ? (
              <div className="gs-actions" style={{ justifyContent: "center" }}>
                {[10, 25, 50].map((duration) => (
                  <button key={duration} className="gs-button gs-button-primary" disabled={busy} onClick={() => void action("focus", { operation: "start", durationSeconds: duration * 60 })}>
                    <Play aria-hidden="true" /> {duration} min
                  </button>
                ))}
              </div>
            ) : <p className="gs-fineprint">Waiting for the host to start a focus session.</p>}
          </>
        )}
      </section>
    </div>
  );
}

function NotesPanel({ controller }: { controller: GroupRoomController }) {
  const { snapshot, action, busy } = controller;
  const [draft, setDraft] = useState<string | null>(null);
  if (!snapshot) return null;
  const editable = snapshot.me.role === "host" || snapshot.room.notesEditable;
  const value = draft ?? snapshot.notes;
  const dirty = draft !== null && draft !== snapshot.notes;

  return (
    <div className="gs-room-main">
      <section className="gs-glass gs-card">
        <div className="gs-section-head">
          <div><h2>Shared notes</h2><p className="gs-muted">{editable ? "Everyone in the room can read this; " : "Read-only; "}{snapshot.me.role === "host" ? "you" : "the host"}{" can "}{editable ? "edit" : "enable editing"}.</p></div>
          <button className="gs-button" onClick={() => void navigator.clipboard?.writeText(value).catch(() => undefined)}><Copy aria-hidden="true" /> Copy notes</button>
        </div>
        <textarea className="gs-textarea" style={{ minHeight: 280, fontFamily: "ui-monospace, monospace" }} value={value} readOnly={!editable} onChange={(e) => setDraft(e.target.value)} aria-label="Shared study notes" />
        {editable ? (
          <div className="gs-actions">
            <button className="gs-button gs-button-primary" disabled={busy || !dirty} onClick={async () => { const ok = await action("notes", { text: draft ?? "", revision: snapshot.revision }); if (ok) setDraft(null); }}><Check aria-hidden="true" /> Save notes</button>
            {dirty ? <button className="gs-button" onClick={() => setDraft(null)}><RotateCcw aria-hidden="true" /> Discard</button> : null}
          </div>
        ) : null}
        <p className="gs-fineprint">Notes clear when the room ends. Copy anything you want to keep.</p>
      </section>
    </div>
  );
}

function PeoplePanel({ controller }: { controller: GroupRoomController }) {
  const { snapshot, action, busy } = controller;
  if (!snapshot) return null;
  const isHost = snapshot.me.role === "host";
  const pending = snapshot.participants.filter((p) => p.status === "pending");
  const approved = snapshot.participants.filter((p) => p.status === "approved");

  return (
    <div className="gs-room-main">
      {pending.length && isHost ? (
        <section className="gs-glass gs-card" style={{ marginBottom: 16 }}>
          <div className="gs-section-head"><h2>Join requests</h2><p className="gs-muted">{pending.length} waiting</p></div>
          <div className="gs-members">
            {pending.map((person) => (
              <div key={person.id} className="gs-glass gs-list-item" style={{ cursor: "default" }}>
                <span className="gs-person"><span className="gs-avatar" aria-hidden="true">{initials(person.displayName)}</span><span className="gs-person-info"><span className="gs-person-name">{person.displayName}</span><span className="gs-person-role">wants to join</span></span></span>
                <span className="gs-actions">
                  <button className="gs-button gs-button-primary" disabled={busy} onClick={() => void action("approve", { participantId: person.id })}><Check aria-hidden="true" /> Allow</button>
                  <button className="gs-button gs-button-danger" disabled={busy} onClick={() => void action("deny", { participantId: person.id })}><X aria-hidden="true" /> Deny</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="gs-glass gs-card">
        <div className="gs-section-head"><h2>Participants</h2><p className="gs-muted">{approved.length} of {snapshot.room.maxParticipants || "—"}</p></div>
        <div className="gs-members">
          {approved.map((person) => (
            <div key={person.id} className="gs-glass gs-list-item" style={{ cursor: "default" }}>
              <span className="gs-person">
                <span className="gs-avatar" aria-hidden="true">{initials(person.displayName)}</span>
                <span className="gs-person-info">
                  <span className="gs-person-name">{person.displayName}{person.id === snapshot.me.id ? " (you)" : ""}</span>
                  <span className="gs-person-role">{person.role === "host" ? "Host" : person.online ? "Online" : "Away"}{person.handRaised ? " · hand raised ✋" : ""}{person.chatMuted ? " · chat muted" : ""}</span>
                </span>
              </span>
              {isHost && person.role !== "host" ? (
                <span className="gs-actions">
                  <button className="gs-button" disabled={busy} onClick={() => void action("mute", { participantId: person.id, muted: !person.chatMuted })}>{person.chatMuted ? "Unmute" : "Mute"}</button>
                  <button className="gs-button gs-button-danger" disabled={busy} onClick={() => void action("remove", { participantId: person.id })}><Trash2 aria-hidden="true" /> Remove</button>
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {snapshot.me.role === "participant" ? (
          <div className="gs-actions">
            <button className="gs-button" disabled={busy} onClick={() => void action("hand", { raised: !snapshot.me.handRaised })}>
              <Hand aria-hidden="true" /> {snapshot.me.handRaised ? "Lower hand" : "Raise hand"}
            </button>
            <button className="gs-button gs-button-danger" onClick={() => void action("leave")}><ArrowLeft aria-hidden="true" /> Leave room</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function HostControlsPanel({ controller }: { controller: GroupRoomController }) {
  const { snapshot, action, busy } = controller;
  const [confirmEnd, setConfirmEnd] = useState(false);
  if (!snapshot) return null;
  const settings = snapshot.room;
  const toggle = (key: "requireApproval" | "aiEnabled" | "chatEnabled" | "pdfEnabled" | "participantUploads" | "notesEditable" | "followHost", label: string, hint: string) => (
    <div className="gs-glass gs-list-item" style={{ cursor: "default" }}>
      <span><strong>{label}</strong><small>{hint}</small></span>
      <button className={settings[key] ? "gs-button gs-button-primary" : "gs-button"} disabled={busy}
        onClick={() => void action("settings", { settings: { [key]: !settings[key] } })} aria-pressed={settings[key]}>
        {settings[key] ? "On" : "Off"}
      </button>
    </div>
  );
  const summary = () => {
    const approved = snapshot.participants.filter((p) => p.status === "approved").length;
    const answered = snapshot.quiz ? snapshot.quiz.responseCount : 0;
    return `Participants: ${approved} · Quiz answers: ${answered} · Materials: ${snapshot.resources.length}`;
  };

  return (
    <div className="gs-room-main">
      <section className="gs-glass gs-card">
        <div className="gs-section-head"><h2>Room</h2><p className="gs-muted">{summary()}</p></div>
        <div className="gs-list">
          <div className="gs-glass gs-list-item" style={{ cursor: "default" }}>
            <span><strong>Study code</strong><small>Participants join with this code</small></span>
            {snapshot.room.code ? <ShareRow code={snapshot.room.code} /> : null}
          </div>
          {toggle("requireApproval", "Require approval", "You admit each participant yourself")}
          <div className="gs-glass gs-list-item" style={{ cursor: "default" }}>
            <span><strong>Lock room</strong><small>{settings.locked ? "New participants cannot join" : "Room is open for new participants"}</small></span>
            <button className={settings.locked ? "gs-button gs-button-danger" : "gs-button"} disabled={busy} onClick={() => void action("lock", { locked: !settings.locked })} aria-pressed={settings.locked}>
              {settings.locked ? <><Lock aria-hidden="true" /> Locked</> : <><Unlock aria-hidden="true" /> Open</>}
            </button>
          </div>
          <div className="gs-glass gs-list-item" style={{ cursor: "default" }}>
            <span><strong>Session state</strong><small>Pause everyone or end the room</small></span>
            <span className="gs-actions">
              {snapshot.room.status === "active" ? <button className="gs-button" disabled={busy} onClick={() => void action("pause")}><Pause aria-hidden="true" /> Pause</button> : null}
              {snapshot.room.status === "paused" ? <button className="gs-button gs-button-primary" disabled={busy} onClick={() => void action("resume")}><Play aria-hidden="true" /> Resume</button> : null}
              {snapshot.room.status === "waiting" ? <button className="gs-button gs-button-primary" disabled={busy} onClick={() => void action("start")}><Play aria-hidden="true" /> Start session</button> : null}
            </span>
          </div>
        </div>
        {confirmEnd ? (
          <div className="gs-note gs-error" role="alertdialog" aria-label="Confirm end room">
            <span>End this study session for everyone?</span>
            <span className="gs-actions">
              <button className="gs-button gs-button-danger" disabled={busy} onClick={() => { setConfirmEnd(false); void action("end"); }}><CircleStop aria-hidden="true" /> End for everyone</button>
              <button className="gs-button" onClick={() => setConfirmEnd(false)}>Cancel</button>
            </span>
          </div>
        ) : (
          <div className="gs-actions">
            <button className="gs-button gs-button-danger" disabled={busy} onClick={() => setConfirmEnd(true)}><CircleStop aria-hidden="true" /> End Group Study</button>
            <button className="gs-button" disabled={busy} onClick={() => void action("regenerate-code")}><RotateCcw aria-hidden="true" /> New code</button>
            <button className="gs-button" disabled={busy} onClick={() => void action("clear-chat")}><Trash2 aria-hidden="true" /> Clear chat</button>
          </div>
        )}
      </section>

      <section className="gs-glass gs-card" style={{ marginTop: 16 }}>
        <div className="gs-section-head"><h2>Features &amp; permissions</h2><p className="gs-muted">Changes apply to everyone immediately.</p></div>
        <div className="gs-list">
          {toggle("aiEnabled", "Group LAM", "Participants can ask the room AI")}
          {toggle("chatEnabled", "Study chat", "Participants can send messages")}
          {toggle("pdfEnabled", "Shared materials", "Materials tab and PDF tools")}
          {toggle("participantUploads", "Participant uploads", "Participants may add materials")}
          {toggle("notesEditable", "Collaborative notes", "Participants can edit shared notes")}
          {toggle("followHost", "Follow Host page sync", "Viewers track the host's PDF page")}
        </div>
        <form className="gs-form" style={{ marginTop: 18 }} onSubmit={async (e) => { e.preventDefault(); const form = new FormData(e.currentTarget); await action("announce", { body: String(form.get("body") ?? "") }); e.currentTarget.reset(); }}>
          <label className="gs-field">Announcement
            <input className="gs-input" name="body" placeholder="Everyone solve Question 4 individually. 5 minutes." maxLength={1000} />
          </label>
          <button className="gs-button" type="submit" disabled={busy}><Send aria-hidden="true" /> Post announcement</button>
        </form>
      </section>
    </div>
  );
}

function OverviewPanel({ controller }: { controller: GroupRoomController }) {
  const { snapshot } = controller;
  const now = useNow(30_000);
  if (!snapshot) return null;
  const startedAt = snapshot.room.startedAt ? Date.parse(snapshot.room.startedAt) : null;
  const minutes = startedAt ? Math.max(0, Math.round((now - startedAt) / 60_000)) : null;
  const approved = snapshot.participants.filter((p) => p.status === "approved");

  return (
    <div className="gs-room-main">
      <section className="gs-glass gs-card">
        <div className="gs-stats">
          <div className="gs-stat"><strong>{approved.length}</strong><span>Studying now</span></div>
          <div className="gs-stat"><strong>{minutes === null ? "—" : `${minutes}m`}</strong><span>Session time</span></div>
          <div className="gs-stat"><strong>{snapshot.room.status}</strong><span>Room state</span></div>
        </div>
        {snapshot.room.subject || snapshot.room.topic ? <p className="gs-muted">{[snapshot.room.subject, snapshot.room.topic].filter(Boolean).join(" · ")}</p> : null}
        {snapshot.room.announcement ? <p className="gs-note" role="status"><Sparkles aria-hidden="true" /> {snapshot.room.announcement}</p> : null}
        <p className="gs-fineprint">{snapshot.room.aiEnabled ? "Group LAM is on." : "Group LAM is off."} {snapshot.room.pdfEnabled ? "Materials are shared." : "Materials are off."} {snapshot.focus ? `Focus ${snapshot.focus.status}.` : ""}</p>
        {snapshot.room.code ? <div className="gs-actions"><ShareRow code={snapshot.room.code} /></div> : null}
      </section>
      <section className="gs-glass gs-card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 13, margin: "0 0 14px" }}>Recent activity</h3>
        {snapshot.messages.length === 0 ? <p className="gs-muted">Nothing yet — say hello or ask LAM something.</p> : (
          <div className="gs-list">
            {snapshot.messages.slice(-5).reverse().map((message) => (
              <div key={message.id} className="gs-list-item" style={{ cursor: "default" }}>
                <span><strong>{message.kind === "ai" ? "Group LAM" : message.author}</strong><small>{message.body.slice(0, 120)}</small></span>
                <time className="gs-fineprint">{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function RoomShell({ roomId, onExit }: { roomId: string; onExit: () => void }) {
  const controller = useGroupRoom(roomId);
  const { snapshot, connection, error } = controller;
  const [tab, setTab] = useState<RoomTabId>("overview");

  useEffect(() => {
    rememberRoomId(roomId);
    return () => rememberRoomId(null);
  }, [roomId]);

  if (connection === "ended") {
    return <div className="group-study"><div className="gs-shade" /><div className="gs-wrap"><EndedView message={error || "This study room has ended."} onBack={onExit} /></div></div>;
  }
  if (!snapshot) {
    return (
      <div className="group-study">
        <div className="gs-shade" />
        <div className="gs-wrap"><div className="gs-wait gs-glass" role="status" aria-live="polite">
          <div className="gs-icon"><Users aria-hidden="true" /></div>
          <h2 style={{ fontWeight: 500 }}>{connection === "reconnecting" ? "Reconnecting to Group Study…" : "Opening your study room…"}</h2>
          {error ? <p className="gs-note gs-error" role="alert">{error}</p> : null}
        </div></div>
      </div>
    );
  }

  if (snapshot.room.status === "ended" || ["removed", "denied", "left"].includes(snapshot.me.status)) {
    const reason = snapshot.me.status === "removed" ? "You were removed from this study room."
      : snapshot.me.status === "denied" ? "The host declined your request to join."
      : snapshot.room.status === "ended" ? "The host ended this study session for everyone."
      : "You left this room.";
    return (
      <div className="group-study">
        <div className="gs-shade" />
        <div className="gs-wrap"><EndedView message={reason} onBack={onExit} /></div>
      </div>
    );
  }

  if (snapshot.me.status === "pending") {
    return (
      <div className="group-study">
        <div className="gs-shade" />
        <div className="gs-wrap">
          <header className="gs-top">
            <button className="gs-brand" onClick={onExit} style={{ background: "none", border: 0 }}><ArrowLeft aria-hidden="true" /> Group Study</button>
            <span className="gs-top-note">GROUP STUDY · <strong>BETA</strong></span>
          </header>
          <PendingView snapshot={snapshot} onLeave={() => { void controller.action("leave").then(ok => { if (ok) onExit(); }); }} />
        </div>
      </div>
    );
  }

  const isHost = snapshot.me.role === "host";
  const tabs: RoomTabId[] = isHost ? [...ROOM_TABS.map((t) => t.id), "host"] : ROOM_TABS.map((t) => t.id);
  const statusLabel = snapshot.room.status === "active" ? "LIVE" : snapshot.room.status === "paused" ? "PAUSED" : "WAITING";
  const participantCount = snapshot.participants.filter((p) => p.status === "approved").length;

  return (
    <div className="group-study">
      <div className="gs-shade" />
      <div className="gs-wrap">
        <header className="gs-room-head">
          <div>
            <p className="gs-kicker"><button onClick={onExit} style={{ all: "unset", cursor: "pointer" }}><ArrowLeft aria-hidden="true" /> Group Study</button></p>
            <h1>{snapshot.room.name}</h1>
            <p className="gs-muted">{[snapshot.room.subject, snapshot.room.topic].filter(Boolean).join(" · ") || "Study room"}</p>
          </div>
          <div>
            <div className="gs-actions">
              <div className="gs-status" data-state={connection === "live" ? snapshot.room.status : "reconnecting"}>
                <span className="gs-status-dot" /> {connection === "live" ? statusLabel : "Reconnecting…"}
              </div>
              <span className="gs-top-note" aria-label="Participant count">{participantCount} studying</span>
            </div>
            {isHost && snapshot.room.code ? <div className="gs-actions"><ShareRow code={snapshot.room.code} /></div> : null}
          </div>
        </header>

        <div className="gs-tabs" role="tablist" aria-label="Room sections">
          {tabs.map((id) => {
            const meta = id === "host" ? { label: "Host controls", icon: ShieldCheck } : ROOM_TABS.find((t) => t.id === id)!;
            const Icon = meta.icon;
            return (
              <button key={id} role="tab" className="gs-tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                <Icon aria-hidden="true" /> {meta.label}
              </button>
            );
          })}
        </div>

        <div className="gs-room-grid">
          <div className="gs-room-side" style={{ display: "contents" }}>
            {tab === "overview" ? <OverviewPanel controller={controller} /> : null}
            {tab === "materials" ? <MaterialsPanel controller={controller} /> : null}
            {tab === "lam" ? <LamPanel controller={controller} /> : null}
            {tab === "chat" ? <Conversation controller={controller} /> : null}
            {tab === "quiz" ? <QuizPanel controller={controller} /> : null}
            {tab === "focus" ? <FocusPanel controller={controller} /> : null}
            {tab === "notes" ? <NotesPanel controller={controller} /> : null}
            {tab === "participants" ? <PeoplePanel controller={controller} /> : null}
            {tab === "host" && isHost ? <HostControlsPanel controller={controller} /> : null}
          </div>
        </div>
        <p className="gs-footer">Group Study · Beta. Names, chat and shared materials are visible to everyone in this room.</p>
      </div>
    </div>
  );
}
