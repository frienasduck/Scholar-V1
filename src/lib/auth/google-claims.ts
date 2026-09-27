import { z } from "zod";

/** Called only AFTER google-auth-library has verified the signature/certificates. */
export function validatedGoogleIdentity(payload: unknown, expected: { audience: string; nonce: string; now?: number }) {
  const schema = z.object({
    iss: z.enum(["accounts.google.com", "https://accounts.google.com"]),
    aud: z.literal(expected.audience),
    sub: z.string().min(1).max(255).regex(/^[\x21-\x7e]+$/),
    exp: z.number().int(), iat: z.number().int(),
    nonce: z.literal(expected.nonce),
    email: z.string().trim().email().max(254), email_verified: z.literal(true),
    name: z.string().max(512).optional(),
  });
  const value = schema.parse(payload);
  const now = expected.now ?? Math.floor(Date.now() / 1000);
  if (value.exp <= now || value.iat > now + 60 || value.exp <= value.iat) throw new Error("Invalid Google token lifetime");
  return { subject: value.sub, email: value.email.trim().toLowerCase(), name: value.name?.trim().slice(0, 80) || "Scholar" };
}
