export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Public beta contact identity (shown in beta messages, never a secret). */
export const BETA_CONTACT_EMAIL = "scholarofficialacc123@gmail.com";
