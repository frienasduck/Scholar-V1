import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { currentPlusPriceInr, subscriptionConfig } from "@/lib/subscriptions/config";
import { newPaymentIdentity, safePaymentRequest } from "@/lib/subscriptions/payment";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { paymentAdminEmail, sendScholarEmail } from "@/lib/subscriptions/email";
import { recordAudit } from "@/lib/subscriptions/audit";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const request = await db.scholarPaymentRequest.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ request: request ? safePaymentRequest(request) : null });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!subscriptionConfig.enabled) return NextResponse.json({ error: "SUBSCRIPTIONS_DISABLED", message: "All Scholar features are currently unlocked." }, { status: 409 });
  if (!subscriptionConfig.upiQrAsset || !(subscriptionConfig.upiId || subscriptionConfig.upiPhone) || !subscriptionConfig.paymentRecipient) {
    return NextResponse.json({ error: "CHECKOUT_NOT_CONFIGURED", message: "Scholar Plus checkout is not configured yet." }, { status: 503 });
  }
  try {
    const active = await db.scholarSubscription.findFirst({ where: { userId: user.id, status: "active", OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] } });
    if (active) return NextResponse.json({ error: "ALREADY_PLUS", message: "Scholar Plus is already active." }, { status: 409 });
    let payment = await db.scholarPaymentRequest.findFirst({
      where: { userId: user.id, status: { in: ["created", "submitted", "more_information_required"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!payment) {
      await enforceRateLimit(user.id, "payment-request", 4, 60 * 60 * 1000);
      const identity = newPaymentIdentity();
      payment = await db.scholarPaymentRequest.create({ data: {
        ...identity,
        userId: user.id,
        expectedAmountPaise: currentPlusPriceInr() * 100,
        regularAmountPaise: subscriptionConfig.regularPriceInr * 100,
        offerApplied: currentPlusPriceInr() === subscriptionConfig.offerPriceInr,
        checkoutOpenedAt: new Date(),
      } });
    }
    let emailStatus = payment.emailNotificationStatus;
    const cooldownElapsed = !payment.checkoutEmailSentAt || Date.now() - payment.checkoutEmailSentAt.getTime() > 60 * 60 * 1000;
    if (subscriptionConfig.adminPaymentEmail && cooldownElapsed) {
      const reviewUrl = new URL(`/admin/subscriptions/payment-requests/${payment.id}`, request.nextUrl.origin).toString();
      const result = await sendScholarEmail({
        to: subscriptionConfig.adminPaymentEmail,
        subject: "Scholar Plus checkout opened",
        idempotencyKey: `checkout-${payment.id}`,
        html: paymentAdminEmail({ title: "Scholar Plus checkout opened", userName: user.name || "Scholar user", userEmail: user.email, userId: user.id, requestId: payment.publicReference, amountInr: payment.expectedAmountPaise / 100, reviewUrl }),
      });
      emailStatus = result.sent ? "sent" : result.reason;
      payment = await db.scholarPaymentRequest.update({ where: { id: payment.id }, data: { checkoutEmailSentAt: result.sent ? new Date() : undefined, emailNotificationStatus: emailStatus } });
    }
    await recordAudit("CHECKOUT_OPENED", { actorUserId: user.id, targetUserId: user.id, paymentRequestId: payment.id });
    return NextResponse.json({
      ok: true,
      request: safePaymentRequest(payment),
      payment: { qrAsset: subscriptionConfig.upiQrAsset, upiId: subscriptionConfig.upiId, phone: subscriptionConfig.upiPhone, recipient: subscriptionConfig.paymentRecipient, regularPriceInr: subscriptionConfig.regularPriceInr, offerLabel: subscriptionConfig.offerLabel },
      notice: emailStatus && emailStatus !== "sent" ? "Your request was saved, but the administrator email could not be sent." : null,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    return NextResponse.json({ error: "Scholar could not open checkout. Please retry." }, { status: 500 });
  }
}
