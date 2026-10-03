import { PrismaClient } from "@prisma/client";
const configured = (key: string) => Boolean(process.env[key]?.trim());
const datasourceUrl = process.env.DB_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
const postgresConfigured = /^postgres(?:ql)?:\/\//.test(datasourceUrl ?? "");
console.log(JSON.stringify({ databaseConfigured: Boolean(datasourceUrl), postgresConfigured, lessonAIConfigured: configured("GROQ_API_KEY"), seekableNarrationConfigured: configured("GROQ_TTS_API_KEY") || configured("GROQ_API_KEY"), optionalWorkerConfigured: configured("LAMTUBE_WORKER_SECRET") }));
if (!postgresConfigured) {
  console.log(JSON.stringify({ databaseReachable: false, migrationPresent: "unverified", message: "Configure a PostgreSQL DB_DATABASE_URL (or DATABASE_URL). A legacy SQLite file URL cannot run Scholar's PostgreSQL schema. No migration was applied." }));
  process.exitCode = 1;
} else {
const client = new PrismaClient({ datasourceUrl, log: [] });
try {
  const result = await Promise.race([
    client.$queryRaw<{ videos: string | null; audio: string | null }[]>`SELECT to_regclass('public."AIVideo"')::text AS videos,to_regclass('public."AIVideoAudio"')::text AS audio`,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000)),
  ]);
  console.log(JSON.stringify({ databaseReachable: true, migrationPresent: Boolean(result[0]?.videos && result[0]?.audio) }));
} catch (error) {
  const e = error as { name?: string; code?: string; message?: string };
  console.log(JSON.stringify({ databaseReachable: false, migrationPresent: "unverified", errorType: e.name, code: e.code ?? null, missingVariable: /Environment variable not found/.test(e.message ?? ""), connectionFailure: /Can't reach database/.test(e.message ?? ""), message: "Database connectivity/configuration unavailable; no migration was applied." }));
}
finally { await client.$disconnect(); }
}
