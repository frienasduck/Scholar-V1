export type LiveTutorScopeError = {
  status: 403 | 409;
  message: string;
};

export function validateLiveTutorSessionScope(
  existing: { userId: string; profileId: string; personality: string } | null,
  requested: { userId: string; profileId: string; personality: string },
): LiveTutorScopeError | null {
  if (!existing) return null;
  if (existing.userId !== requested.userId) {
    return { status: 403, message: "LAM AI session ownership could not be verified." };
  }
  if (existing.profileId !== requested.profileId || existing.personality !== requested.personality) {
    return { status: 409, message: "This LAM AI session belongs to a different profile or personality. Start a new session." };
  }
  return null;
}

export function validateLiveTutorMessageScope(
  existing: { sessionId: string } | null,
  requestedSessionId: string,
): LiveTutorScopeError | null {
  if (existing && existing.sessionId !== requestedSessionId) {
    return { status: 403, message: "LAM AI turn ownership could not be verified." };
  }
  return null;
}
