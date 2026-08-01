"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/lib/notifications/notification-api";
import { useStore } from "@/lib/store";
import { useMusicStore, type MusicTrack } from "@/lib/music-store";
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Plus, Music as MusicIcon,
  Clock, Brain, Sparkles, X, ListMusic, Headphones, Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { profileGetJSON, profileSetJSON, profileGetItem, profileSetItem } from "@/lib/profile-storage";
import { ReadyBackgroundVideo } from "@/components/ready-background-video";

// ===== Tracks =====
interface Track {
  id: string;
  videoId: string;
  title: string;
  category: string;
  emoji: string;
  duration: string;
  desc: string;
}

const TRACKS: Track[] = [
  { id: "lofi", videoId: "jfKfPfyJRdk", title: "Lo-Fi Hip Hop Radio", category: "Lo-Fi", emoji: "🎧", duration: "Live", desc: "Beats to relax & study to" },
  { id: "classical", videoId: "jgpJVI3tDbY", title: "Classical Study Music", category: "Classical", emoji: "🎻", duration: "1:00:00", desc: "Mozart, Bach & more" },
  { id: "nature", videoId: "eKFTSSKCzWA", title: "Nature Sounds — Forest", category: "Nature", emoji: "🌿", duration: "3:00:00", desc: "Birds, streams & wind" },
  { id: "binaural", videoId: "w5jA8G0kS6E", title: "Binaural Focus Beats", category: "Binaural", emoji: "🧠", duration: "1:00:00", desc: "Alpha waves for deep focus" },
  { id: "ambient", videoId: "4xDzrJKXOOY", title: "Ambient Space Drone", category: "Ambient", emoji: "🌌", duration: "2:00:00", desc: "Drifting cosmic textures" },
  { id: "piano", videoId: "4Tr0otuiQUU", title: "Peaceful Piano", category: "Piano", emoji: "🎹", duration: "1:30:00", desc: "Soft solo piano" },
  { id: "rain", videoId: "mPZkdNFkNpr", title: "Rain & Thunder Sounds", category: "Rain", emoji: "🌧️", duration: "8:00:00", desc: "Cozy rainy ambience" },
  { id: "deep-focus", videoId: "5qap5aO4i9A", title: "Deep Focus Radio", category: "Deep Focus", emoji: "🎯", duration: "Live", desc: "Synthwave for flow state" },
  { id: "study-focus", videoId: "xvT1jH8B9AM", title: "Study Focus Music", category: "Ambient", emoji: "🧘", duration: "1:00:00", desc: "Calming ambient focus by Ambient" },
];

// ===== Playlist (localStorage) =====
interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

const BG_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4";

const FOCUS_PRESETS = [15, 25, 45, 60];

export function MusicView() {
  const musicStore = useMusicStore();
  const scholarClass = useStore((s) => s.user.scholarClass);
  const [activeTab, setActiveTab] = useState<"all" | "playlists" | "focus">("all");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(70);

  // Load playlists from localStorage (lazy initial state — avoid setState in effect)
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = profileGetJSON<Playlist[]>(scholarClass, "mu-playlists", []);
    return Array.isArray(saved) ? saved : [];
  });
  const [showCreatePL, setShowCreatePL] = useState(false);
  const [newPLName, setNewPLName] = useState("");
  const [newPLTrackIds, setNewPLTrackIds] = useState<string[]>([]);

  // Focus timer
  const [focusDuration, setFocusDuration] = useState(25);
  const [focusRemaining, setFocusRemaining] = useState(0);
  const [focusActive, setFocusActive] = useState(false);
  const focusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);

  // Persist playlists
  const persistPlaylists = useCallback((pls: Playlist[]) => {
    setPlaylists(pls);
    profileSetJSON(scholarClass, "mu-playlists", pls);
  }, [scholarClass]);

  // Focus timer
  useEffect(() => {
    if (focusActive && focusRemaining > 0) {
      focusIntervalRef.current = setInterval(() => {
        setFocusRemaining((r) => {
          if (r <= 1) {
            // Complete
            clearInterval(focusIntervalRef.current!);
            setFocusActive(false);
            addXP(10);
            addCoins(5);
            pushActivity({ type: "study", text: `Completed ${focusDuration}-min focus session`, icon: "🎯" });
            toast.success(`Focus session complete! +10 XP, +5 coins`);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
      return () => {
        if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
      };
    }
  }, [focusActive, focusRemaining, focusDuration, addXP, addCoins, pushActivity]);

  const startFocus = (mins: number) => {
    setFocusDuration(mins);
    setFocusRemaining(mins * 60);
    setFocusActive(true);
    addXP(3);
    toast.success(`Focus session started · ${mins} min · +3 XP`);
  };

  const stopFocus = () => {
    setFocusActive(false);
    setFocusRemaining(0);
    if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
    toast.info("Focus session stopped");
  };

  // Player controls — uses global music store for persistent playback
  const currentTrack = TRACKS[currentIdx];
  const isPlaying = musicStore.isPlaying;
  const playingTrackId = musicStore.currentTrack?.id;

  const toGlobalTrack = (t: Track): MusicTrack => ({
    id: t.videoId,
    title: t.title,
    artist: t.category,
    category: t.category,
    thumbnail: `https://img.youtube.com/vi/${t.videoId}/hqdefault.jpg`,
  });

  const playTrack = (idx: number) => {
    setCurrentIdx(idx);
    const track = TRACKS[idx];
    const queue = TRACKS.map(toGlobalTrack);
    musicStore.playTrack(toGlobalTrack(track), queue);
    setMuted(false);
  };

  const togglePlay = () => {
    if (!musicStore.currentTrack) {
      playTrack(currentIdx);
    } else {
      musicStore.togglePlay();
    }
  };

  const skipNext = () => {
    const nextIdx = (currentIdx + 1) % TRACKS.length;
    setCurrentIdx(nextIdx);
    musicStore.playTrack(toGlobalTrack(TRACKS[nextIdx]), TRACKS.map(toGlobalTrack));
  };

  const skipPrev = () => {
    const prevIdx = (currentIdx - 1 + TRACKS.length) % TRACKS.length;
    setCurrentIdx(prevIdx);
    musicStore.playTrack(toGlobalTrack(TRACKS[prevIdx]), TRACKS.map(toGlobalTrack));
  };

  const toggleMute = () => {
    setMuted((v) => !v);
    if (muted) musicStore.setVolume(volume);
    else musicStore.setVolume(0);
  };

  // Create playlist
  const createPlaylist = () => {
    const name = newPLName.trim();
    if (!name) { toast.error("Give your playlist a name"); return; }
    if (newPLTrackIds.length === 0) { toast.error("Pick at least one track"); return; }
    const pl: Playlist = {
      id: `mu-pl-${Date.now()}`,
      name,
      trackIds: newPLTrackIds,
      createdAt: Date.now(),
    };
    persistPlaylists([pl, ...playlists]);
    setNewPLName("");
    setNewPLTrackIds([]);
    setShowCreatePL(false);
    toast.success(`Playlist "${name}" created`);
  };

  const deletePlaylist = (id: string) => {
    persistPlaylists(playlists.filter((p) => p.id !== id));
    toast.success("Playlist deleted");
  };

  const toggleTrackInPL = (trackId: string) => {
    setNewPLTrackIds((prev) => prev.includes(trackId) ? prev.filter((t) => t !== trackId) : [...prev, trackId]);
  };

  const playPlaylist = (pl: Playlist) => {
    const firstIdx = TRACKS.findIndex((t) => t.id === pl.trackIds[0]);
    if (firstIdx >= 0) {
      playTrack(firstIdx);
      setActiveTab("all");
      toast.success(`Playing "${pl.name}"`);
    }
  };

  // Format focus time
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="relative -m-3 min-h-[calc(100vh-4rem)] overflow-hidden sm:-m-4 lg:-m-6">
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
        <nav className="flex items-center justify-between px-4 md:px-8 py-4 mu-font">
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
          <div className="flex items-center gap-1 mu-glass rounded-full p-1">
            {[
              { id: "all", label: "All Music", icon: MusicIcon },
              { id: "playlists", label: "My Playlists", icon: ListMusic },
              { id: "focus", label: "Focus Session", icon: Timer },
            ].map((tab) => (
              <button
                key={tab.id}
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

        {/* Main content */}
        <div className="flex-1 overflow-y-auto mu-scroll px-4 md:px-8 pb-32">
          {/* Hero */}
          {activeTab === "all" && (
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
                  8 hand-picked audio streams — lo-fi, classical, binaural, rain, and more. Pick a vibe, hit play, and dive in.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-white/60 mu-font">No ads</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-white/60 mu-font">Looping streams</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-white/60 mu-font">+XP for focus</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tab content */}
          {activeTab === "all" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TRACKS.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <TrackCard
                    track={t}
                    isActive={currentIdx === i}
                    isPlaying={isPlaying && playingTrackId === t.videoId}
                    onPlay={() => playTrack(i)}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {activeTab === "playlists" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white mu-font">My Playlists ({playlists.length})</h2>
                <button
                  onClick={() => setShowCreatePL(true)}
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
                        onClick={() => playPlaylist(pl)}
                        className="grid place-items-center h-12 w-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 shrink-0 hover:scale-105 transition-transform"
                      >
                        <Play className="h-5 w-5 text-white" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white mu-font truncate">{pl.name}</p>
                        <p className="text-[11px] text-white/40 mu-font">{pl.trackIds.length} tracks · {new Date(pl.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button
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

          {activeTab === "focus" && (
            <div className="max-w-2xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mu-glass-strong rounded-3xl p-8 md:p-10 text-center"
              >
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Brain className="h-5 w-5 text-fuchsia-300" />
                  <span className="text-xs uppercase tracking-widest text-white/50 mu-font">Focus Session</span>
                </div>
                <h2 className="mu-serif italic text-5xl md:text-6xl text-white mb-2">
                  {focusActive || focusRemaining > 0 ? fmtTime(focusRemaining) : `${focusDuration}:00`}
                </h2>
                <p className="text-sm text-white/50 mu-font mb-8">
                  {focusActive ? "Stay focused. You've got this." : focusRemaining > 0 ? "Paused" : "Pick a duration to begin"}
                </p>

                {/* Circular progress ring */}
                {focusActive && (
                  <div className="relative w-48 h-48 mx-auto mb-8">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                      <circle
                        cx="50" cy="50" r="46" fill="none" stroke="url(#mu-grad)" strokeWidth="3" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 46}
                        strokeDashoffset={2 * Math.PI * 46 * (1 - focusRemaining / (focusDuration * 60))}
                        style={{ transition: "stroke-dashoffset 1s linear" }}
                      />
                      <defs>
                        <linearGradient id="mu-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#d946ef" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="text-3xl">🎯</span>
                    </div>
                  </div>
                )}

                {/* Presets */}
                {!focusActive && (
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {FOCUS_PRESETS.map((m) => (
                      <button
                        key={m}
                        onClick={() => startFocus(m)}
                        className={cn(
                          "mu-glass rounded-2xl p-4 hover:bg-white/5 transition-colors text-center",
                          focusDuration === m && !focusActive && "ring-2 ring-fuchsia-500/50"
                        )}
                      >
                        <Clock className="h-5 w-5 mx-auto mb-1 text-fuchsia-300" />
                        <p className="text-lg font-bold text-white mu-font">{m}</p>
                        <p className="text-[10px] text-white/40 mu-font">min</p>
                      </button>
                    ))}
                  </div>
                )}

                {focusActive && (
                  <button
                    onClick={stopFocus}
                    className="px-8 py-3 rounded-full text-sm font-medium bg-red-500/80 hover:bg-red-500 text-white transition-colors mu-font"
                  >
                    Stop Session
                  </button>
                )}

                <div className="mt-6 grid grid-cols-3 gap-2 text-xs text-white/50 mu-font">
                  <div className="mu-glass rounded-xl p-3">
                    <p className="text-white font-bold">+3 XP</p>
                    <p className="text-[10px] mt-0.5">on start</p>
                  </div>
                  <div className="mu-glass rounded-xl p-3">
                    <p className="text-white font-bold">+10 XP</p>
                    <p className="text-[10px] mt-0.5">on complete</p>
                  </div>
                  <div className="mu-glass rounded-xl p-3">
                    <p className="text-white font-bold">+5 coins</p>
                    <p className="text-[10px] mt-0.5">on complete</p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Now Playing bar — sticky bottom */}
        <AnimatePresence>
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="sticky bottom-0 z-20 px-4 md:px-8 pb-4"
          >
            <div className="mu-glass-strong rounded-2xl p-3 md:p-4 flex items-center gap-3 md:gap-4 max-w-5xl mx-auto">
              {/* Track info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="grid place-items-center h-12 w-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 shrink-0 text-xl">
                  {currentTrack.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white mu-font truncate">{currentTrack.title}</p>
                  <p className="text-[11px] text-white/40 mu-font truncate">{currentTrack.category} · {currentTrack.desc}</p>
                </div>
              </div>

              {/* Visualizer (desktop) */}
              <div className="hidden md:flex items-end gap-0.5 h-8 w-24">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 rounded-full bg-gradient-to-t from-fuchsia-500 to-purple-300",
                      isPlaying && "mu-bar-anim"
                    )}
                    style={{
                      height: isPlaying ? "40%" : "20%",
                      animationDelay: `${i * 0.07}s`,
                      animationDuration: `${0.7 + (i % 3) * 0.2}s`,
                      opacity: isPlaying ? 1 : 0.3,
                    }}
                  />
                ))}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1 md:gap-2 shrink-0">
                <button
                  onClick={skipPrev}
                  className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Previous"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  onClick={togglePlay}
                  className="grid place-items-center h-10 w-10 rounded-full bg-white text-black hover:scale-105 transition-transform"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                </button>
                <button
                  onClick={skipNext}
                  className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Next"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors hidden sm:block"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>

              {/* Volume (desktop) */}
              <div className="hidden lg:flex items-center gap-2 w-28 shrink-0">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setVolume(v);
                    setMuted(v === 0);
                  }}
                  className="flex-1 h-1 rounded-full bg-white/20 accent-fuchsia-500 cursor-pointer"
                  aria-label="Volume"
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Create Playlist Dialog */}
      <AnimatePresence>
        {showCreatePL && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setShowCreatePL(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg mu-glass-strong rounded-3xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white mu-font flex items-center gap-2">
                  <Plus className="h-5 w-5" /> New Playlist
                </h3>
                <button onClick={() => setShowCreatePL(false)} className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <input
                value={newPLName}
                onChange={(e) => setNewPLName(e.target.value)}
                placeholder="Playlist name (e.g. 'Late Night Study')"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-fuchsia-500/50 mb-4 mu-font"
              />
              <p className="text-xs text-white/50 mu-font mb-2">Pick tracks ({newPLTrackIds.length} selected)</p>
              <div className="space-y-2 max-h-72 overflow-y-auto mu-scroll pr-1 mb-4">
                {TRACKS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => toggleTrackInPL(t.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left",
                      newPLTrackIds.includes(t.id) ? "bg-fuchsia-500/20 ring-1 ring-fuchsia-500/40" : "bg-white/5 hover:bg-white/10"
                    )}
                  >
                    <span className="text-lg">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white mu-font truncate">{t.title}</p>
                      <p className="text-[10px] text-white/40 mu-font">{t.category}</p>
                    </div>
                    {newPLTrackIds.includes(t.id) && (
                      <div className="grid place-items-center h-5 w-5 rounded-full bg-fuchsia-500">
                        <Plus className="h-3 w-3 text-white rotate-45" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={createPlaylist}
                className="w-full py-3 rounded-full bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors mu-font"
              >
                Create Playlist
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Track Card =====
function TrackCard({
  track, isActive, isPlaying, onPlay,
}: {
  track: Track;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  const [thumbStage, setThumbStage] = useState<0 | 1 | 2>(0);
  const thumbSrc =
    thumbStage === 0
      ? `https://img.youtube.com/vi/${track.videoId}/hqdefault.jpg`
      : thumbStage === 1
        ? `https://img.youtube.com/vi/${track.videoId}/mqdefault.jpg`
        : "";

  return (
    <div
      onClick={onPlay}
      className={cn(
        "mu-glass rounded-2xl overflow-hidden cursor-pointer group transition-all hover:scale-[1.02]",
        isActive && "ring-2 ring-fuchsia-500/60"
      )}
    >
      <div className="relative aspect-video bg-white/5 overflow-hidden">
        {thumbStage < 2 ? (
          <img
            src={thumbSrc}
            alt={track.title}
            loading="lazy"
            onError={() => setThumbStage((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : s))}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20">
            <MusicIcon className="h-10 w-10 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {/* Play overlay */}
        <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="grid place-items-center h-14 w-14 rounded-full bg-white/20 backdrop-blur-md">
            {isPlaying ? <Pause className="h-6 w-6 text-white" /> : <Play className="h-6 w-6 text-white ml-1" />}
          </div>
        </div>
        {/* Now playing badge */}
        {isActive && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-fuchsia-500/90 text-white text-[10px] font-medium mu-font">
            <span className="flex items-end gap-0.5 h-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn("w-0.5 bg-white rounded-full", isPlaying && "mu-bar-anim")}
                  style={{ height: "50%", animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
            Now Playing
          </div>
        )}
        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono">
          {track.duration}
        </span>
        <span className="absolute bottom-2 left-2 text-2xl">{track.emoji}</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-white mu-font truncate">{track.title}</p>
        <p className="text-xs text-white/40 mu-font mt-0.5">{track.category}</p>
        <p className="text-[11px] text-white/50 mu-font mt-1 line-clamp-1">{track.desc}</p>
      </div>
    </div>
  );
}

export default MusicView;
