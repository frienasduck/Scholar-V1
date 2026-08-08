import type {
  BillingProvider,
  CheckoutResult,
  CreateCheckoutInput,
  PortalInput,
  PortalResult,
  ProviderSubscription,
  RawWebhookInput,
  SubscriptionLookup,
  VerifiedBillingEvent,
} from "@/lib/v2/billing/types";

/**
 * Placeholder billing provider. No real payment provider is selected yet.
 * Every money-touching call returns BILLING_NOT_CONFIGURED — it never grants
 * Plus, never records a subscription, and never accepts a client callback as
 * proof of purchase. Webhooks are rejected unverified.
 */
export class PlaceholderBillingProvider implements BillingProvider {
  readonly name = "placeholder" as const;

  private notConfigured(): CheckoutResult {
    return {
      ok: false,
      error: {
        code: "BILLING_NOT_CONFIGURED",
        message: "Online payments are not configured yet. Scholar Plus is currently activated through the in-app payment review process.",
      },
    };
  }

  async createCheckout(_input: CreateCheckoutInput): Promise<CheckoutResult> {
    return this.notConfigured();
  }

  async createPortal(_input: PortalInput): Promise<PortalResult> {
    return { ok: false, error: { code: "BILLING_NOT_CONFIGURED", message: "Billing portal is not configured." } };
  }

  async verifyWebhook(_input: RawWebhookInput): Promise<VerifiedBillingEvent | null> {
    // There is no configured provider, so there can be no verified event.
    return null;
  }

  async getSubscription(_input: SubscriptionLookup): Promise<ProviderSubscription | null> {
    return null;
  }
}
