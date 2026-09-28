"use client";

import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { openScholarPlus } from "@/lib/subscriptions/promo";
import "./plus-promotion.css";

export function PlusPromotion() {
  const access = useScholarAccess();
  const [open, setOpen] = useState(false);
  const counted = useRef(false);
  useEffect(() => {
    if (access.loading || !access.authenticated || access.status === "error" || !access.entitlementsLoaded || !access.config?.subscriptionsEnabled || access.access?.source !== "free" || access.pendingPayment) return;
    if (counted.current) return;
    counted.current = true;
    try {
    if (sessionStorage.getItem("scholar-plus-popup-seen") || Date.now() < Number(localStorage.getItem("scholar-plus-popup-dismissed-until") || 0)) return;
    const key = "scholar-plus-eligible-opens";
    const count = Number(localStorage.getItem(key) || 0) + 1;
    localStorage.setItem(key, String(count));
    if (count % (access.config.promoOpenFrequency || 4) !== 0) return;
    const timer = window.setTimeout(() => { sessionStorage.setItem("scholar-plus-popup-seen", "1"); window.dispatchEvent(new Event("scholar:plus-popup-open")); setOpen(true); }, 15_000);
    return () => window.clearTimeout(timer);
    } catch { /* Optional promotions stay hidden when storage is unavailable. */ }
  }, [access.loading, access.authenticated, access.config, access.access?.source, access.pendingPayment]);
  const dismiss = () => { setOpen(false); try { localStorage.setItem("scholar-plus-popup-dismissed-until", String(Date.now() + 7 * 86400000)); } catch { /* dismissal still applies this render */ } };
  const navigate = () => { dismiss(); openScholarPlus({ source: "nav", feature: "welcome-promotion" }); };
  return (
    <DialogPrimitive.Root open={open && access.authenticated && access.access?.source === "free" && access.status !== "error"} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="scholar-plus-promo-overlay" />
        <DialogPrimitive.Content className="scholar-plus-promo">
          <div className="scholar-plus-promo-light" aria-hidden="true" />
          <div className="scholar-plus-promo-body">
            <div className="scholar-plus-promo-top">
              <span className="scholar-plus-promo-icon"><Sparkles aria-hidden="true" /></span>
              <DialogPrimitive.Close className="scholar-plus-promo-close" aria-label="Dismiss Scholar Plus"><X aria-hidden="true" /></DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Title className="scholar-plus-promo-title">Meet Scholar Plus</DialogPrimitive.Title>
            <DialogPrimitive.Description className="scholar-plus-promo-description">Advanced tools, Class 9 access, expanded storage, and a one-time 5,000 Coin bonus.</DialogPrimitive.Description>
            <div className="scholar-plus-promo-pricing">
              {access.config?.offerEnabled ? <span className="scholar-plus-promo-old">₹{access.config.regularPriceInr}</span> : null}
              <strong>₹{access.config?.offerEnabled ? access.config.offerPriceInr : access.config?.regularPriceInr}</strong>
              {access.config?.offerEnabled ? <span className="scholar-plus-promo-offer">{access.config.offerLabel || "Inauguration Offer"}</span> : null}
            </div>
            <div className="scholar-plus-promo-actions">
              <button type="button" className="scholar-plus-promo-primary" onClick={navigate}>View Plus <ArrowRight aria-hidden="true" /></button>
              <button type="button" className="scholar-plus-promo-secondary" onClick={dismiss}>Not now</button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
