"use client";

import { cn } from "@/lib/utils";

export function LamMark({ active = false, className }: { active?: boolean; className?: string }) {
  return <span className={cn("lam-mark", active && "lam-mark--active", className)} aria-hidden="true"><i /><i /><i /></span>;
}
