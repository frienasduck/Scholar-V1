import "server-only";
import { subscriptionConfig } from "@/lib/subscriptions/config";

export function isConfiguredAdminEmail(email: string) {
  const configured = new Set([
    subscriptionConfig.adminPaymentEmail,
    ...(process.env.SCHOLAR_ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()),
  ].filter(Boolean));
  return configured.has(email.trim().toLowerCase());
}
