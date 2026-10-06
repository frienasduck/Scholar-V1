"use client";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { LamAvatar, useLamActivity } from "./lam-avatar";
import { beginLamTubeReaction, cancelLamReaction, canLamReact, getLamPresence, serverLamPresence, subscribeLamPresence } from "@/lib/lam/presence";
import { useStore } from "@/lib/store";
import styles from "./lam-identity.module.css";

export function LamTubeCompanion() {
  const owner = useId();
  const last = useRef(-Infinity);
  const clicks = useRef(0);
  const prefs = useStore(s => s.settings.lamIdentity);
  const reduced = useStore(s => s.settings.reduceMotion || s.settings.appearance.accessibility.reduceMotion);
  const presence = useSyncExternalStore(subscribeLamPresence, getLamPresence, serverLamPresence);
  const story = presence.reaction?.owner === owner ? presence.reaction : null;
  const state = story?.state ?? "lamtube_watching";
  useLamActivity("lamtube_watching", false, true, "screen");
  useEffect(() => () => cancelLamReaction(owner), [owner]);
  useEffect(() => {
    if (presence.hidden || !prefs.animations || prefs.reducedMotion || presence.reduced || reduced) cancelLamReaction(owner);
  }, [owner, presence.hidden, presence.reduced, prefs.animations, prefs.reducedMotion, reduced]);
  const react = () => {
    if (!canLamReact(Date.now(), last.current, !!story) || presence.hidden || !presence.enabled || !prefs.animations || prefs.reducedMotion || presence.reduced || reduced) return;
    const variants = [0,0,1,0,2];
    if (beginLamTubeReaction(owner, variants[clicks.current % variants.length])) { last.current = Date.now(); clicks.current++; }
  };
  return <button type="button" className={styles.watcher} aria-label="Say hello to LAM watching LAMTube" onClick={react} data-reacting={!!story} data-story={story?.phase ?? "watching"} title="LAM is watching with you">
    <LamAvatar state={state} size={82} placement="lamtube" target={story && story.phase !== "return" ? "none" : "screen"}/><span className={styles.computer} aria-hidden="true"/><span className={styles.watcherBubble} aria-hidden="true">{story?.phase === "what" ? "What?" : story?.phase === "wave" ? "Hey." : story?.phase === "double-take" ? "Oh?" : ""}</span>
  </button>;
}
