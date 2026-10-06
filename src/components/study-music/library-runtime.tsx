"use client";
import { useEffect, useRef } from "react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { useMusicStore } from "@/lib/music-store";
import { restoreMusic, persistMusic } from "@/lib/study-music/storage";
import { librarySchema, mergeLibraries } from "@/lib/study-music/model";
import { LEGACY_TRACK_IDS } from "@/lib/study-music/catalog";
import { ambienceEngine } from "@/lib/study-music/ambience";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/notifications/notification-api";

export function MusicLibraryRuntime() {
  const focusRunning = useMusicStore(s => !!s.focus && (!s.focus.paused && s.focus.phase !== "complete" || s.focus.phase !== "study" && !s.focus.recorded));
  const access = useScholarAccess();
  const owner = access.entitlementsLoaded ? access.user?.id ? `user:${access.user.id}` : "guest" : "";
  const synced = useRef(0);
  useEffect(() => {
    if (!owner) return;
    const current = useMusicStore.getState();
    if (current.owner) persistMusic(current, synced.current);
    void ambienceEngine.destroy();
    useMusicStore.setState({ ...restoreMusic(owner), syncStatus: owner === "guest" ? "local" : "loading" });
    synced.current = 0;
    if (owner === "guest") {
      // Class-scoped legacy playlists are migrated only to guest storage, never
      // silently assigned to a signed-in account on a shared device.
      try {
        if (!localStorage.getItem("scholar:study-music:legacy-migrated")) {
          for (const grade of [9, 11]) {
            const old = JSON.parse(localStorage.getItem(`scholar:class${grade}:mu-playlists`) ?? "[]");
            if (Array.isArray(old)) old.slice(0, 20).forEach(p => {
              if (typeof p.name === "string" && Array.isArray(p.trackIds)) useMusicStore.getState().createPlaylist(p.name, p.trackIds.map((id: string) => LEGACY_TRACK_IDS[id]).filter(Boolean));
            });
          }
          localStorage.setItem("scholar:study-music:legacy-migrated", "1");
        }
      } catch { /* Malformed legacy storage is not trusted. */ }
    }
    const abort = new AbortController();
    let syncTimer: ReturnType<typeof setTimeout> | undefined, saving = false;
    const loadCloud = async (merge = false) => {
      if (owner === "guest") return;
      try {
        const response = await fetch("/api/study-music/library", { signal: abort.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Cloud unavailable");
        const data = await response.json(), remote = librarySchema.parse(data.library), s = useMusicStore.getState();
        if (abort.signal.aborted || s.owner !== owner) return;
        const dirty = s.libraryVersion > 0;
        // Same-revision local edits include deletions: don't union them back in.
        // Cross-device differences require the user's explicit merge action.
        if (dirty && s.cloudRevision !== data.revision && !merge) { useMusicStore.setState({ syncStatus: "conflict" }); return; }
        useMusicStore.setState({ library: merge ? mergeLibraries(remote, s.library) : dirty ? s.library : remote, cloudRevision: data.revision, syncStatus: "synced", libraryVersion: dirty || merge ? s.libraryVersion + 1 : 0 });
      } catch { if (!abort.signal.aborted && useMusicStore.getState().owner === owner) useMusicStore.setState({ syncStatus: "unavailable" }); }
    };
    const saveCloud = async () => {
      const s = useMusicStore.getState();
      if (saving || abort.signal.aborted || s.owner !== owner || s.syncStatus !== "synced" || s.libraryVersion <= synced.current) return;
      saving = true; const version = s.libraryVersion;
      try {
        const response = await fetch("/api/study-music/library", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ library: s.library, revision: s.cloudRevision }), signal: abort.signal });
        if (abort.signal.aborted || useMusicStore.getState().owner !== owner) return;
        if (!response.ok) { useMusicStore.setState({ syncStatus: response.status === 409 ? "conflict" : "unavailable" }); return; }
        const data = await response.json();
        if (abort.signal.aborted || useMusicStore.getState().owner !== owner) return;
        synced.current = version;
        useMusicStore.setState({ cloudRevision: data.revision });
      } catch { if (!abort.signal.aborted) useMusicStore.setState({ syncStatus: "unavailable" }); }
      finally { saving = false; if (!abort.signal.aborted && useMusicStore.getState().libraryVersion > synced.current) syncTimer = setTimeout(saveCloud, 2000); }
    };
    const unsubscribe = useMusicStore.subscribe((s, prev) => {
      if (s.owner !== owner) return;
      if (s.libraryVersion !== prev.libraryVersion || s.focus !== prev.focus || s.widgetPosition !== prev.widgetPosition || s.currentTrack !== prev.currentTrack || s.queue !== prev.queue || s.isPlaying !== prev.isPlaying || s.volume !== prev.volume || s.muted !== prev.muted || s.ambience !== prev.ambience)
        if (!persistMusic(s, synced.current)) toast.error("Device storage is full. Music changes are available for this session only.", { id: "music-storage-full" });
      // Playback telemetry must not perpetually postpone a dirty library save.
      if ((s.libraryVersion !== prev.libraryVersion || s.syncStatus !== prev.syncStatus) && s.libraryVersion > synced.current && s.syncStatus === "synced") { clearTimeout(syncTimer); syncTimer = setTimeout(saveCloud, 1800); }
    });
    const save = () => persistMusic(useMusicStore.getState(), synced.current);
    const checkpoint = setInterval(save, 15000);
    const retry = () => void loadCloud(true);
    window.addEventListener("pagehide", save); window.addEventListener("scholar:music-sync", retry);
    void loadCloud();
    return () => { save(); abort.abort(); unsubscribe(); clearInterval(checkpoint); clearTimeout(syncTimer); window.removeEventListener("pagehide", save); window.removeEventListener("scholar:music-sync", retry); };
  }, [owner]);

  useEffect(() => {
    if (!focusRunning) return;
    const interval = setInterval(() => {
      const s = useMusicStore.getState(); if (!s.hydrated) return;
      s.tickFocus(); const result = useMusicStore.getState().recordFocus();
      if (result) {
        const scholar = useStore.getState();
        if (!scholar.sessions.some(f => f.id === result.id)) { scholar.addSession({ id: result.id, type: "pomodoro", duration: result.seconds, completedAt: result.at, subject: result.subject || undefined }); if (result.seconds >= 15 * 60) { scholar.addXP(10); scholar.addCoins(5); } scholar.pushActivity({ type: "focus", text: `Completed ${Math.round(result.seconds / 60)} minutes · ${result.goal}`, icon: "🎧" }); }
        toast.success("Focus session complete", { description: `${Math.round(result.seconds / 60)} minutes of focused study. ${result.breakSeconds ? "Start your break when you're ready." : "Well done."}` });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [focusRunning]);
  return null;
}
