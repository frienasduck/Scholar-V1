"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { activateAccountWorkspace, useStore } from "@/lib/store";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Understated entry point at the bottom of the Privacy Notice. The password
 * itself is verified only by the server (POST /api/developer-access); nothing
 * about the expected value exists in client code or bundles.
 */
export function DeveloperAccessSection() {
  const router = useRouter();
  const setAuthed = useStore((s) => s.setAuthed);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const close = () => {
    setOpen(false);
    setPassword("");
    setError("");
    setLoading(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || loading) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/developer-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(20_000),
      });
      const value = await response.json().catch(() => null);
      if (!response.ok) {
        setError(value?.error || "Incorrect developer access password.");
        setLoading(false);
        return;
      }
      const user = value?.user;
      const profile = {
        email: user?.email || "developer@scholar.app",
        name: user?.name || "Scholar Developer",
        username: (user?.name || "Scholar Developer").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        scholarClass: user?.currentScholarClass === 9 ? 9 as const : 11 as const,
        jeeMode: false,
      };
      if (activateAccountWorkspace(profile)) return; // Full reload re-enters authorized via session refresh.
      useStore.getState().updateUser(profile);
      useStore.getState().switchClass(profile.scholarClass);
      setAuthed(true);
      window.dispatchEvent(new Event("scholar:session-changed"));
      close();
      router.push("/");
    } catch {
      setError("Scholar could not verify developer access. Check your connection and retry.");
      setLoading(false);
    }
  };

  return (
    <div className="mt-12 border-t border-white/10 pt-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground/70 underline-offset-4 transition-colors hover:text-muted-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        Access website for developers
      </button>
      <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm font-semibold tracking-[0.22em]">DEVELOPER ACCESS</DialogTitle>
            <DialogDescription>This area is restricted to authorized Scholar beta developers.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="scholar-developer-access-password" className="text-xs font-medium text-muted-foreground">
                Developer access password
              </label>
              <input
                id="scholar-developer-access-password"
                type="password"
                autoComplete="off"
                autoFocus
                required
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(""); }}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                placeholder="Enter the developer access password"
              />
            </div>
            {error ? <p role="alert" className="text-sm text-rose-500">{error}</p> : null}
            <DialogFooter className="gap-2 sm:gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-50"
              >
                {loading ? "Verifying…" : "ACCESS SCHOLAR"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
