import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminUser, UnauthorizedAdminAccessError } from "@/lib/auth/admin";
import { subscriptionConfig } from "@/lib/subscriptions/config";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { sendScholarEmail } from "@/lib/subscriptions/email";
import { recordAudit } from "@/lib/subscriptions/audit";

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "request_information"]),
  reason: z.string().trim().max(1000).optional(),
  internalNote: z.string().trim().max(2000).optional(),
  durationDays: z.number().int().positive().max(3650).nullable().optional(),
}).superRefine((value, context) => {
  if (value.action !== "approve" && !value.reason) context.addIssue({ code: "custom", message: "A reason is required.", path: ["reason"] });
});

async function authenticatedAdmin() {
  try {
    return await requireAdminUser();
  } catch (error) {
    if (error instanceof UnauthorizedAdminAccessError) return null;
    throw error;
  }
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await authenticatedAdmin();
  if (!actor) return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  const { id } = await context.params;
  const payment = await db.scholarPaymentRequest.findUnique({ where: { id }, include: {
    user: { select: { id: true, name: true, email: true, coins: true } },
    subscription: true,
  } });
  if (!payment) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const previous = await db.scholarPaymentRequest.findMany({
    where: { userId: payment.userId, NOT: { id: payment.id } },
    select: { publicReference: true, status: true, expectedAmountPaise: true, createdAt: true, reviewedAt: true },
    orderBy: { createdAt: "desc" }, take: 10,
  });
  await recordAudit("ADMIN_VIEWED_PAYMENT_REQUEST", { actorUserId: actor.id, targetUserId: payment.userId, paymentRequestId: payment.id });
  return NextResponse.json({ payment: {
    id: payment.id,
    publicReference: payment.publicReference,
    status: payment.status,
    expectedAmountInr: payment.expectedAmountPaise / 100,
    currency: payment.currency,
    payerName: payment.payerName,
    transactionReference: payment.transactionReference,
    hasProof: Boolean(payment.proofData),
    proofMimeType: payment.proofMimeType,
    createdAt: payment.createdAt,
    proofSubmittedAt: payment.proofSubmittedAt,
    reviewedAt: payment.reviewedAt,
    reviewNote: payment.reviewNote,
    internalAdminNote: payment.internalAdminNote,
    user: payment.user,
    subscription: payment.subscription,
    previous,
  } });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await authenticatedAdmin();
  if (!actor) return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  try {
    await enforceRateLimit(actor.id, "admin-payment-action", 20, 15 * 60 * 1000);
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid action." }, { status: 400 });
    const { id } = await context.params;
    const existing = await db.scholarPaymentRequest.findUnique({ where: { id }, include: { user: true, subscription: true } });
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    if (parsed.data.action === "approve") {
      if (!new Set(["submitted", "approved"]).has(existing.status)) return NextResponse.json({ error: "Payment proof must be submitted before approval." }, { status: 409 });
      const durationDays = parsed.data.durationDays ?? subscriptionConfig.durationDays;
      const endsAt = durationDays ? new Date(Date.now() + durationDays * 86_400_000) : null;
      const result = await db.$transaction(async (tx) => {
        const current = await tx.scholarPaymentRequest.findUnique({ where: { id }, include: { subscription: true } });
        if (!current) throw new Error("NOT_FOUND");
        let subscription = current.subscription;
        if (!subscription) {
          subscription = await tx.scholarSubscription.create({ data: {
            userId: current.userId,
            status: "active",
            source: "manual_upi",
            paymentRequestId: current.id,
            approvedByUserId: actor.id,
            endsAt,
          } });
        } else if (subscription.status !== "active") {
          subscription = await tx.scholarSubscription.update({ where: { id: subscription.id }, data: { status: "active", approvedByUserId: actor.id, endsAt } });
        }
        await tx.scholarPaymentRequest.update({ where: { id }, data: { status: "approved", reviewedAt: new Date(), reviewedByUserId: actor.id, reviewNote: null, internalAdminNote: parsed.data.internalNote, approvedSubscriptionId: subscription.id } });
        const bonus = await tx.coinLedger.findUnique({ where: { userId_type: { userId: current.userId, type: "scholar_plus_activation_bonus" } } });
        if (!bonus) {
          await tx.coinLedger.create({ data: { userId: current.userId, subscriptionId: subscription.id, type: "scholar_plus_activation_bonus", amount: 5000 } });
          await tx.user.update({ where: { id: current.userId }, data: { coins: { increment: 5000 }, plusBonusGrantedAt: new Date() } });
        }
        await tx.auditEvent.createMany({ data: [
          { eventType: "PAYMENT_APPROVED", actorUserId: actor.id, targetUserId: current.userId, paymentRequestId: current.id, subscriptionId: subscription.id },
          { eventType: "SUBSCRIPTION_CREATED", actorUserId: actor.id, targetUserId: current.userId, paymentRequestId: current.id, subscriptionId: subscription.id },
          ...(bonus ? [] : [{ eventType: "COIN_BONUS_GRANTED", actorUserId: actor.id, targetUserId: current.userId, paymentRequestId: current.id, subscriptionId: subscription.id, metadataJson: JSON.stringify({ amount: 5000 }) }]),
        ] });
        return { subscription, bonusGranted: !bonus };
      });
      await sendScholarEmail({
        to: existing.user.email,
        subject: "Scholar Plus activated",
        idempotencyKey: `plus-active-${existing.id}`,
        html: `<div style="font-family:system-ui,sans-serif"><h1>Scholar Plus activated</h1><p>Advanced tools, expanded storage${result.bonusGranted ? ", and 5,000 bonus Coins" : ""} are now available.</p></div>`,
      });
      return NextResponse.json({ ok: true, status: "approved", subscriptionId: result.subscription.id, bonusGranted: result.bonusGranted });
    }

    const status = parsed.data.action === "reject" ? "rejected" : "more_information_required";
    await db.scholarPaymentRequest.update({ where: { id }, data: {
      status,
      reviewedAt: new Date(),
      reviewedByUserId: actor.id,
      reviewNote: parsed.data.reason,
      internalAdminNote: parsed.data.internalNote,
    } });
    await recordAudit(parsed.data.action === "reject" ? "PAYMENT_REJECTED" : "PAYMENT_INFORMATION_REQUESTED", { actorUserId: actor.id, targetUserId: existing.userId, paymentRequestId: id });
    await sendScholarEmail({
      to: existing.user.email,
      subject: parsed.data.action === "reject" ? "Scholar Plus payment review update" : "More payment information is needed",
      idempotencyKey: `${status}-${existing.id}-${Date.now()}`,
      html: `<div style="font-family:system-ui,sans-serif"><h1>${parsed.data.action === "reject" ? "Payment verification was not completed" : "More information is needed"}</h1><p>${parsed.data.reason}</p></div>`,
    });
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    return NextResponse.json({ error: "The payment action could not be completed." }, { status: 500 });
  }
}
