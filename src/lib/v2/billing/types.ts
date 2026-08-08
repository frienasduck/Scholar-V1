/**
 * Provider-neutral billing boundary. Scholar keeps billing providers at arm's
 * length: providers report commercial state; the entitlement layer decides
 * capabilities. No real provider is wired yet — `PlaceholderBillingProvider`
 * returns BILLING_NOT_CONFIGURED and never grants Plus.
 */

export type BillingProviderName = "placeholder" | "stripe" | "revenuecat" | "lemon_squeezy";

export interface CreateCheckoutInput {
  userId: string;
  email: string;
  productKey: string;
  /** Internal reference so provider callbacks can be reconciled. */
  externalReference: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CheckoutResult {
  ok: boolean;
  checkoutUrl?: string;
  providerCheckoutId?: string;
  error?: BillingNotConfiguredError | { code: string; message: string };
}

export interface PortalInput {
  userId: string;
  providerCustomerId: string;
  returnUrl?: string;
}

export interface PortalResult {
  ok: boolean;
  portalUrl?: string;
  error?: BillingNotConfiguredError | { code: string; message: string };
}

export interface SubscriptionLookup {
  userId: string;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
}

export interface ProviderSubscription {
  providerSubscriptionId: string;
  productKey: string;
  status: string; // provider-native status, e.g. "active" | "past_due" | "canceled"
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

export type BillingEventType = "checkout_completed" | "subscription_created" | "subscription_updated" | "subscription_canceled" | "subscription_paused" | "payment_failed" | "entitlement_grant" | "unknown";

/** Verified, normalized billing event — the only shape the rest of Scholar consumes. */
export interface VerifiedBillingEvent {
  provider: BillingProviderName;
  type: BillingEventType;
  /** Provider's event ID; used for idempotency. */
  providerEventId: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  productKey?: string;
  status?: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  userId?: string;
  occurredAt: string;
  /** Raw payload is stored only for audit/debug, never parsed as truth. */
  rawJson: string;
}

export type BillingNotConfiguredError = {
  code: "BILLING_NOT_CONFIGURED";
  message: string;
};

export interface BillingProvider {
  readonly name: BillingProviderName;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  createPortal(input: PortalInput): Promise<PortalResult>;
  /** Verify a raw webhook payload. Must preserve the exact raw body for signature checks. */
  verifyWebhook(input: RawWebhookInput): Promise<VerifiedBillingEvent | null>;
  getSubscription(input: SubscriptionLookup): Promise<ProviderSubscription | null>;
}

export interface RawWebhookInput {
  /** Exact request body string — signature verification requires the raw bytes. */
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
}
