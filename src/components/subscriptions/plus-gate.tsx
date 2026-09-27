"use client";

import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react";
import type { ScholarEntitlement } from "@/lib/subscriptions/entitlements";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { ScholarGlass } from "@/components/liquid-glass";

export function PlusGate({ entitlement, title, description, anchor, children }: { entitlement: ScholarEntitlement; title: string; description: string; anchor?: string; children: React.ReactNode }) {
  const access = useScholarAccess();
  if (access.loading) return <div className="min-h-[60vh] animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />;
  if (access.has(entitlement)) return <>{children}</>;
  const offerEnabled = access.config?.offerEnabled ?? true;
  const price = offerEnabled ? access.config?.offerPriceInr : access.config?.regularPriceInr;
  const regularPrice = access.config?.regularPriceInr;
  const offerLabel = access.config?.offerLabel ?? "Inauguration Offer";
  const navigate = (viewId: string) => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId, anchor } }));
  return (
    <section className="relative min-h-[70vh] overflow-hidden rounded-[2rem] border border-white/10 bg-transparent p-5 sm:p-10">
      <div aria-hidden className="absolute inset-0">
        <div className="absolute inset-4 rounded-3xl border border-white/10 bg-white/[.04] p-5 opacity-70 blur-md sm:inset-8 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="h-4 w-2/3 rounded-full bg-white/15" />
              <div className="h-3 w-1/2 rounded-full bg-white/10" />
              <div className="h-28 rounded-2xl bg-gradient-to-br from-indigo-400/25 to-cyan-300/25" />
            </div>
            <div className="hidden space-y-3 sm:block">
              <div className="h-3 w-full rounded-full bg-white/10" />
              <div className="h-3 w-5/6 rounded-full bg-white/10" />
              <div className="h-3 w-3/4 rounded-full bg-white/10" />
              <div className="h-24 rounded-2xl bg-white/[.05]" />
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-10 mx-auto grid min-h-[60vh] max-w-xl place-items-center text-center">
        <ScholarGlass
          variant="premium"
          refraction="prominent"
          block
          radius={32}
          className="w-full max-w-xl text-left"
          innerClassName="flex-col items-center px-7 py-8 text-center sm:px-10 sm:py-10"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-100"><Sparkles className="h-3 w-3" /> Scholar Plus</span>
          <span className="mx-auto mt-5 grid h-14 w-14 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-200 shadow-[0_0_30px_rgba(103,232,249,.25)]"><LockKeyhole className="h-6 w-6" /></span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Unlock {title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/60">{description}</p>
          <p className="mt-6 text-sm font-medium text-cyan-200">Included with Scholar Plus</p>
          <div className="mt-1 flex items-center justify-center gap-2 text-2xl font-semibold text-white">
            {offerEnabled && regularPrice && regularPrice > (price ?? 0) && <span className="text-base text-white/35 line-through">₹{regularPrice}</span>}
            ₹{price}
          </div>
          {offerEnabled && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-1.5 text-xs font-semibold text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" /> {offerLabel} · ₹{access.config?.offerPriceInr}
            </div>
          )}
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <ScholarGlass
              as="button"
              variant="control"
              refraction="standard"
              interactive
              radius={999}
              onClick={() => navigate("plus")}
              className="sg-cta-primary"
              innerClassName="justify-center gap-2 px-6 py-3 text-sm"
            ><Sparkles className="h-4 w-4" /> View Scholar Plus</ScholarGlass>
            <ScholarGlass
              as="button"
              variant="control"
              refraction="none"
              interactive
              radius={999}
              onClick={() => history.back()}
              className="sg-cta-quiet"
              innerClassName="justify-center gap-2 px-6 py-3 text-sm"
            ><ArrowLeft className="h-4 w-4" /> Back</ScholarGlass>
          </div>
        </ScholarGlass>
      </div>
    </section>
  );
}
