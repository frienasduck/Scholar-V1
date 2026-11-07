"use client";

import { useEffect, useState } from "react";
import { Brain, Check, Settings2, ShieldOff } from "lucide-react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { useStore } from "@/lib/store";
import { navigateTo } from "@/lib/nav-event";
import {
  INTELLIGENCE_CONSENT_EVENT,
  declineIntelligenceConsent,
  grantIntelligenceConsent,
  loadIntelligenceConsent,
  type IntelligenceConsent,
} from "@/lib/v2/intelligence/consent";

/**
 * One-time consent for Scholar Intelligence.
 *
 * It only appears for an authenticated account with no saved choice, never
 * preselects Enable, and can be dismissed without blocking the app. Declining
 * stores an explicit "declined" choice, so the prompt is not shown again.
 */
export function ScholarIntelligenceConsentPrompt() {
  const scholarClass = useStore((state) => state.user.scholarClass);
  const guestMode = useStore((state) => state.guestMode);
  const access = useScholarAccess();
  const [consent, setConsent] = useState<IntelligenceConsent | null>(() =>
    loadIntelligenceConsent(scholarClass),
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setConsent(loadIntelligenceConsent(scholarClass));
  }, [scholarClass]);

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ scholarClass?: 9 | 11 }>).detail;
      if (!detail?.scholarClass || detail.scholarClass === scholarClass) {
        setConsent(loadIntelligenceConsent(scholarClass));
      }
    };
    window.addEventListener(INTELLIGENCE_CONSENT_EVENT, sync);
    return () => window.removeEventListener(INTELLIGENCE_CONSENT_EVENT, sync);
  }, [scholarClass]);

  if (
    guestMode ||
    !access.authenticated ||
    access.loading ||
    !access.entitlementsLoaded ||
    consent !== null ||
    dismissed
  ) {
    return null;
  }

  const enable = () => {
    grantIntelligenceConsent(scholarClass);
    setConsent("granted");
  };

  const decline = () => {
    declineIntelligenceConsent(scholarClass);
    setConsent("declined");
  };

  return (
    <section
      aria-labelledby="scholar-intelligence-consent-title"
      className="mx-3 mb-2 mt-3 rounded-2xl border border-indigo-300/20 bg-indigo-400/[.07] p-4 sm:mx-4 lg:mx-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-indigo-300/25 bg-indigo-400/15 text-indigo-100">
          <Brain className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="scholar-intelligence-consent-title" className="text-sm font-semibold text-foreground">
            Make Scholar understand how you learn
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            Scholar Intelligence can use your permitted study activity and preferences to make
            relevant academic recommendations, help prioritize revision and personalize your
            learning experience. It uses quiz and practice attempts, revision progress, mastery
            estimates and preferences you save — never private messages, microphone or camera data.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={enable}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-indigo-300/30 bg-indigo-400/15 px-3.5 py-1.5 text-xs font-semibold text-indigo-100 transition-colors hover:bg-indigo-400/25"
            >
              <Check className="h-3.5 w-3.5" /> Enable Scholar Intelligence
            </button>
            <button
              type="button"
              onClick={decline}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <ShieldOff className="h-3.5 w-3.5" /> Not now
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissed(true);
                navigateTo("settings", { settingsCategory: "intelligence" });
              }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" /> Review privacy settings
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
