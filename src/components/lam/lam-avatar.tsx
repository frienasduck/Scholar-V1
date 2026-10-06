"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "@/lib/store";
import { getLamAvatar, resolveLamState, type LamAvatarState, type LamPlacement } from "@/lib/lam/identity";
import { getLamPresence, serverLamPresence, subscribeLamPresence, setLamPresence, releaseLamPresence, type LamFocusTarget, type LamUrgency } from "@/lib/lam/presence";
import { observeLamVisibility } from "@/lib/lam/visibility";
import { selectLamActivity, selectLamAvatar } from "@/lib/lam/presentation-selectors";
import { cn } from "@/lib/utils";
import styles from "./lam-identity.module.css";

export function useLamActivity(state: string, busy = false, blocked = false, target: LamFocusTarget = "none", urgency: LamUrgency = "calm", deadline?: number) {
  const id = useId();
  const resolved = resolveLamState(state);
  const select = (p: ReturnType<typeof getLamPresence>) => selectLamActivity(p, id, resolved);
  const effective = useSyncExternalStore(subscribeLamPresence, () => select(getLamPresence()), () => select(serverLamPresence()));
  useEffect(() => { setLamPresence(id, resolved, busy, blocked, { target, urgency, deadline }); return () => releaseLamPresence(id); }, [id, resolved, busy, blocked, target, urgency, deadline]);
  // Read immutable owner state from the subscribed snapshot, not ambient time.
  // This also settles feedback while a higher-priority owner remains active.
  return effective;
}

export function LamAvatar({ avatarId, state, placement = "panel", size = 64, className, title, animate = true, target, restrained = false }: {
  avatarId?: string; state?: LamAvatarState; placement?: LamPlacement; size?: number;
  className?: string; title?: string; animate?: boolean; target?: LamFocusTarget; restrained?: boolean;
}) {
  const prefs = useStore(s => s.settings.lamIdentity);
  const reduce = useStore(s => s.settings.reduceMotion || s.settings.appearance.accessibility.reduceMotion || s.settings.appearance.performance === "battery");
  // Subscribe to visual inputs, not another avatar's owner record or route context.
  const select = useShallow((p: ReturnType<typeof getLamPresence>) => selectLamAvatar(p, state, placement, animate, target));
  const presence = useSyncExternalStore(subscribeLamPresence, () => select(getLamPresence()), () => select(serverLamPresence()));
  const element = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => { if (!animate || !element.current) return; return observeLamVisibility(element.current, setVisible); }, [animate]);
  const selected = getLamAvatar(avatarId ?? prefs.avatarId);
  const [failedAssets, setFailedAssets] = useState<string[]>([]);
  const avatar = failedAssets.includes(selected.renderAsset) ? getLamAvatar(selected.fallback) : selected;
  const [, , width, height] = avatar.crop;
  const requested = state === "idle" && placement !== "gallery" && animate ? presence.state : state ?? presence.state;
  const effective = !prefs.celebrations && ["happy", "celebrate"].includes(requested) ? "encouraging" : requested;
  const still = reduce || prefs.reducedMotion || presence.reduced || !prefs.animations || !presence.enabled || !animate || presence.sessionMuted || restrained || presence.urgency === "emergency";
  const idleStill = !prefs.idleReactions && effective === "idle";
  const style = {
    "--lam-size": `${size}px`, "--lam-accent": avatar.accent,
    "--lam-crop-ratio": `${width} / ${height}`,
    "--lam-art-width": "100%",
    "--lam-art-left": "0%", "--lam-art-top": "0%",
    "--lam-float": `${avatar.motion.float}px`, "--lam-tilt": `${avatar.motion.tilt}deg`,
    "--lam-tempo": `${avatar.motion.tempo}s`, "--lam-trail": `${avatar.motion.trail}ms`,
  } as CSSProperties;
  if (!presence.enabled) return <span className={cn("lam-mark", className)} aria-hidden="true"><i/><i/><i/></span>;
  return <span ref={element} className={cn(styles.avatar, className)} style={style} aria-hidden="true" title={title}
    data-lam-avatar={avatar.id} data-placement={placement} data-state={effective}
    data-signature={avatar.signature} data-motion={avatar.motion.language} data-target={presence.target} data-still={still || idleStill} data-paused={presence.hidden || !visible} data-reaction-level={presence.reactionLevel} data-intensity={prefs.presence === "quiet" || presence.urgency === "urgent" ? "subtle" : prefs.intensity}>
    <span className={styles.aura}/><span className={styles.motion}><span className={styles.breath}><span className={styles.window}>
      {failedAssets.includes(avatar.renderAsset) ? <span className={styles.fallback}>LAM</span> : <Image key={avatar.renderAsset} src={avatar.renderAsset} alt="" width={Math.ceil(size)} height={Math.ceil(size * height / width)}
        loading={placement === "header" || placement === "gallery" && animate ? "eager" : "lazy"}
        className={styles.art} draggable={false}
        onError={() => setFailedAssets(failed => failed.includes(avatar.renderAsset) ? failed : [...failed, avatar.renderAsset])}/>}</span></span></span>
    <span className={styles.signal}/><span className={styles.glint}/>
    {size >= 60 && <span className={styles.expression}><i/><i/><i/></span>}
  </span>;
}
