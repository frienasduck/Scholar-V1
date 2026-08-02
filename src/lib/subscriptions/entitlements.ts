import "server-only";
import { db } from "@/lib/db";
import { getSessionUser, hasDeveloperSession } from "@/lib/auth/session";
import { subscriptionConfig } from "@/lib/subscriptions/config";

export const SCHOLAR_ENTITLEMENTS = [
  "levels", "aisig", "homework_scanner", "exam_prep", "assignments",
  "practical_lab", "derivation_library", "store_plus_items",
  "expanded_file_storage", "appearance_lab", "class_9_access",
  "nigtube_ad_free", "study_music_ad_free", "quiz_generation_plus",
  "slideshow_generation_plus", "formula_explorer", "plus_coin_bonus",
] as const;

export type ScholarEntitlement = (typeof SCHOLAR_ENTITLEMENTS)[number];
export type ScholarAccessSource = "free" | "plus" | "developer" | "subscriptions_disabled";

export type ResolvedEntitlements = {
  authenticated: boolean;
  userId: string | null;
  role: string | null;
  source: ScholarAccessSource;
  entitlements: ScholarEntitlement[];
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionEndsAt: string | null;
  storageLimitBytes: number;
  dailyQuizLimit: number;
  dailySlideshowLimit: number;
};

const all = () => [...SCHOLAR_ENTITLEMENTS];

export async function resolveUserEntitlements(userId: string | null): Promise<ResolvedEntitlements> {
  if (!subscriptionConfig.enabled) {
    return {
      authenticated: Boolean(userId), userId, role: null, source: "subscriptions_disabled",
      entitlements: all(), subscriptionId: null, subscriptionStatus: null, subscriptionEndsAt: null,
      storageLimitBytes: subscriptionConfig.plusStorageMb * 1024 * 1024,
      dailyQuizLimit: subscriptionConfig.plusQuizGenerations,
      dailySlideshowLimit: subscriptionConfig.plusSlideshowGenerations,
    };
  }

  if (!userId) {
    return {
      authenticated: false, userId: null, role: null, source: "free", entitlements: [],
      subscriptionId: null, subscriptionStatus: null, subscriptionEndsAt: null,
      storageLimitBytes: subscriptionConfig.freeStorageMb * 1024 * 1024,
      dailyQuizLimit: subscriptionConfig.freeQuizGenerations,
      dailySlideshowLimit: subscriptionConfig.freeSlideshowGenerations,
    };
  }

  const [user, developer, subscription] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
    hasDeveloperSession(userId),
    db.scholarSubscription.findFirst({
      where: { userId, status: "active", OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const elevated = developer || Boolean(subscription);
  const source: ScholarAccessSource = developer ? "developer" : subscription ? "plus" : "free";
  return {
    authenticated: true,
    userId,
    role: user?.role ?? "student",
    source,
    entitlements: elevated ? all() : [],
    subscriptionId: subscription?.id ?? null,
    subscriptionStatus: subscription?.status ?? null,
    subscriptionEndsAt: subscription?.endsAt?.toISOString() ?? null,
    storageLimitBytes: (elevated ? subscriptionConfig.plusStorageMb : subscriptionConfig.freeStorageMb) * 1024 * 1024,
    dailyQuizLimit: elevated ? subscriptionConfig.plusQuizGenerations : subscriptionConfig.freeQuizGenerations,
    dailySlideshowLimit: elevated ? subscriptionConfig.plusSlideshowGenerations : subscriptionConfig.freeSlideshowGenerations,
  };
}
export async function resolveCurrentEntitlements() {
  const user = await getSessionUser();
  return resolveUserEntitlements(user?.id ?? null);
}

export function hasEntitlement(access: ResolvedEntitlements, entitlement: ScholarEntitlement) {
  return access.entitlements.includes(entitlement);
}

export async function requireEntitlement(entitlement: ScholarEntitlement) {
  const user = await getSessionUser();
  const access = await resolveUserEntitlements(user?.id ?? null);
  if (!user && subscriptionConfig.enabled) {
    return { ok: false as const, response: Response.json({ error: "AUTH_REQUIRED" }, { status: 401 }) };
  }
  if (!hasEntitlement(access, entitlement)) {
    await import("@/lib/subscriptions/audit").then(({ recordAudit }) => recordAudit("UNAUTHORIZED_PLUS_REQUEST_BLOCKED", { actorUserId: user?.id, targetUserId: user?.id, metadata: { entitlement } }));
    return { ok: false as const, response: Response.json({ error: "PLUS_REQUIRED", feature: entitlement }, { status: 403 }) };
  }
  return { ok: true as const, user, access };
}
