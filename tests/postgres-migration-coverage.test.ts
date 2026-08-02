import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
const migrationsRoot = join(root, "prisma", "migrations");
const migrationSql = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(migrationsRoot, entry.name, "migration.sql"))
  .flatMap((path) => {
    try {
      return [readFileSync(path, "utf8")];
    } catch {
      return [];
    }
  })
  .join("\n");

const models = [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((match) => match[1]);

describe("PostgreSQL migration coverage", () => {
  test("every Prisma model has a table in the PostgreSQL migration chain", () => {
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) {
      expect(migrationSql).toMatch(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? "${model}"`));
    }
  });

  test("critical account, entitlement, storage, and security tables are covered", () => {
    for (const table of [
      "User", "Session", "SecurityAttempt", "ScholarSubscription", "ScholarPaymentRequest",
      "UsageCounter", "CoinLedger", "StoredFile", "AuditEvent",
    ]) {
      expect(models).toContain(table);
      expect(migrationSql).toMatch(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? "${table}"`));
    }
  });

  test("SecurityAttempt exactly matches the rate-limit model and composite index", () => {
    const securityModel = schema.match(/model SecurityAttempt \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(securityModel).toContain("id        String   @id @default(cuid())");
    expect(securityModel).toContain("key       String");
    expect(securityModel).toContain("action    String");
    expect(securityModel).toContain("createdAt DateTime @default(now())");
    expect(securityModel).toContain("@@index([key, action, createdAt])");
    expect(migrationSql).toContain('CONSTRAINT "SecurityAttempt_pkey" PRIMARY KEY ("id")');
    expect(migrationSql).toContain('"SecurityAttempt_key_action_createdAt_idx"');
  });

  test("declared enum and relation constraints are represented", () => {
    expect(migrationSql).toContain('CREATE TYPE "UserRole" AS ENUM');
    for (const constraint of [
      "Session_userId_fkey", "ScholarSubscription_userId_fkey", "ScholarPaymentRequest_userId_fkey",
      "UsageCounter_userId_fkey", "StoredFile_userId_fkey", "CoinLedger_userId_fkey",
      "AuditEvent_actorUserId_fkey", "AuditEvent_targetUserId_fkey",
    ]) {
      expect(migrationSql).toContain(`CONSTRAINT "${constraint}"`);
    }
  });

  test("Vercel and packaged production builds deploy migrations before Next.js", () => {
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as { buildCommand?: string };
    const packagedBuild = readFileSync(join(root, ".zscripts", "build.sh"), "utf8");
    expect(vercel.buildCommand).toBe("bun run db:migrate:deploy && bun run build");
    expect(packagedBuild.indexOf("bun run db:migrate:deploy")).toBeGreaterThan(-1);
    expect(packagedBuild.indexOf("bun run db:migrate:deploy")).toBeLessThan(packagedBuild.indexOf("bun run build"));
    expect(packagedBuild).not.toContain("prisma db push");
  });
});
