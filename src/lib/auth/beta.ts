import "server-only";
import { BETA_CONTACT_EMAIL } from "@/lib/auth/identity";

/** Compatibility facade: ordinary account authentication is now public. */
export function privateBetaEnabled(): boolean {
  return false;
}

/**
 * Evaluate only a server-authenticated identity, never client profile data.
 *
 * Historic beta environment variables never restrict ordinary accounts.
 * Developer Access and Group Study entitlements remain separate controls.
 */
export async function isBetaAllowed(user: { id: string; email: string; sessionVersion?: number } | null | undefined): Promise<boolean> {
  return Boolean(user?.id);
}

/** Public product status only; never serialize the account allowlist. */
export function publicBetaConfig() {
  const privateBeta = privateBetaEnabled();
  return { privateBeta, registrationEnabled: !privateBeta, contactEmail: BETA_CONTACT_EMAIL };
}
