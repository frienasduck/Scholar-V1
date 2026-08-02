"use client";

import { useStore } from "@/lib/store";
import { AuthScreen } from "@/components/auth-screen";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { ScholarTransitionProvider } from "@/components/scholar-transition";
import { LaunchReadinessGate } from "@/components/launch-readiness-gate";
import { SubscriptionProvider, useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { useEffect } from "react";

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
  const authed = useStore((s) => s.authed);
  const setAuthed = useStore((s) => s.setAuthed);
  const devMode = useStore((s) => s.devMode);
  const setDevMode = useStore((s) => s.setDevMode);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const switchClass = useStore((s) => s.switchClass);
  const onboarded = useStore((s) => s.onboarded);
  const session = useScholarAccess();

  useEffect(() => {
    if (!session.loading && authed && !session.authenticated) setAuthed(false);
    if (!session.loading && session.authenticated && devMode !== session.developerMode) setDevMode(session.developerMode);
    if (!session.loading && session.authenticated && session.user?.currentScholarClass && scholarClass !== session.user.currentScholarClass) switchClass(session.user.currentScholarClass as 9 | 11);
  }, [session.loading, session.authenticated, session.developerMode, session.user?.currentScholarClass, authed, devMode, scholarClass, setAuthed, setDevMode, switchClass]);

  if (session.loading && authed) return <div className="min-h-screen grid place-items-center bg-black text-sm text-white/60">Checking your Scholar session…</div>;
  if (!authed) return <AuthScreen />;
  if (!onboarded) return <Onboarding />;
  return <AppShell />;
}
