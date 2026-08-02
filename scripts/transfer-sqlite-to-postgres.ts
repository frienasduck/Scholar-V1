import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { PrismaClient, UserRole } from "@prisma/client";
import { normalizeEmail } from "../src/lib/auth/identity";

loadEnvConfig(process.cwd());

const legacyPath = resolve(process.env.LEGACY_SQLITE_PATH || "prisma/dev.db");
const targetUrl = process.env.DB_DATABASE_URL || "";

if (!existsSync(legacyPath)) throw new Error("The legacy SQLite database was not found. Set LEGACY_SQLITE_PATH to its absolute path.");
if (!targetUrl.startsWith("postgresql://") && !targetUrl.startsWith("postgres://")) {
  throw new Error("DB_DATABASE_URL must point to the target PostgreSQL database. The transfer refuses SQLite targets.");
}

type LegacyRow = Record<string, unknown>;
const sqlite = new Database(legacyPath, { readonly: true });
const prisma = new PrismaClient();

function rows(table: string): LegacyRow[] {
  return sqlite.query(`SELECT * FROM "${table}"`).all() as LegacyRow[];
}

function date(value: unknown): Date {
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error("Legacy data contains an invalid date.");
  return parsed;
}

function optionalDate(value: unknown): Date | null {
  return value === null || value === undefined ? null : date(value);
}

function text(value: unknown): string {
  return String(value);
}

function requiredText(value: unknown, field: string): string {
  if (value === null || value === undefined || value === "") throw new Error(`Legacy data is missing required ${field}.`);
  return String(value);
}

function optionalText(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function integer(value: unknown): number {
  return Number(value);
}

function boolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

async function createMany<T>(records: T[], write: (data: T[]) => Promise<{ count: number }>) {
  if (records.length === 0) return 0;
  return (await write(records)).count;
}

async function main() {
  const legacyUsers = rows("User");
  const normalizedEmails = legacyUsers.map((user) => normalizeEmail(text(user.email)));
  if (new Set(normalizedEmails).size !== normalizedEmails.length) {
    throw new Error("Legacy users contain duplicate emails after normalization. Resolve them before transferring data.");
  }

  const counts: Record<string, number> = {};
  counts.users = await createMany(
    legacyUsers.map((user) => ({
      id: text(user.id),
      email: normalizeEmail(text(user.email)),
      name: optionalText(user.name),
      passwordHash: requiredText(user.passwordHash, "password hashes"),
      role: String(user.role).toUpperCase() === "ADMIN" ? UserRole.ADMIN : UserRole.USER,
      sessionVersion: integer(user.sessionVersion),
      timezone: text(user.timezone),
      coins: integer(user.coins),
      plusBonusGrantedAt: optionalDate(user.plusBonusGrantedAt),
      currentScholarClass: integer(user.currentScholarClass),
      createdAt: date(user.createdAt),
      updatedAt: date(user.updatedAt),
    })),
    (data) => prisma.user.createMany({ data, skipDuplicates: true }),
  );

  counts.posts = await createMany(
    rows("Post").map((row) => ({
      id: text(row.id), title: text(row.title), content: optionalText(row.content), published: boolean(row.published),
      authorId: text(row.authorId), createdAt: date(row.createdAt), updatedAt: date(row.updatedAt),
    })),
    (data) => prisma.post.createMany({ data, skipDuplicates: true }),
  );

  counts.paymentRequests = await createMany(
    rows("ScholarPaymentRequest").map((row) => ({
      id: text(row.id), publicReference: text(row.publicReference), userId: text(row.userId), planId: text(row.planId),
      currency: text(row.currency), expectedAmountPaise: integer(row.expectedAmountPaise), regularAmountPaise: integer(row.regularAmountPaise),
      offerApplied: boolean(row.offerApplied), status: text(row.status), payerName: optionalText(row.payerName),
      transactionReference: optionalText(row.transactionReference), proofData: row.proofData == null ? null : Buffer.from(row.proofData as Uint8Array),
      proofMimeType: optionalText(row.proofMimeType), proofFileName: optionalText(row.proofFileName), createdAt: date(row.createdAt),
      checkoutOpenedAt: optionalDate(row.checkoutOpenedAt), proofSubmittedAt: optionalDate(row.proofSubmittedAt), reviewedAt: optionalDate(row.reviewedAt),
      reviewedByUserId: optionalText(row.reviewedByUserId), reviewNote: optionalText(row.reviewNote), internalAdminNote: optionalText(row.internalAdminNote),
      approvedSubscriptionId: optionalText(row.approvedSubscriptionId), expiresAt: optionalDate(row.expiresAt),
      emailNotificationStatus: optionalText(row.emailNotificationStatus), checkoutEmailSentAt: optionalDate(row.checkoutEmailSentAt),
      proofEmailSentAt: optionalDate(row.proofEmailSentAt), idempotencyKey: text(row.idempotencyKey), updatedAt: date(row.updatedAt),
    })),
    (data) => prisma.scholarPaymentRequest.createMany({ data, skipDuplicates: true }),
  );

  counts.subscriptions = await createMany(
    rows("ScholarSubscription").map((row) => ({
      id: text(row.id), userId: text(row.userId), planId: text(row.planId), status: text(row.status), source: text(row.source),
      paymentRequestId: optionalText(row.paymentRequestId), startedAt: date(row.startedAt), endsAt: optionalDate(row.endsAt),
      createdAt: date(row.createdAt), updatedAt: date(row.updatedAt), approvedByUserId: optionalText(row.approvedByUserId),
    })),
    (data) => prisma.scholarSubscription.createMany({ data, skipDuplicates: true }),
  );

  counts.usageCounters = await createMany(
    rows("UsageCounter").map((row) => ({ id: text(row.id), userId: text(row.userId), key: text(row.key), day: text(row.day), count: integer(row.count), updatedAt: date(row.updatedAt) })),
    (data) => prisma.usageCounter.createMany({ data, skipDuplicates: true }),
  );
  counts.storedFiles = await createMany(
    rows("StoredFile").map((row) => ({ id: text(row.id), clientId: text(row.clientId), userId: text(row.userId), name: text(row.name), mimeType: text(row.mimeType), sizeBytes: integer(row.sizeBytes), deletedAt: optionalDate(row.deletedAt), createdAt: date(row.createdAt) })),
    (data) => prisma.storedFile.createMany({ data, skipDuplicates: true }),
  );
  counts.coinLedger = await createMany(
    rows("CoinLedger").map((row) => ({ id: text(row.id), userId: text(row.userId), subscriptionId: optionalText(row.subscriptionId), type: text(row.type), amount: integer(row.amount), createdAt: date(row.createdAt) })),
    (data) => prisma.coinLedger.createMany({ data, skipDuplicates: true }),
  );
  counts.auditEvents = await createMany(
    rows("AuditEvent").map((row) => ({ id: text(row.id), eventType: text(row.eventType), actorUserId: optionalText(row.actorUserId), targetUserId: optionalText(row.targetUserId), paymentRequestId: optionalText(row.paymentRequestId), subscriptionId: optionalText(row.subscriptionId), metadataJson: optionalText(row.metadataJson), ipHash: optionalText(row.ipHash), userAgentSummary: optionalText(row.userAgentSummary), createdAt: date(row.createdAt) })),
    (data) => prisma.auditEvent.createMany({ data, skipDuplicates: true }),
  );

  console.log("SQLite to PostgreSQL transfer completed.");
  for (const [table, count] of Object.entries(counts)) console.log(`${table}: ${count}`);
  console.log("Legacy sessions were intentionally not transferred; users must sign in again.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "SQLite transfer failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await prisma.$disconnect();
  });
