-- Existing beta accounts are invited, not forcibly interrupted. New accounts opt in to first-login setup.
CREATE TABLE "LearningProfile" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "stage" INTEGER NOT NULL DEFAULT 0,
  "preferences" JSONB NOT NULL DEFAULT '{}',
  "result" JSONB NOT NULL DEFAULT '{}',
  "jobToken" TEXT,
  "jobStartedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "skippedAt" TIMESTAMP(3),
  "bonusUsedBytes" INTEGER NOT NULL DEFAULT 0,
  "bonusClosedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LearningProfile_bonus_check" CHECK ("bonusUsedBytes" BETWEEN 0 AND 52428800),
  CONSTRAINT "LearningProfile_status_check" CHECK ("status" IN ('NOT_STARTED','IN_PROGRESS','ANALYZING','COMPLETED','SKIPPED','FAILED_RETRYABLE'))
);
INSERT INTO "LearningProfile" ("userId", "required") SELECT "id", false FROM "User";
ALTER TABLE "CustomEbook" ADD COLUMN "allocation" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "CustomEbook" ADD COLUMN "importKey" TEXT;
ALTER TABLE "CustomEbook" ADD COLUMN "importDigest" TEXT;
CREATE UNIQUE INDEX "CustomEbook_userId_importKey_key" ON "CustomEbook"("userId", "importKey");
