"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { profileGetJSON, profileKey } from "@/lib/profile-storage";
import { restoreReadingJournal, type ReadingChange, type EbookReading } from "@/lib/ebooks/contracts";

type Change = ReadingChange;
/** Serialized, idempotent per-page operations; retries never overwrite another device's notes. */
export function useUploadedBookState(id: string, grade: 9 | 11, cloud: EbookReading) {
  const key = `custom-ebook-reading:v2:${id}`;
  const [initial] = useState(() => {
    return restoreReadingJournal(cloud, profileGetJSON(grade, key, null), profileGetJSON(grade, `custom-ebook-reading:${id}`, null));
  });
  const [state, setState] = useState(initial.pending.length ? initial.state : cloud);
  const current = useRef(state);
  const queue = useRef(initial.pending);
  const sending = useRef(false);
  const delayed = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const [sync, setSync] = useState(initial.pending.length ? "Saved on this device · waiting to sync" : "Saved to your account");
  const persist = useCallback(() => {
    try { localStorage.setItem(profileKey(grade, key), JSON.stringify({ state: current.current, pending: queue.current })); return true; }
    catch { return false; }
  }, [grade, key]);
  const flush = useCallback(async () => {
    if (sending.current || !queue.current.length) return;
    sending.current = true;
    if (alive.current) setSync("Saving to your account…");
    try {
      while (queue.current.length) {
        const change = queue.current[0];
        const response = await fetch(`/api/ebooks/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change), signal: AbortSignal.timeout(10_000), keepalive: true });
        if (!response.ok) throw new Error("SAVE_UNAVAILABLE");
        queue.current.shift(); persist();
      }
      if (alive.current) setSync("Saved to your account");
    } catch { if (alive.current) setSync(persist() ? "Saved on this device · account sync failed. Retry saving." : "Not saved: device storage and account sync are unavailable. Keep this book open and retry saving."); }
    finally { sending.current = false; }
  }, [id, persist]);
  useEffect(() => {
    alive.current = true;
    void flush();
    const timer = setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) void flush(); }, 15_000);
    const online = () => void flush(); window.addEventListener("online", online);
    return () => { alive.current = false; clearInterval(timer); if (delayed.current) clearTimeout(delayed.current); window.removeEventListener("online", online); persist(); void flush(); };
  }, [flush, persist]);
  const update = useCallback((change: Change) => {
    const next = { ...current.current, bookmarks: [...current.current.bookmarks], notes: [...current.current.notes] };
    if (change.page) { next.page = change.page; next.lastOpenedAt = new Date().toISOString(); }
    if (change.bookmark) {
      const item = change.bookmark; const previous = next.bookmarks.find(b => b.page === item.page);
      next.bookmarks = next.bookmarks.filter(b => b.page !== item.page);
      if (!item.remove) next.bookmarks.push({ id: previous?.id ?? crypto.randomUUID(), page: item.page, note: item.note ?? previous?.note, createdAt: previous?.createdAt ?? new Date().toISOString() });
    }
    if (change.note) { next.notes = next.notes.filter(n => n.page !== change.note!.page); if (change.note.text.trim()) next.notes.push({ ...change.note, updatedAt: new Date().toISOString() }); }
    current.current = next; setState(next);
    // Do not replace the operation currently being sent. Coalesce only queued
    // note edits; the local journal is durable before the debounce starts.
    const duplicate = change.note ? queue.current.findIndex((item, index) => index >= (sending.current ? 1 : 0) && item.note?.page === change.note!.page) : -1;
    if (duplicate >= 0) queue.current[duplicate] = change; else queue.current.push(change);
    const deviceSaved = persist();
    if (delayed.current) clearTimeout(delayed.current);
    if (change.note) { setSync(deviceSaved ? "Saved on this device · saving to your account…" : "Saving to your account… Device backup is unavailable."); delayed.current = setTimeout(() => void flush(), 750); }
    else void flush();
  }, [flush, persist]);
  const opened = useRef(false);
  useEffect(() => { if (!opened.current) { opened.current = true; update({ page: current.current.page }); } }, [update]);
  return { state, update, sync, flush };
}
