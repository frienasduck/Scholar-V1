import "server-only";
import { UserRole } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";

export class UnauthorizedAdminAccessError extends Error {
  constructor() {
    super("Administrator access is required.");
    this.name = "UnauthorizedAdminAccessError";
  }
}

export async function getAdminUser() {
  const user = await getSessionUser();
  return user?.role === UserRole.ADMIN ? user : null;
}

export async function requireAdminUser() {
  const user = await getAdminUser();
  if (!user) throw new UnauthorizedAdminAccessError();
  return user;
}
