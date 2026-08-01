"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { applyAppearanceTokens } from "@/lib/appearance/appearance-tokens";
import { getWallpaper } from "@/lib/appearance/wallpaper-manager";
import type { ScholarAppearanceSettings, WallpaperSettings } from "@/lib/appearance/appearance-schema";

const SCHOLAR_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4";

const WALLPAPERS: Record<string, string> = {
  "midnight": "radial-gradient(circle at 72% 12%, rgba(79,70,229,.34), transparent 36%), linear-gradient(145deg,#020617,#071827 58%,#020617)",
  "deep-space": "radial-gradient(circle at 20% 12%, rgba(59,130,246,.28), transparent 25%), radial-gradient(circle at 75% 24%, rgba(139,92,246,.25), transparent 30%), linear-gradient(150deg,#020617,#070b1b 70%,#000)",
  "aurora": "radial-gradient(ellipse at 22% 85%, rgba(20,184,166,.42), transparent 42%), radial-gradient(ellipse at 80% 10%, rgba(139,92,246,.38), transparent 38%), #03151b",
  "warm-study": "radial-gradient(circle at 78% 82%, rgba(245,158,11,.32), transparent 38%), linear-gradient(145deg,#130b08,#2b160d 62%,#090706)",
  "cool-focus": "radial-gradient(circle at 50% 0%, rgba(34,211,238,.22), transparent 40%), linear-gradient(145deg,#020617,#082f49)",
  "paper": "repeating-linear-gradient(0deg,rgba(71,85,105,.055) 0 1px,transparent 1px 28px),linear-gradient(135deg,#fffaf0,#f3e7cf)",
  "abstract": "radial-gradient(circle at 12% 18%,rgba(236,72,153,.3),transparent 34%),radial-gradient(circle at 88% 72%,rgba(14,165,233,.3),transparent 38%),#080b16",
};

const ROTATING_WALLPAPERS = ["deep-space", "aurora", "warm-study", "cool-focus", "abstract"] as const;

function stableIndex(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  return Math.abs(hash) % ROTATING_WALLPAPERS.length;
}

function overrideWallpaper(settings: ScholarAppearanceSettings, page: string): WallpaperSettings {
  const override = settings.pageOverrides[page as keyof typeof settings.pageOverrides];
  if (!override || override === "global") return settings.wallpaper;
  if (override === "none") return { ...settings.wallpaper, kind: "none", value: "none" };
  if (override === "scholar-cinematic") return { ...settings.wallpaper, kind: "video", value: override };
  return { ...settings.wallpaper, kind: "scholar", value: override };
}

function AppearanceBackground({ settings, page }: { settings: ScholarAppearanceSettings; page: string }) {
  const baseWallpaper = useMemo(() => overrideWallpaper(settings, page), [page, settings]);
  const [rotatedWallpaper, setRotatedWallpaper] = useState<string | null>(null);
  const [mediaRecord, setMediaRecord] = useState<{ id: string; url: string } | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  const [mobile, setMobile] = useState(false);
  const [networkAllowsVideo, setNetworkAllowsVideo] = useState(true);
  const [batterySaverLikely, setBatterySaverLikely] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wallpaper = useMemo(() => settings.rotateWallpapers !== "off" && !baseWallpaper.mediaId && baseWallpaper.kind !== "none" && rotatedWallpaper
    ? { ...baseWallpaper, kind: "scholar" as const, value: rotatedWallpaper }
    : baseWallpaper, [baseWallpaper, rotatedWallpaper, settings.rotateWallpapers]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (settings.rotateWallpapers === "off" || baseWallpaper.mediaId || baseWallpaper.kind === "none") {
      return;
    }
    const now = new Date();
    const daily = now.toISOString().slice(0, 10);
    const firstDay = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil(((now.getTime() - firstDay.getTime()) / 86_400_000 + firstDay.getDay() + 1) / 7);
    let seed = settings.rotateWallpapers === "page" ? `page:${page}`
      : settings.rotateWallpapers === "weekly" ? `week:${now.getFullYear()}:${week}`
        : settings.rotateWallpapers === "daily" ? `day:${daily}` : "launch";
    if (settings.rotateWallpapers === "launch") {
      const key = "scholar:appearance:launch-wallpaper";
      seed = sessionStorage.getItem(key) ?? `${Date.now()}:${crypto.randomUUID()}`;
      sessionStorage.setItem(key, seed);
    }
    let active = true;
    queueMicrotask(() => {
      if (active) setRotatedWallpaper(ROTATING_WALLPAPERS[stableIndex(seed)]);
    });
    return () => { active = false; };
  }, [baseWallpaper.kind, baseWallpaper.mediaId, page, settings.rotateWallpapers]);

  useEffect(() => {
    type NetworkInformation = { type?: string; effectiveType?: string; saveData?: boolean; addEventListener?: (name: string, listener: () => void) => void; removeEventListener?: (name: string, listener: () => void) => void };
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    const update = () => {
      if (!baseWallpaper.wifiOnly || !connection) return setNetworkAllowsVideo(true);
      setNetworkAllowsVideo(connection.type ? connection.type === "wifi" : !connection.saveData && connection.effectiveType !== "2g" && connection.effectiveType !== "slow-2g");
    };
    update();
    connection?.addEventListener?.("change", update);
    return () => connection?.removeEventListener?.("change", update);
  }, [baseWallpaper.wifiOnly]);
  useEffect(() => {
    type BatteryManager = { charging: boolean; level: number; addEventListener: (name: string, listener: () => void) => void; removeEventListener: (name: string, listener: () => void) => void };
    const getBattery = (navigator as Navigator & { getBattery?: () => Promise<BatteryManager> }).getBattery;
    if (!getBattery || !baseWallpaper.pauseOnBatterySaver) {
      return;
    }
    let battery: BatteryManager | null = null;
    const update = () => setBatterySaverLikely(Boolean(battery && !battery.charging && battery.level <= .2));
    void getBattery.call(navigator).then((value) => {
      battery = value;
      update();
      battery.addEventListener("chargingchange", update);
      battery.addEventListener("levelchange", update);
    }).catch(() => setBatterySaverLikely(false));
    return () => {
      battery?.removeEventListener("chargingchange", update);
      battery?.removeEventListener("levelchange", update);
    };
  }, [baseWallpaper.pauseOnBatterySaver]);
  const forceStill = (settings.responsiveMode === "separate" && settings.mobile.stillWallpaper && mobile)
    || wallpaper.stillOnMobile && mobile
    || !networkAllowsVideo
    || wallpaper.pauseOnBatterySaver && batterySaverLikely
    || settings.performance === "battery"
    || settings.performance === "performance";

  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;
    if (!wallpaper.mediaId) return;
    void getWallpaper(wallpaper.mediaId).then((record) => {
      if (!active || !record) return;
      objectUrl = URL.createObjectURL(record.blob);
      setMediaRecord({ id: record.id, url: objectUrl });
    }).catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [wallpaper.mediaId]);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !wallpaper.pauseWhenHidden) return;
    if (!visible) video.pause();
    else void video.play().catch(() => undefined);
  }, [visible, wallpaper.pauseWhenHidden, videoReady]);

  useEffect(() => {
    if (wallpaper.attachment !== "parallax" || settings.accessibility.reduceMotion || settings.motion.level === "off") return;
    const layer = document.querySelector<HTMLElement>(".scholar-appearance-background");
    if (!layer) return;
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        layer.style.setProperty("--appearance-parallax-y", `${Math.min(24, window.scrollY * .025)}px`);
        frame = 0;
      });
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => { window.removeEventListener("scroll", update); if (frame) cancelAnimationFrame(frame); };
  }, [settings.accessibility.reduceMotion, settings.motion.level, wallpaper.attachment]);

  const isVideo = wallpaper.kind === "video" && wallpaper.videoEnabled && !forceStill;
  const isActive = wallpaper.kind !== "none";
  useEffect(() => {
    document.documentElement.dataset.scholarWallpaperActive = String(isActive);
    return () => { document.documentElement.dataset.scholarWallpaperActive = "false"; };
  }, [isActive]);

  if (!isActive) return null;
  const mediaUrl = wallpaper.mediaId && mediaRecord?.id === wallpaper.mediaId ? mediaRecord.url : null;
  const customImage = wallpaper.kind === "custom-image" ? mediaUrl : null;
  const background = wallpaper.kind === "solid"
    ? wallpaper.value
    : wallpaper.kind === "gradient" || wallpaper.kind === "scholar"
      ? WALLPAPERS[wallpaper.value] ?? WALLPAPERS["deep-space"]
      : forceStill || videoFailed
        ? WALLPAPERS[wallpaper.value] ?? WALLPAPERS["deep-space"]
        : undefined;
  const fit = wallpaper.fit === "tile" ? "auto" : wallpaper.fit === "center" ? "contain" : wallpaper.fit;
  const position = `${wallpaper.positionX}% ${wallpaper.positionY}%`;

  return (
    <div className="scholar-appearance-background" aria-hidden="true" data-attachment={wallpaper.attachment} data-transition={wallpaper.transition}>
      <div
        className="scholar-appearance-poster"
        style={{
          background: customImage ? `url("${customImage}")` : background,
          backgroundSize: wallpaper.fit === "tile" ? "auto" : fit,
          backgroundPosition: position,
          backgroundRepeat: wallpaper.fit === "tile" ? "repeat" : "no-repeat",
          opacity: wallpaper.opacity / 100,
          filter: `blur(${wallpaper.blur}px) brightness(${wallpaper.brightness}%) saturate(${wallpaper.saturation}%) contrast(${wallpaper.contrast}%)`,
          transform: `scale(${Math.max(1, wallpaper.zoom / 100)})`,
        }}
      />
      {isVideo ? (
        <video
          ref={videoRef}
          className="scholar-appearance-video"
          src={wallpaper.mediaId ? mediaUrl ?? undefined : SCHOLAR_VIDEO}
          poster="/backgrounds/scholar-poster.svg"
          autoPlay
          muted={wallpaper.muted}
          playsInline
          loop={wallpaper.loop}
          preload="metadata"
          onLoadedData={(event) => {
            event.currentTarget.playbackRate = wallpaper.videoSpeed;
            setVideoReady(true);
          }}
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoFailed(true)}
          style={{
            opacity: videoReady ? wallpaper.opacity / 100 : 0,
            objectFit: fit === "fill" ? "fill" : fit === "auto" ? "contain" : fit,
            objectPosition: position,
            filter: `blur(${wallpaper.blur}px) brightness(${wallpaper.brightness}%) saturate(${wallpaper.saturation}%) contrast(${wallpaper.contrast}%)`,
            transform: `scale(${Math.max(1, wallpaper.zoom / 100)})`,
          }}
        />
      ) : null}
      <div className="scholar-appearance-overlay" style={{ background: wallpaper.overlayColor, opacity: wallpaper.overlay / 100 }} />
    </div>
  );
}

export function AppearanceRuntime({ settings, page }: { settings: ScholarAppearanceSettings; page: string }) {
  const [scheduleTick, setScheduleTick] = useState(0);
  const effectiveSettings = useMemo(() => {
    const profile = settings.customProfiles.find((item) => item.id === settings.scheduledProfileId);
    if (!profile) return settings;
    const [hours, minutes] = settings.scheduledProfileTime.split(":").map(Number);
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() < (hours || 0) * 60 + (minutes || 0)) return settings;
    return { ...settings, ...profile.config, customProfiles: settings.customProfiles };
  }, [scheduleTick, settings]);
  useEffect(() => {
    const apply = () => applyAppearanceTokens(effectiveSettings);
    apply();
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    darkQuery.addEventListener("change", apply);
    motionQuery.addEventListener("change", apply);
    const timer = settings.themeMode === "schedule" ? window.setInterval(apply, 60_000) : undefined;
    return () => {
      darkQuery.removeEventListener("change", apply);
      motionQuery.removeEventListener("change", apply);
      if (timer) window.clearInterval(timer);
    };
  }, [effectiveSettings]);
  useEffect(() => {
    if (settings.scheduledProfileId === "off") return;
    const timer = window.setInterval(() => setScheduleTick((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [settings.scheduledProfileId]);
  return <AppearanceBackground settings={effectiveSettings} page={page} />;
}
