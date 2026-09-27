import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { sendScholarEmail } from "@/lib/subscriptions/email";
import { authBaseUrl, authEmailConfigured } from "./config";
import { AuthFlowError } from "./flow-errors";
import { hashPassword } from "./password";
import { after } from "next/server";

export const recoveryTokenHash = (token: string) => createHash("sha256").update(token).digest("base64url");
export type AuthEmailPurpose = "reset" | "verify";
export function queueAuthEmail(user: { id: string; email: string; sessionVersion: number }, purpose: AuthEmailPurpose) {
  if (!authEmailConfigured()) return false;
  after(async () => { await issueAuthEmail(user, purpose).catch(() => false); });
  return true; // Scheduled, NOT a claim of successful delivery.
}
export async function issueAuthEmail(user: { id: string; email: string; sessionVersion: number }, purpose: AuthEmailPurpose) {
  if (!authEmailConfigured()) return false;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = recoveryTokenHash(token);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
    await tx.authActionToken.deleteMany({ where: { userId: user.id, purpose } });
    await tx.authActionToken.create({ data: { tokenHash, userId: user.id, email: user.email, purpose,
      sessionVersion: user.sessionVersion, expiresAt: new Date(Date.now() + (purpose === "reset" ? 15 * 60 : 24 * 60 * 60) * 1000) } });
    await tx.authActionToken.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  });
  // Fragment tokens are not sent in the page request URL/referrer. Client removes immediately.
  const link = `${authBaseUrl()}/login#${purpose}=${token}`;
  const escapedLink = link.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  const label = purpose === "reset" ? "Reset your Scholar password" : "Verify your Scholar email";
  const result = await sendScholarEmail({ to: user.email, subject: label, idempotencyKey: `auth-${tokenHash}`,
    html: `<h1>${label}</h1><p><a href="${escapedLink}">${label}</a></p><p>This single-use link expires in ${purpose === "reset" ? "15 minutes" : "24 hours"}. If you did not request this, ignore this email.</p>` });
  if (!result.sent) await db.authActionToken.deleteMany({ where: { tokenHash } });
  return result.sent;
}

export async function consumeAuthEmail(token: string, purpose: AuthEmailPurpose, password?: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthFlowError("INVALID_AUTH_LINK", "This link is invalid or expired. Request a new one.");
  const tokenHash = recoveryTokenHash(token);
  const hint = await db.authActionToken.findUnique({ where: { tokenHash } });
  if (!hint || hint.purpose !== purpose || hint.usedAt || hint.expiresAt <= new Date()) throw new AuthFlowError("INVALID_AUTH_LINK", "This link is invalid or expired. Request a new one.");
  const passwordHash = purpose === "reset" && password ? await hashPassword(password) : undefined;
  if (purpose === "reset" && !passwordHash) throw new AuthFlowError("VALIDATION_ERROR", "A new password is required.");
  return db.$transaction(async (tx) => {
    // Same user lock as other credential operations; version/one-use checked INSIDE lock.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${hint.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: hint.userId } });
    if (!user || user.email !== hint.email || user.sessionVersion !== hint.sessionVersion) throw new AuthFlowError("INVALID_AUTH_LINK", "This link is invalid or expired. Request a new one.");
    const used = await tx.authActionToken.updateMany({ where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw new AuthFlowError("INVALID_AUTH_LINK", "This link was already used or expired.");
    if (purpose === "reset") {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, sessionVersion: { increment: 1 }, emailVerifiedAt: new Date() } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.authActionToken.deleteMany({ where: { userId: user.id } });
      await tx.oAuthAttempt.deleteMany({ where: { userId: user.id } });
    } else await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    return { ok: true };
  });
}
