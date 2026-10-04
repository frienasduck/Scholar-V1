"use client";
import { useEffect, useRef } from "react";
import { useMusicStore } from "@/lib/music-store";
import { createTextureWav } from "@/lib/study-music/native-audio";

export function NativeAudioPlayer() {
  const track = useMusicStore(s => s.currentTrack), playing = useMusicStore(s => s.isPlaying);
  const volume = useMusicStore(s => s.volume), muted = useMusicStore(s => s.muted), seek = useMusicStore(s => s.seekRequest);
  const owner = useMusicStore(s => s.owner), nonce = useMusicStore(s => s.playNonce);
  const audio = useRef<HTMLAudioElement | null>(null);
  const texture = track?.mediaSource === "AUDIO_SOURCE" ? track.texture : null;
  useEffect(() => {
    if (!texture) return;
    const url = URL.createObjectURL(new Blob([createTextureWav(texture)], { type: "audio/wav" }));
    const element = new Audio(url); audio.current = element; element.loop = true;
    const s = useMusicStore.getState(); element.volume = s.volume / 100; element.muted = s.muted;
    element.currentTime = Math.min(15.9, s.currentTime);
    const update = () => { const state = useMusicStore.getState(); state.setDuration(element.duration); state.setCurrentTime(element.currentTime); };
    const fail = () => useMusicStore.getState().setError("This browser could not play the native sound texture. Retry or choose another track.");
    element.addEventListener("timeupdate", update); element.addEventListener("loadedmetadata", update); element.addEventListener("error", fail);
    return () => { element.pause(); element.removeEventListener("timeupdate", update); element.removeEventListener("loadedmetadata", update); element.removeEventListener("error", fail); element.removeAttribute("src"); element.load(); audio.current = null; URL.revokeObjectURL(url); };
  }, [texture, owner]);
  useEffect(() => {
    const element = audio.current; if (!element) return;
    if (nonce && useMusicStore.getState().currentTime === 0) element.currentTime = 0;
    if (playing) void element.play().catch(() => { if (audio.current === element) useMusicStore.getState().setError("Your browser paused audio. Press Play to allow sound."); });
    else element.pause();
  }, [playing, texture, nonce, owner]);
  useEffect(() => { if (audio.current) { audio.current.volume = volume / 100; audio.current.muted = muted; } }, [volume, muted]);
  useEffect(() => { if (audio.current && seek.nonce) audio.current.currentTime = Math.min(15.9, seek.time); }, [seek]);
  return null;
}
