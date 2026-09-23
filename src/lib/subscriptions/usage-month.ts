/** Calendar-month key in the account's configured IANA timezone. */
export function usageMonth(timezone = "Asia/Kolkata", now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}`;
  } catch {
    return now.toISOString().slice(0, 7);
  }
}
