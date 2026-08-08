-- Scholar V2.1 — Scholar Intelligence core (additive migration).
-- Only ADDS tables and indexes. No existing table is altered or dropped.
-- The intelligence layer is inert until the client/server write evidence,
-- so this migration is safe to deploy independently.
-- Rollback: reverse the application release first; tables are inert.

CREATE TABLE IF NOT EXISTS "MasteryRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "chapter" TEXT,
    "topic" TEXT,
    "level" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "decayed" BOOLEAN NOT NULL DEFAULT false,
    "lastAttemptAt" TIMESTAMP(3),
    "lastRevisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MasteryRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PracticeAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "chapter" TEXT,
    "topic" TEXT,
    "correct" BOOLEAN,
    "score" DOUBLE PRECISION,
    "total" INTEGER,
    "difficulty" TEXT,
    "rating" INTEGER,
    "questionId" TEXT,
    "question" TEXT,
    "userAnswer" TEXT,
    "correctAnswer" TEXT,
    "explanation" TEXT,
    "source" TEXT NOT NULL DEFAULT 'quiz',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MistakeRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "chapter" TEXT,
    "topic" TEXT,
    "question" TEXT NOT NULL,
    "userAnswer" TEXT,
    "correctAnswer" TEXT,
    "explanation" TEXT,
    "mistakeType" TEXT NOT NULL DEFAULT 'Concept Error',
    "originalType" TEXT,
    "source" TEXT NOT NULL DEFAULT 'quiz',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MistakeRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RevisionItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "chapter" TEXT,
    "topic" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'concept',
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "intervalDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "sourceId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    CONSTRAINT "RevisionItem_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (mirror the Prisma relations; cascade on user deletion).
ALTER TABLE "MasteryRecord" ADD CONSTRAINT "MasteryRecord_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MistakeRecord" ADD CONSTRAINT "MistakeRecord_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevisionItem" ADD CONSTRAINT "RevisionItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Uniqueness + query indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "MasteryRecord_userId_subject_chapter_topic_key"
    ON "MasteryRecord"("userId", "subject", "chapter", "topic");
CREATE INDEX IF NOT EXISTS "MasteryRecord_userId_updatedAt_idx"
    ON "MasteryRecord"("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "PracticeAttempt_userId_occurredAt_idx"
    ON "PracticeAttempt"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "PracticeAttempt_userId_subject_occurredAt_idx"
    ON "PracticeAttempt"("userId", "subject", "occurredAt");

CREATE INDEX IF NOT EXISTS "MistakeRecord_userId_subject_occurredAt_idx"
    ON "MistakeRecord"("userId", "subject", "occurredAt");
CREATE INDEX IF NOT EXISTS "MistakeRecord_userId_resolved_occurredAt_idx"
    ON "MistakeRecord"("userId", "resolved", "occurredAt");

CREATE UNIQUE INDEX IF NOT EXISTS "RevisionItem_userId_kind_sourceId_key"
    ON "RevisionItem"("userId", "kind", "sourceId");
CREATE INDEX IF NOT EXISTS "RevisionItem_userId_dueAt_state_idx"
    ON "RevisionItem"("userId", "dueAt", "state");
