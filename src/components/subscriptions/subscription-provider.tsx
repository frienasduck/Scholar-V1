"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { subscribeSessionChanges } from "@/lib/auth/session-events";
import type { ScholarEntitlement, ScholarAccessSource, ScholarPlan } from "@/lib/subscriptions/entitlements";

export type ScholarSessionStatus = "initializing" | "authenticated" | "guest" | "unauthenticated" | "refreshing" | "error";

type SessionState = {
  status: ScholarSessionStatus;
  loading: boolean;
  refreshing: boolean;
  authenticated: boolean;
  developerMode: boolean;
  plan?: ScholarPlan;
  entitlementsLoaded?: boolean;
  user?: { id: string; email: string; name: string | null; role: string; coins: number; currentScholarClass: number };
  access?: { plan: ScholarPlan; source: ScholarAccessSource; entitlementsLoaded: boolean; entitlements: ScholarEntitlement[]; subscriptionId: string | null; subscriptionStatus: string | null; subscriptionEndsAt: string | null; storageLimitBytes: number; dailyQuizLimit: number; dailySlideshowLimit: number; monthlyEbookUploadLimit: number; monthlyMockExamLimit: number };
  usage?: { day: string; quiz: { used: number; limit: number }; slideshow: { used: number; limit: number } };
  monthlyUsage?: { period: string; timezone: string; ebookUploads: { used: number; limit: number; remaining: number }; mockExams: { used: number; limit: number; remaining: number } };
  storage?: { usedBytes: number; limitBytes: number };
  pendingPayment?: { publicReference: string; status: string; createdAt: string } | null;
  config?: { subscriptionsEnabled: boolean; regularPriceInr: number; offerPriceInr: number; offerEnabled: boolean; offerLabel: string; billingInterval: string | null; durationDays: number | null; checkoutConfigured: boolean; promoOpenFrequency: number; installDismissDays: number };
};

type AccessContextValue = SessionState & { refresh: () => Promise<void>; has: (entitlement: ScholarEntitlement) => boolean };
const AccessContext = createContext<AccessContextValue | null>(null);

const INITIAL_STATE: SessionState = { status: "initializing", loading: true, refreshing: false, authenticated: false, developerMode: false };

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(INITIAL_STATE);
  const previousAccessSource = useRef<ScholarAccessSource | null>(null);
  const refreshSequence = useRef(0);
  const initialized = useRef(false);
  const requestActive = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const refresh = useCallback(async (reason: "boot" | "silent" | "switch") => {
    // Focus + visibility + payment polling can arrive together. Reuse the live
    // refresh, not a cached entitlement; a session switch always supersedes it.
    if (reason !== "switch" && requestActive.current) return;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller; requestActive.current = true;
    const sequence = ++refreshSequence.current;
    if (reason === "boot" || !initialized.current) {
      // Full-screen loader is allowed only during this first initialization.
      setState(INITIAL_STATE);
    } else if (reason === "switch") {
      // Account context change (sign-in / sign-out): clear prior account
      // privileges before the next server session resolves. Account content is
      // gated during this explicit transition; silent revalidation stays smooth.
      setState((previous) => ({
        ...previous,
        status: "refreshing",
        loading: true,
        refreshing: true,
        authenticated: false,
        developerMode: false,
        user: undefined,
        access: undefined,
        plan: undefined,
        entitlementsLoaded: false,
        usage: undefined,
        monthlyUsage: undefined,
        storage: undefined,
        pendingPayment: null,
      }));
    } else {
      // Silent background refresh (focus, visibility, polling, settings):
      // keep the current interface and data visible while revalidating.
      setState((previous) => ({ ...previous, status: "refreshing", loading: false, refreshing: true }));
    }
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]) });
      if (!response.ok) throw new Error("Session service unavailable");
      const value = await response.json();
      if (!value || typeof value.authenticated !== "boolean") throw new Error("Invalid session response");
      if (sequence !== refreshSequence.current) return;
      initialized.current = true;
      const authenticated = value.authenticated === true;
      const status: ScholarSessionStatus = authenticated
        ? "authenticated"
        : useStore.getState().guestMode
          ? "guest"
          : "unauthenticated";
      setState({ ...value, status, loading: false, refreshing: false });
    } catch {
      if (sequence !== refreshSequence.current) return;
      initialized.current = true;
      setState((previous) => ({ ...previous, status: "error", loading: false, refreshing: false }));
    } finally {
      if (sequence === refreshSequence.current) requestActive.current = false;
    }
  }, []);
  useEffect(() => {
    const initialRefresh = window.setTimeout(() => { void refresh("boot"); }, 0);
    const onSessionChanged = () => void refresh("switch");
    const onFocus = () => void refresh("silent");
    const onVisibility = () => { if (!document.hidden) void refresh("silent"); };
    const unsubscribeSessionChanges = subscribeSessionChanges(onSessionChanged);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      refreshSequence.current++; requestController.current?.abort(); requestActive.current = false;
      window.clearTimeout(initialRefresh);
      unsubscribeSessionChanges();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);
  useEffect(() => {
    if (!state.pendingPayment || state.pendingPayment.status === "approved" || state.pendingPayment.status === "rejected") return;
    const timer = window.setInterval(() => { if (!document.hidden) void refresh("silent"); }, 20_000);
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
  const value = useMemo<AccessContextValue>(() => ({ ...state, refresh: () => refresh("silent"), has: (entitlement) => state.status !== "error" && state.entitlementsLoaded === true && Boolean(state.access?.entitlements.includes(entitlement)) }), [state, refresh]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useScholarAccess() {
  const value = useContext(AccessContext);
  if (!value) throw new Error("useScholarAccess must be used inside SubscriptionProvider");
  return value;
}
