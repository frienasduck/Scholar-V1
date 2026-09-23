-- Additive private PDF-backed Scholar E-Books. Binary data and extracted text
-- remain owner-scoped and are removed with the owning account.
CREATE TABLE "CustomEbook" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "sizeBytes" INTEGER NOT NULL,
  "pageCount" INTEGER NOT NULL,
  "text" TEXT NOT NULL DEFAULT '',
  "pageTexts" JSONB NOT NULL DEFAULT '[]',
  "pdfBytes" BYTEA NOT NULL,
  "processingStatus" TEXT NOT NULL DEFAULT 'ready',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CustomEbook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomEbook_userId_deletedAt_createdAt_idx" ON "CustomEbook"("userId", "deletedAt", "createdAt");
ALTER TABLE "CustomEbook" ADD CONSTRAINT "CustomEbook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
