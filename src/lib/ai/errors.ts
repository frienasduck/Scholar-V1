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

export function publicAIError(error: unknown): { message: string; status: number; code: string } {
  if (error instanceof AIProviderError) {
    return { message: error.message, status: error.status, code: error.code };
  }

  if (error instanceof Error && error.name === "AbortError") {
    return { message: "The AI request timed out. Please try again.", status: 504, code: "AI_TIMEOUT" };
  }

  return {
    message: process.env.NODE_ENV === "development" && error instanceof Error
      ? error.message
      : "The AI service is temporarily unavailable. Please try again.",
    status: 500,
    code: "AI_INTERNAL_ERROR",
  };
}
