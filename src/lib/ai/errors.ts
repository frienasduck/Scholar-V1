export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
    public readonly code = "AI_PROVIDER_ERROR",
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

/**
 * User-facing AI error messages with clear, actionable guidance.
 * Codes are stable identifiers; messages are designed for Scholar's
 * premium liquid-glass error states.
 */
const AI_ERROR_MAP: Record<string, { title: string; description: string }> = {
  AI_TIMEOUT: {
    title: "Request timed out",
    description: "The AI took too long to respond. Try again in a moment.",
  },
  AI_CONTEXT_TOO_LARGE: {
    title: "Conversation too long",
    description: "Start a new chat or shorten your input to continue.",
  },
  AI_SCHEMA_MISMATCH: {
    title: "Unexpected response format",
    description: "The AI returned data in an unexpected structure. Retry once.",
  },
  AI_PROVIDER_ERROR: {
    title: "AI service unavailable",
    description: "Try again in a moment. If this persists, the provider may be undergoing maintenance.",
  },
  AI_INTERNAL_ERROR: {
    title: "AI provider configuration issue",
    description: "The AI service could not be reached. This is a temporary infrastructure issue.",
  },
  AI_RATE_LIMITED: {
    title: "Too many AI requests",
    description: "Please wait a moment before trying again.",
  },
  AI_UNAVAILABLE: {
    title: "AI service unavailable",
    description: "Try again in a moment.",
  },
};

/**
 * Safely extract a user-facing error envelope from any thrown value.
 * Does NOT expose stack traces, provider details, or internal messages
 * to non-developer users.
 */
export function publicAIError(error: unknown): { message: string; status: number; code: string } {
  if (error instanceof AIProviderError) {
    return { message: error.message, status: error.status, code: error.code };
  }

  if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
    return { message: AI_ERROR_MAP.AI_TIMEOUT.description, status: 504, code: "AI_TIMEOUT" };
  }

  // Public errors never include infrastructure details, even in development.
  return {
    message: AI_ERROR_MAP.AI_INTERNAL_ERROR.description,
    status: 500,
    code: "AI_INTERNAL_ERROR",
  };
}

/**
 * Return the user-facing title for an AI error code.
 */
export function aiErrorTitle(code: string): string {
  return AI_ERROR_MAP[code]?.title ?? "Something went wrong";
}

/**
 * Return the user-facing description for an AI error code.
 */
export function aiErrorDescription(code: string): string {
  return AI_ERROR_MAP[code]?.description ?? "Please try again in a moment.";
}
