"use client";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "@/lib/notifications/notification-api";
import { useMusicStore, type MusicTrack } from "@/lib/music-store";
import { MUSIC_CATALOG, CATEGORIES } from "@/lib/study-music/catalog";
import { NATIVE_AUDIO_CATALOG } from "@/lib/study-music/native-audio";
import { trackName } from "@/lib/study-music/model";
import { Play, Pause, Plus, Music as MusicIcon, Sparkles, X, ListMusic, Headphones, Timer, Link2, Heart, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReadyBackgroundVideo } from "@/components/ready-background-video";
import { FreeAdSlot } from "@/components/subscriptions/free-ad-slot";
import { PlusGate } from "@/components/subscriptions/plus-gate";
import { FocusPanel, MixerPanel } from "@/components/study-music/tools";
import { MusicImportDialog } from "@/components/study-music/import-dialog";
import { MusicThumbnail } from "@/components/study-music/thumbnail";
import { MySongs, SoundtrackBuilder } from "@/components/study-music/workspace";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import "@/components/study-music/study-music.css";
interface Track { id: string; videoId: string; title: string; category: string; emoji: string; duration: string; desc: string; featured?: boolean; data: MusicTrack }
const emojis: Record<string,string> = { "Lo-fi":"🎧",Classical:"🎻",Nature:"🌿",Ambient:"🌌",Piano:"🎹",Rain:"🌧️","Deep focus":"🎯","Scholar picks":"✨","Late night":"🌙","Café":"☕",Instrumental:"🎼" };
const BG_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4";
export function MusicView() {
  return <PlusGate entitlement="study_music_ad_free" title="Study Music" description="Build your study soundtrack with music, playlists, focus sessions and native ambience." anchor="music"><MusicWorkspace/></PlusGate>;
}
function MusicWorkspace() {
  const songs = useMusicStore(s => s.library.songs), playlists = useMusicStore(s => s.library.playlists);
  const selectedTrack = useMusicStore(s => s.currentTrack), isPlaying = useMusicStore(s => s.isPlaying);
  const queue = useMusicStore(s => s.queue), queueIndex = useMusicStore(s => s.queueIndex);
  const lastTrack = selectedTrack ?? queue[queueIndex];
  const [activeTab, setActiveTab] = useState<"all"|"songs"|"playlists"|"focus">("all");
  const [showCreatePL, setShowCreatePL] = useState(false), [editPL, setEditPL] = useState<string|null>(null), [newPLName, setNewPLName] = useState(""), [newPLTrackIds, setNewPLTrackIds] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false), [search, setSearch] = useState(""), [category, setCategory] = useState("All"), [noLyrics, setNoLyrics] = useState(false), [focusView, setFocusView] = useState(false), [collection,setCollection]=useState("all"), [duration,setDuration]=useState("all");
  const favorites=useMusicStore(s=>s.library.favorites),history=useMusicStore(s=>s.library.history);
  const allTracks = useMemo(() => [...new Map([...MUSIC_CATALOG.filter(t=>t.id==='zAiIgYOH4Ys'),...MUSIC_CATALOG.filter(t=>t.id!=='zAiIgYOH4Ys'), ...NATIVE_AUDIO_CATALOG, ...songs].map(t => [t.id,t])).values()], [songs]);
  const TRACKS: Track[] = allTracks.map(t => ({ id:t.id, videoId:t.id, title:trackName(t),category:t.category,emoji:emojis[t.category] ?? "🎵",duration:t.mediaSource === "AUDIO_SOURCE" ? "Continuous" : t.durationSeconds ? `${Math.round(t.durationSeconds/60)} min` : t.tags?.includes("radio") ? "Radio" : "YouTube",desc:t.artist,featured:t.id === "zAiIgYOH4Ys",data:t }));
  const filtered = TRACKS.filter(t => (category === "All" || t.category === category) && `${t.title} ${t.desc} ${t.category}`.toLowerCase().includes(search.toLowerCase()) && (!noLyrics || t.data.tags?.includes("no lyrics")) && (collection==="all" || collection==="favorites" && favorites.includes(t.id) || collection==="recent" && history.some(h=>h.id===t.id) || collection==="imported" && t.data.source==="imported" || collection==="catalog" && t.data.source==="catalog" || collection==="native" && t.data.mediaSource==="AUDIO_SOURCE") && (duration==="all" || duration==="long" && (t.data.durationSeconds ?? 0)>=3600 || duration==="unknown" && !t.data.durationSeconds));
  const playingTrackId = selectedTrack?.id;
  const createPlaylist = () => { if (!newPLName.trim() || !newPLTrackIds.length) return; const s=useMusicStore.getState(); if(editPL)s.updatePlaylist(editPL,newPLName,newPLTrackIds);else s.createPlaylist(newPLName,newPLTrackIds); setShowCreatePL(false);setEditPL(null);setNewPLName("");setNewPLTrackIds([]);toast.success(editPL?"Playlist updated":"Playlist created"); };
  const deletePlaylist = (id:string) => { if (window.confirm("Delete this playlist? Your songs will stay in your library.")) useMusicStore.getState().removePlaylist(id); };
  const toggleTrackInPL = (id:string) => setNewPLTrackIds(ids => ids.includes(id) ? ids.filter(t => t !== id) : [...ids,id]);
  const playPlaylist = (pl: {trackIds:string[];name:string}) => { const queue = pl.trackIds.map(id => allTracks.find(t => t.id === id)).filter(Boolean) as MusicTrack[]; if (queue.length) { useMusicStore.getState().playTrack(queue[0],queue); toast.success(`Playing "${pl.name}"`); } };
  return (
    <div className="scholar-music scholar-responsive-page relative -m-3 overflow-hidden sm:-m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        .mu-glass {
          background: rgba(255,255,255,0.02);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .mu-glass-strong {
          background: rgba(20,20,30,0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .mu-font { font-family: 'Inter', sans-serif; }
        .mu-serif { font-family: 'Instrument Serif', serif; }
        .mu-scroll::-webkit-scrollbar { width: 6px; }
        .mu-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
        .mu-scroll::-webkit-scrollbar-track { background: transparent; }
        @keyframes mu-bar {
          0%, 100% { height: 20%; }
          50% { height: 100%; }
        }
        .mu-bar-anim { animation: mu-bar 0.9s ease-in-out infinite; }
      `}</style>

      {/* Background video */}
      <ReadyBackgroundVideo
        src={BG_VIDEO}
        className="z-0"
        readinessId="music"
      />
      <div className="absolute inset-0 z-0 bg-black/65" />

      {/* YouTube playback is handled by the global FloatingMusicWidget — no local iframe */}

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)]">
        {/* Navbar */}
        <nav className="scholar-music-nav flex items-center justify-between px-4 md:px-8 py-4 mu-font">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-lg">
              <Headphones className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Study Music</h1>
              <p className="text-[10px] text-white/40 -mt-0.5">Focus, relax, repeat</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="scholar-music-tabs scholar-scroll-rail flex items-center gap-1 mu-glass rounded-full p-1">
            {[
              { id: "all", label: "All Music", icon: MusicIcon },
              { id: "songs", label: "My Songs", icon: Heart },
              { id: "playlists", label: "My Playlists", icon: ListMusic },
              { id: "focus", label: "Focus Session", icon: Timer },
            ].map((tab) => (
              <button
                key={tab.id}
                aria-label={tab.label}
                aria-current={activeTab === tab.id ? "page" : undefined}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  activeTab === tab.id ? "bg-white text-black" : "text-white/70 hover:text-white"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="px-4 md:px-8 mb-4 flex flex-wrap gap-2 sm-ui mu-font"><button className="sm-btn" onClick={()=>setShowImport(true)}><Link2 size={16}/> Import to My Songs</button><button className="sm-btn" onClick={()=>setFocusView(v=>!v)}><Timer size={16}/>{focusView?"Exit focus view":"Focus view"}</button><button className="sm-btn" onClick={()=>useMusicStore.getState().setDrawer("mixer")}><SlidersHorizontal size={16}/> Ambience</button><LibraryStatus/></div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto mu-scroll px-4 md:px-8 pb-32">
          {/* Hero */}
          {activeTab === "all" && !focusView && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mu-glass-strong rounded-3xl p-6 md:p-10 mb-6 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/20 via-purple-500/10 to-transparent" />
              <div className="relative z-10 max-w-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-fuchsia-300" />
                  <span className="text-xs uppercase tracking-widest text-white/50 mu-font">Curated for Focus</span>
                </div>
                <h1 className="mu-serif italic text-4xl md:text-6xl text-white leading-[0.9] mb-4">
                  Sound that helps you <span className="text-fuchsia-300">study deeper.</span>
                </h1>
                <p className="text-sm text-white/60 mu-font max-w-md">
                  {MUSIC_CATALOG.length} hand-picked tracks — KALYANI (Remix), lo-fi, classical, piano, rain, and more. Pick a vibe, hit play, and dive in.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-white/60 mu-font">Plus: no Scholar promos</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-white/60 mu-font">Your songs & playlists</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-white/60 mu-font">Focus sessions</span>
                </div>
              </div>
            </motion.div>
          )}

          {lastTrack && <section className="sm-ui sm-continue-card" aria-label="Continue listening">
            <div className="sm-continue-art"><MusicThumbnail track={lastTrack}/></div>
            <div className="sm-continue-copy"><small>Continue listening</small><strong>{trackName(lastTrack)}</strong><p>{lastTrack.artist}</p></div>
            <button className="sm-btn" onClick={() => { const s = useMusicStore.getState(); if (!selectedTrack) s.playTrack(lastTrack, queue); else s.setWidgetVisible(true); window.dispatchEvent(new Event("scholar:music-controls")); }}>Open player</button>
          </section>}
          {activeTab==="all"&&!focusView&&<>
            <div className="sm-ui mu-font mb-5 flex flex-wrap items-center gap-3"><label className="flex-1 min-w-48 relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-white/40"/><input aria-label="Search music" placeholder="Search tracks, channels or moods" style={{paddingLeft:36}} value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Music category" style={{width:"auto",maxWidth:"100%"}} value={category} onChange={e=>setCategory(e.target.value)}>{[...CATEGORIES,"Sound textures",...(songs.length?["My Songs"]:[])].map(c=><option key={c}>{c}</option>)}</select><select aria-label="Music collection" style={{width:"auto",maxWidth:"100%"}} value={collection} onChange={e=>setCollection(e.target.value)}><option value="all">All sources</option><option value="favorites">Favorites</option><option value="recent">Recently played</option><option value="imported">My imports</option><option value="catalog">Scholar catalog</option><option value="native">Native audio · background friendly</option></select><select aria-label="Track duration" style={{width:"auto",maxWidth:"100%"}} value={duration} onChange={e=>setDuration(e.target.value)}><option value="all">All durations</option><option value="long">1 hour+ (known)</option><option value="unknown">Unknown / radio</option></select><label className="sm-check"><input type="checkbox" checked={noLyrics} onChange={e=>setNoLyrics(e.target.checked)}/> No lyrics</label></div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">{filtered.map(t=><TrackCard key={t.id} track={t} isActive={playingTrackId===t.videoId} isPlaying={isPlaying&&playingTrackId===t.videoId} onPlay={()=>{if(playingTrackId===t.videoId)useMusicStore.getState().togglePlay();else useMusicStore.getState().playTrack(t.data,filtered.map(v=>v.data));}}/>)}</div>
            {!filtered.length&&<p className="text-white/60 py-10 text-center mu-font">No matching tracks. Try a different filter.</p>}
            <div className="sm-ui mu-font mt-8"><SoundtrackBuilder tracks={allTracks}/></div>
          </>}
          {activeTab==="songs"&&!focusView&&<div className="sm-ui mu-font"><MySongs search={search} onImport={()=>setShowImport(true)}/></div>}
          {activeTab === "playlists" && !focusView && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white mu-font">My Playlists ({playlists.length})</h2>
                <button
                  onClick={() => { setEditPL(null); setNewPLName(""); setNewPLTrackIds([]); setShowCreatePL(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors mu-font"
                >
                  <Plus className="h-4 w-4" /> New Playlist
                </button>
              </div>

              {playlists.length === 0 ? (
                <div className="mu-glass rounded-2xl p-10 text-center">
                  <ListMusic className="h-10 w-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/50 mu-font text-sm">No playlists yet. Create one to group your favorite study tracks.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {playlists.map((pl) => (
                    <div key={pl.id} className="mu-glass rounded-2xl p-4 flex items-center gap-3">
                      <button
                        aria-label={`Play ${pl.name} playlist`}
                        onClick={() => playPlaylist(pl)}
                        className="grid place-items-center h-12 w-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 shrink-0 hover:scale-105 transition-transform"
                      >
                        <Play className="h-5 w-5 text-white" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white mu-font truncate">{pl.name}</p>
                        <p className="text-[11px] text-white/40 mu-font">{pl.trackIds.length} tracks</p>
                      </div>
                      <button
                        onClick={() => { setEditPL(pl.id); setNewPLName(pl.name); setNewPLTrackIds(pl.trackIds); setShowCreatePL(true); }}
                        className="px-3 py-2 rounded-full text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                        aria-label={`Edit ${pl.name}`}
                      >Edit</button>
                      <button
                        aria-label={`Delete ${pl.name} playlist`}
                        onClick={() => deletePlaylist(pl.id)}
                        className="p-2 rounded-full text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(activeTab==="focus"||focusView)&&<div className="sm-ui mu-font max-w-2xl mx-auto space-y-5"><FocusPanel/><MixerPanel/></div>}
          <p className="sm-music-disclaimer mu-font">YouTube music and videos belong to their respective creators, not Scholar. Original Scholar sound textures support audio-only background listening.</p>
          <div className="mt-8"><FreeAdSlot entitlement="study_music_ad_free" label="Study Music"/></div>

        </div>

      </div>

      <MusicImportDialog open={showImport} onClose={()=>setShowImport(false)}/>
      <Dialog open={showCreatePL} onOpenChange={setShowCreatePL}><DialogContent className="sm-dialog sm-ui mu-font"><DialogTitle>{editPL?"Edit Playlist":"New Playlist"}</DialogTitle><DialogDescription>Pick tracks for your next study session.</DialogDescription><input aria-label="Playlist name" maxLength={80} value={newPLName} onChange={e=>setNewPLName(e.target.value)} placeholder="Late Night Study"/><div className="max-h-72 overflow-y-auto mu-scroll space-y-2">{TRACKS.map(t=><button key={t.id} onClick={()=>toggleTrackInPL(t.id)} aria-pressed={newPLTrackIds.includes(t.id)} className={cn("w-full flex items-center gap-3 p-3 rounded-xl text-left",newPLTrackIds.includes(t.id)?"bg-fuchsia-500/20 ring-1 ring-fuchsia-500/40":"bg-white/5 hover:bg-white/10")}><span>{t.emoji}</span><span className="flex-1 text-sm">{t.title}<small className="block text-white/40">{t.desc}</small></span>{newPLTrackIds.includes(t.id)&&<Heart size={16}/>}</button>)}</div><button className="sm-btn sm-primary" disabled={!newPLName.trim()||!newPLTrackIds.length} onClick={createPlaylist}>{editPL?"Save Playlist":"Create Playlist"}</button></DialogContent></Dialog>
    </div>
  );
}
function LibraryStatus() {
  const owner=useMusicStore(s=>s.owner),status=useMusicStore(s=>s.syncStatus);
  return <span className="sm-library-status">{owner==="guest"?"Guest · saved on this device":status==="synced"?"Private library · cloud connected":"Device library · cloud unavailable"}{owner!=="guest"&&["conflict","unavailable"].includes(status)&&<button onClick={()=>window.dispatchEvent(new Event("scholar:music-sync"))}>Retry & merge</button>}</span>;
}
function TrackCard({track,isActive,isPlaying,onPlay}:{track:Track;isActive:boolean;isPlaying:boolean;onPlay:()=>void}) {
  const favorite=useMusicStore(s=>s.library.favorites.includes(track.id)),playlists=useMusicStore(s=>s.library.playlists);
  return <article className={cn("mu-glass rounded-2xl group transition-all hover:scale-[1.02]",isActive&&"ring-2 ring-fuchsia-500/60")}>
    <button onClick={onPlay} aria-label={`${isPlaying?"Pause":"Play"} ${track.title}`} className="sm-album-cover relative bg-white/5 overflow-hidden rounded-t-2xl w-full block text-left">
      <MusicThumbnail track={track.data}/><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"/>
      <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"><div className="grid place-items-center h-14 w-14 rounded-full bg-white/20 backdrop-blur-md">{isPlaying?<Pause className="h-6 w-6 text-white"/>:<Play className="h-6 w-6 text-white ml-1"/>}</div></div>
      {isActive&&<div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-fuchsia-500/90 text-white text-[10px] font-medium mu-font">{isPlaying?"Now Playing":"Selected"}</div>}
      {track.featured&&!isActive&&<div className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-100">Featured · Scholar Pick</div>}
      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono">{track.duration}</span><span className="absolute bottom-2 left-2 text-2xl">{track.emoji}</span>
    </button><div className="p-3"><p className="text-sm font-medium text-white mu-font truncate" title={track.title}>{track.title}</p><p className="sm-source-badge mu-font mt-0.5">{track.data.mediaSource === "AUDIO_SOURCE" ? "Native audio" : "YouTube source"} · {track.category}</p><p className="text-[11px] text-white/50 mu-font mt-1 line-clamp-1">{track.desc}</p>
    <div className="sm-ui sm-track-actions -mb-2 mt-1"><button className="sm-icon" aria-label={`Favorite ${track.title}`} aria-pressed={favorite} onClick={()=>useMusicStore.getState().favorite(track.id)}><Heart size={16} fill={favorite?"currentColor":"none"}/></button><button className="sm-icon" aria-label={`Queue ${track.title}`} onClick={()=>{useMusicStore.getState().addToQueue(track.data);toast.success("Added to queue");}}><Plus size={18}/></button><details className="sm-menu"><summary aria-label={`More actions for ${track.title}`}>•••</summary><div><button onClick={()=>useMusicStore.getState().addToQueue(track.data,true)}>Play next</button>{track.data.mediaSource === "YOUTUBE_VIDEO_SOURCE" && <a href={`https://www.youtube.com/watch?v=${track.videoId}`} target="_blank" rel="noopener noreferrer">Open on YouTube</a>}<button onClick={()=>{useMusicStore.getState().addSong(track.data);toast.success("Saved to My Songs");}}>Save to My Songs</button>{playlists.map(p=><button key={p.id} onClick={()=>useMusicStore.getState().playlistAdd(p.id,track.id)}>Add to {p.name}</button>)}</div></details></div></div>
  </article>;
}
export default MusicView;
