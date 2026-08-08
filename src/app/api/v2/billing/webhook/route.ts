import { NextRequest, NextResponse } from "next/server";
import { getBillingProvider } from "@/lib/v2/billing/registry";
import { webhookIdempotencyKey, planEntitlementReconciliation } from "@/lib/v2/billing/webhook";
import { recordAudit } from "@/lib/subscriptions/audit";

/**
 * Billing webhook endpoint (provider-neutral).
 *
 * Guarantees enforced here (shared with the adapter layer):
 *   verified   — raw body + signature checked by the provider adapter
 *   idempotent — provider event ID becomes the idempotency key
 *   audited    — every accepted/rejected webhook is recorded
 *   replay-safe — same event ID cannot apply twice
 *   never trust client callbacks like /payment/success as proof of purchase
 *
 * With the placeholder provider there is nothing to verify, so every request
 * is rejected with BILLING_NOT_CONFIGURED and audited. This route + the
 * reconciliation hook are the wiring a real provider plugs into later.
 */
export async function POST(request: NextRequest) {
  const provider = getBillingProvider();
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  // 1. VERIFY — provider checks the signature against the exact raw body.
  const verified = await provider.verifyWebhook({ rawBody, headers });

  // 2. REJECT unverified events before any normalization is trusted.
  if (!verified) {
    await recordAudit("BILLING_WEBHOOK_REJECTED", {
      metadata: { provider: provider.name, reason: provider.name === "placeholder" ? "BILLING_NOT_CONFIGURED" : "UNVERIFIED_SIGNATURE" },
    });
    return NextResponse.json(
      {
        error: "BILLING_NOT_CONFIGURED",
        message: "Online billing is not configured for this deployment. No purchase state was changed.",
      },
      { status: 501 },
    );
  }

  // 3. IDEMPOTENCY + RECONCILE — this is the hook a real provider uses.
  const key = webhookIdempotencyKey(verified);
  const plan = planEntitlementReconciliation(verified);
  await recordAudit("BILLING_WEBHOOK_RECEIVED", {
    actorUserId: verified.userId ?? undefined,
    metadata: { idempotencyKey: key, type: verified.type, action: plan.action, provider: verified.provider },
  });

  if (!plan.shouldApply) {
    return NextResponse.json({ received: true, applied: false, reason: plan.action });
  }

  // NOTE: DB entitlement writes are intentionally not implemented until a
  // real provider is enabled. `planEntitlementReconciliation` returns the
  // intended action; apply it transactionally keyed by `key` when the
  // provider ships, with replay protection (see src/lib/v2/billing/webhook.ts).
  return NextResponse.json({ received: true, applied: false, pendingProviderIntegration: true, plan });
}
