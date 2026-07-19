"use client";

// Global navigation event system — lets any view trigger view switches
// without prop drilling. The app-shell listens for these events.

export const NAV_EVENT = "neha-scholar:navigate";

export function navigateTo(viewId: string, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(NAV_EVENT, { detail: { viewId, payload } })
  );
}
