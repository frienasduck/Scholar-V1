import { NextRequest, NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { generateGroqJSON, generateGroqText, streamGroqText } from "@/lib/ai/groq";
import { publicAIError, AIProviderError } from "@/lib/ai/errors";
import { buildSystemPrompt } from "@/lib/ai/personas";
import { aiRequestSchema, schemaForMode, type AIMode } from "@/lib/ai/schemas";

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
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...body.messages
      .filter((message) => message.role !== "system")
      .slice(-24)
      .map((message) => ({ role: message.role, content: message.content }) as ChatCompletionMessageParam),
  ];

  if (queryStream || mode === "stream") {
    return streamResponse(messages, body.temperature, request.signal);
  }

  try {
    if (JSON_MODES.has(mode)) {
      const value = await generateGroqJSON({
        messages: withJSONInstruction(messages),
        temperature: Math.min(body.temperature, 0.8),
        signal: request.signal,
      });
      const schema = schemaForMode(mode);
      if (schema) {
        const validated = schema.safeParse(value);
        if (!validated.success) {
          throw new AIProviderError(
            "The AI response did not match the required structure. Please retry.",
            502,
            "AI_SCHEMA_MISMATCH",
          );
        }
        return NextResponse.json({ ok: true, data: validated.data });
      }
      return NextResponse.json({ ok: true, data: value });
    }

    const text = await generateGroqText({
      messages,
      temperature: body.temperature,
      signal: request.signal,
      maxTokens: mode === "lesson" ? 8_000 : 6_000,
    });
    return NextResponse.json({ ok: true, text });
  } catch (error) {
    const detail = publicAIError(error);
    return errorResponse(detail.message, detail.status, detail.code);
  }
}

function withJSONInstruction(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
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
  messages: ChatCompletionMessageParam[],
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
        await streamGroqText({ messages, temperature, signal, maxTokens: 8_000 }, (delta) => {
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
      // The request signal is forwarded to Groq and is aborted when the client disconnects.
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
