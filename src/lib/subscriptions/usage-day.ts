/**
 * Daily boundary for generation usage counters. A single "day" is derived in
 * the user's timezone so counters roll over consistently at their local
 * midnight, regardless of server timezone. Pure module (no server-only import)
 * so it can be unit-tested directly.
 */
export function usageDay(timezone = "Asia/Kolkata", now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
