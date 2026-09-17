"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import type { RoomSnapshot } from "@/lib/group-study/types";
import type { GroupRoomController } from "./use-room";
import { groupRequest, errorMessage } from "./client";
import { EmptyState } from "./room-ui";

export function ChatWorkspace({
  controller,
  active,
}: {
  controller: GroupRoomController;
  active: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [older, setOlder] = useState<RoomSnapshot["messages"]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const feed = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const previousLast = useRef("");
  const { snapshot: s, messages } = controller;
  const all = [
    ...older.filter((m) => !messages.some((recent) => recent.id === m.id)),
    ...messages,
  ];
  const last = messages.at(-1)?.id ?? "";
  useEffect(() => {
    if (!active) return;
    if (last !== previousLast.current) {
      if (nearBottom.current || messages.at(-1)?.delivery === "sending")
        feed.current?.scrollTo({ top: feed.current.scrollHeight });
      else setNewMessages(true);
      previousLast.current = last;
    }
  }, [last, active, messages]);
  if (!s) return null;
  const disabled =
    !s.room.chatEnabled || s.me.chatMuted || s.room.status !== "active";
  const send = () => {
    const body = draft.trim();
    if (!body || disabled) return;
    setDraft("");
    nearBottom.current = true;
    void controller.sendChat(body);
  };
  const loadOlder = async () => {
    if (!all[0] || loading) return;
    setLoading(true);
    const element = feed.current,
      previousHeight = element?.scrollHeight ?? 0;
    try {
      const result = await groupRequest<{
        messages: RoomSnapshot["messages"];
        hasMore: boolean;
      }>(
        `/api/group-study/rooms/${s.room.id}/messages?before=${encodeURIComponent(all[0].id)}`,
      );
      setOlder((items) => [...result.messages, ...items]);
      setHasMore(result.hasMore);
      requestAnimationFrame(() => {
        if (element) element.scrollTop += element.scrollHeight - previousHeight;
      });
    } catch (cause) {
      controller.setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="gs-glass gs-conversation" aria-label="Study chat">
      <div className="gs-chat-heading">
        <div>
          <h2>Study chat</h2>
          <p className="gs-muted">Good questions belong here.</p>
        </div>
        <small className="gs-muted">
          {
            s.participants.filter((p) => p.online && p.status === "approved")
              .length
          }{" "}
          online
        </small>
      </div>
      <div
        className="gs-messages"
        ref={feed}
        onScroll={() => {
          const e = feed.current;
          if (e) {
            nearBottom.current =
              e.scrollHeight - e.scrollTop - e.clientHeight < 90;
            if (nearBottom.current) setNewMessages(false);
          }
        }}
      >
        {hasMore && all.length >= 60 && (
          <button
            className="gs-button"
            disabled={loading}
            onClick={() => void loadOlder()}
          >
            {loading ? "Loading earlier messages…" : "Earlier messages"}
          </button>
        )}
        {!all.length && (
          <EmptyState title="Start the conversation.">
            Ask a question, share a breakthrough, or say hello.
          </EmptyState>
        )}
        {all.map((m) => (
          <article
            key={m.id}
            className="gs-message"
            data-mine={m.authorId === s.me.id}
            data-kind={m.kind}
          >
            <div className="gs-message-meta">
              <strong>{m.authorId === s.me.id ? "You" : m.author}</strong>
              {m.authorRole === "host" && (
                <span className="gs-tiny-pill">HOST</span>
              )}
              {m.kind === "announcement" && (
                <span className="gs-tiny-pill">ANNOUNCEMENT</span>
              )}
              <time dateTime={m.createdAt}>
                {new Date(m.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              {m.delivery === "sending" && <span>Sending…</span>}
            </div>
            <div className="gs-message-body">
              {m.kind === "ai" ? (
                <ScholarAIContent content={m.body} mode="compact" />
              ) : (
                m.body
              )}
            </div>
            {m.delivery === "failed" && (
              <button
                className="gs-button gs-button-danger"
                onClick={() => void controller.sendChat(m.body, m.id)}
              >
                Not sent · Retry
              </button>
            )}
          </article>
        ))}
      </div>
      {newMessages && (
        <button
          className="gs-button gs-new-messages"
          onClick={() => {
            feed.current?.scrollTo({
              top: feed.current.scrollHeight,
              behavior: "smooth",
            });
            nearBottom.current = true;
            setNewMessages(false);
          }}
        >
          New messages ↓
        </button>
      )}
      <form
        className="gs-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          className="gs-textarea"
          aria-label="Message"
          rows={1}
          maxLength={2000}
          value={draft}
          disabled={disabled}
          placeholder={
            s.me.chatMuted
              ? "The host muted your chat."
              : disabled
                ? "Chat is available during an active session."
                : "Message the room…"
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className="gs-button gs-button-primary gs-button-icon"
          aria-label="Send"
          disabled={disabled || !draft.trim()}
        >
          <Send />
        </button>
      </form>
      <div className="gs-composer-hint">
        Enter to send · Shift+Enter for a new line · {draft.length}/2000
      </div>
    </section>
  );
}
