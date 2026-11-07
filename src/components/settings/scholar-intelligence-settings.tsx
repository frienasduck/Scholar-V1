"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  Check,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { IntelligenceView } from "@/components/views/intelligence";
import {
  INTELLIGENCE_CONSENT_EVENT,
  clearIntelligenceProfile,
  declineIntelligenceConsent,
  grantIntelligenceConsent,
  loadIntelligenceConsent,
  type IntelligenceConsent,
} from "@/lib/v2/intelligence/consent";
import { loadLastSync } from "@/lib/v2/intelligence/profile";

const PRIVACY_POINTS = [
  "Scholar Intelligence reads learning signals you already have in Scholar: quiz attempts, revision-hub sessions, recall ratings, the Mistake Book, planner exams and study progress.",
  "Mastery estimates, weak-topic radar, the mistake book and the revision queue are calculated in this browser. Nothing is analysed while the feature is off.",
  "If you are signed in and enable it, a bounded summary of up to 200 evidence events and 200 mistakes can sync to your Scholar account. Notes, files and attachments are never included.",
  "You can disable it at any time. Disabling stops the analysis and the sync; clearing the profile removes the derived intelligence data for this class.",
];

function statusBadge(consent: IntelligenceConsent | null) {
  if (consent === "granted") {
    return {
      label: "On",
      className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    };
  }
  if (consent === "declined") {
    return {
      label: "Off · your choice",
      className: "border-white/15 bg-white/5 text-white/60",
    };
  }
  return {
    label: "Not set up",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  };
}

export function ScholarIntelligenceSettings({ scholarClass }: { scholarClass: 9 | 11 }) {
  const [consent, setConsent] = useState<IntelligenceConsent | null>(() =>
    loadIntelligenceConsent(scholarClass),
  );
  const [lastSync, setLastSync] = useState(() => loadLastSync(scholarClass));

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ scholarClass?: 9 | 11 }>).detail;
      if (!detail?.scholarClass || detail.scholarClass === scholarClass) {
        setConsent(loadIntelligenceConsent(scholarClass));
        setLastSync(loadLastSync(scholarClass));
      }
    };
    window.addEventListener(INTELLIGENCE_CONSENT_EVENT, sync);
    return () => window.removeEventListener(INTELLIGENCE_CONSENT_EVENT, sync);
  }, [scholarClass]);

  const enable = () => {
    grantIntelligenceConsent(scholarClass);
    setConsent("granted");
    toast.success("Scholar Intelligence enabled", {
      description: "Your existing Scholar activity will now be summarised on this device.",
    });
  };

  const decline = () => {
    declineIntelligenceConsent(scholarClass);
    setConsent("declined");
    toast.info("Scholar Intelligence stays off", {
      description: "Nothing is analysed. You can enable it from Settings whenever you choose.",
    });
  };

  const disable = () => {
    declineIntelligenceConsent(scholarClass);
    setConsent("declined");
    toast.info("Scholar Intelligence disabled", {
      description: "Analysis and account sync are stopped. Your stored study work is untouched.",
    });
  };

  const clearProfile = () => {
    if (
      !window.confirm(
        `Clear Scholar Intelligence data for the Class ${scholarClass} profile? This removes mastery estimates, revision schedules, mistake resolutions and sync state. Your quizzes, notes and study history stay intact.`,
      )
    ) {
      return;
    }
    clearIntelligenceProfile(scholarClass);
    setConsent(null);
    setLastSync(null);
    toast.success("Intelligence profile cleared", {
      description: "Your choice was reset. Scholar will ask before analysing again.",
    });
  };

  const badge = statusBadge(consent);
  const enabled = consent === "granted";

  return (
    <div className="space-y-4">
      <div className="asme-glass rounded-3xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="flex items-center gap-2 font-semibold text-white">
                <Brain className="h-4 w-4 text-indigo-300" />
                Scholar Intelligence
              </h3>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Mastery, weak spots, mistakes and revision priorities, computed from activity you
              already have in Scholar. Estimates are estimates — Scholar never pretends to know you
              better than you know yourself.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {enabled ? (
              <>
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                  <ShieldCheck className="h-4 w-4" /> Enabled
                </span>
                <button
                  type="button"
                  onClick={disable}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Disable
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={enable}
                className="flex items-center gap-1.5 rounded-full border border-indigo-300/25 bg-indigo-400/15 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-400/25"
              >
                <Sparkles className="h-3.5 w-3.5" /> Enable Scholar Intelligence
              </button>
            )}
          </div>
        </div>

        {consent === null && (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-4">
            <p className="text-sm font-semibold text-amber-100">Your choice — no preselection</p>
            <p className="mt-1 text-xs leading-5 text-white/60">
              Scholar Intelligence is currently off. Enable it to turn your existing quiz, revision
              and mistake data into study guidance, or choose Not now and Scholar will not ask
              again automatically.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={enable}
                className="flex items-center gap-1.5 rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-400"
              >
                <Check className="h-3.5 w-3.5" /> Enable Scholar Intelligence
              </button>
              <button
                type="button"
                onClick={decline}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {consent === "declined" && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-4">
            <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-white/50" />
            <div>
              <p className="text-sm font-semibold text-white/85">Scholar Intelligence is off</p>
              <p className="mt-1 text-xs leading-5 text-white/50">
                Nothing is analysed and nothing is synced. You chose not to enable it, so Scholar
                will not prompt you again — the controls stay here if you change your mind.
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-2 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.045] p-4 text-xs leading-5 text-white/55">
          <p className="font-semibold uppercase tracking-wider text-cyan-200/80">What it reads</p>
          {PRIVACY_POINTS.map((point) => (
            <p key={point} className="flex gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
              <span>{point}</span>
            </p>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/40">
            {enabled && lastSync
              ? `Last sync summary: ${lastSync.events} events and ${lastSync.mistakes} mistakes, ${new Date(lastSync.at).toLocaleString()}.`
              : enabled
                ? "No account sync has completed yet. Sync is best-effort and only runs while enabled."
                : "Account sync is off while Scholar Intelligence is off."}
          </p>
          <button
            type="button"
            onClick={clearProfile}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-rose-300/25 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear intelligence profile
          </button>
        </div>
      </div>

      {enabled && (
        <div className="asme-glass rounded-3xl p-4 sm:p-5">
          <IntelligenceView />
        </div>
      )}
    </div>
  );
}
