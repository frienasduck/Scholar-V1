import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
function key() {
  const secret = process.env.CONNECTOR_TOKEN_SECRET || process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("CONNECTOR_ENCRYPTION_NOT_CONFIGURED");
  return createHash("sha256").update(`scholar-connectors-v1:${secret}`).digest();
}
export function sealConnection(userId: string, provider: string, value: unknown) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`${userId}:${provider}`));
  return Buffer.concat([iv, cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()]).toString("base64url");
}
export function openConnection<T>(userId: string, provider: string, envelope: string): T {
  const bytes = Buffer.from(envelope, "base64url");
  if (bytes.length < 29) throw new Error("INVALID_CONNECTOR_TOKEN");
  const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(`${userId}:${provider}`)); decipher.setAuthTag(bytes.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString()) as T;
}
