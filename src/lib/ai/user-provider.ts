import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";

export const USER_AI_COOKIE = "scholar-user-ai";
export const userAIProviderSchema = z.enum(["groq", "gemini", "nvidia"]);
export const userAIScopeSchema = z.enum(["lam", "ai-tutor"]);
export const userAISettingsSchema = z.object({
  provider: userAIProviderSchema,
  model: z.string().trim().min(2).max(100).regex(/^[\w./:-]+$/),
  scopes: z.array(userAIScopeSchema).min(1).max(2),
  apiKey: z.string().trim().min(12).max(512),
}).strict();

export type UserAISettings = z.infer<typeof userAISettingsSchema>;
type BoundSettings = UserAISettings & { userId: string };

function encryptionKey() {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.DEV_MODE_SESSION_SECRET || (process.env.NODE_ENV !== "production" ? "scholar-local-development-session-secret-only" : "");
  if (!secret || secret.length < 32) throw new Error("Scholar session encryption is unavailable");
  return createHash("sha256").update("scholar-user-ai:v1:").update(secret).digest();
}

export function sealUserAISettings(settings: BoundSettings): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(settings), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

export function unsealUserAISettings(value: string | undefined, userId: string): UserAISettings | null {
  if (!value || value.length > 3000) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const parsed = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")) as BoundSettings;
    if (parsed.userId !== userId) return null;
    // userId binds the sealed key to an account but is not returned to clients.
    const { userId: _userId, ...settings } = parsed;
    return userAISettingsSchema.parse(settings);
  } catch { return null; }
}

export async function getUserAISettings(userId: string): Promise<UserAISettings | null> {
  return unsealUserAISettings((await cookies()).get(USER_AI_COOKIE)?.value, userId);
}
