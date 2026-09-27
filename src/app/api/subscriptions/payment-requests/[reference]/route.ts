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
import sharp from "sharp";
import { isUniqueConstraintError } from "@/lib/auth/errors";

const proofSchema = z.object({
  payerName: z.string().trim().min(2, "Enter the exact payer name shown in the UPI transaction.").max(100),
  transactionReference: z.string().trim().min(4, "Enter the UPI transaction reference (UTR).").max(100).regex(/^[A-Za-z0-9]+[A-Za-z0-9._:-]*$/, "The UTR can only contain letters, numbers, dots, dashes, underscores, or colons."),
});
const proofTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
class PaymentStateError extends Error {}

async function sanitizeProof(file: File): Promise<{ data: Uint8Array<ArrayBuffer>; mimeType: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const prefix = Buffer.from(bytes.subarray(0, 12));
  if (file.type === "application/pdf") {
    if (prefix.subarray(0, 5).toString() !== "%PDF-") throw new Error("INVALID_PROOF_FILE");
    return { data: bytes, mimeType: "application/pdf" };
  }

  const png = prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255;
  const webp = prefix.subarray(0, 4).toString() === "RIFF" && prefix.subarray(8, 12).toString() === "WEBP";
  const expected = file.type === "image/png" ? png : file.type === "image/jpeg" ? jpeg : file.type === "image/webp" ? webp : false;
  if (!expected) throw new Error("INVALID_PROOF_FILE");

  const image = sharp(bytes, { failOn: "error", limitInputPixels: 20_000_000 }).rotate();
  const sanitized = file.type === "image/png"
    ? await image.png().toBuffer()
    : file.type === "image/webp"
      ? await image.webp().toBuffer()
      : await image.jpeg().toBuffer();
  if (sanitized.byteLength > MAX_PROOF_BYTES) throw new Error("PROOF_TOO_LARGE");
  return { data: new Uint8Array(sanitized), mimeType: file.type };
}

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
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_PROOF_BYTES + 128 * 1024) {
      return NextResponse.json({ error: "Payment proof must be 5 MB or smaller." }, { status: 413 });
    }
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
      if (proof.size > MAX_PROOF_BYTES) return NextResponse.json({ error: "Payment proof must be 5 MB or smaller." }, { status: 413 });
      if (!proofTypes.has(proof.type)) return NextResponse.json({ error: "Use a PNG, JPEG, WebP, or PDF proof file." }, { status: 415 });
      try {
        const sanitized = await sanitizeProof(proof);
        proofData = sanitized.data;
        proofMimeType = sanitized.mimeType;
      } catch (error) {
        const tooLarge = error instanceof Error && error.message === "PROOF_TOO_LARGE";
        return NextResponse.json(
          { error: tooLarge ? "Payment proof must be 5 MB or smaller." : "The payment proof does not match its declared file type." },
          { status: tooLarge ? 413 : 415 },
        );
      }
      proofFileName = proof.name.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "payment-proof";
    }
    let updated;
    try {
      updated = await db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "ScholarPaymentRequest" WHERE "id" = ${payment.id} FOR UPDATE
        `;
        if (!locked[0]) throw new PaymentStateError("This payment request is no longer available.");
        const current = await tx.scholarPaymentRequest.findFirst({ where: { id: payment.id, userId: user.id } });
        if (!current) throw new PaymentStateError("This payment request is no longer available.");
        if (!new Set(["created", "more_information_required", "submitted"]).has(current.status)) {
          throw new PaymentStateError("This payment request has already been finalized.");
        }
        return tx.scholarPaymentRequest.update({ where: { id: current.id }, data: {
          status: "submitted",
          payerName: parsed.data.payerName,
          transactionReference: parsed.data.transactionReference,
          proofData,
          proofMimeType,
          proofFileName,
          proofSubmittedAt: new Date(),
          reviewNote: null,
        } });
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return NextResponse.json({ error: "That transaction reference is already linked to another request." }, { status: 409 });
      }
      throw error;
    }
    let emailNotice: string | null = null;
    if (subscriptionConfig.adminPaymentEmail && !updated.proofEmailSentAt) {
      const reviewUrl = new URL(`/admin/subscriptions/payment-requests/${updated.id}`, request.nextUrl.origin).toString();
      try {
        const result = await sendScholarEmail({
          to: subscriptionConfig.adminPaymentEmail,
          subject: "Scholar Plus payment submitted for review",
          idempotencyKey: `proof-${updated.id}-${updated.proofSubmittedAt?.getTime() ?? Date.now()}`,
          html: paymentProofAdminEmail({
            title: "Scholar Plus payment submitted for review",
            userName: user.name || "Scholar user",
            userEmail: user.email,
            requestId: updated.publicReference,
            amountInr: updated.expectedAmountPaise / 100,
            payerName: parsed.data.payerName,
            transactionReference: parsed.data.transactionReference,
            submittedAt: updated.proofSubmittedAt ?? new Date(),
            proofUploaded: Boolean(proofData && proofData.length > 0),
            reviewUrl,
          }),
        });
        await db.scholarPaymentRequest.update({
          where: { id: updated.id },
          data: result.sent
            ? { proofEmailSentAt: new Date(), emailNotificationStatus: "sent" }
            : { emailNotificationStatus: result.reason },
        });
        if (!result.sent) {
          emailNotice = "Payment saved, but the administrator notification could not be sent. An administrator will still review your payment.";
        }
      } catch (error) {
        console.error(
          "[Scholar] Admin payment notification failed",
          error instanceof Error ? error.name : "unknown",
        );
        await db.scholarPaymentRequest.update({
          where: { id: updated.id },
          data: { emailNotificationStatus: "EMAIL_PROVIDER_UNAVAILABLE" },
        }).catch(() => undefined);
        emailNotice = "Payment saved, but the administrator notification could not be sent. An administrator will still review your payment.";
      }
    }
    await recordAudit("PAYMENT_PROOF_SUBMITTED", { actorUserId: user.id, targetUserId: user.id, paymentRequestId: updated.id });
    return NextResponse.json({ ok: true, request: safePaymentRequest(updated), notice: emailNotice });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    if (error instanceof PaymentStateError) return NextResponse.json({ error: error.message }, { status: 409 });
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
  const cancelled = await db.scholarPaymentRequest.updateMany({
    where: { id: payment.id, userId: user.id, status: { in: ["created", "more_information_required"] } },
    data: { status: "cancelled" },
  });
  if (cancelled.count !== 1) {
    return NextResponse.json({ error: "This payment request has already been finalized." }, { status: 409 });
  }
  await recordAudit("PAYMENT_REQUEST_CANCELLED", { actorUserId: user.id, targetUserId: user.id, paymentRequestId: payment.id });
  return NextResponse.json({ ok: true });
}
