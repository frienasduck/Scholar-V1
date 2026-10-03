"use client";
import { useEffect, useRef, useState } from "react";
import { Link2, Loader2, Plus, Play } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { parseYouTubeUrl, cleanTrack, type MusicTrack } from "@/lib/study-music/model";
import { useMusicStore } from "@/lib/music-store";
import { toast } from "@/lib/notifications/notification-api";
import { MusicThumbnail } from "./thumbnail";
export function MusicImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState(""), [preview, setPreview] = useState<MusicTrack | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null), lookupOwner = useRef(""), songs = useMusicStore(s => s.library.songs);
  useEffect(() => () => request.current?.abort(), []);
  const duplicate = preview && songs.some(t => t.id === preview.id);
  const resolve = async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    lookupOwner.current = useMusicStore.getState().owner;
    try {
      const parsed = parseYouTubeUrl(url); setBusy(true); setError(""); setPreview(null);
      const response = await fetch("/api/study-music/metadata", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: parsed.url }), signal: controller.signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not read that video.");
      if (!controller.signal.aborted && lookupOwner.current === useMusicStore.getState().owner) setPreview(cleanTrack(data.track));
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Lookup failed. Check your connection."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const finish = (play: boolean) => {
    if (!preview) return; const s = useMusicStore.getState();
    if (lookupOwner.current !== s.owner) { setPreview(null); setError("Your account changed. Preview the link again before saving."); return; }
    if (!duplicate && !s.addSong(preview)) { setError("My Songs is full (400 tracks). Remove a song before adding another."); return; }
    if (play) s.playTrack(preview); toast.success(duplicate ? "Already saved in My Songs" : "Added to My Songs"); onClose();
  };
  return <Dialog open={open} onOpenChange={value => { if (!value) { request.current?.abort(); setBusy(false); onClose(); } }}><DialogContent className="sm-dialog sm-ui"><DialogTitle><Link2 size={20}/> YouTube import · My Songs</DialogTitle><DialogDescription>Your personal collection, with original title and channel attribution.</DialogDescription>
    <form onSubmit={e => { e.preventDefault(); void resolve(); }} className="sm-inline-form"><input aria-label="YouTube video link" type="url" required maxLength={2048} placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={e => { request.current?.abort(); setBusy(false); setUrl(e.target.value); setPreview(null); setError(""); }}/><button className="sm-btn sm-primary" disabled={busy}>{busy ? <Loader2 className="sm-spin" size={16}/> : <Link2 size={16}/>} Preview</button></form>
    {error && <p className="sm-error" role="alert">{error}</p>}
    {preview && <div className="sm-import-preview"><MusicThumbnail track={preview}/><h3>{preview.title}</h3><p>{preview.artist} · Duration available after playback starts</p>{duplicate && <p className="sm-success">Already in My Songs. No duplicate will be added.</p>}<div className="sm-actions"><button className="sm-btn" disabled={!!duplicate} onClick={() => finish(false)}><Plus size={16}/> Add to My Songs</button><button className="sm-btn sm-primary" onClick={() => finish(true)}><Play size={16}/> {duplicate ? "Play now" : "Add & play"}</button></div></div>}
    <p className="sm-muted sm-small">Supports watch, youtu.be, Shorts and YouTube Music video links. Playlist-only import needs the official YouTube Data API and is not enabled. Videos remain on YouTube; no downloads, audio extraction or ad blocking. Availability can change after import.</p>
  </DialogContent></Dialog>;
}
