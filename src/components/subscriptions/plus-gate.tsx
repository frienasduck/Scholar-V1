"use client";

import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react";
import type { ScholarEntitlement } from "@/lib/subscriptions/entitlements";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";

export function PlusGate({ entitlement, title, description, children }: { entitlement: ScholarEntitlement; title: string; description: string; children: React.ReactNode }) {
  const access = useScholarAccess();
  if (access.loading) return <div className="min-h-[60vh] animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />;
  if (access.has(entitlement)) return <>{children}</>;
  const price = access.config?.offerEnabled ? access.config.offerPriceInr : access.config?.regularPriceInr;
  const navigate = (viewId: string) => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId } }));
  return (
    <section className="relative min-h-[70vh] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_25%_15%,rgba(91,122,255,.23),transparent_36%),linear-gradient(145deg,#070a11,#0a1521)] p-5 sm:p-10">
      <div aria-hidden className="absolute inset-7 grid grid-cols-2 gap-4 opacity-30 blur-xl"><div className="rounded-3xl bg-white/10" /><div className="rounded-3xl bg-cyan-300/10" /><div className="col-span-2 rounded-3xl bg-violet-300/10" /></div>
      <div className="relative z-10 mx-auto grid min-h-[60vh] max-w-xl place-items-center text-center">
        <div className="rounded-[2rem] border border-white/15 bg-black/45 p-7 shadow-2xl backdrop-blur-2xl sm:p-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-200"><LockKeyhole className="h-6 w-6" /></span>
          <h1 className="mt-5 text-2xl font-semibold text-white sm:text-3xl">Unlock {title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/60">{description}</p>
          <p className="mt-6 text-sm text-cyan-200">Included with Scholar Plus</p>
          <div className="mt-1 text-2xl font-semibold text-white">{access.config?.offerEnabled && <span className="mr-2 text-base text-white/35 line-through">₹{access.config.regularPriceInr}</span>}₹{price} <span className="text-xs font-medium text-white/45">{access.config?.offerEnabled ? access.config.offerLabel : ""}</span></div>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button onClick={() => navigate("plus")} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black"><Sparkles className="h-4 w-4" /> View Scholar Plus</button>
            <button onClick={() => history.back()} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm text-white/70"><ArrowLeft className="h-4 w-4" /> Back</button>
          </div>
        </div>
      </div>
    </section>
  );
}
