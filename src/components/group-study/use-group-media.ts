"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GroupRoomController } from "./use-room";
import { errorMessage, groupRequest } from "./client";

type Signal = {
  id: string;
  senderId: string;
  kind: "offer" | "answer" | "ice" | "leave";
  payload: Record<string, unknown>;
  createdAt: string;
};
type RemoteMedia = { participantId: string; stream: MediaStream };

export function useGroupMedia(roomId: string, controller: GroupRoomController) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteMedia, setRemoteMedia] = useState<RemoteMedia[]>([]);
  const [mediaError, setMediaError] = useState("");
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioOutputMuted, setAudioOutputMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null),
    peers = useRef(new Map<string, RTCPeerConnection>()),
    candidates = useRef(new Map<string, RTCIceCandidateInit[]>()),
    cursor = useRef(new Date(Date.now() - 5_000).toISOString()),
    config = useRef<RTCConfiguration>({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
  const me = controller.snapshot?.me;

  const sendSignal = useCallback(
    async (
      targetId: string,
      kind: Signal["kind"],
      payload: Record<string, unknown>,
    ) => {
      await groupRequest(
        `/api/group-study/rooms/${encodeURIComponent(roomId)}/signals`,
        {
          method: "POST",
          body: JSON.stringify({ targetId, kind, payload }),
        },
        10_000,
      );
    },
    [roomId],
  );
  const dropPeer = useCallback((participantId: string) => {
    peers.current.get(participantId)?.close();
    peers.current.delete(participantId);
    candidates.current.delete(participantId);
    setRemoteMedia((items) =>
      items.filter((item) => item.participantId !== participantId),
    );
  }, []);
  const ensurePeer = useCallback(
    (participantId: string) => {
      const existing = peers.current.get(participantId);
      if (existing) return existing;
      const peer = new RTCPeerConnection(config.current);
      peers.current.set(participantId, peer);
      streamRef.current
        ?.getTracks()
        .forEach((track) => peer.addTrack(track, streamRef.current!));
      peer.onicecandidate = (event) => {
        if (event.candidate)
          void sendSignal(
            participantId,
            "ice",
            JSON.parse(JSON.stringify(event.candidate)) as Record<
              string,
              unknown
            >,
          ).catch(() => undefined);
      };
      peer.ontrack = (event) =>
        setRemoteMedia((items) => [
          ...items.filter((item) => item.participantId !== participantId),
          {
            participantId,
            stream: event.streams[0] ?? new MediaStream([event.track]),
          },
        ]);
      peer.onconnectionstatechange = () => {
        if (["failed", "closed"].includes(peer.connectionState))
          dropPeer(participantId);
      };
      return peer;
    },
    [dropPeer, sendSignal],
  );
  const negotiate = useCallback(
    async (participantId: string) => {
      const peer = ensurePeer(participantId),
        offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal(participantId, "offer", {
        type: offer.type,
        sdp: offer.sdp,
      });
    },
    [ensurePeer, sendSignal],
  );

  useEffect(() => {
    const activeIds = new Set(
      (controller.snapshot?.participants ?? [])
        .filter((p) => p.id !== me?.id && p.voiceJoined)
        .map((p) => p.id),
    );
    for (const id of peers.current.keys()) if (!activeIds.has(id)) dropPeer(id);
    if (me?.voiceJoined)
      for (const id of activeIds)
        if (!peers.current.has(id) && me.id < id)
          void negotiate(id).catch((cause) =>
            setMediaError(errorMessage(cause)),
          );
  }, [
    controller.snapshot?.participants,
    me?.id,
    me?.voiceJoined,
    dropPeer,
    negotiate,
  ]);

  useEffect(() => {
    if (!me?.voiceJoined) return;
    let stopped = false,
      running = false;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (stopped || running || document.hidden) return;
      running = true;
      try {
        const result = await groupRequest<{
          signals: Signal[];
          serverTime: string;
        }>(
          `/api/group-study/rooms/${encodeURIComponent(roomId)}/signals?after=${encodeURIComponent(cursor.current)}`,
          { signal: abort.signal },
          10_000,
        );
        cursor.current = result.serverTime;
        for (const signal of result.signals) {
          if (signal.kind === "leave") {
            dropPeer(signal.senderId);
            continue;
          }
          const peer = ensurePeer(signal.senderId);
          if (signal.kind === "offer") {
            await peer.setRemoteDescription(
              signal.payload as unknown as RTCSessionDescriptionInit,
            );
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await sendSignal(signal.senderId, "answer", {
              type: answer.type,
              sdp: answer.sdp,
            });
          } else if (signal.kind === "answer")
            await peer.setRemoteDescription(
              signal.payload as unknown as RTCSessionDescriptionInit,
            );
          else if (signal.kind === "ice") {
            if (peer.remoteDescription)
              await peer.addIceCandidate(
                signal.payload as unknown as RTCIceCandidateInit,
              );
            else
              candidates.current.set(signal.senderId, [
                ...(candidates.current.get(signal.senderId) ?? []),
                signal.payload as unknown as RTCIceCandidateInit,
              ]);
          }
          if (peer.remoteDescription) {
            for (const candidate of candidates.current.get(signal.senderId) ??
              [])
              await peer.addIceCandidate(candidate);
            candidates.current.delete(signal.senderId);
          }
        }
      } catch (cause) {
        if (
          !stopped &&
          !(cause instanceof DOMException && cause.name === "AbortError")
        )
          setMediaError(errorMessage(cause));
      } finally {
        running = false;
      }
      if (!stopped) timer = setTimeout(() => void poll(), 1_000);
    };
    void poll();
    return () => {
      stopped = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [roomId, me?.voiceJoined, dropPeer, ensurePeer, sendSignal]);

  const stopLocal = useCallback(
    async (notify = true) => {
      if (notify)
        await Promise.allSettled(
          [...peers.current.keys()].map((id) => sendSignal(id, "leave", {})),
        );
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setLocalStream(null);
      for (const peer of peers.current.values()) peer.close();
      peers.current.clear();
      setRemoteMedia([]);
      setAudioMuted(false);
      if (notify)
        await controller.action("media-state", {
          voiceJoined: false,
          cameraActive: false,
        });
    },
    [controller.action, sendSignal],
  );
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      for (const peer of peers.current.values()) peer.close();
    },
    [],
  );
  useEffect(() => {
    if (controller.connection === "ended") void stopLocal(false);
  }, [controller.connection, stopLocal]);
  useEffect(() => {
    if (
      localStream &&
      (!controller.snapshot?.room.voiceEnabled ||
        !controller.snapshot.me.voiceAllowed)
    )
      void stopLocal(false);
    else if (
      localStream?.getVideoTracks().length &&
      (!controller.snapshot?.room.cameraEnabled ||
        !controller.snapshot.me.cameraAllowed)
    ) {
      for (const track of localStream.getVideoTracks()) {
        track.stop();
        localStream.removeTrack(track);
      }
      setLocalStream(new MediaStream(localStream.getTracks()));
    }
  }, [
    controller.snapshot?.room.voiceEnabled,
    controller.snapshot?.room.cameraEnabled,
    controller.snapshot?.me.voiceAllowed,
    controller.snapshot?.me.cameraAllowed,
    localStream,
    stopLocal,
  ]);

  const joinVoice = useCallback(async () => {
    setMediaError("");
    try {
      const mediaConfig = await groupRequest<{ iceServers: RTCIceServer[] }>(
        `/api/group-study/rooms/${encodeURIComponent(roomId)}/media-config`,
      );
      config.current = { iceServers: mediaConfig.iceServers };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      streamRef.current = stream;
      setLocalStream(stream);
      if (
        !(await controller.action("media-state", {
          voiceJoined: true,
          cameraActive: false,
        }))
      ) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setLocalStream(null);
      }
    } catch (cause) {
      setMediaError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone permission was not granted."
          : errorMessage(cause),
      );
    }
  }, [controller.action, roomId]);
  const toggleCamera = useCallback(async () => {
    setMediaError("");
    try {
      const current = streamRef.current;
      if (!current) return;
      const video = current.getVideoTracks()[0];
      if (video) {
        video.stop();
        current.removeTrack(video);
        for (const peer of peers.current.values()) {
          const sender = peer
            .getSenders()
            .find((value) => value.track === video);
          if (sender) peer.removeTrack(sender);
        }
        await controller.action("media-state", {
          voiceJoined: true,
          cameraActive: false,
        });
      } else {
        const camera = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 20, max: 24 },
          },
          audio: false,
        });
        const track = camera.getVideoTracks()[0];
        if (!track) throw new Error("No camera track was available.");
        const accepted = await controller.action("media-state", {
          voiceJoined: true,
          cameraActive: true,
        });
        if (!accepted) {
          camera.getTracks().forEach((item) => item.stop());
          return;
        }
        current.addTrack(track);
        for (const [id, peer] of peers.current) {
          peer.addTrack(track, current);
          void negotiate(id);
        }
      }
      setLocalStream(new MediaStream(current.getTracks()));
    } catch (cause) {
      setMediaError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Camera permission was not granted."
          : errorMessage(cause),
      );
    }
  }, [controller.action, negotiate]);
  const toggleMute = useCallback(() => {
    const muted = !audioMuted;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    setAudioMuted(muted);
  }, [audioMuted]);
  return {
    localStream,
    remoteMedia,
    mediaError,
    audioMuted,
    audioOutputMuted,
    setAudioOutputMuted,
    joinVoice,
    leaveVoice: stopLocal,
    toggleCamera,
    toggleMute,
  };
}
