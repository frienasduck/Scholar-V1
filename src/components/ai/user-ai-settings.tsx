"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { toast } from "@/lib/notifications/notification-api";

type Provider = "groq" | "gemini" | "nvidia";
type Scope = "lam" | "ai-tutor";

export function UserAISettings() {
  const access = useScholarAccess();
  const [provider, setProvider] = useState<Provider>("groq");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(["lam", "ai-tutor"]);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!access.authenticated) return;
    let cancelled = false;
    void fetch("/api/ai/user-provider", { cache: "no-store" }).then((response) => response.json()).then((value) => {
      if (cancelled) return;
      setConfigured(Boolean(value.configured));
      if (value.provider) setProvider(value.provider);
      if (value.model) setModel(value.model);
      if (Array.isArray(value.scopes) && value.scopes.length) setScopes(value.scopes);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [access.authenticated, access.user?.id]);

  const save = async () => {
    if (!apiKey.trim() || !model.trim() || !scopes.length) return toast.error("Enter a key, model and at least one Scholar area.");
    setBusy(true);
    try {
      const response = await fetch("/api/ai/user-provider", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model: model.trim(), apiKey: apiKey.trim(), scopes }) });
      if (!response.ok) throw new Error("Scholar could not save these model settings. Check the key and model format.");
      setApiKey(""); setConfigured(true);
      window.dispatchEvent(new Event("scholar:ai-settings-changed"));
      toast.success("Model settings saved", { description: "The key is encrypted and never shown again. Provider usage is billed by your provider." });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save the model."); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/ai/user-provider", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove your key.");
      setConfigured(false); setApiKey("");
      window.dispatchEvent(new Event("scholar:ai-settings-changed"));
      toast.success("Custom API key removed");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not remove your key."); }
    finally { setBusy(false); }
  };

  if (!access.authenticated) return <p className="text-sm text-white/60">Sign in to connect your own AI provider.</p>;
  return <section className="rounded-3xl border border-cyan-100/20 bg-[linear-gradient(145deg,rgba(127,194,255,.13),rgba(10,22,43,.48))] p-5 text-white shadow-[inset_0_1px_rgba(255,255,255,.2)] backdrop-blur-xl sm:p-6">
    <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl border border-white/20 bg-white/10"><KeyRound className="size-5 text-cyan-200" /></span><div><h3 className="font-semibold">Your AI provider</h3><p className="text-xs text-white/55">{configured ? "Custom model connected on this browser" : "Optional · Scholar Groq remains the free default"}</p></div></div>
    <p className="mt-4 text-sm leading-6 text-white/65">Connect a Groq, Gemini, or NVIDIA key and choose its model. Your own key powers only the areas selected below. Scholar Plus users can also choose configured platform Gemini and NVIDIA models in LAM AI.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-xs font-medium text-white/75">Provider<select className="min-h-11 rounded-xl border border-white/20 bg-[#101b32] px-3 text-sm text-white" value={provider} onChange={(event) => setProvider(event.target.value as Provider)}><option value="groq">Groq</option><option value="gemini">Gemini</option><option value="nvidia">NVIDIA</option></select></label>
      <label className="grid gap-1.5 text-xs font-medium text-white/75">Model ID<input className="min-h-11 rounded-xl border border-white/20 bg-black/20 px-3 text-sm text-white" placeholder="Provider model ID" autoComplete="off" value={model} onChange={(event) => setModel(event.target.value)} /></label>
    </div>
    <label className="mt-3 grid gap-1.5 text-xs font-medium text-white/75">API key<input className="min-h-11 rounded-xl border border-white/20 bg-black/20 px-3 text-sm text-white" type="password" placeholder={configured ? "Enter a new key to replace the saved key" : "Paste your provider API key"} autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></label>
    <fieldset className="mt-4"><legend className="text-xs font-semibold text-white/75">Use your key for</legend><div className="mt-2 flex flex-wrap gap-3">{([ ["lam", "LAM AI"], ["ai-tutor", "AI Tutor and standard study generations"] ] as const).map(([scope, label]) => <label key={scope} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-3 text-sm"><input type="checkbox" checked={scopes.includes(scope)} onChange={(event) => setScopes((current) => event.target.checked ? [...current, scope] : current.filter((item) => item !== scope))} />{label}</label>)}</div></fieldset>
    <p className="mt-3 text-xs leading-5 text-white/45">Stored in an encrypted, account-bound, HttpOnly browser cookie for 90 days. It does not sync to other devices. Model IDs must be supported by your provider; never paste a key into chat.</p>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cyan-100 px-5 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}Save model</button>{configured ? <button type="button" disabled={busy} onClick={() => void remove()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 text-sm text-white/75 transition hover:bg-white/10 disabled:opacity-50"><Trash2 className="size-4" />Remove key</button> : null}</div>
  </section>;
}
