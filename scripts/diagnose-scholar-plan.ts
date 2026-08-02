import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const falseValues = new Set(["false", "0", "off", "no"]);
const subscriptionsEnabled = !falseValues.has((process.env.SUBSCRIPTIONS_ENABLED ?? "true").trim().toLowerCase());
const integer = (name: string, fallback: number) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
};

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: bun run subscription:diagnose -- user@example.com");
  process.exitCode = 1;
} else {
  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, coins: true, currentScholarClass: true },
    });
    if (!user) {
      console.error("No Scholar account exists for that email.");
      process.exitCode = 1;
    } else {
      const subscription = subscriptionsEnabled ? await db.scholarSubscription.findFirst({
        where: { userId: user.id, status: "active", OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
        orderBy: { startedAt: "desc" },
        select: { id: true, status: true, endsAt: true },
      }) : null;
      const plan = subscriptionsEnabled ? (subscription ? "PLUS" : "FREE") : "UNLOCKED";
      const elevated = plan !== "FREE";
      console.log(JSON.stringify({
        user: { email: user.email, role: user.role, coins: user.coins, currentScholarClass: user.currentScholarClass },
        plan,
        subscriptionsEnabled,
        developerSession: "request-bound; not evaluated by this CLI diagnostic",
        subscription: { id: subscription?.id ?? null, status: subscription?.status ?? null, endsAt: subscription?.endsAt?.toISOString() ?? null },
        limits: {
          storageBytes: integer(elevated ? "PLUS_STORAGE_LIMIT_MB" : "FREE_STORAGE_LIMIT_MB", elevated ? 1024 : 30) * 1024 * 1024,
          dailyQuiz: integer(elevated ? "PLUS_DAILY_QUIZ_GENERATIONS" : "FREE_DAILY_QUIZ_GENERATIONS", elevated ? -1 : 3),
          dailySlideshow: integer(elevated ? "PLUS_DAILY_SLIDESHOW_GENERATIONS" : "FREE_DAILY_SLIDESHOW_GENERATIONS", elevated ? -1 : 3),
        },
      }, null, 2));
    }
  } finally {
    await db.$disconnect();
  }
}
