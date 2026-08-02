import { NextRequest, NextResponse } from "next/server";
import {
  generateScholarGroqJSON,
  generateScholarGroqText,
  streamScholarGroqText,
  type ScholarGroqMessage,
} from "@/lib/ai/scholar-groq";
import { publicAIError, AIProviderError } from "@/lib/ai/errors";
import { buildSystemPrompt } from "@/lib/ai/personas";
import { aiRequestSchema, schemaForMode, type AIMode } from "@/lib/ai/schemas";
import { getSessionUser } from "@/lib/auth/session";
import { requireEntitlement, resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { consumeGeneration } from "@/lib/subscriptions/usage";
import { subscriptionConfig } from "@/lib/subscriptions/config";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

const JSON_MODES = new Set<AIMode>([
  "json",
  "checkpoint",
  "flashcards",
  "mock-exam",
  "answer-evaluation",
]);

export async function POST(request: NextRequest) {
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
  const sessionUser = await getSessionUser();
  if (subscriptionConfig.enabled && !sessionUser) return errorResponse("Sign in to use Scholar AI.", 401, "AUTH_REQUIRED");
  if (sessionUser) {
    try {
      await enforceRateLimit(sessionUser.id, "ai-generation", 90, 60 * 60 * 1000);
      if (body.feature) {
        const required = await requireEntitlement(body.feature);
        if (!required.ok) return required.response;
      }
      if (body.usage) await consumeGeneration(sessionUser.id, body.usage, await resolveUserEntitlements(sessionUser.id));
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
    { role: "system", content: systemPrompt },
    ...body.messages
      .filter((message) => message.role !== "system")
      .slice(-24)
      .map((message) => ({ role: message.role, content: message.content }) as ScholarGroqMessage),
  ];

  if (queryStream || mode === "stream") {
    return streamResponse(messages, body.temperature, request.signal);
  }

  try {
    if (JSON_MODES.has(mode)) {
      let value = await generateScholarGroqJSON({
        messages: withJSONInstruction(messages),
        temperature: Math.min(body.temperature, 0.8),
        signal: request.signal,
      });
      const schema = schemaForMode(mode);
      if (schema) {
        let validated = schema.safeParse(value);
        if (!validated.success) {
          value = await generateScholarGroqJSON({
            messages: [
              ...withJSONInstruction(messages),
              {
                role: "system",
                content:
                  "The prior JSON did not match the required feature schema. Regenerate it once with every required field, correct field type, and no additional prose.",
              },
            ],
            temperature: Math.min(body.temperature, 0.5),
            signal: request.signal,
          });
          validated = schema.safeParse(value);
          if (!validated.success) {
            throw new AIProviderError(
              "The AI response did not match the required structure. Please retry.",
              502,
              "AI_SCHEMA_MISMATCH",
            );
          }
        }
        return NextResponse.json({ ok: true, data: validated.data });
      }
      return NextResponse.json({ ok: true, data: value });
    }

    const text = await generateScholarGroqText({
      messages,
      temperature: body.temperature,
      signal: request.signal,
      maxTokens: 6_000,
    });
    return NextResponse.json({ ok: true, text });
  } catch (error) {
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

function streamResponse(
  messages: ScholarGroqMessage[],
  temperature: number,
  signal: AbortSignal,
): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };
      const send = (event: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await streamScholarGroqText({ messages, temperature, signal, maxTokens: 6_000 }, (delta) => {
          send({ delta });
        });
        send({ done: true });
      } catch (error) {
        const detail = publicAIError(error);
        send({ error: { code: detail.code, message: detail.message } });
      } finally {
        close();
      }
    },
    cancel() {
      // The request signal is forwarded to Groq and aborts when the client disconnects.
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
