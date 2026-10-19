-- Additive only. Prepared, NOT applied by implementation tooling.
CREATE TABLE "ExamReadyMaterial" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "grade" INTEGER NOT NULL CHECK ("grade" IN (9,11)), "subjectId" TEXT NOT NULL, "chapterId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "mime" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 3145728),
  "contentHash" TEXT NOT NULL, "revision" INTEGER NOT NULL DEFAULT 0, "fileBytes" BYTEA NOT NULL, "state" TEXT NOT NULL DEFAULT 'PROCESSING',
  "pages" JSONB NOT NULL DEFAULT '[]', "metadata" JSONB NOT NULL DEFAULT '{}', "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseToken" TEXT, "leaseUntil" TIMESTAMPTZ, "errorCode" TEXT, "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "ExamReadyMaterial_userId_grade_subjectId_chapterId_deletedAt_idx" ON "ExamReadyMaterial"("userId","grade","subjectId","chapterId","deletedAt");
CREATE INDEX "ExamReadyMaterial_state_leaseUntil_idx" ON "ExamReadyMaterial"("state","leaseUntil");
CREATE TABLE "ExamReadyGeneration" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "sessionId" TEXT NOT NULL REFERENCES "ExamReadySession"("id") ON DELETE CASCADE,
  "contextHash" TEXT NOT NULL, "segments" JSONB NOT NULL DEFAULT '{}', "state" TEXT NOT NULL DEFAULT 'PARTIAL',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("userId","sessionId","contextHash")
);
