"use client";

import { LamAvatar } from "./lam-avatar";
import type { LamAvatarState, LamPlacement } from "@/lib/lam/identity";

export function LamMark({ active = false, className, state, size = 36, placement = "header" }: { active?: boolean; className?: string; state?: LamAvatarState; size?: number; placement?: LamPlacement }) {
  return <LamAvatar className={className} state={state ?? (active ? "listening" : undefined)} size={size} placement={placement}/>;
}
