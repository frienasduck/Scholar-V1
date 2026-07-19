"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production — in dev, SW breaks Turbopack HMR
    if (process.env.NODE_ENV !== "production") {
      // Unregister any existing SW in dev
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failure is non-fatal
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
