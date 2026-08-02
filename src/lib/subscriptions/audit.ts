import "server-only";
import { createHash } from "node:crypto";
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
export async function recordAudit(eventType: string, input: AuditInput = {}) {
  try {
    const requestHeaders = await headers();
    const rawIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(`${process.env.AUDIT_LOG_SALT || "scholar"}:${rawIp}`).digest("hex").slice(0, 24);
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
    console.error("[Scholar audit] Failed to record event", eventType, error instanceof Error ? error.message : "unknown");
  }
}
