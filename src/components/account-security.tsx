"use client";
import { useEffect, useState } from "react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { GlassSurface } from "@/components/liquid-glass/glass-surface";
import { GlassButton } from "@/components/liquid-glass/glass-button";
type Account = { googleConfigured: boolean; googleConnected: boolean; emailVerified: boolean; emailVerificationConfigured: boolean };
export function AccountSecurity() {
  const session = useScholarAccess();
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!session.authenticated) return;
    const controller = new AbortController();
    void fetch("/api/auth/account", { cache: "no-store", signal: controller.signal }).then(async (r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setAccount).catch(() => { if (!controller.signal.aborted) setMessage("Account connection status is temporarily unavailable. Please retry later."); });
    const url = new URL(window.location.href);
    if (url.searchParams.get("google") === "connected") queueMicrotask(() => setMessage("Google is connected to your existing account. Your saved work and plan are unchanged."));
    if (url.searchParams.has("authError")) queueMicrotask(() => setMessage("Google could not be connected. It may already belong to another account, or the authorization expired. Your existing account is unchanged."));
    if (url.searchParams.has("google") || url.searchParams.has("authError")) window.history.replaceState(null, "", url.pathname);
    return () => controller.abort();
  }, [session.authenticated]);
  if (!session.authenticated) return null;
  async function action(link: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(link ? "/api/auth/google/start" : "/api/auth/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(link ? { intent: "link" } : { action: "request-verify" }), signal: AbortSignal.timeout(25_000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Please retry later.");
      if (link) window.location.assign(data.url); else setMessage(data.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please retry later."); }
    finally { setBusy(false); }
  }
  return <GlassSurface className="mb-5 rounded-2xl p-5 space-y-3" material="standard"><h3 className="text-sm font-semibold">Sign-in & security</h3><p className="text-xs text-muted-foreground">{account?.emailVerified ? "Email verified" : "Email not yet verified"} · {account?.googleConnected ? "Google connected" : "Google not connected"}</p><div className="flex flex-wrap gap-2"><GlassButton type="button" size="sm" disabled={busy || !account?.googleConfigured || account.googleConnected} onClick={() => void action(true)}>{account?.googleConnected ? "Google connected" : "Connect Google"}</GlassButton>{!account?.emailVerified && <GlassButton type="button" size="sm" disabled={busy || !account?.emailVerificationConfigured} onClick={() => void action(false)}>Send verification email</GlassButton>}<a className="text-xs underline underline-offset-4 p-2" href="/login#forgot">Reset password</a></div>{account && !account.googleConfigured && <p className="text-xs text-muted-foreground">Google sign-in is not configured on this instance.</p>}{message && <p role="status" className="text-xs leading-relaxed">{message}</p>}</GlassSurface>;
}
