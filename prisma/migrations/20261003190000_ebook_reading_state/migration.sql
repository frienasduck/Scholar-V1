-- Additive only. Original bytes and existing reading/index data are untouched.
ALTER TABLE "CustomEbook" ADD COLUMN "readingState" JSONB NOT NULL DEFAULT '{}';
