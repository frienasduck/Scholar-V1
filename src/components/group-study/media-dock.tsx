"use client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  PhoneOff,
} from "lucide-react";
import type { GroupRoomController } from "./use-room";
import { useGroupMedia } from "./use-group-media";
import { useEffect, useRef } from "react";

function MediaTile({
  stream,
  label,
  muted = false,
  outputMuted = false,
}: {
  stream: MediaStream;
  label: string;
  muted?: boolean;
  outputMuted?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);
  const hasVideo = stream
    .getVideoTracks()
    .some((track) => track.readyState === "live");
  return (
    <article className="gs-media-tile" data-video={hasVideo}>
      <video
        ref={video}
        autoPlay
        playsInline
        muted={muted || outputMuted}
        aria-label={`${label} live media`}
      />
      {!hasVideo && (
        <span className="gs-media-avatar">
          {label.slice(0, 2).toUpperCase()}
        </span>
      )}
      <small>{label}</small>
    </article>
  );
}

export function MediaDock({
  roomId,
  controller,
  expanded,
  onExpanded,
}: {
  roomId: string;
  controller: GroupRoomController;
  expanded: boolean;
  onExpanded: (value: boolean) => void;
}) {
  const media = useGroupMedia(roomId, controller),
    s = controller.snapshot;
  if (!s) return null;
  const joined = Boolean(media.localStream),
    camera = Boolean(media.localStream?.getVideoTracks().length);
  const name = (id: string) =>
    s.participants.find((person) => person.id === id)?.displayName ??
    "Study partner";
  return (
    <div className={`gs-media-dock ${expanded ? "is-open" : ""}`}>
      <div
        className="gs-media-controls gs-glass"
        aria-label="Group media controls"
      >
        {!joined ? (
          <button
            className="gs-button"
            onClick={() => void media.joinVoice()}
            disabled={!s.room.voiceEnabled || !s.me.voiceAllowed}
          >
            <Mic />
            Join voice
          </button>
        ) : (
          <>
            <button
              className="gs-button gs-button-icon"
              onClick={media.toggleMute}
              aria-label={
                media.audioMuted ? "Unmute microphone" : "Mute microphone"
              }
              aria-pressed={media.audioMuted}
            >
              {media.audioMuted ? <MicOff /> : <Mic />}
            </button>
            <button
              className="gs-button gs-button-icon"
              onClick={() => void media.toggleCamera()}
              disabled={!s.room.cameraEnabled || !s.me.cameraAllowed}
              aria-label={camera ? "Turn camera off" : "Turn camera on"}
              aria-pressed={camera}
            >
              {camera ? <Video /> : <VideoOff />}
            </button>
            <button
              className="gs-button gs-button-icon"
              onClick={() => media.setAudioOutputMuted(!media.audioOutputMuted)}
              aria-label={
                media.audioOutputMuted ? "Hear group audio" : "Mute group audio"
              }
            >
              {media.audioOutputMuted ? <VolumeX /> : <Volume2 />}
            </button>
            <button
              className="gs-button gs-button-icon gs-button-danger"
              onClick={() => void media.leaveVoice()}
              aria-label="Leave voice"
            >
              <PhoneOff />
            </button>
          </>
        )}
        <button
          className="gs-button"
          onClick={() => onExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {s.participants.filter((person) => person.voiceJoined).length} in
          voice
        </button>
      </div>
      {media.mediaError && (
        <p className="gs-note gs-error" role="alert">
          {media.mediaError}
        </p>
      )}
      {expanded && joined && (
        <div className="gs-media-tiles gs-glass">
          {media.localStream && (
            <MediaTile
              stream={media.localStream}
              label={`${s.me.displayName} · You`}
              muted
            />
          )}
          {media.remoteMedia.map((item) => (
            <MediaTile
              key={item.participantId}
              stream={item.stream}
              label={name(item.participantId)}
              outputMuted={media.audioOutputMuted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
