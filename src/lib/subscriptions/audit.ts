import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";

type AuditInput = {
  actorUserId?: string | null;
  targetUserId?: string | null;
  paymentRequestId?: string | null;
  subscriptionId?: string | null;
  metadata?: Record<string, unknown>;
};

function safeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return undefined;
  const blocked = /password|secret|token|proof|screenshot|api.?key/i;
  return JSON.stringify(Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.test(key)))).slice(0, 4000);
}

function auditHashSecret(): string | null {
  const configured = process.env.AUDIT_LOG_SALT || process.env.AUTH_SESSION_SECRET || process.env.DEV_MODE_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV !== "production") return "scholar-local-audit-pseudonym-key-only";
  return null;
}

export async function recordAudit(eventType: string, input: AuditInput = {}) {
  try {
    const requestHeaders = await headers();
    const rawIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const hashSecret = auditHashSecret();
    // A predictable fallback salt lets known IP addresses be recovered by
    // dictionary attack. If production has no strong server secret, omit the
    // pseudonym instead of recording weakly protected network metadata.
    const ipHash = hashSecret && rawIp !== "unknown"
      ? createHmac("sha256", hashSecret).update(rawIp).digest("hex").slice(0, 24)
      : undefined;
    const userAgentSummary = (requestHeaders.get("user-agent") || "unknown").slice(0, 240);
    await db.auditEvent.create({ data: {
      eventType,
      actorUserId: input.actorUserId || undefined,
      targetUserId: input.targetUserId || undefined,
      paymentRequestId: input.paymentRequestId || undefined,
      subscriptionId: input.subscriptionId || undefined,
      metadataJson: safeMetadata(input.metadata),
      ipHash,
      userAgentSummary,
    } });
  } catch (error) {
    console.error("[Scholar audit] Failed to record event", eventType, error instanceof Error ? error.name : "unknown");
  }
}
