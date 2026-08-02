-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "plusBonusGrantedAt" DATETIME,
    "currentScholarClass" INTEGER NOT NULL DEFAULT 11,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScholarSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL DEFAULT 'scholar_plus',
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL,
    "paymentRequestId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "approvedByUserId" TEXT,
    CONSTRAINT "ScholarSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScholarSubscription_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScholarSubscription_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "ScholarPaymentRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScholarPaymentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "proofData" BLOB,
    "proofMimeType" TEXT,
    "proofFileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkoutOpenedAt" DATETIME,
    "proofSubmittedAt" DATETIME,
    "reviewedAt" DATETIME,
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "internalAdminNote" TEXT,
    "approvedSubscriptionId" TEXT,
    "expiresAt" DATETIME,
    "emailNotificationStatus" TEXT,
    "checkoutEmailSentAt" DATETIME,
    "proofEmailSentAt" DATETIME,
    "idempotencyKey" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScholarPaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScholarPaymentRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoinLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoinLedger_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ScholarSubscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "paymentRequestId" TEXT,
    "subscriptionId" TEXT,
    "metadataJson" TEXT,
    "ipHash" TEXT,
    "userAgentSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ScholarSubscription_paymentRequestId_key" ON "ScholarSubscription"("paymentRequestId");

-- CreateIndex
CREATE INDEX "ScholarSubscription_userId_status_idx" ON "ScholarSubscription"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScholarPaymentRequest_publicReference_key" ON "ScholarPaymentRequest"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "ScholarPaymentRequest_transactionReference_key" ON "ScholarPaymentRequest"("transactionReference");

-- CreateIndex
CREATE UNIQUE INDEX "ScholarPaymentRequest_idempotencyKey_key" ON "ScholarPaymentRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ScholarPaymentRequest_userId_status_idx" ON "ScholarPaymentRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "ScholarPaymentRequest_createdAt_idx" ON "ScholarPaymentRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_key_day_key" ON "UsageCounter"("userId", "key", "day");

-- CreateIndex
CREATE INDEX "StoredFile_userId_deletedAt_idx" ON "StoredFile"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_userId_clientId_key" ON "StoredFile"("userId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinLedger_userId_type_key" ON "CoinLedger"("userId", "type");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_createdAt_idx" ON "AuditEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_targetUserId_createdAt_idx" ON "AuditEvent"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityAttempt_key_action_createdAt_idx" ON "SecurityAttempt"("key", "action", "createdAt");
