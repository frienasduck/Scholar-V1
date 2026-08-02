import "server-only";
import { randomBytes, randomUUID } from "node:crypto";

export function newPaymentIdentity() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return { id: randomUUID(), publicReference: `SCH-${stamp}-${suffix}`, idempotencyKey: randomUUID() };
}

export function safePaymentRequest<T extends {
  publicReference: string; status: string; expectedAmountPaise: number; currency: string;
  createdAt: Date; proofSubmittedAt: Date | null; reviewedAt: Date | null; reviewNote: string | null;
}>(request: T) {
  return {
    publicReference: request.publicReference,
    status: request.status,
    expectedAmountInr: request.expectedAmountPaise / 100,
    currency: request.currency,
    createdAt: request.createdAt.toISOString(),
    proofSubmittedAt: request.proofSubmittedAt?.toISOString() ?? null,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    reviewNote: request.reviewNote,
  };
}
