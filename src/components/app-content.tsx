"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { AuthScreen } from "@/components/auth-screen";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { ScholarTransitionProvider } from "@/components/scholar-transition";
import { LaunchReadinessGate } from "@/components/launch-readiness-gate";
import { SubscriptionProvider, useScholarAccess } from "@/components/subscriptions/subscription-provider";

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
  const authed = useStore((state) => state.authed);
  const guestMode = useStore((state) => state.guestMode);
  const setAuthed = useStore((state) => state.setAuthed);
  const devMode = useStore((state) => state.devMode);
  const setDevMode = useStore((state) => state.setDevMode);
  const scholarClass = useStore((state) => state.user.scholarClass);
  const switchClass = useStore((state) => state.switchClass);
  const onboarded = useStore((state) => state.onboarded);
  const session = useScholarAccess();

  useEffect(() => {
    if (!session.loading && authed && !guestMode && !session.authenticated) setAuthed(false);
    if (!session.loading && session.authenticated && devMode !== session.developerMode) setDevMode(session.developerMode);
    if (!session.loading && session.authenticated && session.user?.currentScholarClass && scholarClass !== session.user.currentScholarClass) {
      switchClass(session.user.currentScholarClass as 9 | 11);
    }
  }, [session.loading, session.authenticated, session.developerMode, session.user?.currentScholarClass, authed, guestMode, devMode, scholarClass, setAuthed, setDevMode, switchClass]);

  if (session.loading && authed && !guestMode) {
    return <div className="grid min-h-screen place-items-center bg-black text-sm text-white/60">Checking your Scholar session…</div>;
  }
  if (!authed) return <AuthScreen />;
  if (!onboarded) return <Onboarding />;
  return <AppShell />;
}
