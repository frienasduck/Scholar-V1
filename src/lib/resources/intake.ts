import type { Prisma } from "@prisma/client";
export function pdfResource(userId: string, title: string, digest: string, grade: number, usageKey?: string): Prisma.StudyResourceUncheckedCreateWithoutEbookInput {
  return { ownerUserId: userId, identityKey: `${userId}:pdf:${digest}`, visibility: "PRIVATE", title,
    resourceType: "textbook", sourceType: "upload", publisher: "Your private upload", attributionText: "Private user material. Not reviewed or shared by Scholar.",
    canStoreCopy: true, canGenerateDerivatives: true, contentHash: digest, state: "EXTRACTING",
    sourceMetadata: { grade, usageKey: usageKey ?? null }, job: { create: {} } };
}
