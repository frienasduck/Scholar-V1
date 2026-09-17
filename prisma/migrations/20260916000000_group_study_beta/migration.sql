-- Scholar Group Study (private beta) — additive migration.
-- Creates only new Group Study tables. No existing Scholar table is dropped,
-- altered, or emptied. All FKs reference existing tables/columns.
-- Idempotent (IF NOT EXISTS / guarded constraints) so re-running or shadow
-- databases that already applied parts of it cannot fail.
-- Rollback: drop the GroupStudy* tables in reverse dependency order.

CREATE TABLE IF NOT EXISTS "GroupStudyRoom" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "topic" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pdfEnabled" BOOLEAN NOT NULL DEFAULT true,
    "participantUploads" BOOLEAN NOT NULL DEFAULT false,
    "notesEditable" BOOLEAN NOT NULL DEFAULT false,
    "maxParticipants" INTEGER NOT NULL DEFAULT 15,
    "activeResourceId" TEXT,
    "page" INTEGER NOT NULL DEFAULT 1,
    "followHost" BOOLEAN NOT NULL DEFAULT true,
    "announcement" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupStudyRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GroupStudyParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "handRaised" BOOLEAN NOT NULL DEFAULT false,
    "chatMuted" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "GroupStudyParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GroupStudyMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "participantId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'chat',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupStudyMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GroupStudyResource" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "bytes" BYTEA NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "pageTexts" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupStudyResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GroupStudyActivity" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupStudyActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GroupStudyEvent" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "participantId" TEXT,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupStudyEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GroupStudyRoom_code_key" ON "GroupStudyRoom"("code");
CREATE INDEX IF NOT EXISTS "GroupStudyRoom_hostUserId_status_idx" ON "GroupStudyRoom"("hostUserId", "status");
CREATE INDEX IF NOT EXISTS "GroupStudyRoom_expiresAt_idx" ON "GroupStudyRoom"("expiresAt");

CREATE INDEX IF NOT EXISTS "GroupStudyParticipant_roomId_status_idx" ON "GroupStudyParticipant"("roomId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "GroupStudyParticipant_tokenHash_key" ON "GroupStudyParticipant"("tokenHash");

CREATE INDEX IF NOT EXISTS "GroupStudyMessage_roomId_createdAt_idx" ON "GroupStudyMessage"("roomId", "createdAt");

CREATE INDEX IF NOT EXISTS "GroupStudyResource_roomId_createdAt_idx" ON "GroupStudyResource"("roomId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "GroupStudyActivity_roomId_kind_key" ON "GroupStudyActivity"("roomId", "kind");

CREATE INDEX IF NOT EXISTS "GroupStudyEvent_roomId_createdAt_idx" ON "GroupStudyEvent"("roomId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupStudyRoom_hostUserId_fkey') THEN
        ALTER TABLE "GroupStudyRoom" ADD CONSTRAINT "GroupStudyRoom_hostUserId_fkey"
        FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupStudyParticipant_roomId_fkey') THEN
        ALTER TABLE "GroupStudyParticipant" ADD CONSTRAINT "GroupStudyParticipant_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "GroupStudyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupStudyMessage_roomId_fkey') THEN
        ALTER TABLE "GroupStudyMessage" ADD CONSTRAINT "GroupStudyMessage_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "GroupStudyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupStudyMessage_participantId_fkey') THEN
        ALTER TABLE "GroupStudyMessage" ADD CONSTRAINT "GroupStudyMessage_participantId_fkey"
        FOREIGN KEY ("participantId") REFERENCES "GroupStudyParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupStudyResource_roomId_fkey') THEN
        ALTER TABLE "GroupStudyResource" ADD CONSTRAINT "GroupStudyResource_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "GroupStudyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupStudyResource_uploadedById_fkey') THEN
        ALTER TABLE "GroupStudyResource" ADD CONSTRAINT "GroupStudyResource_uploadedById_fkey"
        FOREIGN KEY ("uploadedById") REFERENCES "GroupStudyParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupStudyActivity_roomId_fkey') THEN
        ALTER TABLE "GroupStudyActivity" ADD CONSTRAINT "GroupStudyActivity_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "GroupStudyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupStudyEvent_roomId_fkey') THEN
        ALTER TABLE "GroupStudyEvent" ADD CONSTRAINT "GroupStudyEvent_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "GroupStudyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
