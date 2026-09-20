"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomSnapshot } from "@/lib/group-study/types";
import { errorMessage, groupRequest, GroupStudyClientError } from "./client";
import { pollDelay, singleFlight } from "./room-sync";

type Connection = "connecting" | "live" | "offline" | "lost" | "ended";
type Message = RoomSnapshot["messages"][number];
type PollResult = RoomSnapshot | { unchanged: true; version: string };
const EMPTY_MESSAGES: Message[] = [];
const terminal = (s: RoomSnapshot) =>
  s.room.status === "ended" ||
  ["left", "removed", "denied"].includes(s.me.status);

/** Preserve unchanged bounded slices so polling does not reset workspace state. */
function shareSnapshot(
  previous: RoomSnapshot | null,
  next: RoomSnapshot,
): RoomSnapshot {
  if (!previous || previous.room.id !== next.room.id) return next;
  const result = { ...next };
  for (const key of [
    "room",
    "me",
    "participants",
    "messages",
    "resources",
    "quiz",
    "poll",
    "focus",
    "activity",
  ] as const) {
    if (JSON.stringify(previous[key]) === JSON.stringify(next[key]))
      Object.assign(result, { [key]: previous[key] });
  }
  return result;
}

export function useGroupRoom(roomId: string | null) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const latest = useRef<RoomSnapshot | null>(null);
  const currentRoom = useRef(roomId);
  currentRoom.current = roomId;
  const [connection, setConnection] = useState<Connection>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState<string[]>([]);
  const inFlight = useRef(new Set<string>());
  const [outbox, setOutbox] = useState<Message[]>([]);
  const [serverMessages, setServerMessages] = useState<Message[]>([]);
  const refreshRef = useRef<
    (force?: boolean) => Promise<RoomSnapshot | undefined>
  >(async () => undefined);
  const acceptSnapshot = useCallback((value: RoomSnapshot) => {
    if (value.room.id !== currentRoom.current) return;
    const previous = latest.current;
    if (previous && (previous.revision > value.revision || terminal(previous)))
      return;
    const next = shareSnapshot(previous, value);
    latest.current = next;
    setSnapshot(next);
    setOutbox((items) => {
      const remaining = items.filter(
        (item) => !value.messages.some((m) => m.id === item.id),
      );
      return remaining.length === items.length ? items : remaining;
    });
  }, []);
  const refresh = useCallback((force = true) => refreshRef.current(force), []);
  const getSnapshot = useCallback(() => latest.current, []);

  useEffect(() => {
    latest.current = null;
    setSnapshot(null);
    setOutbox([]);
    setServerMessages([]);
    setError(null);
    setConnection("connecting");
    if (!roomId) return;
    let disposed = false,
      ticking = false,
      wakeAgain = false,
      failures = 0,
      lastSuccess = Date.now(),
      lastHeartbeat = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();
    const endpoint = `/api/group-study/rooms/${encodeURIComponent(roomId)}`;
    const read = singleFlight(async (force: boolean) => {
      if (disposed || terminalIfPresent() || !navigator.onLine)
        return latest.current ?? undefined;
      const version = !force && latest.current?.version;
      const result = await groupRequest<PollResult>(
        endpoint + (version ? `?version=${encodeURIComponent(version)}` : ""),
        { signal: abort.signal },
      );
      if (disposed) return undefined;
      if (!("unchanged" in result)) acceptSnapshot(result);
      failures = 0;
      lastSuccess = Date.now();
      setConnection("live");
      return latest.current ?? undefined;
    });
    refreshRef.current = read;
    function terminalIfPresent() {
      return latest.current && terminal(latest.current);
    }
    async function tick() {
      clearTimeout(timer);
      if (ticking) {
        wakeAgain = true;
        return;
      }
      if (disposed || terminalIfPresent()) return;
      if (!navigator.onLine) {
        setConnection("offline");
        return;
      }
      ticking = true;
      try {
        await read(false);
        // Presence is a separate acknowledgment, never a full snapshot/revision.
        if (
          !disposed &&
          !document.hidden &&
          Date.now() - lastHeartbeat >= 30_000
        ) {
          lastHeartbeat = Date.now();
          await groupRequest(endpoint + "/events", {
            method: "POST",
            signal: abort.signal,
          });
        }
      } catch (cause) {
        if (disposed) return;
        if (
          cause instanceof GroupStudyClientError &&
          [401, 403, 404, 410].includes(cause.status)
        ) {
          setError(errorMessage(cause));
          setConnection("ended");
          disposed = true;
          return;
        }
        failures++;
        if (!navigator.onLine) setConnection("offline");
        else if (failures >= 3 && Date.now() - lastSuccess > 15_000)
          setConnection("lost");
      } finally {
        ticking = false;
      }
      if (!disposed && !terminalIfPresent()) {
        const delay =
          wakeAgain && !document.hidden
            ? 0
            : pollDelay(document.hidden, failures);
        wakeAgain = false;
        timer = setTimeout(() => void tick(), delay);
      }
    }
    const wake = () => {
      clearTimeout(timer);
      if (!document.hidden) void tick();
      else timer = setTimeout(() => void tick(), 30_000);
    };
    const offline = () => {
      clearTimeout(timer);
      setConnection("offline");
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("offline", offline);
    void tick();
    return () => {
      disposed = true;
      abort.abort();
      clearTimeout(timer);
      refreshRef.current = async () => undefined;
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", offline);
    };
  }, [roomId, acceptSnapshot]);

  useEffect(() => {
    if (
      !roomId ||
      !snapshot ||
      snapshot.me.status !== "approved" ||
      snapshot.room.featurePolicy.chat === "off" ||
      (snapshot.room.featurePolicy.chat === "host" &&
        snapshot.me.role !== "host")
    )
      return;
    let stopped = false,
      running = false;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (stopped || running || !navigator.onLine) return;
      running = true;
      try {
        const last = serverMessages.at(-1)?.id;
        const result = await groupRequest<{ messages: Message[] }>(
          `/api/group-study/rooms/${encodeURIComponent(roomId)}/messages${last ? `?after=${encodeURIComponent(last)}` : ""}`,
          { signal: abort.signal },
        );
        if (!stopped && result.messages.length)
          setServerMessages((items) => {
            const known = new Set(items.map((item) => item.id));
            const next = [
              ...items,
              ...result.messages.filter((item) => !known.has(item.id)),
            ];
            return next.slice(-60);
          });
      } catch (cause) {
        if (
          !stopped &&
          !(cause instanceof DOMException && cause.name === "AbortError") &&
          !(cause instanceof GroupStudyClientError && cause.status === 403)
        )
          setError(errorMessage(cause));
      } finally {
        running = false;
      }
      if (!stopped)
        timer = setTimeout(() => void poll(), document.hidden ? 15_000 : 1_500);
    };
    void poll();
    const wake = () => {
      clearTimeout(timer);
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      stopped = true;
      abort.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [
    roomId,
    snapshot?.me.status,
    snapshot?.me.role,
    snapshot?.room.featurePolicy.chat,
    serverMessages,
  ]);

  const action = useCallback(
    async (name: string, parameters: Record<string, unknown> = {}) => {
      if (!roomId) return false;
      const key = `${name}:${parameters.participantId ?? parameters.questionId ?? parameters.clientMessageId ?? ""}`;
      if (inFlight.current.has(key)) return false;
      inFlight.current.add(key);
      setBusyKeys([...inFlight.current]);
      setError(null);
      try {
        const result = await groupRequest<{
          ok: boolean;
          snapshot?: RoomSnapshot;
        }>(`/api/group-study/rooms/${encodeURIComponent(roomId)}/actions`, {
          method: "POST",
          body: JSON.stringify({ action: name, ...parameters }),
        });
        if (currentRoom.current !== roomId) return false;
        if (result.snapshot) acceptSnapshot(result.snapshot);
        else if (["end", "leave"].includes(name) && latest.current) {
          const next = {
            ...latest.current,
            room:
              name === "end"
                ? { ...latest.current.room, status: "ended" as const }
                : latest.current.room,
            me:
              name === "leave"
                ? { ...latest.current.me, status: "left" as const }
                : latest.current.me,
          };
          latest.current = next;
          setSnapshot(next);
        } else if (name !== "heartbeat") await refresh(true);
        return true;
      } catch (cause) {
        if (currentRoom.current === roomId) {
          setError(errorMessage(cause));
          if (cause instanceof GroupStudyClientError && cause.status === 409)
            await refresh(true).catch(() => undefined);
        }
        return false;
      } finally {
        inFlight.current.delete(key);
        setBusyKeys([...inFlight.current]);
      }
    },
    [roomId, acceptSnapshot, refresh],
  );

  const sendChat = useCallback(
    async (body: string, retryId?: string) => {
      const me = latest.current?.me;
      if (!me || !body.trim()) return false;
      const id = retryId ?? crypto.randomUUID();
      const message: Message = {
        id,
        authorId: me.id,
        authorRole: me.role,
        author: me.displayName,
        kind: "chat",
        body: body.trim(),
        createdAt: new Date().toISOString(),
        delivery: "sending",
      };
      setOutbox((items) => [
        ...items.filter((item) => item.id !== id),
        message,
      ]);
      const ok = await action("chat", {
        body: message.body,
        clientMessageId: id,
      });
      if (ok) {
        setOutbox((items) => items.filter((item) => item.id !== id));
        setServerMessages((items) => {
          if (items.some((item) => item.id === id)) return items;
          const { delivery: _delivery, ...delivered } = message;
          return [...items, delivered].slice(-60);
        });
      }
      else
        setOutbox((items) =>
          items.map((item) =>
            item.id === id ? { ...item, delivery: "failed" } : item,
          ),
        );
      return ok;
    },
    [action],
  );
  const messages = useMemo(
    () =>
      outbox.length === 0
        ? serverMessages.length
          ? serverMessages
          : EMPTY_MESSAGES
        : [
            ...serverMessages,
            ...outbox.filter(
              (item) => !serverMessages.some((m) => m.id === item.id),
            ),
          ],
    [serverMessages, outbox],
  );
  return {
    snapshot,
    connection,
    error,
    busy: busyKeys.length > 0,
    busyKeys,
    action,
    refresh,
    getSnapshot,
    setError,
    messages,
    sendChat,
  };
}
export type GroupRoomController = ReturnType<typeof useGroupRoom>;
