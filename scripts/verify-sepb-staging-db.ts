/** Read-only isolation proof; --migrate applies the reviewed chain only to an empty stage. */
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { assertStagingIsolation } from "../src/lib/staging/environment";

const env = parseEnv(readFileSync(".sepb-staging/.env.local", "utf8"));
const proof = assertStagingIsolation(env);
const direct = new URL(env.DB_DATABASE_URL_UNPOOLED!);
const client = new PrismaClient({ datasourceUrl: direct.toString(), log: [] });
type Identity = { databaseMatches: boolean; roleMatches: boolean; canCreate: boolean; readOnly: string; recovery: boolean };
try {
  const [identity] = await client.$queryRaw<Identity[]>`
    SELECT current_database() = ${decodeURIComponent(direct.pathname.slice(1))} AS "databaseMatches",
      current_user = ${decodeURIComponent(direct.username)} AS "roleMatches",
      has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreate",
      current_setting('transaction_read_only') AS "readOnly", pg_is_in_recovery() AS recovery`;
  const [tables] = await client.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
  const count = Number(tables.count);
  if (!identity.databaseMatches || !identity.roleMatches || !identity.canCreate || identity.readOnly !== "off" || identity.recovery) throw new Error("STAGING_DATABASE_IDENTITY_OR_WRITE_PERMISSION_MISMATCH");
  console.log(JSON.stringify({ check: "staging-db-isolation", ...proof, identity, publicTables: count, credentialLogged: false }));
  await client.$disconnect();
  const migrate = process.argv.includes("--migrate");
  if (migrate && count !== 0) throw new Error("INITIAL_MIGRATION_REQUIRES_VERIFIED_EMPTY_STAGING_DATABASE");
  const result = spawnSync("bun", ["x", "prisma", "migrate", migrate ? "deploy" : "status"], {
    env: { ...process.env, ...env, DATABASE_URL: env.DB_DATABASE_URL }, encoding: "utf8", windowsHide: true, timeout: 120_000,
  });
  const output = result.stdout + result.stderr;
  // Emit only known status lines; never Prisma's database URL or raw error object.
  const status = output.split(/\r?\n/).filter(line => /^(\d+ migrations found|Database schema is up to date|All migrations have been successfully applied|The following migration\(s\)|Applying migration `|Your local migration history and the migrations table)/.test(line));
  console.log(JSON.stringify({ operation: migrate ? "staging-migrate-deploy" : "staging-migrate-status", exitCode: result.status, status }));
  if (result.status !== 0 && !(count === 0 && !migrate && /not yet been applied|not managed by Prisma Migrate|Following migration/.test(output))) process.exitCode = 1;
  if (migrate && result.status === 0) {
    await client.$connect();
    const [{ applied }] = await client.$queryRaw<{ applied: bigint }[]>`SELECT count(*) AS applied FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    console.log(JSON.stringify({ appliedMigrations: Number(applied), users: await client.user.count(), customEbooks: await client.customEbook.count(), groupRooms: await client.groupStudyRoom.count(), aiVideos: await client.aIVideo.count() }));
  }
} catch (error) {
  console.error(JSON.stringify({ check: "staging-db-isolation", passed: false, code: error instanceof Error && /^STAGING_|^INITIAL_/.test(error.message) ? error.message : "DATABASE_CHECK_FAILED" }));
  process.exitCode = 1;
} finally { await client.$disconnect(); }
