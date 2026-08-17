/**
 * Scholar API types — mirror the backend contracts served by the existing
 * Next.js app (src/app/api/* and src/lib/subscriptions/*). These are the
 * single source of truth for the Android API client.
 */

export type Plan = "FREE" | "PLUS" | "DEVELOPER" | "UNLOCKED";

export type UserRole = "USER" | "ADMIN";

/** Shape of `user` returned by /api/auth/login and /api/auth/register. */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/** Shape of `user` inside the /api/auth/session response. */
export interface SessionUser extends AuthUser {
  coins: number;
  currentScholarClass: 9 | 11;
}

export interface SessionLimits {
  storageBytes: number;
  dailyQuiz: number;
  dailySlideshow: number;
}

export interface PendingPayment {
  publicReference: string;
  status: string;
  createdAt: string;
  proofSubmittedAt: string | null;
}

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
}

/** Response of GET /api/auth/session (see src/app/api/auth/session/route.ts). */
export interface SessionResponse {
  authenticated: boolean;
  user?: SessionUser;
  plan?: Plan;
  entitlements?: string[];
  limits?: SessionLimits;
  entitlementsLoaded?: boolean;
  developerMode?: boolean;
  access?: {
    plan: Plan;
    entitlements: string[];
    storageLimitBytes: number;
    dailyQuizLimit: number;
    dailySlideshowLimit: number;
    entitlementsLoaded: boolean;
  };
  usage?: Record<string, unknown>;
  storage?: StorageUsage;
  pendingPayment?: PendingPayment | null;
  config?: Record<string, unknown>;
}

export interface LoginResponse {
  ok: true;
  user: AuthUser;
}

export interface RegisterResponse {
  ok: true;
  user: AuthUser;
}

/** Error envelope used by Scholar API routes. */
export interface ApiErrorBody {
  error?: string;
  message?: string;
}
