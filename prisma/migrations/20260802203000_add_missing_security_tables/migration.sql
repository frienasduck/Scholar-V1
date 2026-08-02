-- Additive production repair for databases where the PostgreSQL baseline was
-- recorded or partially provisioned without the rate-limit table.
CREATE TABLE IF NOT EXISTS "SecurityAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecurityAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SecurityAttempt_key_action_createdAt_idx"
ON "SecurityAttempt"("key", "action", "createdAt");
