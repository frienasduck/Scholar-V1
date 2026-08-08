import type { BillingProvider, BillingProviderName } from "@/lib/v2/billing/types";
import { PlaceholderBillingProvider } from "@/lib/v2/billing/placeholder";

/**
 * Provider registry. `BILLING_PROVIDER` env selects the active adapter;
 * only "placeholder" exists today. A real adapter (e.g. Stripe) plugs in
 * here and is gated by feature flag + explicit enablement — never silently.
 */
export function configuredBillingProvider(): BillingProviderName {
  const value = process.env.BILLING_PROVIDER?.trim().toLowerCase();
  if (value === "placeholder" || value === "none" || value === "") return "placeholder";
  // Unknown values fail closed to placeholder instead of misrouting money.
  return "placeholder";
}

export function getBillingProvider(): BillingProvider {
  switch (configuredBillingProvider()) {
    case "placeholder":
    default:
      return new PlaceholderBillingProvider();
  }
}
