"use client";

import { Sparkles } from "lucide-react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import type { ScholarEntitlement } from "@/lib/subscriptions/entitlements";
import { openScholarPlus } from "@/lib/subscriptions/promo";

export function FreeAdSlot({ entitlement, label }: { entitlement: ScholarEntitlement; label: string }) {
  const access = useScholarAccess();
  if (access.loading || access.status === "error" || !access.entitlementsLoaded || access.config?.subscriptionsEnabled === false || access.has(entitlement)) return null;
  return (
    <aside aria-label={`${label} sponsor message`} className="mx-auto mb-4 flex min-w-0 max-w-3xl flex-col items-stretch justify-between gap-3 overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(135deg,rgba(139,92,246,.10),rgba(255,255,255,.035))] px-4 py-3 text-white/70 shadow-[inset_0_1px_rgba(255,255,255,.08),0_18px_48px_rgba(0,0,0,.18)] backdrop-blur-2xl sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-3"><Sparkles className="h-4 w-4 shrink-0 text-violet-300" /><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Scholar Plus</p><p className="break-words text-xs leading-relaxed">Enjoy {label} without Scholar promotions, with premium AI and higher limits.</p></div></div>
      <button onClick={() => openScholarPlus({ source: label === "Nigtube" ? "nigtube-ad" : "study-music-ad", feature: label === "Nigtube" ? "nigtube" : "music" })} className="min-h-10 w-full shrink-0 rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-xs font-semibold text-violet-100 sm:w-auto">Go ad-free</button>
    </aside>
  );
}
