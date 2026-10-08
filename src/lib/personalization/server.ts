import "server-only";
import { Prisma, type LearningProfile } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { savedPreferencesSchema, DEFAULT_PREFERENCES, BONUS_BYTES, mayImport } from "./schema";
import type { Blueprint } from "./engine";

export class ProfileError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export const jsonValue = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function lockAccount(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}
export async function checkGrade(userId: string, grade: number) {
  if (grade !== 9) return;
  const access = await resolveUserEntitlements(userId);
  if (!access.entitlementsLoaded || !access.entitlements.includes("class_9_access")) throw new ProfileError("Class 9 requires Scholar Plus access. Choose Class 11 or manage your plan.", 403);
}
export function profileView(profile: LearningProfile | null, required: boolean, grade: number) {
  const parsed = savedPreferencesSchema.safeParse(profile?.preferences);
  return {
    required, status: profile?.status ?? "NOT_STARTED", stage: profile?.stage ?? 0, revision: profile?.revision ?? 0,
    preferences: parsed.success ? parsed.data : { ...DEFAULT_PREFERENCES, grade: grade === 9 ? 9 : 11 },
    result: profile?.completedAt ? profile.result as unknown as Blueprint : null,
    bonus: { total: BONUS_BYTES, used: profile?.bonusUsedBytes ?? 0, closed: Boolean(profile?.bonusClosedAt) },
    jobStartedAt: profile?.jobStartedAt?.toISOString() ?? null,
  };
}
export async function readProfile(userId: string) {
  const [user, profile] = await Promise.all([
    db.user.findUniqueOrThrow({where:{id:userId},select:{currentScholarClass:true}}),
    db.learningProfile.findUnique({where:{userId}}),
  ]);
  return profileView(profile, profile?.required ?? true, user.currentScholarClass);
}
export async function storeBonusBook(userId: string, key: string, digest: string, data: Omit<Prisma.CustomEbookUncheckedCreateInput,"userId">) {
  return db.$transaction(async tx => {
    await lockAccount(tx,userId);
    const existing = await tx.customEbook.findUnique({where:{userId_importKey:{userId,importKey:key}},include:{resource:{select:{id:true}}}});
    if (existing) {
      if (existing.importDigest !== digest || existing.deletedAt) throw new ProfileError("This import reference was already used. Choose the file again.");
      return existing;
    }
    const profile = await tx.learningProfile.findUnique({where:{userId}});
    if (!profile || !mayImport(profile.status,Boolean(profile.bonusClosedAt),profile.bonusUsedBytes,data.sizeBytes)) throw new ProfileError("Your initial-setup import space is closed or this PDF exceeds the remaining space.");
    // Return the nested durable resource from the same transaction. Dispatch
    // must not depend on a second optional read after the upload has committed.
    const book = await tx.customEbook.create({data:{...data,userId,allocation:"onboarding",importKey:key,importDigest:digest},include:{resource:{select:{id:true}}}});
    await tx.learningProfile.update({where:{userId},data:{bonusUsedBytes:{increment:data.sizeBytes}}});
    return book;
  },{timeout:10_000});
}
