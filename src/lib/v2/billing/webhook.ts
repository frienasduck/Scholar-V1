import type { BillingProviderName, BillingEventType, VerifiedBillingEvent } from "@/lib/v2/billing/types";

/**
 * Webhook architecture (provider-neutral).
 *
 * Guarantees a real provider must preserve: verified (signature-checked raw
 * body), idempotent (event ID keyed), audited, replay-safe, mapped to
 * internal subscription records, then mapped to entitlements. Client
 * callbacks such as /payment/success are NEVER proof of purchase.
 *
 * These helpers are pure so the pipeline is unit-testable before a provider
 * ships. The reconciliation function is intentionally a planning stub until
 * a provider is enabled (see notes below).
 */

export function webhookIdempotencyKey(event: Pick<VerifiedBillingEvent, "provider" | "providerEventId">): string {
  return `${event.provider}:${event.providerEventId}`;
}

export function normalizeBillingEvent(
  provider: BillingProviderName,
  type: BillingEventType,
  fields: Omit<VerifiedBillingEvent, "provider" | "type" | "rawJson" | "occurredAt"> & { occurredAt?: string; rawJson?: string },
): VerifiedBillingEvent {
  return {
    provider,
    type,
    providerEventId: fields.providerEventId,
    providerCustomerId: fields.providerCustomerId,
    providerSubscriptionId: fields.providerSubscriptionId,
    productKey: fields.productKey,
    status: fields.status,
    currentPeriodEnd: fields.currentPeriodEnd,
    cancelAtPeriodEnd: fields.cancelAtPeriodEnd,
    userId: fields.userId,
    occurredAt: fields.occurredAt ?? new Date().toISOString(),
    rawJson: fields.rawJson ?? "{}",
  };
}

/** Map provider-native status to the internal subscription lifecycle. */
export function internalStatusFromProvider(status: string | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "grace";
    case "canceled":
    case "cancelled":
    case "expired":
      return "expired";
    case "paused":
      return "paused";
    default:
      return "unknown";
  }
}

/** Is this event one that should grant or refresh entitlements? */
export function grantsEntitlements(type: BillingEventType, status: string | undefined): boolean {
  if (type === "entitlement_grant" || type === "checkout_completed") return true;
  if (type === "subscription_created" || type === "subscription_updated") {
    return internalStatusFromProvider(status) === "active";
  }
  return false;
}

export type EntitlementReconciliationPlan = {
  shouldApply: boolean;
  subscriptionStatus: string;
  action: "grant" | "keep" | "revoke" | "none";
};

/**
 * Decide the entitlement action for a normalized billing event. This is the
 * hook a real provider calls after the event passes idempotency + audit.
 *
 * NOTE: DB reconciliation (writing Entitlement rows / SubscriptionRecord)
 * is intentionally NOT implemented yet — no provider is enabled, and the
 * placeholder must never grant Plus. When a provider is added, implement
 * `applyBillingEvent` against the Entitlement + subscription tables inside
 * a transaction, keyed by `webhookIdempotencyKey`, with replay protection.
 */
export function planEntitlementReconciliation(event: VerifiedBillingEvent): EntitlementReconciliationPlan {
  const status = internalStatusFromProvider(event.status);
  if (grantsEntitlements(event.type, event.status)) {
    return { shouldApply: true, subscriptionStatus: status, action: "grant" };
  }
  // Grace: don't revoke yet — keep access until the grace window closes.
  if (event.type === "subscription_updated" && status === "grace") {
    return { shouldApply: true, subscriptionStatus: status, action: "keep" };
  }
  if (event.type === "subscription_canceled" || event.type === "payment_failed") {
    return { shouldApply: true, subscriptionStatus: status, action: "revoke" };
  }
  return { shouldApply: false, subscriptionStatus: status, action: "none" };
}
