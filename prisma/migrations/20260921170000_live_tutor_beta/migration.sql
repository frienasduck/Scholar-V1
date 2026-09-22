CREATE TABLE "LiveTutorSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Live Tutor session',
    "personality" TEXT NOT NULL DEFAULT 'calm',
    "provider" TEXT NOT NULL DEFAULT 'auto',
    "mode" TEXT NOT NULL DEFAULT 'tutor',
    "status" TEXT NOT NULL DEFAULT 'active',
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveTutorSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveTutorMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "inputMode" TEXT NOT NULL DEFAULT 'text',
    "provider" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveTutorMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveTutorMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "subject" TEXT,
    "topic" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'explicit',
    "sourceId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "importance" INTEGER NOT NULL DEFAULT 70,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiveTutorMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveTutorSession_userId_lastActivityAt_idx" ON "LiveTutorSession"("userId", "lastActivityAt");
CREATE INDEX "LiveTutorMessage_sessionId_createdAt_idx" ON "LiveTutorMessage"("sessionId", "createdAt");
CREATE UNIQUE INDEX "LiveTutorMemory_userId_fingerprint_key" ON "LiveTutorMemory"("userId", "fingerprint");
CREATE INDEX "LiveTutorMemory_userId_enabled_updatedAt_idx" ON "LiveTutorMemory"("userId", "enabled", "updatedAt");
CREATE INDEX "LiveTutorMemory_userId_kind_subject_idx" ON "LiveTutorMemory"("userId", "kind", "subject");

ALTER TABLE "LiveTutorSession" ADD CONSTRAINT "LiveTutorSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveTutorMessage" ADD CONSTRAINT "LiveTutorMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveTutorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveTutorMemory" ADD CONSTRAINT "LiveTutorMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
