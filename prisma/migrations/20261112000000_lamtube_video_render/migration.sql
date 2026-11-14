CREATE TABLE "AIVideoRender" (
  "id" TEXT PRIMARY KEY,
  "videoId" TEXT NOT NULL REFERENCES "AIVideo"("id") ON DELETE CASCADE,
  "digest" TEXT NOT NULL,
  "bytes" BYTEA NOT NULL,
  "captionsVtt" TEXT NOT NULL DEFAULT '',
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "fps" INTEGER NOT NULL DEFAULT 30,
  "duration" DOUBLE PRECISION NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "codec" TEXT NOT NULL DEFAULT 'h264+aac',
  "mimeType" TEXT NOT NULL DEFAULT 'video/mp4',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIVideoRender_videoId_digest_key" UNIQUE ("videoId", "digest"),
  CONSTRAINT "AIVideoRender_duration_check" CHECK ("duration" > 0 AND "duration" <= 1800),
  CONSTRAINT "AIVideoRender_size_check" CHECK (octet_length("bytes") <= 120000000)
);
CREATE INDEX "AIVideoRender_videoId_createdAt_idx" ON "AIVideoRender"("videoId", "createdAt");

CREATE TABLE "AIVideoAsset" (
  "id" TEXT PRIMARY KEY,
  "videoId" TEXT NOT NULL REFERENCES "AIVideo"("id") ON DELETE CASCADE,
  "assetKey" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "bytes" BYTEA NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'image/png',
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIVideoAsset_videoId_assetKey_key" UNIQUE ("videoId", "assetKey"),
  CONSTRAINT "AIVideoAsset_size_check" CHECK (octet_length("bytes") <= 8000000)
);
