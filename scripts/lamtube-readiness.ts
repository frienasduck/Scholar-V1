import { PrismaClient } from "@prisma/client";
const configured = (key: string) => Boolean(process.env[key]?.trim());
console.log(JSON.stringify({ databaseConfigured: configured("DATABASE_URL"), lessonAIConfigured: configured("GROQ_API_KEY"), seekableNarrationConfigured: configured("GROQ_TTS_API_KEY") || configured("GROQ_API_KEY"), optionalWorkerConfigured: configured("LAMTUBE_WORKER_SECRET") }));
const client = new PrismaClient({ log: [] });
try {
  const result = await Promise.race([
    client.$queryRaw<{ videos: string | null; audio: string | null }[]>`SELECT to_regclass('public."AIVideo"')::text AS videos,to_regclass('public."AIVideoAudio"')::text AS audio`,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000)),
  ]);
  console.log(JSON.stringify({ databaseReachable: true, migrationPresent: Boolean(result[0]?.videos && result[0]?.audio) }));
} catch { console.log(JSON.stringify({ databaseReachable: false, migrationPresent: "unverified", message: "Database connectivity/configuration unavailable; no migration was applied." })); }
finally { await client.$disconnect(); }
