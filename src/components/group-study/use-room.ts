"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "@/lib/group-study/types";
import { errorMessage, groupRequest, GroupStudyClientError } from "./client";

export function useGroupRoom(roomId: string | null) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [connection, setConnection] = useState<"connecting" | "live" | "reconnecting" | "ended">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const actionBusy = useRef(false);
  const currentRoom = useRef(roomId);
  currentRoom.current = roomId;

  const acceptSnapshot = useCallback((value: RoomSnapshot) => {
    if (value.room?.id !== currentRoom.current) return;
    setSnapshot(previous => previous?.room.id === value.room.id &&
      (previous.revision > value.revision || previous.room.status === "ended" || previous.me.status === "left") ? previous : value);
  }, []);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    const value = await groupRequest<RoomSnapshot>(`/api/group-study/rooms/${encodeURIComponent(roomId)}`);
    acceptSnapshot(value);
    return value;
  }, [roomId, acceptSnapshot]);

  useEffect(() => {
    setSnapshot(null);
    setError(null);
    setConnection("connecting");
    if (!roomId) return;
    let closed = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const abort = new AbortController();
    const endpoint = `/api/group-study/rooms/${encodeURIComponent(roomId)}`;

    const scheduleReconnect = () => {
      source?.close();
      if (closed || document.hidden) return;
      setConnection("reconnecting");
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void connect(), Math.min(30_000, 4_000 * 2 ** Math.min(failures++, 3)));
    };

    const connect = async () => {
      if (closed || document.hidden) return;
      try {
        const next = await groupRequest<RoomSnapshot>(endpoint, { signal: abort.signal });
        if (closed) return;
        acceptSnapshot(next);
        setError(null);
        if (next.room.status === "ended" || ["removed", "denied", "left"].includes(next.me.status)) { setConnection("live"); return; }
        source?.close();
        source = new EventSource(`${endpoint}/events`);
        source.onopen = () => { if (!closed) { failures = 0; setConnection("live"); } };
        const onSnapshot = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data) as RoomSnapshot | { snapshot: RoomSnapshot };
            const nextSnapshot = "snapshot" in data ? data.snapshot : data;
            if (!nextSnapshot.room || !nextSnapshot.me) return;
            acceptSnapshot(nextSnapshot);
            setConnection("live");
            if (nextSnapshot.room.status === "ended" || ["removed", "denied", "left"].includes(nextSnapshot.me.status)) source?.close();
          } catch { scheduleReconnect(); }
        };
        source.addEventListener("snapshot", onSnapshot);
        source.onmessage = onSnapshot;
        source.onerror = scheduleReconnect;
      } catch (cause) {
        if (closed) return;
        setError(errorMessage(cause));
        if (cause instanceof GroupStudyClientError && [401, 403, 404, 410].includes(cause.status)) { setConnection("ended"); return; }
        scheduleReconnect();
      }
    };
    const onVisibility = () => {
      clearTimeout(retryTimer);
      source?.close();
      if (!document.hidden) void connect();
    };
    document.addEventListener("visibilitychange", onVisibility);
    void connect();
    return () => { closed = true; abort.abort(); source?.close(); clearTimeout(retryTimer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [roomId, acceptSnapshot]);

  const action = useCallback(async (actionName: string, parameters: Record<string, unknown> = {}) => {
    if (!roomId || actionBusy.current) return false;
    actionBusy.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await groupRequest<{ ok: boolean; snapshot?: RoomSnapshot }>(`/api/group-study/rooms/${encodeURIComponent(roomId)}/actions`, {
        method: "POST", body: JSON.stringify({ action: actionName, ...parameters }),
      });
      if (result.snapshot) acceptSnapshot(result.snapshot);
      else if (actionName === "end" || actionName === "leave") {
        setSnapshot(previous => previous ? { ...previous, room: actionName === "end" ? { ...previous.room, status: "ended" } : previous.room, me: actionName === "leave" ? { ...previous.me, status: "left" } : previous.me } : previous);
      }
      else if (!["leave", "end"].includes(actionName)) await refresh();
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof GroupStudyClientError && cause.status === 409) await refresh().catch(() => undefined);
      return false;
    } finally { actionBusy.current = false; setBusy(false); }
  }, [roomId, acceptSnapshot, refresh]);

  return { snapshot, connection, error, busy, action, refresh, setError };
}

export type GroupRoomController = ReturnType<typeof useGroupRoom>;
