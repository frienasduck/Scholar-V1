import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { getUsage } from "@/lib/subscriptions/usage";
import { db } from "@/lib/db";
import { publicSubscriptionConfig } from "@/lib/subscriptions/config";
import { databaseUnavailableError } from "@/lib/auth/errors";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ authenticated: false, config: publicSubscriptionConfig() });
    const access = await resolveUserEntitlements(user.id);
    const [usage, storage, pendingPayment] = await Promise.all([
      getUsage(user.id, access),
      db.storedFile.aggregate({ where: { userId: user.id, deletedAt: null }, _sum: { sizeBytes: true } }),
      db.scholarPaymentRequest.findFirst({
        where: { userId: user.id, status: { in: ["created", "submitted", "more_information_required"] } },
        orderBy: { createdAt: "desc" },
        select: { publicReference: true, status: true, createdAt: true, proofSubmittedAt: true },
      }),
    ]);
    const currentScholarClass = user.currentScholarClass === 9 && !access.entitlements.includes("class_9_access") ? 11 : user.currentScholarClass;
    if (currentScholarClass !== user.currentScholarClass) {
      await db.user.update({ where: { id: user.id }, data: { currentScholarClass } });
    }
    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, coins: user.coins, currentScholarClass },
      plan: access.plan,
      entitlements: access.entitlements,
      limits: { storageBytes: access.storageLimitBytes, dailyQuiz: access.dailyQuizLimit, dailySlideshow: access.dailySlideshowLimit },
      entitlementsLoaded: access.entitlementsLoaded,
      developerMode: access.plan === "DEVELOPER",
      access,
      usage,
      storage: { usedBytes: storage._sum.sizeBytes ?? 0, limitBytes: access.storageLimitBytes },
      pendingPayment,
      config: publicSubscriptionConfig(),
    });
  } catch {
    return databaseUnavailableError();
  }
}
