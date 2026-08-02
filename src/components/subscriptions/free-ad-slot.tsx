"use client";

import { Sparkles } from "lucide-react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import type { ScholarEntitlement } from "@/lib/subscriptions/entitlements";

export function FreeAdSlot({ entitlement, label }: { entitlement: ScholarEntitlement; label: string }) {
  const access = useScholarAccess();
  if (access.loading || access.has(entitlement)) return null;
  return (
    <aside aria-label={`${label} sponsor message`} className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-white/70 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3"><Sparkles className="h-4 w-4 shrink-0 text-violet-300" /><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Scholar Free</p><p className="truncate text-xs">Sponsor space helps keep {label} available. Scholar Plus removes these messages.</p></div></div>
      <button onClick={() => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "plus" } }))} className="shrink-0 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-100">Go ad-free</button>
    </aside>
  );
}
