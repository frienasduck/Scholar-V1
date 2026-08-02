"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ScholarEntitlement, ScholarAccessSource, ScholarPlan } from "@/lib/subscriptions/entitlements";

type SessionState = {
  loading: boolean;
  authenticated: boolean;
  developerMode: boolean;
  plan?: ScholarPlan;
  entitlementsLoaded?: boolean;
  user?: { id: string; email: string; name: string | null; role: string; coins: number; currentScholarClass: number };
  access?: { plan: ScholarPlan; source: ScholarAccessSource; entitlementsLoaded: boolean; entitlements: ScholarEntitlement[]; subscriptionId: string | null; subscriptionStatus: string | null; subscriptionEndsAt: string | null; storageLimitBytes: number; dailyQuizLimit: number; dailySlideshowLimit: number };
  usage?: { day: string; quiz: { used: number; limit: number }; slideshow: { used: number; limit: number } };
  storage?: { usedBytes: number; limitBytes: number };
  pendingPayment?: { publicReference: string; status: string; createdAt: string } | null;
  config?: { subscriptionsEnabled: boolean; regularPriceInr: number; offerPriceInr: number; offerEnabled: boolean; offerLabel: string; billingInterval: string | null; durationDays: number | null; checkoutConfigured: boolean; promoOpenFrequency: number; installDismissDays: number };
};

type AccessContextValue = SessionState & { refresh: () => Promise<void>; has: (entitlement: ScholarEntitlement) => boolean };
const AccessContext = createContext<AccessContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ loading: true, authenticated: false, developerMode: false });
  const previousAccessSource = useRef<ScholarAccessSource | null>(null);
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    // Clear privileges before fetching so a prior account can never leak into
    // the next account while its server session is being resolved.
    setState({ loading: true, authenticated: false, developerMode: false });
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const value = await response.json();
      if (sequence !== refreshSequence.current) return;
      setState({ ...value, loading: false });
    } catch {
      if (sequence !== refreshSequence.current) return;
      setState({ loading: false, authenticated: false, developerMode: false });
    }
  }, []);
  useEffect(() => {
    const initialRefresh = window.setTimeout(() => { void refresh(); }, 0);
    const listener = () => void refresh();
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("scholar:session-changed", listener);
    window.addEventListener("focus", listener);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearTimeout(initialRefresh); window.removeEventListener("scholar:session-changed", listener); window.removeEventListener("focus", listener); document.removeEventListener("visibilitychange", onVisibility); };
  }, [refresh]);
  useEffect(() => {
    if (!state.pendingPayment || state.pendingPayment.status === "approved" || state.pendingPayment.status === "rejected") return;
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 20_000);
    return () => window.clearInterval(timer);
  }, [refresh, state.pendingPayment]);
  useEffect(() => {
    if (state.loading || !state.authenticated || !state.access) return;
    const current = state.access.source;
    const previous = previousAccessSource.current;
    previousAccessSource.current = current;
    if (previous !== "free" || current !== "plus") return;
    const welcomeKey = `scholar-plus-welcomed-${state.access.subscriptionId ?? "active"}`;
    if (localStorage.getItem(welcomeKey) === "true") return;
    localStorage.setItem(welcomeKey, "true");
    window.dispatchEvent(new CustomEvent("scholar:notification", { detail: {
      type: "success",
      title: "Scholar Plus activated",
      message: "Advanced tools, expanded storage and 5,000 bonus Coins are now available.",
      duration: 7000,
      action: { label: "Explore Scholar Plus", onClick: () => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "plus" } })) },
    } }));
  }, [state.access, state.authenticated, state.loading]);
  const value = useMemo<AccessContextValue>(() => ({ ...state, refresh, has: (entitlement) => state.entitlementsLoaded === true && Boolean(state.access?.entitlements.includes(entitlement)) }), [state, refresh]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useScholarAccess() {
  const value = useContext(AccessContext);
  if (!value) throw new Error("useScholarAccess must be used inside SubscriptionProvider");
  return value;
}
