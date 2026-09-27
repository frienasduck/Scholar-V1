"use client";

/**
 * Notification material helpers.
 *
 * Scholar notifications are one glass card with a status tint — the status
 * colour reaches the status icon, a hairline edge tint and a faint material
 * wash. It never turns the whole notification into a saturated colour block.
 *
 * The visual material itself lives in `scholar-notifications.css`, which is now
 * driven by the shared `--sg-*` tokens.
 */

export type GlassNotificationTone = "info" | "success" | "warning" | "error" | "loading";

/** Accent colour per tone, exposed as a CSS value so CSS owns the presentation. */
export const GLASS_NOTIFICATION_TONE_COLOR: Record<GlassNotificationTone, string> = {
  info: "var(--sg-tone-info, #60a5fa)",
  success: "var(--sg-tone-success, #34d399)",
  warning: "var(--sg-tone-warning, #fbbf24)",
  error: "var(--sg-tone-error, #fb7185)",
  loading: "var(--sg-tone-loading, #a78bfa)",
};

/** Material family used by every notification surface. */
export const GLASS_NOTIFICATION_MATERIAL = "notification" as const;

export function glassNotificationVars(tone: GlassNotificationTone): Record<string, string> {
  return {
    "--sg-tone": GLASS_NOTIFICATION_TONE_COLOR[tone],
    "--sg-tone-alpha": tone === "error" ? "0.2" : "0.14",
  };
}
