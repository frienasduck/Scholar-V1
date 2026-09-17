import "server-only";
import { normalizeEmail } from "@/lib/auth/identity";

const BETA_CONTACT_EMAIL = "scholarofficialacc@gmail.com";

/** Missing or invalid configuration keeps the private beta closed. */
export function privateBetaEnabled(): boolean {
  return !["false", "0", "off", "no"].includes(process.env.SCHOLAR_PRIVATE_BETA?.trim().toLowerCase() ?? "");
}

function entries(value: string): string[] {
  return value.split(/[,;\s]+/).map((entry) => entry.trim()).filter(Boolean);
}

/** Evaluate only a server-authenticated identity, never client profile data. */
export function isBetaAllowed(user: { id: string; email: string } | null | undefined): boolean {
  if (!user) return false;
  if (!privateBetaEnabled()) return true;

  // Account IDs take precedence when configured. An explicitly empty list
  // denies everyone rather than accidentally restoring the default email.
  const configuredIds = process.env.SCHOLAR_BETA_ALLOWED_USER_IDS;
  if (configuredIds !== undefined) return entries(configuredIds).includes(user.id);

  const configuredEmails = process.env.SCHOLAR_BETA_ALLOWED_EMAILS;
  const allowedEmails = entries(configuredEmails ?? BETA_CONTACT_EMAIL).map(normalizeEmail);
  return allowedEmails.includes(normalizeEmail(user.email));
}

/** Public product status only; never serialize the account allowlist. */
export function publicBetaConfig() {
  const privateBeta = privateBetaEnabled();
  return { privateBeta, registrationEnabled: !privateBeta, contactEmail: BETA_CONTACT_EMAIL };
}

export function privateBetaLoginMessage(): string {
  return `Scholar is currently in private beta. We could not sign you in with this account. You can continue in Guest Mode or join a Group Study room. For beta access, contact ${BETA_CONTACT_EMAIL}.`;
}

export function privateBetaRegistrationMessage(): string {
  return `Scholar is currently in private beta. New Scholar accounts are not publicly available yet. Continue in Guest Mode or join a Group Study room. For beta access, contact ${BETA_CONTACT_EMAIL}.`;
}
