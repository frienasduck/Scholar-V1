"use client";

import { Sparkles, ArrowRight } from "lucide-react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { openScholarPlus } from "@/lib/subscriptions/promo";

/**
 * "X of Y generations used today" indicator for limited AI features.
 * Reads the cached server-verified usage from the session (never hardcoded).
 */
export function GenerationQuotaIndicator({ kind }: { kind: "quiz" | "slideshow" }) {
  const access = useScholarAccess();
  if (access.loading || !access.entitlementsLoaded) return null;
  const usage = kind === "quiz" ? access.usage?.quiz : access.usage?.slideshow;
  if (!usage) return null;

  const unlimited = usage.limit < 0;
  const remaining = Math.max(0, usage.limit - usage.used);
  const atLimit = !unlimited && remaining <= 0;

  if (atLimit) {
    return (
      <button
        onClick={() => openScholarPlus({ source: "generation-limit", feature: kind })}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/25 bg-amber-300/10 px-3 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-300/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
      >
        <Sparkles className="h-3 w-3" />
        Daily generation limit reached
        <ArrowRight className="h-3 w-3" />
        Upgrade to Scholar Plus
      </button>
    );
  }

  const label = unlimited
    ? "Scholar Plus · unlimited generations"
    : `${usage.used} of ${usage.limit} generations used today`;
  return (
    <p
      className="text-[11px] text-white/45"
      aria-label={label}
    >
      {label}
    </p>
  );
}
