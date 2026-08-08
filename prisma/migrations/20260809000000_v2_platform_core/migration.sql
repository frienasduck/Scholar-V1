-- Scholar V2 platform core — additive migration (expand/backfill/switch/contract).
-- This migration only ADDS tables and indexes. No V1 path is dropped or altered.
-- Rollback: reverse the application release first; these tables are inert until
-- the V2 feature flags are enabled.
CREATE TABLE IF NOT EXISTS "Entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "periodDay" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdCampaign" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'scholar_house',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "skipAfterSeconds" INTEGER,
    "maxImpressionsPerUser" INTEGER DEFAULT 3,
    "cooldownMinutes" INTEGER DEFAULT 20,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "targetingRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdImpression" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT,
    "placement" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    CONSTRAINT "AdImpression_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AutomationWorkflow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "source" TEXT NOT NULL DEFAULT 'lam',
    "input" JSONB,
    "currentStep" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AutomationWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AutomationAction" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "parameters" JSONB,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "confirmationRequired" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DevicePushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "encryptedSubscription" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DevicePushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "anonymousOrUserKey" TEXT,
    "name" TEXT NOT NULL,
    "properties" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPct" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- Uniqueness + high-contention indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Entitlement_userId_key_source_key" ON "Entitlement"("userId", "key", "source");
CREATE INDEX IF NOT EXISTS "Entitlement_userId_status_idx" ON "Entitlement"("userId", "status");
CREATE INDEX IF NOT EXISTS "Entitlement_key_status_endsAt_idx" ON "Entitlement"("key", "status", "endsAt");
CREATE UNIQUE INDEX IF NOT EXISTS "UsageEvent_idempotencyKey_key" ON "UsageEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "UsageEvent_userId_feature_status_idx" ON "UsageEvent"("userId", "feature", "status");
CREATE INDEX IF NOT EXISTS "UsageEvent_userId_periodDay_idx" ON "UsageEvent"("userId", "periodDay");
CREATE UNIQUE INDEX IF NOT EXISTS "AdCampaign_key_placement_key" ON "AdCampaign"("key", "placement");
CREATE INDEX IF NOT EXISTS "AdCampaign_placement_enabled_idx" ON "AdCampaign"("placement", "enabled");
CREATE INDEX IF NOT EXISTS "AdImpression_campaignId_startedAt_idx" ON "AdImpression"("campaignId", "startedAt");
CREATE INDEX IF NOT EXISTS "AdImpression_userId_placement_startedAt_idx" ON "AdImpression"("userId", "placement", "startedAt");
CREATE INDEX IF NOT EXISTS "AutomationWorkflow_userId_state_idx" ON "AutomationWorkflow"("userId", "state");
CREATE INDEX IF NOT EXISTS "AutomationWorkflow_state_updatedAt_idx" ON "AutomationWorkflow"("state", "updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "AutomationAction_idempotencyKey_key" ON "AutomationAction"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AutomationAction_workflowId_status_idx" ON "AutomationAction"("workflowId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "DevicePushSubscription_endpointHash_key" ON "DevicePushSubscription"("endpointHash");
CREATE INDEX IF NOT EXISTS "DevicePushSubscription_userId_enabled_idx" ON "DevicePushSubscription"("userId", "enabled");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_name_occurredAt_idx" ON "AnalyticsEvent"("name", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_anonymousOrUserKey_occurredAt_idx" ON "AnalyticsEvent"("anonymousOrUserKey", "occurredAt");

-- Foreign keys (additive; all V1 tables untouched)
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AutomationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevicePushSubscription" ADD CONSTRAINT "DevicePushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
