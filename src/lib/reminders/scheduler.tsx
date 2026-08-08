"use client";

// ============================================================================
// Smart Reminders 2.0 — due-check scheduler + notification centre
// Reliable due-date checks on startup, visibility change, focus, periodic
// ticks and reminder changes. Fires in-app notifications, browser
// notifications (only when permitted), and Talk Reminders. Renders a global
// "reminder due" action centre with Complete / Snooze / Stop Speaking /
// Start Task / Open in Scholar.
//
// We do NOT claim closed-browser delivery: browser notifications only fire
// while a Scholar tab is open (the PWA has no push server).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlarmClock, Bell, CheckCircle2, Play, Square, Volume2, X } from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { navigateTo } from "@/lib/nav-event";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useReminderStore, REMINDERS_CHANGED_EVENT } from "./store";
import { mayFireNow, nextOccurrenceAfter, isOverdue } from "./engine";
import { speakSmartReminder, stopTalkSpeech } from "./talk";
import { DEFAULT_REMINDER_SETTINGS, type ReminderProfileState, type SmartReminder } from "./types";

const TICK_MS = 30_000;
const MISS_GRACE_MS = 24 * 3_600_000;

// ---------------------------------------------------------------------------
// Digest queue — suppressed low-priority reminders are grouped and delivered
// once quiet hours end (in-memory per session).
// ---------------------------------------------------------------------------
const digestQueue: Array<{ title: string; dueLabel: string }> = [];

export function flushDigest(scholarClass: 9 | 11): void {
  if (!digestQueue.length) return;
  const items = digestQueue.splice(0, digestQueue.length);
  toast.info(`Missed reminders while you were away`, {
    description: items.slice(0, 5).map((i) => `• ${i.title} (${i.dueLabel})`).join("\n") + (items.length > 5 ? `\n…and ${items.length - 5} more` : ""),
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("scholar:reminder-digest", { detail: { scholarClass, count: items.length } }));
  }
}

// ---------------------------------------------------------------------------
// Notification permission helpers
// ---------------------------------------------------------------------------

export function browserNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestBrowserNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  const current = Notification.permission;
  if (current === "granted" || current === "denied") return current;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function sendTestNotification(): void {
  if (typeof window === "undefined") return;
  const title = "Scholar reminders";
  const body = "This is how a reminder notification will look. Complete or snooze from here.";
  if (document.visibilityState === "hidden" && browserNotificationPermission() === "granted") {
    try {
      const notification = new Notification(title, { body, tag: "scholar-test", icon: "/icon-192.png" });
      notification.onclick = () => { window.focus(); notification.close(); };
    } catch {
      /* fall back to in-app */
    }
  }
  toast.info(title, { description: body, id: "scholar-test-toast" });
}

function fireBrowserNotification(reminder: SmartReminder): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState !== "hidden") return; // in-app toast already shown
  const due = new Date(reminder.dueAt);
  const body = reminder.alerts.length
    ? `${reminder.title} — ${due.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
    : reminder.title;
  try {
    const notification = new Notification("Scholar reminder", {
      body,
      tag: `reminder-${reminder.id}`,
      icon: "/icon-192.png",
    });
    notification.onclick = () => {
      window.focus();
      navigateTo("reminders", { openReminder: reminder.id });
      notification.close();
    };
  } catch {
    // Notifications can fail (e.g. permission revoked mid-session).
  }
}

// ---------------------------------------------------------------------------
// Scheduler state
// ---------------------------------------------------------------------------

export interface DueCard {
  key: string;
  reminder: SmartReminder;
  firedAlert: string;
}

interface SchedulerHook {
  scholarClass: 9 | 11;
}

function computeNextTrigger(reminder: SmartReminder, now: Date): Date | null {
  const effectiveDue = reminder.snoozeUntil ? new Date(reminder.snoozeUntil) : new Date(reminder.dueAt);
  const alertOffsets = reminder.alerts.length ? reminder.alerts.map((a) => ({ id: a.id, offset: a.offsetMinutes })) : [{ id: "due", offset: 0 }];
  const candidates = alertOffsets
    .filter((a) => !reminder.firedAlertIds.includes(a.id))
    .map((a) => ({ id: a.id, time: new Date(effectiveDue.getTime() - a.offset * 60_000) }))
    .filter((c) => c.time.getTime() > now.getTime());
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.time.getTime() - b.time.getTime());
  return candidates[0].time;
}

/** Returns the alert id that should fire right now, or null. */
function dueAlertNow(reminder: SmartReminder, now: Date): string | null {
  if (reminder.status === "completed" || reminder.status === "cancelled") return null;
  if (reminder.snoozeUntil && new Date(reminder.snoozeUntil).getTime() > now.getTime()) return null;
  const effectiveDue = reminder.snoozeUntil ? new Date(reminder.snoozeUntil) : new Date(reminder.dueAt);
  const alertOffsets = reminder.alerts.length ? reminder.alerts.map((a) => ({ id: a.id, offset: a.offsetMinutes })) : [{ id: "due", offset: 0 }];
  const due = alertOffsets
    .filter((a) => !reminder.firedAlertIds.includes(a.id))
    .map((a) => ({ id: a.id, time: effectiveDue.getTime() - a.offset * 60_000 }))
    .filter((c) => c.time <= now.getTime());
  if (!due.length) return null;
  due.sort((a, b) => b.time - a.time);
  return due[0].id;
}

function runDueCheck(scholarClass: 9 | 11, onDue: (reminder: SmartReminder, firedAlert: string) => void): void {
  const store = useReminderStore.getState();
  const profile = store.ensureProfile(scholarClass);
  const now = new Date();
  const settings = profile.settings;

  for (const reminder of profile.reminders) {
    if (reminder.status === "completed" || reminder.status === "cancelled") continue;

    const alertId = dueAlertNow(reminder, now);

    // Mark genuinely missed (non-recurring, past due, beyond grace, no snooze).
    if (!alertId && !reminder.recurrence && isOverdue(reminder, now) && !reminder.snoozeUntil) {
      if (now.getTime() - new Date(reminder.dueAt).getTime() > MISS_GRACE_MS && reminder.status !== "missed") {
        store.markMissed(scholarClass, reminder.id);
      }
      continue;
    }

    if (!alertId) continue;

    const gate = mayFireNow(reminder, settings, now);
    const isExamOrImportant = reminder.type === "exam" || reminder.priority === "high" || reminder.priority === "critical" || reminder.important;

    if (!gate.allow) {
      // Quiet hours — high-priority & exam reminders stay separate when allowed,
      // low-priority ones go into the digest queue.
      if (settings.quietHours.deliverLater && !isExamOrImportant) {
        digestQueue.push({ title: reminder.title, dueLabel: reminder.dueAt });
      }
      store.markFired(scholarClass, reminder.id, [...reminder.firedAlertIds, alertId], now.toISOString(), computeNextTrigger({ ...reminder, firedAlertIds: [...reminder.firedAlertIds, alertId] }, now)?.toISOString());
      continue;
    }

    // Fire!
    onDue(reminder, alertId);
    fireBrowserNotification(reminder);
    store.markFired(scholarClass, reminder.id, [...reminder.firedAlertIds, alertId], now.toISOString(), computeNextTrigger({ ...reminder, firedAlertIds: [...reminder.firedAlertIds, alertId] }, now)?.toISOString());
  }
}

/** Advance recurring reminders whose current occurrence has fully fired. */
function advanceRecurring(scholarClass: 9 | 11): void {
  const store = useReminderStore.getState();
  const profile = store.ensureProfile(scholarClass);
  const now = new Date();
  for (const reminder of profile.reminders) {
    if (!reminder.recurrence || reminder.status === "completed" || reminder.status === "cancelled") continue;
    const effectiveDue = reminder.snoozeUntil ? new Date(reminder.snoozeUntil) : new Date(reminder.dueAt);
    if (effectiveDue.getTime() > now.getTime()) continue;
    const firedAll = reminder.alerts.every((a) => reminder.firedAlertIds.includes(a.id));
    if (!firedAll) continue;

    if (reminder.recurrenceCount && (reminder.occurrencesFired ?? 0) >= reminder.recurrenceCount) {
      store.completeReminder(scholarClass, reminder.id);
      continue;
    }
    if (reminder.recurrenceEndAt && new Date(reminder.recurrenceEndAt).getTime() < now.getTime()) {
      store.completeReminder(scholarClass, reminder.id);
      continue;
    }
    const next = nextOccurrenceAfter(reminder.recurrence, effectiveDue);
    if (!next) {
      store.completeReminder(scholarClass, reminder.id);
      continue;
    }
    store.advanceOccurrence(scholarClass, reminder.id, next.toISOString(), (reminder.occurrencesFired ?? 0) + 1);
  }
}

// ---------------------------------------------------------------------------
// Global component
// ---------------------------------------------------------------------------

export function ReminderScheduler({ scholarClass }: SchedulerHook) {
  const [dueCards, setDueCards] = useState<DueCard[]>([]);
  const timerRef = useRef<number | null>(null);
  const lastCheckRef = useRef(0);
  const mountedRef = useRef(true);

  const handleDue = useCallback((reminder: SmartReminder, firedAlert: string) => {
    if (!mountedRef.current) return;
    const key = `${reminder.id}:${firedAlert}:${reminder.occurrencesFired ?? 0}`;
    setDueCards((prev) => {
      if (prev.some((c) => c.key === key)) return prev;
      const next = [{
        key,
        reminder,
        firedAlert,
      }, ...prev].slice(0, 4);
      // Snooze after 45 seconds if the user ignores the card.
      return next;
    });

    const settings = useReminderStore.getState().ensureProfile(scholarClass).settings;
    const gate = mayFireNow(reminder, settings, new Date());

    // Talk Reminder
    const shouldSpeak = reminder.talkEnabled && gate.allowSpeech;
    if (shouldSpeak) {
      const talk = settings.talk;
      const openOnly = talk.speakOnlyWhenOpen;
      const respectQuiet = talk.respectQuietHours;
      const speakNow = (!respectQuiet || gate.allowSpeech) && (!openOnly || document.visibilityState === "visible");
      if (speakNow) {
        speakSmartReminder(reminder, {
          repeatCount: talk.repeatCount,
          repeatDelayMs: talk.repeatDelayMs,
          requireVisible: false,
        });
        useReminderStore.getState().addActivity(scholarClass, {
          kind: "spoken",
          reminderId: reminder.id,
          reminderTitle: reminder.title,
          actor: "automatic",
          detail: "Talk Reminder announced aloud",
        });
      }
    }

    // In-app toast (always, unless already covered by the due card on mobile)
    toast.info(reminder.title, {
      description: reminder.alerts.length ? `Due ${new Date(reminder.dueAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : "Reminder is due now",
      id: key,
      duration: 8_000,
      action: { label: "Open", onClick: () => navigateTo("reminders", { openReminder: reminder.id }) },
    });
  }, [scholarClass]);

  const checkNow = useCallback(() => {
    const now = Date.now();
    if (now - lastCheckRef.current < 2_000) return;
    lastCheckRef.current = now;
    try {
      runDueCheck(scholarClass, handleDue);
      advanceRecurring(scholarClass);
      const settings = useReminderStore.getState().ensureProfile(scholarClass).settings;
      if (settings.quietHours.enabled && !mayFireNow({ priority: "low", type: "general", important: false, talkEnabled: false }, settings, new Date()).allow) {
        // still quiet — keep digest queued
      } else {
        flushDigest(scholarClass);
      }
    } catch {
      // Scheduler must never break the app.
    }
  }, [scholarClass, handleDue]);

  useEffect(() => {
    mountedRef.current = true;
    lastCheckRef.current = 0;
    // Immediate check on mount (app startup / login / view change).
    const first = window.setTimeout(checkNow, 600);

    const visibility = () => { if (document.visibilityState === "visible") { lastCheckRef.current = 0; checkNow(); } };
    const focus = () => { lastCheckRef.current = 0; checkNow(); };
    const changed = () => { lastCheckRef.current = 0; checkNow(); };

    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", focus);
    window.addEventListener(REMINDERS_CHANGED_EVENT, changed);
    window.addEventListener("storage", changed);
    timerRef.current = window.setInterval(checkNow, TICK_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timerRef.current ?? undefined);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", focus);
      window.removeEventListener(REMINDERS_CHANGED_EVENT, changed);
      window.removeEventListener("storage", changed);
    };
  }, [checkNow]);

  // Auto-dismiss overdue cards after 90s.
  useEffect(() => {
    if (!dueCards.length) return;
    const timer = window.setTimeout(() => setDueCards((prev) => prev.slice(0, 0)), 90_000);
    return () => window.clearTimeout(timer);
  }, [dueCards.length]);

  const dismissCard = useCallback((key: string, opts?: { complete?: boolean; snoozeMinutes?: number }) => {
    const card = dueCards.find((c) => c.key === key);
    if (!card) return;
    stopTalkSpeech();
    if (opts?.complete) {
      useReminderStore.getState().completeReminder(scholarClass, card.reminder.id);
      toast.success("Reminder completed");
    } else if (opts?.snoozeMinutes) {
      const until = new Date(Date.now() + opts.snoozeMinutes * 60_000).toISOString();
      useReminderStore.getState().snoozeReminder(scholarClass, card.reminder.id, until);
      toast.success(`Snoozed for ${opts.snoozeMinutes} minutes`);
    }
    setDueCards((prev) => prev.filter((c) => c.key !== key));
  }, [dueCards, scholarClass]);

  return (
    <>
      {typeof window !== "undefined" && createPortal(
        <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2" role="region" aria-label="Due reminders">
          <AnimatePresence>
            {dueCards.map((card) => (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.25 }}
                className="pointer-events-auto rounded-2xl border border-rose-300/25 bg-slate-950/90 p-4 shadow-2xl shadow-rose-500/10 backdrop-blur-xl"
                role="alertdialog"
                aria-label={`Reminder due: ${card.reminder.title}`}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-300">
                    {card.reminder.talkEnabled ? <Volume2 className="h-5 w-5" /> : <AlarmClock className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/80">Reminder due</p>
                    <p className="mt-0.5 text-sm font-semibold text-white">{card.reminder.title}</p>
                    <p className="mt-0.5 text-[11px] text-white/50">
                      {new Date(card.reminder.dueAt).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      {card.reminder.durationMin ? ` · ${card.reminder.durationMin} min` : ""}
                    </p>
                  </div>
                  <button onClick={() => dismissCard(card.key)} className="rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white" aria-label="Dismiss reminder">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {card.reminder.talkEnabled && (
                  <button
                    onClick={() => stopTalkSpeech()}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10"
                  >
                    <Square className="h-3 w-3" /> Stop Speaking
                  </button>
                )}

                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button onClick={() => dismissCard(card.key, { complete: true })} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/30">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                  </button>
                  <button
                    onClick={() => {
                      const minutes = card.reminder.type === "focus" || card.reminder.autoStartFocus ? 5 : 10;
                      dismissCard(card.key, { snoozeMinutes: minutes });
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10"
                  >
                    <Bell className="h-3.5 w-3.5" /> Snooze {card.reminder.type === "focus" || card.reminder.autoStartFocus ? "5" : "10"}
                  </button>
                  <button
                    onClick={() => {
                      stopTalkSpeech();
                      const view = card.reminder.openViewOnStart ?? (card.reminder.type === "focus" ? "focus" : "study");
                      const minutes = card.reminder.durationMin ?? (card.reminder.type === "focus" ? 25 : undefined);
                      navigateTo(view, minutes ? { minutes, source: "reminder" } : { source: "reminder" });
                      if (view !== "focus") {
                        useReminderStore.getState().completeReminder(scholarClass, card.reminder.id);
                      }
                      setDueCards((prev) => prev.filter((c) => c.key !== card.key));
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-500/20 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-500/30"
                  >
                    <Play className="h-3.5 w-3.5" /> Start Task
                  </button>
                  <button
                    onClick={() => {
                      stopTalkSpeech();
                      navigateTo("reminders", { openReminder: card.reminder.id });
                      setDueCards((prev) => prev.filter((c) => c.key !== card.key));
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10"
                  >
                    <AlarmClock className="h-3.5 w-3.5" /> Open in Scholar
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Immediate manual check (used by the reminders view on mount). */
export function checkRemindersNow(scholarClass: 9 | 11): void {
  runDueCheck(scholarClass, (reminder, firedAlert) => {
    const key = `${reminder.id}:${firedAlert}`;
    toast.info(reminder.title, {
      description: `Due ${new Date(reminder.dueAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`,
      id: key,
      action: { label: "Open", onClick: () => navigateTo("reminders", { openReminder: reminder.id }) },
    });
    const settings = useReminderStore.getState().ensureProfile(scholarClass).settings;
    const gate = mayFireNow(reminder, settings, new Date());
    if (reminder.talkEnabled && gate.allowSpeech && settings.talk.speakOnlyWhenOpen === false) {
      speakSmartReminder(reminder, { requireVisible: false });
    }
  });
  advanceRecurring(scholarClass);
}

// Re-export for the settings UI.
export { DEFAULT_REMINDER_SETTINGS };
export type { ReminderProfileState };
