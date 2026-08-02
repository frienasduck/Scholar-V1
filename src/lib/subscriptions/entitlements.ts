import "server-only";
import { db } from "@/lib/db";
import { getSessionUser, hasDeveloperSession } from "@/lib/auth/session";
import { subscriptionConfig } from "@/lib/subscriptions/config";
import { UserRole } from "@prisma/client";

export const SCHOLAR_ENTITLEMENTS = [
  "levels", "aisig", "homework_scanner", "exam_prep", "assignments",
  "practical_lab", "derivation_library", "store_plus_items",
  "expanded_file_storage", "appearance_lab", "class_9_access",
  "nigtube_ad_free", "study_music_ad_free", "quiz_generation_plus",
  "slideshow_generation_plus", "formula_explorer", "plus_coin_bonus",
] as const;

export type ScholarEntitlement = (typeof SCHOLAR_ENTITLEMENTS)[number];
export type ScholarAccessSource = "free" | "plus" | "developer" | "subscriptions_disabled";
export type ScholarPlan = "FREE" | "PLUS" | "DEVELOPER" | "UNLOCKED";

export type ResolvedEntitlements = {
  authenticated: boolean;
  userId: string | null;
  role: string | null;
  plan: ScholarPlan;
  source: ScholarAccessSource;
  entitlementsLoaded: boolean;
  entitlements: ScholarEntitlement[];
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionEndsAt: string | null;
  storageLimitBytes: number;
  dailyQuizLimit: number;
  dailySlideshowLimit: number;
};

const all = () => [...SCHOLAR_ENTITLEMENTS];

type PlanResolution = {
  plan: ScholarPlan;
  role: UserRole;
  entitlementsLoaded: boolean;
  subscription: { id: string; status: string; endsAt: Date | null } | null;
};

export async function resolveScholarPlan(userId: string): Promise<PlanResolution> {
  if (!subscriptionConfig.enabled) {
    return { plan: "UNLOCKED", role: UserRole.USER, entitlementsLoaded: true, subscription: null };
  }

  const [userResult, developerResult, subscriptionResult] = await Promise.allSettled([
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
    hasDeveloperSession(userId),
    db.scholarSubscription.findFirst({
      where: { userId, status: "active", OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
      orderBy: { startedAt: "desc" },
      select: { id: true, status: true, endsAt: true },
    }),
  ]);

  const entitlementsLoaded = userResult.status === "fulfilled"
    && developerResult.status === "fulfilled"
    && subscriptionResult.status === "fulfilled";
  const role = userResult.status === "fulfilled" ? userResult.value?.role ?? UserRole.USER : UserRole.USER;
  const developer = developerResult.status === "fulfilled" ? developerResult.value : false;
  const subscription = subscriptionResult.status === "fulfilled" ? subscriptionResult.value : null;

  // Any failed privilege lookup resolves to FREE. It must never grant access.
  const plan: ScholarPlan = developer ? "DEVELOPER" : subscription ? "PLUS" : "FREE";
  return { plan, role, entitlementsLoaded, subscription };
}

export async function resolveUserEntitlements(userId: string | null): Promise<ResolvedEntitlements> {
  if (!subscriptionConfig.enabled) {
    return {
      authenticated: Boolean(userId), userId, role: null, source: "subscriptions_disabled",
      plan: "UNLOCKED", entitlementsLoaded: true,
      entitlements: all(), subscriptionId: null, subscriptionStatus: null, subscriptionEndsAt: null,
      storageLimitBytes: subscriptionConfig.plusStorageMb * 1024 * 1024,
      dailyQuizLimit: subscriptionConfig.plusQuizGenerations,
      dailySlideshowLimit: subscriptionConfig.plusSlideshowGenerations,
    };
  }

  if (!userId) {
    return {
      authenticated: false, userId: null, role: null, source: "free", entitlements: [],
      plan: "FREE", entitlementsLoaded: true,
      subscriptionId: null, subscriptionStatus: null, subscriptionEndsAt: null,
      storageLimitBytes: subscriptionConfig.freeStorageMb * 1024 * 1024,
      dailyQuizLimit: subscriptionConfig.freeQuizGenerations,
      dailySlideshowLimit: subscriptionConfig.freeSlideshowGenerations,
    };
  }

  const resolution = await resolveScholarPlan(userId);
  const elevated = resolution.plan === "PLUS" || resolution.plan === "DEVELOPER";
  const source: ScholarAccessSource = resolution.plan === "DEVELOPER" ? "developer" : resolution.plan === "PLUS" ? "plus" : "free";
  return {
    authenticated: true,
    userId,
    role: resolution.role,
    plan: resolution.plan,
    source,
    entitlementsLoaded: resolution.entitlementsLoaded,
    entitlements: elevated ? all() : [],
    subscriptionId: resolution.subscription?.id ?? null,
    subscriptionStatus: resolution.subscription?.status ?? null,
    subscriptionEndsAt: resolution.subscription?.endsAt?.toISOString() ?? null,
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
  if (!user) {
    return { ok: false as const, response: Response.json({ error: "AUTH_REQUIRED" }, { status: 401 }) };
  }
  if (!access.entitlementsLoaded) {
    return { ok: false as const, response: Response.json({ error: "ENTITLEMENTS_UNAVAILABLE", message: "Scholar could not verify your plan right now. Please try again." }, { status: 503 }) };
  }
  if (!hasEntitlement(access, entitlement)) {
    await import("@/lib/subscriptions/audit").then(({ recordAudit }) => recordAudit("UNAUTHORIZED_PLUS_REQUEST_BLOCKED", { actorUserId: user?.id, targetUserId: user?.id, metadata: { entitlement } }));
    return { ok: false as const, response: Response.json({ error: "PLUS_REQUIRED", feature: entitlement }, { status: 403 }) };
  }
  return { ok: true as const, user, access };
}
