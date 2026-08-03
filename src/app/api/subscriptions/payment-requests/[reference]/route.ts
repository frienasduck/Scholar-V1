import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { safePaymentRequest } from "@/lib/subscriptions/payment";
import { subscriptionConfig } from "@/lib/subscriptions/config";
import { paymentProofAdminEmail, sendScholarEmail } from "@/lib/subscriptions/email";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { recordAudit } from "@/lib/subscriptions/audit";
import { UserRole } from "@prisma/client";

const proofSchema = z.object({
  payerName: z.string().trim().min(2, "Enter the exact payer name shown in the UPI transaction.").max(100),
  transactionReference: z.string().trim().min(4, "Enter the UPI transaction reference (UTR).").max(100).regex(/^[A-Za-z0-9]+[A-Za-z0-9._:-]*$/, "The UTR can only contain letters, numbers, dots, dashes, underscores, or colons."),
});
const proofTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

export async function GET(_: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { reference } = await context.params;
  const payment = await db.scholarPaymentRequest.findFirst({ where: user.role === UserRole.ADMIN ? { publicReference: reference } : { publicReference: reference, userId: user.id } });
  if (!payment) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ request: safePaymentRequest(payment) });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    await enforceRateLimit(user.id, "payment-proof", 6, 60 * 60 * 1000);
    const { reference } = await context.params;
    const payment = await db.scholarPaymentRequest.findFirst({ where: { publicReference: reference, userId: user.id } });
    if (!payment) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (!new Set(["created", "more_information_required", "submitted"]).has(payment.status)) return NextResponse.json({ error: "REQUEST_NOT_EDITABLE" }, { status: 409 });
    const form = await request.formData();
    const parsed = proofSchema.safeParse({ payerName: form.get("payerName"), transactionReference: form.get("transactionReference") });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Enter the payer name and a valid transaction reference." }, { status: 400 });
    const proof = form.get("proof");
    let proofData: Uint8Array<ArrayBuffer> | undefined;
    let proofMimeType: string | undefined;
    let proofFileName: string | undefined;
    if (proof instanceof File && proof.size > 0) {
      if (proof.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Payment proof must be 5 MB or smaller." }, { status: 413 });
      if (!proofTypes.has(proof.type)) return NextResponse.json({ error: "Use a PNG, JPEG, WebP, or PDF proof file." }, { status: 415 });
      const proofBuffer = await proof.arrayBuffer();
      proofData = new Uint8Array(proofBuffer);
      proofMimeType = proof.type;
      proofFileName = proof.name.slice(0, 160);
    }
    let updated;
    try {
      updated = await db.scholarPaymentRequest.update({ where: { id: payment.id }, data: {
        status: "submitted",
        payerName: parsed.data.payerName,
        transactionReference: parsed.data.transactionReference,
        proofData,
        proofMimeType,
        proofFileName,
        proofSubmittedAt: new Date(),
        reviewNote: null,
      } });
    } catch {
      return NextResponse.json({ error: "That transaction reference is already linked to another request." }, { status: 409 });
    }
    let emailNotice: string | null = null;
    if (subscriptionConfig.adminPaymentEmail && !payment.proofEmailSentAt) {
      const reviewUrl = new URL(`/admin/subscriptions/payment-requests/${payment.id}`, request.nextUrl.origin).toString();
      try {
        const result = await sendScholarEmail({
          to: subscriptionConfig.adminPaymentEmail,
          subject: "Scholar Plus payment submitted for review",
          idempotencyKey: `proof-${payment.id}-${updated.proofSubmittedAt?.getTime() ?? Date.now()}`,
          html: paymentProofAdminEmail({
            title: "Scholar Plus payment submitted for review",
            userName: user.name || "Scholar user",
            userEmail: user.email,
            requestId: payment.publicReference,
            amountInr: payment.expectedAmountPaise / 100,
            payerName: parsed.data.payerName,
            transactionReference: parsed.data.transactionReference,
            submittedAt: updated.proofSubmittedAt ?? new Date(),
            proofUploaded: Boolean(proofData && proofData.length > 0),
            reviewUrl,
          }),
        });
        await db.scholarPaymentRequest.update({
          where: { id: payment.id },
          data: result.sent
            ? { proofEmailSentAt: new Date(), emailNotificationStatus: "sent" }
            : { emailNotificationStatus: result.reason },
        });
        if (!result.sent) {
          emailNotice = "Payment saved, but the administrator notification could not be sent. An administrator will still review your payment.";
        }
      } catch (error) {
        console.error("[Scholar] Admin payment notification failed for", payment.publicReference, error);
        await db.scholarPaymentRequest.update({
          where: { id: payment.id },
          data: { emailNotificationStatus: "EMAIL_PROVIDER_UNAVAILABLE" },
        }).catch(() => undefined);
        emailNotice = "Payment saved, but the administrator notification could not be sent. An administrator will still review your payment.";
      }
    }
    await recordAudit("PAYMENT_PROOF_SUBMITTED", { actorUserId: user.id, targetUserId: user.id, paymentRequestId: payment.id });
    return NextResponse.json({ ok: true, request: safePaymentRequest(updated), notice: emailNotice });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    return NextResponse.json({ error: "Payment proof could not be submitted. Please retry." }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { reference } = await context.params;
  const payment = await db.scholarPaymentRequest.findFirst({ where: { publicReference: reference, userId: user.id } });
  if (!payment) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!new Set(["created", "more_information_required"]).has(payment.status)) {
    return NextResponse.json({ error: "A submitted payment must be reviewed rather than cancelled." }, { status: 409 });
  }
  await db.scholarPaymentRequest.update({ where: { id: payment.id }, data: { status: "cancelled" } });
  await recordAudit("PAYMENT_REQUEST_CANCELLED", { actorUserId: user.id, targetUserId: user.id, paymentRequestId: payment.id });
  return NextResponse.json({ ok: true });
}
