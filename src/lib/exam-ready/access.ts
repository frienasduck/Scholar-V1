import "server-only";
import { isServerFlagEnabled } from "@/lib/v2/server-flags";
import { isFlagEnabled } from "@/lib/v2/flags";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
export function accessDecision(enabled: boolean, free: boolean, plus: boolean, until: string | undefined, now = Date.now()) {
    const end = until ? Date.parse(until) : null;
    const temporary = free && (end === null || Number.isFinite(end) && end > now);
    return { allowed: enabled && (temporary || plus), source: !enabled ? "unavailable" : temporary ? "temporary_free" : plus ? "plus" : "unavailable", freeUntil: temporary && end !== null ? new Date(end).toISOString() : null };
}
export async function examAccess(userId: string | null) {
    const flag = (key: "v2_exam_ready" | "v2_exam_ready_free") => process.env.DB_DATABASE_URL ? isServerFlagEnabled(key, userId) : Promise.resolve(isFlagEnabled(key));
    const [enabled, free] = await Promise.all([flag("v2_exam_ready"), flag("v2_exam_ready_free")]);
    const temporary = accessDecision(enabled, free, false, process.env.EXAM_READY_FREE_UNTIL).allowed;
    const plus = !temporary && userId ? (await resolveUserEntitlements(userId)).entitlements.includes("exam_prep") : false;
    return accessDecision(enabled, free, plus, process.env.EXAM_READY_FREE_UNTIL);
}
