-- PostgreSQL production baseline. The former SQLite migrations remain available
-- in Git history; they cannot be deployed safely to PostgreSQL.
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "plusBonusGrantedAt" TIMESTAMP(3),
    "currentScholarClass" INTEGER NOT NULL DEFAULT 11,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScholarSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL DEFAULT 'scholar_plus',
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL,
    "paymentRequestId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedByUserId" TEXT,
    CONSTRAINT "ScholarSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScholarPaymentRequest" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL DEFAULT 'scholar_plus',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "expectedAmountPaise" INTEGER NOT NULL,
    "regularAmountPaise" INTEGER NOT NULL,
    "offerApplied" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'created',
    "payerName" TEXT,
    "transactionReference" TEXT,
    "proofData" BYTEA,
    "proofMimeType" TEXT,
    "proofFileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkoutOpenedAt" TIMESTAMP(3),
    "proofSubmittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "internalAdminNote" TEXT,
    "approvedSubscriptionId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "emailNotificationStatus" TEXT,
    "checkoutEmailSentAt" TIMESTAMP(3),
    "proofEmailSentAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScholarPaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoinLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "paymentRequestId" TEXT,
    "subscriptionId" TEXT,
    "metadataJson" TEXT,
    "ipHash" TEXT,
    "userAgentSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecurityAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "ScholarSubscription_paymentRequestId_key" ON "ScholarSubscription"("paymentRequestId");
CREATE INDEX "ScholarSubscription_userId_status_idx" ON "ScholarSubscription"("userId", "status");
CREATE UNIQUE INDEX "ScholarPaymentRequest_publicReference_key" ON "ScholarPaymentRequest"("publicReference");
CREATE UNIQUE INDEX "ScholarPaymentRequest_transactionReference_key" ON "ScholarPaymentRequest"("transactionReference");
CREATE UNIQUE INDEX "ScholarPaymentRequest_idempotencyKey_key" ON "ScholarPaymentRequest"("idempotencyKey");
CREATE INDEX "ScholarPaymentRequest_userId_status_idx" ON "ScholarPaymentRequest"("userId", "status");
CREATE INDEX "ScholarPaymentRequest_createdAt_idx" ON "ScholarPaymentRequest"("createdAt");
CREATE UNIQUE INDEX "UsageCounter_userId_key_day_key" ON "UsageCounter"("userId", "key", "day");
CREATE INDEX "StoredFile_userId_deletedAt_idx" ON "StoredFile"("userId", "deletedAt");
CREATE UNIQUE INDEX "StoredFile_userId_clientId_key" ON "StoredFile"("userId", "clientId");
CREATE UNIQUE INDEX "CoinLedger_userId_type_key" ON "CoinLedger"("userId", "type");
CREATE INDEX "AuditEvent_eventType_createdAt_idx" ON "AuditEvent"("eventType", "createdAt");
CREATE INDEX "AuditEvent_targetUserId_createdAt_idx" ON "AuditEvent"("targetUserId", "createdAt");
CREATE INDEX "SecurityAttempt_key_action_createdAt_idx" ON "SecurityAttempt"("key", "action", "createdAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScholarSubscription" ADD CONSTRAINT "ScholarSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScholarSubscription" ADD CONSTRAINT "ScholarSubscription_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScholarSubscription" ADD CONSTRAINT "ScholarSubscription_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "ScholarPaymentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScholarPaymentRequest" ADD CONSTRAINT "ScholarPaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScholarPaymentRequest" ADD CONSTRAINT "ScholarPaymentRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoinLedger" ADD CONSTRAINT "CoinLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoinLedger" ADD CONSTRAINT "CoinLedger_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ScholarSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
