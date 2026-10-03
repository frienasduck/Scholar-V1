import { afterAll, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
const previous = process.env.CONNECTOR_TOKEN_SECRET;
process.env.CONNECTOR_TOKEN_SECRET = "connector-test-only-secret-that-is-not-a-production-key";
const { sealConnection, openConnection } = await import("../src/lib/connections/crypto");
afterAll(() => { if (previous === undefined) delete process.env.CONNECTOR_TOKEN_SECRET; else process.env.CONNECTOR_TOKEN_SECRET = previous; });
test("tokens are encrypted and round trip only for the bound owner/provider", () => { const sealed = sealConnection("user-a", "google-drive", { refresh_token: "private-refresh", access_token: "private-access" }); expect(sealed).not.toContain("private"); expect(openConnection<{ refresh_token: string; access_token: string }>("user-a", "google-drive", sealed)).toEqual({ refresh_token: "private-refresh", access_token: "private-access" }); expect(() => openConnection("user-b", "google-drive", sealed)).toThrow(); expect(() => openConnection("user-a", "other-provider", sealed)).toThrow(); });
test("tampered ciphertext is rejected", () => { const sealed = sealConnection("user-a", "google-drive", { refresh_token: "secret" }); const bytes = Buffer.from(sealed, "base64url"); bytes[15] ^= 1; expect(() => openConnection("user-a", "google-drive", bytes.toString("base64url"))).toThrow(); });
