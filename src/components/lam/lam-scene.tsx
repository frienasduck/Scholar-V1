"use client";
import { BookOpen, Check, FileText, Headphones, Lightbulb, Search, Sparkles } from "lucide-react";
import { LamAvatar } from "./lam-avatar";
import type { LamAvatarState, LamPlacement } from "@/lib/lam/identity";
import type { LamFocusTarget } from "@/lib/lam/presence";
import styles from "./lam-identity.module.css";

export function lamStateLabel(state: LamAvatarState): string {
  if (["thinking", "processing", "analyzing"].includes(state)) return "Thinking it through…";
  if (state === "planning") return "Putting the next steps together…";
  if (["teaching", "responding", "pointing"].includes(state)) return "Let’s break it down.";
  if (state === "listening") return "I’m listening.";
  if (["reading", "scanning"].includes(state)) return "Reading your source…";
  if (state === "searching") return "Looking for useful sources…";
  if (["error", "helpful", "confused"].includes(state)) return "We can try another way.";
  if (["happy", "success", "celebrate"].includes(state)) return "A good step forward.";
  if (state === "sleeping") return "Resting a little.";
  if (state === "sleepy" || state === "rest") return "Here when you need me.";
  if (state === "wake") return "Welcome back.";
  if (state === "exam_focus" || state === "quizzing") return "One step at a time.";
  if (state === "listening_music") return "In the groove.";
  if (state === "studying") return "Let’s stay with this idea.";
  if (state === "reviewing") return "Let’s connect what you’ve learned.";
  if (state === "greeting") return "Ready when you are.";
  return "Your Scholar study companion.";
}
/** Props decorate the scene, not the art. Never replace progress or error UI. */
export function LamScene({ state, placement = "panel", size = 88, avatarId, target = "content", label, compact = false, restrained = false }: {
  state: LamAvatarState; placement?: LamPlacement; size?: number; avatarId?: string; target?: LamFocusTarget; label?: string; compact?: boolean; restrained?: boolean;
}) {
  const reading = ["reading", "scanning", "studying", "reviewing"].includes(state);
  const teaching = ["teaching", "responding", "pointing"].includes(state);
  const thinking = ["thinking", "processing", "analyzing", "planning", "searching"].includes(state);
  const success = ["happy", "success", "celebrate"].includes(state);
  const Icon = reading ? BookOpen : thinking ? state === "searching" ? Search : Sparkles : teaching ? FileText : success ? Check : state === "listening_music" ? Headphones : Lightbulb;
  return <div className={styles.scene} data-lam-scene aria-hidden="true" data-scene-state={state} data-scene-placement={placement} data-compact={compact} data-restrained={restrained}>
    <div className={styles.sceneStage}>
      <LamAvatar avatarId={avatarId} state={state} placement={placement} size={size} target={target} restrained={restrained}/>
      {!restrained && <span className={styles.sceneProp} aria-hidden="true" data-prop={reading ? "book" : teaching ? "notes" : thinking ? "thought" : success ? "success" : state === "listening_music" ? "music" : "quiet"}><Icon size={compact ? 14 : 19}/><i/><i/></span>}
      <span className={styles.sceneGround} aria-hidden="true"/>
    </div>
    <span className={styles.sceneCaption}>{label ?? lamStateLabel(state)}</span>
  </div>;
}
