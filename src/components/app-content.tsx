"use client";

import { useEffect, useState } from "react";
import { activateAccountWorkspace, useStore } from "@/lib/store";
import { workspaceOwner } from "@/lib/account-workspace";
import { AuthScreen } from "@/components/auth-screen";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { PersonalizationProvider } from "@/components/personalization/personalization-provider";
import { ScholarTransitionProvider } from "@/components/scholar-transition";
import { LaunchReadinessGate, useLaunchContentReadiness } from "@/components/launch-readiness-gate";
import { SubscriptionProvider, useScholarAccess } from "@/components/subscriptions/subscription-provider";

function currentWorkspaceOwner(): string {
  try { return workspaceOwner(window.localStorage); } catch { return ""; }
}

export function AppContent() {
  return (
    <ScholarTransitionProvider>
      <SubscriptionProvider>
        <LaunchReadinessGate>
          <ScholarContent />
        </LaunchReadinessGate>
      </SubscriptionProvider>
    </ScholarTransitionProvider>
  );
}

function ScholarContent() {
  const [workspaceError, setWorkspaceError] = useState(false);
  const { reportShellReady } = useLaunchContentReadiness();
  const authed = useStore((state) => state.authed);
  const guestMode = useStore((state) => state.guestMode);
  const setAuthed = useStore((state) => state.setAuthed);
  const devMode = useStore((state) => state.devMode);
  const setDevMode = useStore((state) => state.setDevMode);
  const scholarClass = useStore((state) => state.user.scholarClass);
  const workspaceEmail = useStore((state) => state.user.email);
  const switchClass = useStore((state) => state.switchClass);
  const onboarded = useStore((state) => state.onboarded);
  const session = useScholarAccess();
  const restoringWorkspace = (guestMode && !session.authenticated && currentWorkspaceOwner() !== "guest") || (session.authenticated && session.user?.email !== workspaceEmail);
  const shellReady = workspaceError || (!session.loading && !restoringWorkspace && session.status !== "initializing");

  useEffect(() => {
    reportShellReady(shellReady);
  }, [reportShellReady, shellReady]);

  useEffect(() => {
    if (!session.loading && session.status !== "error" && !session.authenticated && guestMode && currentWorkspaceOwner() !== "guest") {
      useStore.getState().startGuestSession();
      return;
    }
    if (!session.loading && session.status !== "error" && session.authenticated && session.user) {
      const profile = { email: session.user.email, name: session.user.name || "Scholar", scholarClass: session.user.currentScholarClass === 9 ? 9 as const : 11 as const };
      try {
        if (activateAccountWorkspace(profile)) return;
        if (!authed) setAuthed(true);
        const stored = useStore.getState().user;
        if (stored.email !== profile.email || stored.name !== profile.name) useStore.getState().updateUser(profile);
      } catch { queueMicrotask(() => setWorkspaceError(true)); return; }
    }
    if (!session.loading && session.status !== "error" && authed && !guestMode && !session.authenticated) {
      setDevMode(false);
      setAuthed(false);
    }
    if (!session.loading && session.status !== "error" && !session.authenticated && devMode) setDevMode(false);
    if (!session.loading && session.authenticated && devMode !== session.developerMode) setDevMode(session.developerMode);
    if (!session.loading && session.authenticated && session.user?.currentScholarClass && scholarClass !== session.user.currentScholarClass) {
      switchClass(session.user.currentScholarClass as 9 | 11);
    }
  }, [session.loading, session.status, session.authenticated, session.developerMode, session.user?.email, session.user?.name, session.user?.currentScholarClass, authed, guestMode, devMode, scholarClass, setAuthed, setDevMode, switchClass]);

  if (workspaceError) {
    return <div role="alert" className="grid min-h-dvh place-items-center bg-background p-6"><div className="max-w-md space-y-4"><h1 className="text-xl font-semibold">Your saved workspace is protected</h1><p>Scholar could not safely switch accounts because browser storage is full or unavailable. No previous account’s work has been discarded. Keep this browser’s data and contact support before clearing storage.</p><button className="rounded-xl border px-4 py-3" onClick={() => window.location.reload()}>Retry safely</button></div></div>;
  }
  if (restoringWorkspace) {
    return <div role="status" className="grid min-h-dvh place-items-center bg-background">Opening your account’s workspace…</div>;
  }
  if (session.loading && !guestMode) {
    // Do not keep account A's private local shell mounted while a sign-in,
    // sign-out or cross-tab session switch is resolving. Silent refreshes set
    // loading=false and do not disrupt the active verified workspace.
    return <div role="status" className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">Checking your Scholar session…</div>;
  }
  if (session.status === "error" && authed && !guestMode && !session.authenticated) {
    return <div role="alert" className="grid min-h-dvh place-items-center bg-background px-6 text-center"><div className="max-w-sm space-y-4"><h1 className="text-xl font-semibold">We couldn't check your session</h1><p className="text-sm text-muted-foreground">Your saved work is still here. Check your connection and try again.</p><button className="rounded-xl border border-border px-5 py-3" onClick={() => void session.refresh()}>Retry connection</button></div></div>;
  }
  if (!authed) return <AuthScreen />;
  if (session.authenticated && session.user) return <PersonalizationProvider key={session.user.id}><AppShell /></PersonalizationProvider>;
  if (!guestMode) return <AuthScreen />;
  if (!onboarded) return <Onboarding />;
  return <AppShell />;
}
