CREATE TABLE "AIVideo" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "requestKey" TEXT NOT NULL UNIQUE, "revision" INTEGER NOT NULL DEFAULT 0, "state" JSONB NOT NULL,
  "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3), "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AIVideo_userId_updatedAt_idx" ON "AIVideo"("userId", "updatedAt");
CREATE INDEX "AIVideo_leaseUntil_idx" ON "AIVideo"("leaseUntil");
CREATE TABLE "AIVideoAudio" (
  "id" TEXT PRIMARY KEY, "videoId" TEXT NOT NULL REFERENCES "AIVideo"("id") ON DELETE CASCADE,
  "digest" TEXT NOT NULL, "bytes" BYTEA NOT NULL, "duration" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIVideoAudio_videoId_digest_key" UNIQUE ("videoId", "digest"),
  CONSTRAINT "AIVideoAudio_duration_check" CHECK ("duration" > 0 AND "duration" <= 45),
  CONSTRAINT "AIVideoAudio_size_check" CHECK (octet_length("bytes") <= 8000000)
);
