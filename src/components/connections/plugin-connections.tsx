"use client";
import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Plug, Search, Loader2 } from "lucide-react";
import { GlassSurface } from "@/components/liquid-glass/glass-surface";
import type { DriveFile } from "@/lib/connections/google-drive";
import { requiresExternalDriveBrowser } from "@/lib/connections/browser";
type Provider = { id: string; name: string; configured: boolean; connected: boolean; revocationPending: boolean; capabilities: string[] };
export function PluginConnections() {
  const [providers, setProviders] = useState<Provider[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]); const [query, setQuery] = useState(""); const [next, setNext] = useState<string>(); const [browsing, setBrowsing] = useState(false);
  const [externalBrowserUrl, setExternalBrowserUrl] = useState("");
  const request = async (url: string, init?: RequestInit) => { const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(55_000) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Please retry."); return data; };
  const refresh = useCallback(async () => { try { const response = await fetch("/api/connections", { cache: "no-store", signal: AbortSignal.timeout(8_000) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Sign in to connect files."); setProviders(data.providers); } catch (cause) { setError(cause instanceof Error ? cause.message : "Connections unavailable."); } }, []);
  useEffect(() => { if (requiresExternalDriveBrowser(navigator.userAgent)) setExternalBrowserUrl(`${location.origin}/settings#plugins-connections`); const result = new URLSearchParams(location.search).get("drive"); if (result === "failed") setError("Google Drive authorization was not completed. Your existing connection was not replaced. Retry Connect when ready."); void refresh(); }, [refresh]);
  const run = async (action: () => Promise<void>) => { if (busy) return; setBusy(true); setError(""); try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Please retry."); } finally { setBusy(false); } };
  const browse = (pageToken?: string) => run(async () => { const data = await request(`/api/connections/google-drive/files?q=${encodeURIComponent(query)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`); setFiles(current => pageToken ? [...current, ...data.files] : data.files); setNext(data.nextPageToken); setBrowsing(true); });
  const connect = () => run(async () => {
    if (requiresExternalDriveBrowser(navigator.userAgent)) throw new Error("Open Scholar in your phone’s full browser to connect Google Drive.");
    const data = await request("/api/connections/google-drive/start", { method: "POST" });
    location.assign(data.url);
  });
  return <section id="plugins-connections" className="scroll-mt-24"><GlassSurface material="elevated" radius={24} className="p-5 sm:p-6">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Plug size={19} /> Plugins &amp; Connections</h2>
    <p className="mt-2 text-sm leading-6 text-slate-300">Connect a source, then choose what to import into your private Scholar resource library.</p>
    {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
    {externalBrowserUrl && <div role="note" className="mt-3 rounded-xl border border-cyan-200/20 p-3 text-sm leading-6"><p>Google connections require your phone’s full browser, not embedded Google sign-in. Open Scholar there and sign in, then connect Drive. Your connection will be available here afterward.</p><a className="mt-2 inline-block break-all text-cyan-200 underline" href={externalBrowserUrl} target="_blank" rel="noopener noreferrer">{externalBrowserUrl}</a><p className="mt-1 text-xs text-slate-400">If this stays inside the app, copy the URL into Chrome or your browser manually.</p></div>}
    {providers.map(provider => <div key={provider.id} className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-4"><h3 className="flex items-center gap-2 font-medium"><FolderOpen size={18} /> {provider.name} <span className="text-xs text-cyan-200">{provider.connected ? "Connected" : provider.revocationPending ? "Revocation pending" : provider.configured ? "Available" : "Not configured"}</span></h3>
      <p className="mt-2 text-xs leading-6 text-slate-300">Limited per-file access. Scholar sees only PDFs and Google Docs you have granted this app, not your entire Drive. Grant a file using Google Drive’s “Open with Scholar” integration. Imports are private; PDFs and exported Docs must be 4 MB or smaller. No Drive files are modified.</p>
      <div className="mt-3 flex flex-wrap gap-2">{!provider.connected && !provider.revocationPending && <button disabled={!provider.configured || busy || Boolean(externalBrowserUrl)} className="sg-cta-primary min-h-11 rounded-full px-4 disabled:opacity-50" onClick={connect}>Connect Google Drive</button>}{provider.connected && <button disabled={busy} className="sg-cta-quiet min-h-11 rounded-full px-4" onClick={() => browse()}>Browse granted files</button>}{(provider.connected || provider.revocationPending) && <button disabled={busy} className="sg-cta-quiet min-h-11 rounded-full px-4" onClick={() => run(async () => { await request("/api/connections/google-drive/disconnect", { method: "DELETE" }); setFiles([]); setBrowsing(false); await refresh(); })}>{provider.revocationPending ? "Retry disconnect" : "Disconnect & revoke"}</button>}</div>
    </div>)}
    {busy && <p role="status" className="mt-3 flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Working…</p>}
    {browsing && <div className="mt-4"><form className="flex gap-2" onSubmit={event => { event.preventDefault(); void browse(); }}><input aria-label="Search granted Drive files" className="min-w-0 flex-1 rounded-xl border border-white/20 bg-black/20 px-3 py-2" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search granted PDFs and Docs" /><button disabled={busy} className="sg-cta-quiet min-h-11 rounded-xl px-4" aria-label="Search"><Search size={18} /></button></form>
      {!files.length && <p className="mt-4 text-sm text-slate-300">No granted files found. In Google Drive, open a PDF or Doc with Scholar, then refresh this list.</p>}
      <ul className="mt-3 space-y-2">{files.map(file => <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><span className="min-w-0 flex-1 break-words text-sm">{file.name}</span><button disabled={busy} className="sg-cta-quiet min-h-11 rounded-full px-4 text-sm" onClick={() => run(async () => { await request("/api/connections/google-drive/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: file.id }) }); setError("Imported. Open E-Books to read it; Resources uses the same private index."); })}>Import to Scholar</button></li>)}</ul>{next && <button className="mt-3 min-h-11 px-4" disabled={busy} onClick={() => browse(next)}>More files</button>}
    </div>}
  </GlassSurface></section>;
}
