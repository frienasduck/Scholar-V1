import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("PostgreSQL account architecture", () => {
  test("uses PostgreSQL and a database-backed revocable session", () => {
    const schema = source("prisma/schema.prisma");
    expect(schema).toContain('provider  = "postgresql"');
    expect(schema).toContain('url       = env("DB_DATABASE_URL")');
    expect(schema).toContain('directUrl = env("DB_DATABASE_URL_UNPOOLED")');
    expect(schema).toContain("model Session");
    expect(schema).toContain("tokenHash String");
    expect(schema).toContain("onDelete: Cascade");
  });

  test("normalizes identity and never returns password hashes", () => {
    const register = source("src/app/api/auth/register/route.ts");
    const login = source("src/app/api/auth/login/route.ts");
    const session = source("src/lib/auth/session.ts");
    expect(register).toContain("normalizeEmail");
    expect(login).toContain("normalizeEmail");
    expect(register).toContain("hashPassword");
    expect(login).toContain("verifyPassword");
    expect(register).not.toContain("passwordHash: user.passwordHash");
    expect(session).not.toContain("passwordHash: true");
  });

  test("uses generic login failures and safe account-service errors", () => {
    const login = source("src/app/api/auth/login/route.ts");
    const errors = source("src/lib/auth/errors.ts");
    expect(login).toContain("Incorrect email or password.");
    expect(errors).toContain("DATABASE_UNAVAILABLE");
    expect(errors).not.toContain("DB_DATABASE_URL");
  });

  test("session cookies are HTTP-only and logout revokes the database session", () => {
    const session = source("src/lib/auth/session.ts");
    expect(session).toContain("httpOnly: true");
    expect(session).toContain('sameSite: "lax"');
    expect(session).toContain('secure: process.env.NODE_ENV === "production"');
    expect(session).toContain("db.session.deleteMany");
    expect(session).toContain("expiresAt <= new Date()");
  });

  test("keeps Guest Mode separate from protected APIs", () => {
    const store = source("src/lib/store.ts");
    const entitlements = source("src/lib/subscriptions/entitlements.ts");
    expect(store).toContain("GUEST_STORAGE_KEY");
    expect(store).toContain("devMode: false");
    expect(entitlements).toContain("if (!user)");
    expect(entitlements).not.toContain("guestMode");
  });

  test("provides a PostgreSQL baseline and explicit legacy transfer", () => {
    const lock = source("prisma/migrations/migration_lock.toml");
    const migration = source("prisma/migrations/20260802190000_postgres_auth_baseline/migration.sql");
    const transfer = source("scripts/transfer-sqlite-to-postgres.ts");
    expect(lock).toContain('provider = "postgresql"');
    expect(migration).toContain('CREATE TYPE "UserRole"');
    expect(migration).toContain('CREATE TABLE "Session"');
    expect(transfer).toContain("Legacy sessions were intentionally not transferred");
    expect(transfer).toContain("normalizeEmail");
  });
});
