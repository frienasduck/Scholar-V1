"use client";

import { useState } from "react";
import { Check, Crown, HardDrive, Loader2, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { toast } from "@/lib/notifications/notification-api";

const BENEFIT_GROUPS = [
  { title: "AI & Study Tools", icon: Wand2, items: ["AISIG", "Homework Scanner", "Exam Prep", "Assignments", "Practical Lab", "Derivation Library", "Formula Explorer", "Python Workspace"] },
  { title: "Content & Media", icon: Crown, items: ["Levels", "Higher Quiz generation", "Higher Slideshow generation", "More Store items", "Ad-free Nigtube", "Ad-free Study Music"] },
  { title: "Storage & Account", icon: HardDrive, items: ["Expanded Files storage", "Class 9 access", "Appearance Lab", "One-time +5,000 Coins bonus"] },
];

const COMPARISON = [
  ["Class 11 core study tools", "Included", "Included"],
  ["AI-generated quizzes and slideshows", "3 each per day", "Higher configured limits"],
  ["File storage", "30 MB", "Expanded storage"],
  ["Class 9 and advanced study labs", "Preview", "Included"],
  ["Nigtube and Study Music", "Scholar-controlled ads may appear", "Ad-free"],
] as const;

export function ScholarPlusView() {
  const access = useScholarAccess();
  const [loading, setLoading] = useState(false);
  const navigate = (viewId: string) => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId } }));
  const subscribe = async () => {
    if (!access.config?.subscriptionsEnabled) { toast.info("All Scholar features are currently unlocked."); return; }
    setLoading(true);
    const started = Date.now();
    try {
      const response = await fetch("/api/subscriptions/payment-requests", { method: "POST" });
      const value = await response.json();
      if (!response.ok) throw new Error(value.message || value.error || "Checkout could not be opened.");
      sessionStorage.setItem("scholar:plus-checkout", JSON.stringify(value));
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, 5000 - (Date.now() - started))));
      navigate("subscription-payment");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Checkout could not be opened."); }
    finally { setLoading(false); }
  };
  const price = access.config?.offerEnabled ? access.config.offerPriceInr : access.config?.regularPriceInr;
  if (access.config?.subscriptionsEnabled === false) {
    return <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center"><section className="rounded-[2.5rem] border border-emerald-200/15 bg-emerald-300/[.07] p-8 text-center text-white backdrop-blur-2xl sm:p-12"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-300 text-black"><Check className="h-6 w-6" /></span><h1 className="mt-5 text-3xl font-semibold">All Scholar features are unlocked</h1><p className="mt-3 leading-7 text-white/60">Subscriptions are currently disabled. No payment, promotion, quota, or upgrade is required.</p></section></main>;
  }
  const isPlus = access.access?.source === "plus";
  const isDeveloper = access.access?.source === "developer";
  const accountStatus = isPlus
    ? { label: "Scholar Plus is active", tone: "emerald" as const }
    : isDeveloper
      ? { label: "Developer access", tone: "amber" as const }
      : { label: "Scholar Free", tone: "slate" as const };
  return <main className="mx-auto max-w-6xl space-y-10 py-6">
    <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgba(94,234,212,.18),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(139,92,246,.22),transparent_34%),#070b12] p-7 text-white shadow-2xl backdrop-blur-2xl sm:p-12">
      <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
      <div aria-hidden className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-violet-400/10 blur-3xl" />
      <div className="relative max-w-2xl">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[.25em] text-cyan-200"><Sparkles className="h-4 w-4" /> Scholar Plus</p>
        <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">More space to learn, build, and explore.</h1>
        <p className="mt-5 max-w-xl leading-7 text-white/60">Unlock Scholar’s advanced academic tools while keeping the complete Class 11 core experience available on Free.</p>
        <div className="mt-8 flex flex-wrap items-end gap-3">
          <span className="text-xl text-white/35 line-through">₹{access.config?.regularPriceInr ?? 300}</span>
          <span className="text-5xl font-semibold">₹{price ?? 100}</span>
          {access.config?.offerEnabled && <span className="mb-1 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs text-cyan-100">{access.config.offerLabel}</span>}
        </div>
        <p className="mt-2 text-xs text-white/40">Access details are shown before payment.</p>
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[.05] p-5 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[.2em] text-white/40">Current account status</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-lg font-medium text-white/90">{accountStatus.label}</p>
            {isPlus && <span className="rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Plus</span>}
          </div>
          {isPlus ? <div className="mt-5 inline-flex rounded-full bg-emerald-300 px-6 py-3 font-semibold text-black">Scholar Plus is active</div> : <button disabled={loading || !access.config?.checkoutConfigured} onClick={subscribe} className="mt-5 inline-flex min-w-48 items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-black shadow-[0_8px_30px_rgba(255,255,255,.18)] transition hover:bg-white/90 disabled:opacity-50">{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing secure checkout…</> : "Subscribe"}</button>}
        </div>
        {access.config?.subscriptionsEnabled && !access.config.checkoutConfigured && <p className="mt-3 text-sm text-amber-200">Checkout is temporarily unavailable until the UPI recipient is configured.</p>}
      </div>
    </section>
    <section>
      <h2 className="text-2xl font-semibold">Included with Scholar Plus</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {BENEFIT_GROUPS.map((group) => (
          <div key={group.title} className="rounded-3xl border border-white/10 bg-white/[.04] p-5 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-200"><group.icon className="h-5 w-5" /></span>
              <h3 className="font-semibold">{group.title}</h3>
            </div>
            <ul className="mt-4 space-y-2.5">
              {group.items.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-sm text-white/75">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-300/10 text-emerald-300"><Check className="h-3 w-3" /></span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[.035]">
      <div className="grid grid-cols-[1.25fr_.75fr_.75fr] border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/45 sm:px-6"><span>Capability</span><span>Free</span><span>Plus</span></div>
      {COMPARISON.map(([feature, free, plus]) => <div key={feature} className="grid grid-cols-[1.25fr_.75fr_.75fr] gap-2 border-b border-white/[.06] px-4 py-4 text-xs last:border-0 sm:px-6 sm:text-sm"><span className="font-medium">{feature}</span><span className="text-white/50">{free}</span><span className="text-cyan-100">{plus}</span></div>)}
    </section>
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-xl font-semibold">Payment and approval</h2><p className="mt-3 text-sm leading-6 text-white/55">After payment, submit the payer name and UPI transaction reference. Payment is manually verified before Scholar Plus is activated. A submitted reference never grants access automatically.</p></div>
      <div className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-xl font-semibold">Frequently asked</h2><p className="mt-3 text-sm font-medium">Is renewal or expiry automatic?</p><p className="mt-1 text-sm leading-6 text-white/55">No interval or expiry is claimed unless it is explicitly configured and confirmed during approval.</p><p className="mt-3 text-sm font-medium">Does Plus make every AI tool paid?</p><p className="mt-1 text-sm leading-6 text-white/55">No. Core AI tools remain available on Free; AISIG and Homework Scanner are the Plus-only AI tools.</p></div>
    </section>
  </main>;
}
