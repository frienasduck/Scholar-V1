import { beforeEach, expect, test } from "bun:test";
import { useMusicStore, musicDefaults } from "../src/lib/music-store";
import { emptyLibrary, parseYouTubeUrl, thumbnailCandidates, librarySchema, mergeLibraries, cleanTrack } from "../src/lib/study-music/model";
import { NATIVE_AUDIO_CATALOG, createTextureWav } from "../src/lib/study-music/native-audio";
import { sourcePlaybackAllowed } from "../src/lib/study-music/source-visibility";
import { MUSIC_CATALOG, buildSoundtrack } from "../src/lib/study-music/catalog";
import { clampPosition, normalizePosition, restorePosition, snapPosition } from "../src/lib/study-music/position";
import { advanceFocus, focusRemaining, toggleFocusPause, type FocusSession } from "../src/lib/study-music/focus";
import { persistMusic, restoreMusic, musicStorageKey } from "../src/lib/study-music/storage";
import { youtubeVideoRequest } from "../src/lib/study-music/youtube-player";

const [a,b,c] = MUSIC_CATALOG;
test("legacy YouTube imports migrate without losing title, attribution or identity", () => {
  const legacy = { ...a, mediaSource: undefined };
  expect(cleanTrack(legacy).mediaSource).toBe("YOUTUBE_VIDEO_SOURCE");
  expect(cleanTrack(legacy).artist).toBe(a.artist);
});
test("native audio is explicitly original and supports mixed playlists, history and favorites", () => {
  const native = NATIVE_AUDIO_CATALOG[0];
  expect(cleanTrack(native).mediaSource).toBe("AUDIO_SOURCE");
  expect(thumbnailCandidates(native.id)).toEqual([]);
  expect(librarySchema.safeParse({ ...emptyLibrary(), songs: [a, native], favorites: [native.id], history: [{ id: native.id, at: 1 }], playlists: [{ id: "p", name: "Focus", trackIds: [a.id, native.id] }] }).success).toBe(true);
  expect(() => cleanTrack({ ...native, id: "audio:unknown" })).toThrow();
  expect(() => cleanTrack({ ...native, texture: "ocean" })).toThrow();
  expect(() => cleanTrack({ ...native, provenance: "youtube-extracted" })).toThrow();
});
test("native audio loops are real, bounded PCM audio without external media", () => {
  for (const texture of ["rain", "brown", "white", "ocean"] as const) {
    const wav = createTextureWav(texture), bytes = new DataView(wav);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
    expect(bytes.getUint32(24, true)).toBe(22050);
    expect(wav.byteLength).toBe(44 + 22050 * 16 * 2);
    expect([...new Int16Array(wav.slice(44, 2044))].some(sample => sample !== 0)).toBe(true);
  }
});
test("YouTube source requires minimum usable size, majority visibility and no covering overlay", () => {
  const rect = { width: 320, height: 200, top: 60, left: 0, right: 320, bottom: 260 }, viewport = { width: 390, height: 844 };
  expect(sourcePlaybackAllowed(rect, viewport, true)).toBe(true);
  expect(sourcePlaybackAllowed({ ...rect, height: 199 }, viewport, true)).toBe(false);
  expect(sourcePlaybackAllowed({ ...rect, width: 199 }, viewport, true)).toBe(false);
  expect(sourcePlaybackAllowed(rect, viewport, false)).toBe(false);
  expect(sourcePlaybackAllowed({ ...rect, top: 654, bottom: 854 }, viewport, true)).toBe(false);
  expect(sourcePlaybackAllowed({ ...rect, top: 744, bottom: 944 }, viewport, true)).toBe(false);
});
test("video expansion and minimization preserve the track, playback and playhead", () => {
  const s = useMusicStore.getState(); s.playTrack(a); s.setCurrentTime(42); s.toggleExpand();
  expect(useMusicStore.getState().widgetExpanded).toBe(true); s.toggleExpand(); s.toggleMinimize();
  expect(useMusicStore.getState().currentTime).toBe(42); expect(useMusicStore.getState().isPlaying).toBe(true);
  s.togglePlay(); expect(useMusicStore.getState().widgetMinimized).toBe(true);
});
test("covering music tools pause YouTube but retain native background audio", () => {
  const s = useMusicStore.getState(); s.playTrack(a); s.setDrawer("queue"); expect(useMusicStore.getState().isPlaying).toBe(false);
  s.setDrawer(null); expect(useMusicStore.getState().isPlaying).toBe(false);
  s.playTrack(NATIVE_AUDIO_CATALOG[0]); s.setDrawer("mixer"); expect(useMusicStore.getState().isPlaying).toBe(true);
});
test("switching media sources clears old buffering and expanded-video state", () => {
  const s = useMusicStore.getState(); s.playTrack(a); s.setBuffering(true); s.toggleExpand(); s.playTrack(NATIVE_AUDIO_CATALOG[0]);
  expect(useMusicStore.getState().buffering).toBe(false); expect(useMusicStore.getState().widgetExpanded).toBe(false);
});
beforeEach(() => useMusicStore.setState({ ...musicDefaults(), library: emptyLibrary(), libraryVersion: 0, owner: "guest", hydrated: true, cloudRevision: 0, syncStatus: "local" }));
test("supported video links become one canonical identity, with playlist parameters ignored", () => {
  for (const url of [`https://www.youtube.com/watch?v=${a.id}&list=anything`, `https://youtu.be/${a.id}?si=anything`, `https://music.youtube.com/watch?v=${a.id}`, `https://m.youtube.com/shorts/${a.id}`, `https://youtube.com/embed/${a.id}`]) expect(parseYouTubeUrl(url)).toEqual({ id: a.id, url: `https://www.youtube.com/watch?v=${a.id}` });
});
test("arbitrary hosts, credentials, ports, unsafe schemes and playlist-only links are rejected", () => {
  for (const url of ["http://127.0.0.1", "https://youtube.com.evil.test/watch?v=jfKfPfyJRdk", "https://youtube.com@evil.test/watch?v=jfKfPfyJRdk", "https://user:pass@youtube.com/watch?v=jfKfPfyJRdk", "https://youtube.com:8443/watch?v=jfKfPfyJRdk", "javascript:alert(1)", "https://youtube.com/playlist?list=abc", "https://youtu.be/jfKfPfyJRdk/other", "https://youtube.com/watch?v=bad"]) expect(() => parseYouTubeUrl(url)).toThrow();
});
test("thumbnail chain trusts only known image hosts and valid video IDs", () => {
  expect(thumbnailCandidates(a.id, "https://private.test/image")[0]).toBe(`https://i.ytimg.com/vi/${a.id}/hqdefault.jpg`);
  expect(thumbnailCandidates(a.id)).toHaveLength(3); expect(thumbnailCandidates("bad")).toEqual([]);
});
test("catalog is bounded, validated, unique, attributed and contains no fabricated durations", () => {
  expect(MUSIC_CATALOG.length).toBeGreaterThan(10);
  expect(new Set(MUSIC_CATALOG.map(t => t.id)).size).toBe(MUSIC_CATALOG.length);
  expect(librarySchema.safeParse({ ...emptyLibrary(), songs: MUSIC_CATALOG }).success).toBe(true);
  expect(MUSIC_CATALOG.every(t => !!t.artist && !t.title.includes("Binaural Focus"))).toBe(true);
});
test("queue controls preserve the selected item through reorder and removal", () => {
  const s = useMusicStore.getState(); s.playTrack(b,[a,b,c]); s.moveQueue(1,-1); expect(useMusicStore.getState().queueIndex).toBe(0); expect(useMusicStore.getState().currentTrack?.id).toBe(b.id);
  s.removeQueue(0); expect(useMusicStore.getState().queue).toHaveLength(3); s.removeQueue(2); expect(useMusicStore.getState().queue).toHaveLength(2);
  s.addToQueue(c,true); expect(useMusicStore.getState().queue[1].id).toBe(c.id); s.clearQueue(); expect(useMusicStore.getState().queue.map(t=>t.id)).toEqual([b.id]);
});
test("play, pause, bounded volume and seek requests reach the real player command channel", () => {
  const s=useMusicStore.getState();s.playTrack(a);s.togglePlay();expect(useMusicStore.getState().isPlaying).toBe(false);
  s.setDuration(100);s.seekTo(300);expect(useMusicStore.getState().seekRequest).toEqual({time:100,nonce:1});s.seekTo(-3);expect(useMusicStore.getState().seekRequest.time).toBe(0);
  s.setVolume(200);expect(useMusicStore.getState().volume).toBe(100);s.setVolume(-1);expect(useMusicStore.getState().muted).toBe(true);
  s.setCurrentTime(10);s.prev();expect(useMusicStore.getState().seekRequest.nonce).toBe(3);
});
test("repeat one affects ended playback, not the user's next button", () => {
  const s=useMusicStore.getState();s.playTrack(a,[a,b]);s.setRepeatMode("one");s.next(true);expect(useMusicStore.getState().currentTrack?.id).toBe(a.id);expect(useMusicStore.getState().seekRequest.nonce).toBe(1);
  s.next();expect(useMusicStore.getState().currentTrack?.id).toBe(b.id);s.setRepeatMode("off");s.next(true);expect(useMusicStore.getState().isPlaying).toBe(false);s.setRepeatMode("all");s.next(true);expect(useMusicStore.getState().currentTrack?.id).toBe(a.id);
});
test("shuffle avoids immediate repeats and exhausts the bag before wrapping", () => {
  const s=useMusicStore.getState();s.playTrack(a,[a,b,c]);s.toggleShuffle();s.next();const id=useMusicStore.getState().currentTrack?.id;expect(id).not.toBe(a.id);s.next();expect(useMusicStore.getState().currentTrack?.id).not.toBe(id);expect(useMusicStore.getState().currentTrack?.id).not.toBe(a.id);s.next();expect(useMusicStore.getState().isPlaying).toBe(false);
});
test("minimizing controls preserves playback; close pauses without destroying ambience", () => {
  const s=useMusicStore.getState();s.playTrack(a);s.setAmbience("rain",40);s.toggleAmbience();s.toggleMinimize();expect(useMusicStore.getState().isPlaying).toBe(true);expect(useMusicStore.getState().widgetMinimized).toBe(true);expect(useMusicStore.getState().ambienceEnabled).toBe(true);s.toggleMinimize();expect(useMusicStore.getState().isPlaying).toBe(true);s.closeWidget();expect(useMusicStore.getState().isPlaying).toBe(false);
});
test("My Songs detects duplicates, reorders, keeps source attribution and edits playlists", () => {
  const s=useMusicStore.getState();expect(s.addSong(a)).toBe(true);expect(s.addSong(a)).toBe(false);s.addSong(b);s.moveSong(1,-1);s.renameSong(b.id,"My display title");expect(useMusicStore.getState().library.songs[0].title).toBe(b.title);
  s.favorite(a.id);s.createPlaylist("Revision",[a.id]);const p=useMusicStore.getState().library.playlists[0];s.playlistAdd(p.id,b.id);s.playlistAdd(p.id,b.id);expect(useMusicStore.getState().library.playlists[0].trackIds).toHaveLength(2);s.removeSong(a.id);expect(useMusicStore.getState().library.playlists[0].trackIds).toEqual([b.id]);
});
test("large libraries, duplicate song IDs and invalid imports cannot be persisted", () => {
  expect(librarySchema.safeParse({...emptyLibrary(),songs:[a,a]}).success).toBe(false);
  expect(librarySchema.safeParse({...emptyLibrary(),songs:Array(401).fill(a)}).success).toBe(false);
  expect(()=>useMusicStore.getState().addSong({...a,id:"https://evil.test"})).toThrow();
});
test("normalized mini-player bounds survive laptop-to-phone resize and zoom", () => {
  const b={width:356,height:400,viewportWidth:1366,viewportHeight:768};const p=clampPosition({x:9999,y:-999},b);expect(p.x).toBe(1002);expect(p.y).toBe(8);expect(restorePosition(normalizePosition(p,b),b)).toEqual(p);
  const mobile={width:304,height:400,viewportWidth:320,viewportHeight:568,bottomInset:90};const small=restorePosition({x:1,y:1},mobile);expect(small.x).toBe(8);expect(small.y).toBe(78);expect(snapPosition({x:300,y:600},b).x).toBe(8);
});
const focus = ():FocusSession=>({id:"f",goal:"Study",subject:"Physics",chapter:"Motion",studySeconds:1500,breakSeconds:300,phase:"study",deadline:1600000,remaining:1500,paused:false,startedAt:100000,music:a.title,pauseMusicOnBreak:false,recorded:false});
test("focus uses deadlines across refresh/background, with exact pause/resume",()=>{
  const f=focus();expect(focusRemaining(f,1000000)).toBe(600);const paused=toggleFocusPause(f,1000000);expect(focusRemaining(paused,5000000)).toBe(600);const resumed=toggleFocusPause(paused,5000000);expect(resumed.deadline).toBe(5600000);expect(advanceFocus(resumed,5600000).phase).toBe("break");expect(advanceFocus(resumed,5600000).paused).toBe(true);
});
test("focus records once, no-break completes, break pause is respected",()=>{
  const s=useMusicStore.getState();useMusicStore.setState({focus:{...focus(),deadline:0,breakSeconds:0}});s.tickFocus();expect(useMusicStore.getState().focus?.phase).toBe("complete");expect(s.recordFocus()?.seconds).toBe(1500);expect(s.recordFocus()).toBeNull();expect(useMusicStore.getState().focusHistory).toHaveLength(1);
});
test("library storage is account-scoped and restores every sound source paused",()=>{
  const values=new Map<string,string>();const previous=globalThis.localStorage;
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
  try{const s=useMusicStore.getState();s.addSong(a);s.playTrack(a);s.toggleAmbience();useMusicStore.setState({owner:"user:A"});expect(persistMusic(useMusicStore.getState(),0)).toBe(true);expect(musicStorageKey("user:A")).not.toBe(musicStorageKey("guest"));const restored=restoreMusic("user:A");expect(restored.isPlaying).toBe(false);expect(restored.ambienceEnabled).toBe(false);expect(restored.library?.songs).toHaveLength(1);expect(restoreMusic("user:B").library?.songs).toHaveLength(0);}finally{Object.defineProperty(globalThis,"localStorage",{configurable:true,value:previous});}
});
test("explicit conflict merge retains local and remote songs without duplicates",()=>{expect(mergeLibraries({...emptyLibrary(),songs:[a,b]},{...emptyLibrary(),songs:[b,c]}).songs).toHaveLength(3);});
test("soundtrack selection ranks neutral tags and favorites without fabricated learning claims",()=>{expect(buildSoundtrack([a,b,c],"energetic",[a.id],2)).toHaveLength(2);});
test("switching tracks never replays a stale seek command",()=>{const s=useMusicStore.getState();s.playTrack(a,[a,b]);s.setDuration(300);s.seekTo(200);s.next();expect(useMusicStore.getState().seekRequest).toEqual({time:0,nonce:0});expect(useMusicStore.getState().currentTime).toBe(0);s.closeWidget();s.addToQueue(c);expect(useMusicStore.getState().currentTime).toBe(0);});
test("explicit library merge retains the most recent play timestamp",()=>{const merged=mergeLibraries({...emptyLibrary(),history:[{id:a.id,at:20}]},{...emptyLibrary(),history:[{id:a.id,at:50},{id:b.id,at:30}]});expect(merged.history).toEqual([{id:a.id,at:50},{id:b.id,at:30}]);});
test("YouTube initialization always has a real video ID and safe start time",()=>{expect(()=>youtubeVideoRequest("")).toThrow();expect(youtubeVideoRequest(a.id,NaN)).toEqual({videoId:a.id,startSeconds:0});expect(youtubeVideoRequest(a.id,-10).startSeconds).toBe(0);expect(youtubeVideoRequest(a.id,12.8).startSeconds).toBe(12);});
test("non-finite and live-stream telemetry cannot poison saved playback state",()=>{const s=useMusicStore.getState();s.setCurrentTime(Infinity);expect(useMusicStore.getState().currentTime).toBe(0);s.setCurrentTime(18000000);expect(useMusicStore.getState().currentTime).toBe(604800);s.setDuration(18000000);expect(useMusicStore.getState().duration).toBe(0);});
