// Read-only and value-redacted. Bun loads the existing .env.local; this never
// pulls secrets, connects to a database, migrates, or changes configuration.
const issues: { severity: "blocker" | "warning"; code: string; message: string }[] = [];
const present = (key: string) => Boolean(process.env[key]?.trim());
const database = process.env.DB_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
if (!/^postgres(ql)?:\/\//.test(database)) issues.push({ severity: "blocker", code: "DATABASE_PROTOCOL", message: "An isolated PostgreSQL database URL is required for real authenticated RC testing." });
if ((process.env.AUTH_SESSION_SECRET || process.env.DEV_MODE_SESSION_SECRET || "").length < 32) issues.push({ severity: "blocker", code: "SESSION_SECRET", message: "A configured session secret of at least 32 characters is required; development fallback is not production readiness." });
const pairs = [
  ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "Google sign-in"],
  ["GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET", "Google Drive"],
  ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "Recovery/verification email"],
];
for (const [a, b, feature] of pairs) if (!present(a) || !present(b)) issues.push({ severity: "warning", code: `MISSING_${a}`, message: `${feature} is not fully configured in this environment.` });
if (!present("GROQ_API_KEY")) issues.push({ severity: "warning", code: "GROQ_MISSING", message: "Scholar's default text provider needs a configured key." });
if (!present("GEMINI_API_KEY")) issues.push({ severity: "warning", code: "GEMINI_MISSING", message: "AI video narration/image generation needs a configured provider key." });
console.log(JSON.stringify({ scope: "current process/local configuration only; not a live-provider or deployment certification", issues }, null, 2));
process.exitCode = issues.some(issue => issue.severity === "blocker") ? 1 : 0;
