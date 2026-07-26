"use client";

import { useStore } from "@/lib/store";
import { AuthScreen } from "@/components/auth-screen";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { ScholarTransitionProvider } from "@/components/scholar-transition";
import { LaunchReadinessGate } from "@/components/launch-readiness-gate";

export function AppContent() {
  return (
    <ScholarTransitionProvider>
      <LaunchReadinessGate>
        <ScholarContent />
      </LaunchReadinessGate>
    </ScholarTransitionProvider>
  );
}

function ScholarContent() {
  const authed = useStore((s) => s.authed);
  const onboarded = useStore((s) => s.onboarded);

  if (!authed) return <AuthScreen />;
  if (!onboarded) return <Onboarding />;
  return <AppShell />;
}
