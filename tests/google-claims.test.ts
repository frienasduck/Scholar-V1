import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { validatedGoogleIdentity } from "../src/lib/auth/google-claims";
const now = Math.floor(Date.now() / 1000);
const expected = { audience: "unit-test-audience", nonce: "unit-test-nonce", now };
const claims = { iss: "https://accounts.google.com", aud: expected.audience, sub: "unit-subject", nonce: expected.nonce, iat: now - 10, exp: now + 600, email: " OWNER@EXAMPLE.TEST ", email_verified: true, name: "Learner" };
describe("verified Google claim restrictions", () => {
  test("accepts verified normalized email and stable subject", () => { expect(validatedGoogleIdentity(claims, expected)).toEqual({ subject: "unit-subject", email: "owner@example.test", name: "Learner" }); });
  for (const [name, change] of Object.entries({ audience: { aud: "other-client" }, issuer: { iss: "https://attacker.example" }, nonce: { nonce: "wrong" }, expired: { exp: now - 1 }, future: { iat: now + 120 }, unverified: { email_verified: false }, stringVerified: { email_verified: "true" }, subject: { sub: "" }, badEmail: { email: "not-email" } })) {
    test(`rejects ${name}`, () => { expect(() => validatedGoogleIdentity({ ...claims, ...change }, expected)).toThrow(); });
  }
});
describe("real Google library signature checks (offline ephemeral test key)", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const certs = { fixture: publicKey.export({ type: "spki", format: "pem" }).toString() };
  const jwt = (payload: object) => { const body = `${Buffer.from(JSON.stringify({ alg: "RS256", kid: "fixture" })).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`; return `${body}.${sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url")}`; };
  const oauth = new OAuth2Client();
  test("accepts a valid signature only with matching audience/issuer", async () => { const ticket = await oauth.verifySignedJwtWithCertsAsync(jwt(claims), certs, expected.audience, [claims.iss]); expect(ticket.getPayload()?.sub).toBe(claims.sub); });
  test("rejects a tampered signature", async () => { const token = jwt(claims); await expect(oauth.verifySignedJwtWithCertsAsync(`${token.slice(0, -12)}invalidchars`, certs, expected.audience, [claims.iss])).rejects.toThrow(); });
  test("rejects wrong audience", async () => { await expect(oauth.verifySignedJwtWithCertsAsync(jwt(claims), certs, "different", [claims.iss])).rejects.toThrow(); });
  test("rejects wrong issuer", async () => { await expect(oauth.verifySignedJwtWithCertsAsync(jwt({ ...claims, iss: "https://attacker.example" }), certs, expected.audience, [claims.iss])).rejects.toThrow(); });
  test("rejects expired signed tokens", async () => { await expect(oauth.verifySignedJwtWithCertsAsync(jwt({ ...claims, iat: now - 1200, exp: now - 600 }), certs, expected.audience, [claims.iss])).rejects.toThrow(); });
});
