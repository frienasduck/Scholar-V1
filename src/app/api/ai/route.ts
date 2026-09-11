import { NextRequest, NextResponse } from "next/server";
import {
  generateScholarGroqJSON,
  generateScholarGroqText,
  streamScholarGroqText,
  type ScholarGroqMessage,
} from "@/lib/ai/scholar-groq";
import { publicAIError, AIProviderError } from "@/lib/ai/errors";
import { buildSystemPrompt } from "@/lib/ai/personas";
import { aiRequestSchema, quizGenerationSchema, schemaForMode, type AIMode } from "@/lib/ai/schemas";
import { getSessionUser } from "@/lib/auth/session";
import { requireEntitlement, resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { reserveGeneration, commitGeneration, releaseGeneration, QuotaExceededError, ReservationConflictError } from "@/lib/v2/usage/ledger";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const JSON_MODES = new Set<AIMode>([
  "json",
  "checkpoint",
  "flashcards",
  "mock-exam",
  "answer-evaluation",
]);

export async function POST(request: NextRequest) {
  // One budget for provider fallback AND schema repair; nested attempts must
  // never outlive the browser's 60-second deadline.
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]);
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("The request body must be valid JSON.", 400, "INVALID_JSON_BODY");
  }

  const parsed = aiRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({
      ok: false,
      error: {
        code: "INVALID_AI_REQUEST",
        message: "The AI request is invalid.",
        fields: parsed.error.flatten().fieldErrors,
      },
    }, { status: 400 });
  }

  const body = parsed.data;
  let sessionUser: Awaited<ReturnType<typeof getSessionUser>>;
  try { sessionUser = await getSessionUser(); }
  catch { return errorResponse("Scholar could not verify your session. Please retry.", 503, "SESSION_UNAVAILABLE"); }
  if (!sessionUser) return errorResponse("Sign in to use Scholar AI.", 401, "AUTH_REQUIRED");
  if (sessionUser) {
    try {
      await enforceRateLimit(sessionUser.id, "ai-generation", 90, 60 * 60 * 1000);
      if (body.feature) {
        const required = await requireEntitlement(body.feature);
        if (!required.ok) return required.response;
      }
    } catch (error) {
      if (error instanceof RateLimitError) return errorResponse("Too many AI requests. Please wait and try again.", 429, "RATE_LIMITED");
      if (error instanceof Error && (error as Error & { code?: string }).code === "QUOTA_REACHED") return errorResponse("Your daily generation limit has been reached. Upgrade to Scholar Plus for a higher limit.", 429, "QUOTA_REACHED");
      return errorResponse("Scholar could not verify this AI request.", 500, "ACCESS_CHECK_FAILED");
    }
  }
  const queryStream = request.nextUrl.searchParams.get("stream") === "1";
  const mode: AIMode = body.mode ?? (queryStream ? "stream" : (body.json ? "json" : "chat"));
  const totalCharacters = body.messages.reduce((sum, message) => sum + message.content.length, 0);
  if (totalCharacters > 60_000) {
    return errorResponse("The conversation is too long. Start a new chat or shorten the input.", 413, "AI_CONTEXT_TOO_LARGE");
  }

  const systemPrompt = buildSystemPrompt({
    persona: body.persona,
    mode,
    scholarClass: body.scholarClass,
    jeeMode: body.jeeMode,
  });
  const messages: ScholarGroqMessage[] = [
    { role: "system", content: systemPrompt + (body.usage === "quiz_generation" ? "\nFor quiz generation: stay strictly within the requested chapter. Solve each question before constructing four distinct options. Include exactly one correct option matching the answer and explanation. State constants and rounding assumptions in numerical questions. Recalculate arithmetic and units; replace any question with inconsistent choices. Return only polished final explanations, never draft self-corrections or a nearest-option guess." : "") },
    ...body.messages
      .filter((message) => message.role !== "system")
      .slice(-24)
      .map((message) => ({ role: message.role, content: message.content }) as ScholarGroqMessage),
  ];

  let reservationKey: string | undefined;
  if (body.usage) {
    try {
      const key = `${sessionUser.id}:${body.requestId ?? crypto.randomUUID()}:${body.usage}`;
      const reserved = await reserveGeneration({ userId: sessionUser.id, feature: body.usage === "quiz_generation" ? "quiz" : "slideshow", idempotencyKey: key, access: await resolveUserEntitlements(sessionUser.id) });
      if (reserved.replayed) return errorResponse("This generation is already running or completed. Check your saved result before retrying.", 409, "GENERATION_REPLAY");
      reservationKey = key;
    } catch (error) {
      if (error instanceof QuotaExceededError) return errorResponse("Your daily generation allowance has been reached.", 429, "QUOTA_REACHED");
      if (error instanceof ReservationConflictError) return errorResponse("This request has already been handled. Start a new generation to retry.", 409, "GENERATION_REPLAY");
      console.warn("[Scholar AI] quota reservation unavailable");
      return errorResponse("Scholar could not check your generation allowance. Please retry.", 503, "QUOTA_UNAVAILABLE");
    }
  }
  if (queryStream || mode === "stream") {
    return streamResponse(messages, body.temperature, signal, reservationKey, sessionUser.id);
  }

  try {
    if (JSON_MODES.has(mode)) {
      const schema = body.usage === "quiz_generation" ? quizGenerationSchema : schemaForMode(mode);
      let repair = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const value = await generateScholarGroqJSON({
            messages: [...withJSONInstruction(messages), ...(repair ? [{ role: "system" as const, content: repair }] : [])],
            temperature: Math.min(body.temperature, attempt ? 0.4 : 0.8), signal,
          });
          const validated = schema?.safeParse(value);
          if (validated && !validated.success) {
            repair = `Return a complete JSON object matching the requested format. Fix these validation issues: ${validated.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ").slice(0, 1500)}`;
            throw new AIProviderError("The AI response did not match the required structure. Please retry.", 502, "AI_SCHEMA_MISMATCH");
          }
          await recordUsage(reservationKey, sessionUser.id);
          return NextResponse.json({ ok: true, data: validated?.success ? validated.data : value });
        } catch (error) {
          if (attempt || signal.aborted || !(error instanceof AIProviderError) || !["AI_SCHEMA_MISMATCH", "GROQ_INVALID_JSON"].includes(error.code)) throw error;
          repair ||= "Return valid JSON only. Escape newlines and backslashes correctly, close all brackets, and include every requested field.";
        }
      }
      throw new AIProviderError("The AI returned invalid structured data. Please retry.");
    }

    const text = await generateScholarGroqText({
      messages,
      temperature: body.temperature,
      signal,
      maxTokens: 4_000,
    });
    await recordUsage(reservationKey, sessionUser.id);
    return NextResponse.json({ ok: true, text });
  } catch (error) {
    await releaseUsage(reservationKey, sessionUser.id);
    const detail = publicAIError(error);
    return errorResponse(detail.message, detail.status, detail.code);
  }
}

function withJSONInstruction(
  messages: ScholarGroqMessage[],
): ScholarGroqMessage[] {
  const [system, ...rest] = messages;
  return [
    {
      role: "system",
      content: `${typeof system.content === "string" ? system.content : ""}\n\nReturn only one valid JSON object. Do not use markdown fences or add commentary outside the object.`,
    },
    ...rest,
  ];
}

/**
 * Record a successful generation against the user's daily quota.
 * A reserved unit is committed exactly once, only after output validation.
 */
async function recordUsage(key: string | undefined, userId: string) {
  if (key) await commitGeneration(key, userId);
}

async function releaseUsage(key: string | undefined, userId: string) {
  if (key) await releaseGeneration(key, userId).catch(() => console.warn("[Scholar AI] reservation release deferred to expiry"));
}

function streamResponse(
  messages: ScholarGroqMessage[],
  temperature: number,
  signal: AbortSignal,
  reservationKey: string | undefined,
  userId: string,
): Response {
  const encoder = new TextEncoder();
  const disconnected = new AbortController();
  const streamSignal = AbortSignal.any([signal, disconnected.signal]);
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed || disconnected.signal.aborted) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };
      const send = (event: unknown) => {
        if (closed || disconnected.signal.aborted) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await streamScholarGroqText({ messages, temperature, signal: streamSignal, maxTokens: 4_000 }, (delta) => {
          send({ delta });
        });
        // Usage is recorded only after the stream completes without error, so
        // aborted or failed generations never consume daily quota.
        await recordUsage(reservationKey, userId);
        send({ done: true });
      } catch (error) {
        await releaseUsage(reservationKey, userId);
        const detail = publicAIError(error);
        send({ error: { code: detail.code, message: detail.message } });
      } finally {
        close();
      }
    },
    cancel() {
      disconnected.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}
