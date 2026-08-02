"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";

export function PlusPromotion() {
  const access = useScholarAccess();
  const [open, setOpen] = useState(false);
  const counted = useRef(false);
  useEffect(() => {
    if (access.loading || !access.config?.subscriptionsEnabled || access.access?.source !== "free" || access.pendingPayment) return;
    if (counted.current) return;
    counted.current = true;
    const key = "scholar-plus-eligible-opens";
    const count = Number(localStorage.getItem(key) || 0) + 1;
    localStorage.setItem(key, String(count));
    if (count % (access.config.promoOpenFrequency || 4) !== 0) return;
    const timer = window.setTimeout(() => { window.dispatchEvent(new Event("scholar:plus-popup-open")); setOpen(true); }, 2200);
    return () => window.clearTimeout(timer);
  }, [access.loading, access.config, access.access?.source, access.pendingPayment]);
  const navigate = () => { setOpen(false); window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "plus" } })); };
  return <AnimatePresence>{open && <motion.aside initial={{ opacity: 0, y: 24, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[10040] mx-auto max-w-sm rounded-[1.75rem] border border-cyan-200/15 bg-[#07111c]/88 p-5 text-white shadow-2xl backdrop-blur-2xl lg:bottom-6 lg:left-6 lg:right-auto lg:mx-0"><button onClick={() => setOpen(false)} className="absolute right-4 top-4 text-white/40" aria-label="Dismiss Scholar Plus"><X className="h-4 w-4" /></button><span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-500 text-black"><Sparkles className="h-5 w-5" /></span><h2 className="mt-4 text-xl font-semibold">Meet Scholar Plus</h2><p className="mt-2 text-sm leading-6 text-white/55">Advanced tools, Class 9 access, expanded storage, and a one-time 5,000 Coin bonus.</p><p className="mt-4 font-semibold"><span className="mr-2 text-sm text-white/30 line-through">₹{access.config?.regularPriceInr}</span>₹{access.config?.offerPriceInr} <span className="text-xs text-cyan-200">{access.config?.offerLabel}</span></p><div className="mt-5 flex gap-2"><button onClick={navigate} className="flex-1 rounded-full bg-white py-2.5 text-sm font-semibold text-black">View Plus</button><button onClick={() => setOpen(false)} className="rounded-full border border-white/10 px-4 text-sm text-white/55">Not now</button></div></motion.aside>}</AnimatePresence>;
}
