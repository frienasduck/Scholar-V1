"use client";
import { useEffect, useState } from "react";
import { Play, Pause, X, ArrowUp, ArrowDown, Music2, Waves, Timer, ExternalLink, Headphones } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useMusicStore, type Ambience } from "@/lib/music-store";
import { focusRemaining } from "@/lib/study-music/focus";
import { formatTime, trackName } from "@/lib/study-music/model";
import { ambienceEngine } from "@/lib/study-music/ambience";
import { toast } from "@/lib/notifications/notification-api";
import { MusicThumbnail } from "./thumbnail";

export function FocusClock() {
  const focus = useMusicStore(s => s.focus);
  const [now, setNow] = useState(0);
  useEffect(() => { const update = () => setNow(Date.now()); const start = setTimeout(update, 0); const interval = setInterval(update, 1000); return () => { clearTimeout(start); clearInterval(interval); }; }, []);
  return <div className="sm-focus-clock" aria-label="Focus time remaining"><span>{focus?.phase === "break" ? "BREAK" : focus?.phase === "complete" ? "COMPLETE" : "FOCUS SESSION"}</span><strong>{focus ? formatTime(focusRemaining(focus, now || focus.startedAt)) : "25:00"}</strong><small>{focus ? focus.goal : "Make room for your next breakthrough."}</small></div>;
}
export function FocusPanel({ compact = false }: { compact?: boolean }) {
  const focus = useMusicStore(s => s.focus), history = useMusicStore(s => s.focusHistory);
  const [minutes, setMinutes] = useState(25), [breakMinutes, setBreak] = useState(5), [goal, setGoal] = useState(""), [subject, setSubject] = useState(""), [chapter, setChapter] = useState(""), [pauseMusic, setPauseMusic] = useState(false);
  const active = focus && focus.phase !== "complete";
  return <section className="sm-panel sm-focus-panel">
    <h2><Timer size={20}/> Your focus space</h2><FocusClock/>
    {active ? <><p className="sm-muted">{[focus.subject, focus.chapter].filter(Boolean).join(" · ") || "A little less noise. A little more progress."}</p><div className="sm-actions"><button className="sm-btn sm-primary" onClick={useMusicStore.getState().pauseFocus}>{focus.paused ? <Play size={17}/> : <Pause size={17}/>} {focus.paused ? focus.phase === "break" ? "Start break" : "Resume" : "Pause"}</button><button className="sm-btn" onClick={() => { if (window.confirm("End this focus session? Unfinished study time will not be recorded.")) useMusicStore.getState().cancelFocus(); }}>End session</button></div></> : <>
      {focus?.phase === "complete" && <p className="sm-success">You completed {Math.round(focus.studySeconds / 60)} minutes. Take a breath.</p>}
      <div className="sm-preset-row">{[[25,5],[50,10],[90,15]].map(([study, rest]) => <button key={study} className="sm-chip" aria-pressed={minutes === study && breakMinutes === rest} onClick={() => { setMinutes(study); setBreak(rest); }}>{study} / {rest}</button>)}</div>
      <div className="sm-fields"><label>Study minutes<input type="number" min={1} max={180} value={minutes} onChange={e => setMinutes(Number(e.target.value))}/></label><label>Break minutes<input type="number" min={0} max={60} value={breakMinutes} onChange={e => setBreak(Number(e.target.value))}/></label></div>
      <label className="sm-label">Your study goal<input maxLength={180} placeholder="Finish the Laws of Motion questions" value={goal} onChange={e => setGoal(e.target.value)}/></label>
      {!compact && <div className="sm-fields"><label>Subject (optional)<input maxLength={80} placeholder="Physics" value={subject} onChange={e => setSubject(e.target.value)}/></label><label>Chapter (optional)<input maxLength={120} placeholder="Laws of Motion" value={chapter} onChange={e => setChapter(e.target.value)}/></label></div>}
      <label className="sm-check"><input type="checkbox" checked={pauseMusic} onChange={e => setPauseMusic(e.target.checked)}/> Pause music during breaks</label>
      <button className="sm-btn sm-primary" disabled={!Number.isFinite(minutes) || minutes < 1 || minutes > 180 || breakMinutes < 0 || breakMinutes > 60} onClick={() => useMusicStore.getState().startFocus(minutes, breakMinutes, { goal: goal || "Focused study", subject, chapter, pauseMusicOnBreak: pauseMusic })}><Play size={17}/> Start focus session</button>
      <p className="sm-muted sm-small">0 break minutes = no break. Your timer continues across Scholar sections and can recover after refresh. Sound never restarts automatically. Complete at least 15 study minutes for the existing +10 XP / +5 Coins reward; starting alone gives no reward.</p>
    </>}
    {!compact && history.length > 0 && <details className="sm-history"><summary>Recent focus sessions · {history.length}</summary>{history.slice(0, 5).map(item => <div key={item.id}><strong>{item.goal}</strong><span>{Math.round(item.seconds / 60)} min · {item.subject || "Study"}</span><small>{item.music}</small></div>)}</details>}
  </section>;
}
export function MixerPanel() {
  const levels = useMusicStore(s => s.ambience), enabled = useMusicStore(s => s.ambienceEnabled);
  const labels: Record<Ambience, string> = { rain: "Soft rain texture", brown: "Brown noise", white: "White noise", ocean: "Ocean-like wash" };
  return <section className="sm-panel"><h2><Waves size={20}/> Build your atmosphere</h2><p className="sm-muted">Scholar-synthesized textures. Separate from YouTube, usable offline after the page has loaded.</p>
    <button className="sm-btn" aria-pressed={enabled} onClick={async () => { try { await ambienceEngine.resume(); const s = useMusicStore.getState(); if (!Object.values(s.ambience).some(Boolean)) s.setAmbience("rain", 40); s.toggleAmbience(); } catch { toast.error("Your browser could not start ambience. Try another browser or check audio permissions."); } }}><Waves size={17}/>{enabled ? "Pause ambience" : "Start ambience"}</button>
    {(Object.keys(labels) as Ambience[]).map(key => <label className="sm-mixer-label" key={key}><span>{labels[key]}<small>{levels[key]}%</small></span><input type="range" min={0} max={100} value={levels[key]} aria-label={`${labels[key]} volume`} onChange={e => useMusicStore.getState().setAmbience(key, Number(e.target.value))}/></label>)}
    <p className="sm-muted sm-small">Mix gently. These are procedural sound textures, not recordings, and make no medical or cognitive claims.</p>
  </section>;
}
function QueuePanel() {
  const queue = useMusicStore(s => s.queue), currentIndex = useMusicStore(s => s.queueIndex);
  const [name, setName] = useState("");
  return <div><div className="sm-section-heading"><h2>Up next · {queue.length}</h2><button className="sm-btn" onClick={useMusicStore.getState().clearQueue}>Clear upcoming</button></div>
    {!queue.length && <p className="sm-muted">Your queue is empty. Choose a track or build a study soundtrack.</p>}
    <ol className="sm-queue">{queue.map((track, index) => <li key={`${track.id}:${index}`} className={index === currentIndex ? "sm-queue-current" : ""}><MusicThumbnail track={track}/><button className="sm-queue-name" onClick={() => useMusicStore.getState().playTrack(track, queue)}><strong>{trackName(track)}</strong><small>{index === currentIndex ? "Now selected · " : ""}{track.artist}</small></button><div className="sm-row-actions"><button className="sm-icon" disabled={index === 0} aria-label={`Move ${trackName(track)} up`} onClick={() => useMusicStore.getState().moveQueue(index, -1)}><ArrowUp size={15}/></button><button className="sm-icon" disabled={index === queue.length - 1} aria-label={`Move ${trackName(track)} down`} onClick={() => useMusicStore.getState().moveQueue(index, 1)}><ArrowDown size={15}/></button><button className="sm-icon" disabled={index === currentIndex} aria-label={`Remove ${trackName(track)} from queue`} onClick={() => useMusicStore.getState().removeQueue(index)}><X size={15}/></button></div></li>)}</ol>
    {!!queue.length && <form className="sm-inline-form" onSubmit={e => { e.preventDefault(); useMusicStore.getState().createPlaylist(name, queue.map(t => t.id)); setName(""); toast.success("Queue saved as a playlist"); }}><input placeholder="Playlist name" aria-label="Save queue playlist name" maxLength={80} value={name} onChange={e => setName(e.target.value)}/><button className="sm-btn" disabled={!name.trim()}>Save playlist</button></form>}
  </div>;
}
export function MusicDrawers() {
  const drawer = useMusicStore(s => s.drawer), track = useMusicStore(s => s.currentTrack);
  return <Dialog open={!!drawer} onOpenChange={open => { if (!open) useMusicStore.getState().setDrawer(null); }}><DialogContent className="sm-dialog sm-ui"><DialogTitle>{drawer === "queue" ? "Your music queue" : drawer === "mixer" ? "Ambient mixer" : "Study Music · quick space"}</DialogTitle><DialogDescription>Keep your rhythm without leaving your study workspace.</DialogDescription>
    {drawer === "queue" ? <QueuePanel/> : drawer === "mixer" ? <MixerPanel/> : <><div className="sm-actions"><button className="sm-btn" onClick={() => { useMusicStore.getState().setDrawer(null); window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "music" } })); }}><Headphones size={17}/> Open Study Music <ExternalLink size={14}/></button>{track && <button className="sm-btn" onClick={useMusicStore.getState().togglePlay}><Music2 size={17}/> Play / pause</button>}<button className="sm-btn" onClick={() => useMusicStore.getState().setDrawer("queue")}>Queue</button></div><FocusPanel compact/><MixerPanel/></>}
  </DialogContent></Dialog>;
}
