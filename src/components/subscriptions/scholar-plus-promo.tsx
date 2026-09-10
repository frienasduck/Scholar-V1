"use client";

import { useCallback, useState } from "react";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { openScholarPlus, type PlusPromoSource } from "@/lib/subscriptions/promo";
import { cn } from "@/lib/utils";

export type ScholarPlusPromoVariant =
  | "compact"
  | "horizontal"
  | "modal"
  | "inline"
  | "locked"
  | "pre-roll";

interface ScholarPlusPromoProps {
  variant: ScholarPlusPromoVariant;
  title?: string;
  description?: string;
  source?: PlusPromoSource;
  feature?: string;
  dismissible?: boolean;
  className?: string;
}

const DEFAULT_TITLE = "Scholar Plus";
const DEFAULT_DESCRIPTION = "More intelligence. More tools. Less friction.";

export function ScholarPlusPromo({
  variant,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  source = "nav",
  feature,
  dismissible = false,
  className,
}: ScholarPlusPromoProps) {
  const access = useScholarAccess();
  const [dismissed, setDismissed] = useState(false);

  if (access.loading || access.status === "error" || !access.entitlementsLoaded || access.config?.subscriptionsEnabled === false || access.access?.source === "plus" || access.access?.source === "developer" || access.access?.source === "subscriptions_disabled") {
    return null;
  }
  if (dismissed) return null;

  const navigateToPlus = () => openScholarPlus({ source, feature });

  const offerEnabled = access.config?.offerEnabled ?? true;
  const regularPrice = access.config?.regularPriceInr ?? 300;
  const offerPrice = access.config?.offerPriceInr ?? 100;
  const offerLabel = access.config?.offerLabel ?? "Offer";

  const priceTag = (
    <div className="flex items-center gap-2 text-sm">
      {offerEnabled && regularPrice > offerPrice && (
        <span className="text-white/30 line-through">₹{regularPrice}</span>
      )}
      <span className="font-semibold text-white">₹{offerEnabled ? offerPrice : regularPrice}</span>
      {offerEnabled && (
        <Badge className="border border-cyan-200/20 bg-cyan-200/10 text-[9px] font-bold text-cyan-100">
          {offerLabel}
        </Badge>
      )}
    </div>
  );

  const ctaButton = (btnClassName?: string) => (
    <button
      onClick={navigateToPlus}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black shadow-[0_4px_20px_rgba(255,255,255,0.12)] hover:bg-white/90 transition-all",
        btnClassName,
      )}
    >
      <Sparkles className="h-3 w-3" />
      Explore Scholar Plus
      <ArrowRight className="h-3 w-3" />
    </button>
  );

  const dismissButton = dismissible ? (
    <button
      onClick={() => setDismissed(true)}
      className="absolute right-3 top-3 text-white/30 hover:text-white/60 transition-colors z-10"
      aria-label="Dismiss"
    >
      <X className="h-4 w-4" />
    </button>
  ) : null;

  // ─── COMPACT ──────────────────────────────────────
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-cyan-200/10 bg-[#07101a]/70 p-4 backdrop-blur-xl",
          className,
        )}
      >
        {dismissButton}
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-300/20 to-violet-500/20">
            <Sparkles className="h-4 w-4 text-cyan-200" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/45">{description}</p>
            <div className="mt-2">{priceTag}</div>
          </div>
        </div>
        <div className="mt-3">{ctaButton("w-full h-8 text-[11px]")}</div>
      </div>
    );
  }

  // ─── HORIZONTAL ──────────────────────────────────
  if (variant === "horizontal") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-cyan-200/10 bg-[#07101a]/70 p-5 backdrop-blur-xl",
          className,
        )}
      >
        {dismissButton}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-500 text-black">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-white">{title}</p>
              <Badge className="border border-cyan-200/20 bg-cyan-200/10 text-[9px] font-bold text-cyan-100">NEW</Badge>
            </div>
            <p className="mt-1 text-xs text-white/50">{description}</p>
            <div className="mt-2">{priceTag}</div>
          </div>
          <div className="shrink-0">{ctaButton()}</div>
        </div>
      </div>
    );
  }

  // ─── INLINE BANNER ───────────────────────────────
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-xl border border-cyan-200/15 bg-cyan-200/[0.04] px-4 py-3 backdrop-blur-sm",
          className,
        )}
      >
        {dismissButton}
        <Sparkles className="h-4 w-4 shrink-0 text-cyan-200/70" />
        <p className="flex-1 text-xs text-white/60">
          <span className="font-medium text-white/80">{title}</span>
          {" — "}
          {description}
        </p>
        <button
          onClick={navigateToPlus}
          className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/5 transition-colors"
        >
          Learn more
        </button>
      </div>
    );
  }

  // ─── LOCKED FEATURE ──────────────────────────────
  if (variant === "locked") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#05080f] p-6 sm:p-8 backdrop-blur-2xl",
          className,
        )}
      >
        {dismissButton}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
        </div>
        <div className="relative z-10 text-center max-w-md mx-auto">
          <Badge className="inline-flex items-center gap-1.5 border border-cyan-200/25 bg-cyan-200/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">
            <Sparkles className="h-3 w-3" /> Scholar Plus
          </Badge>
          <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm text-white/50">{description}</p>
          <div className="mt-4">{priceTag}</div>
          <div className="mt-5 flex flex-col sm:flex-row justify-center gap-2">
            {ctaButton()}
          </div>
        </div>
      </div>
    );
  }

  // ─── PRE-ROLL ────────────────────────────────────
  if (variant === "pre-roll") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-cyan-200/10 bg-[#07101a]/80 backdrop-blur-2xl",
          className,
        )}
      >
        {dismissButton}
        <div className="p-5 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-500 text-black">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-white/45">{description}</p>
          <div className="mt-3">{priceTag}</div>
          <div className="mt-4 flex justify-center gap-2">
            {ctaButton()}
            <button
              onClick={() => setDismissed(true)}
              className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/50 hover:bg-white/5 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── MODAL (fallback) ────────────────────────────
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-cyan-200/10 bg-[#07101a]/80 p-6 backdrop-blur-2xl",
        className,
      )}
    >
      {dismissButton}
      <div className="text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-500 text-black">
          <Sparkles className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-white/50">{description}</p>
        <div className="mt-3">{priceTag}</div>
        <div className="mt-4 flex justify-center gap-2">{ctaButton()}</div>
      </div>
    </div>
  );
}
