"use client";
import Image from "next/image";
import { useState } from "react";
import { Music2, CloudRain, Waves, AudioLines } from "lucide-react";
import { thumbnailCandidates, type MusicTrack } from "@/lib/study-music/model";
export function MusicThumbnail({ track }: { track: MusicTrack }) {
  if (track.mediaSource === "AUDIO_SOURCE") {
    const Icon = track.texture === "rain" ? CloudRain : track.texture === "ocean" ? Waves : AudioLines;
    return <div className={`sm-art sm-native-art sm-native-${track.texture}`}><span className="sm-native-orbit"/><Icon size={36} aria-hidden="true"/></div>;
  }
  return <Thumbnail key={`${track.id}:${track.thumbnail}`} track={track}/>;
}
function Thumbnail({ track }: { track: MusicTrack }) {
  const [index, setIndex] = useState(0), [loaded, setLoaded] = useState(false);
  const candidates = thumbnailCandidates(track.id, track.thumbnail);
  const fail = () => { setLoaded(false); setIndex(value => value + 1); };
  return <div className={`sm-art ${loaded ? "sm-art-loaded" : ""}`}>
    <Music2 size={28} aria-hidden="true"/>
    {index < candidates.length && <Image key={candidates[index]} src={candidates[index]} alt="" fill sizes="(max-width: 640px) 45vw, 240px" unoptimized loading="lazy" onError={fail} onLoad={event => { if ((event.target as HTMLImageElement).naturalWidth <= 120) fail(); else setLoaded(true); }} />}
  </div>;
}
