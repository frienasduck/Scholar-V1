import { NextRequest, NextResponse } from "next/server";
import { publicAIError } from "@/lib/ai/errors";
import { AIRequestBodyError, readBoundedAIJSON } from "@/lib/ai/request";
import { getUserAISettings } from "@/lib/ai/user-provider";
import { getSessionUser } from "@/lib/auth/session";
import { pluginById } from "@/lib/lam/plugin-registry";
import { pluginPlusRequirement } from "@/lib/lam/plugin-prompts";
import {
  executePluginServer,
  PLUGIN_EXECUTE_REQUEST_SCHEMA,
} from "@/lib/lam/plugin-server";
import { mutationOrigin } from "@/lib/resources/http";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import {
  requireEntitlement,
  resolveUserEntitlements,
} from "@/lib/subscriptions/entitlements";
import {
  commitGeneration,
  QuotaExceededError,
  releaseGeneration,
  ReservationConflictError,
  reserveGeneration,
} from "@/lib/v2/usage/ledger";

export const runtime = "nodejs";
export const maxDuration = 120;

const activeExecutions = new Set<string>();

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  if (!mutationOrigin(request)) {
    return jsonError("ORIGIN_REJECTED", "Open LAM plugins from Scholar.", 403);
  }

  let sessionUser: Awaited<ReturnType<typeof getSessionUser>>;
  try {
    sessionUser = await getSessionUser();
  } catch {
    return jsonError("SESSION_UNAVAILABLE", "Scholar could not verify your session. Please retry.", 503);
  }
  if (!sessionUser) {
    return jsonError("AUTH_REQUIRED", "Sign in to execute LAM plugins.", 401);
  }

  try {
    await enforceRateLimit(sessionUser.id, "lam-plugin-burst", 25, 60 * 1000);
    await enforceRateLimit(sessionUser.id, "lam-plugin-hourly", 120, 60 * 60 * 1000);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, error: { code: "RATE_LIMITED", message: "Too many plugin requests. Please wait and retry." } },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    return jsonError("ACCESS_CHECK_FAILED", "Scholar could not verify rate limits.", 503);
  }

  let raw: unknown;
  try {
    raw = await readBoundedAIJSON(request, 15 * 1024 * 1024);
  } catch (error) {
    if (error instanceof AIRequestBodyError) {
      return jsonError(error.code, error.message, error.status);
    }
    return jsonError("INVALID_JSON_BODY", "The plugin request body could not be read.", 400);
  }

  const parsed = PLUGIN_EXECUTE_REQUEST_SCHEMA.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_PLUGIN_REQUEST",
          message: "The plugin request payload is invalid.",
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const plugin = pluginById(input.pluginId);
  if (!plugin) {
    return jsonError("PLUGIN_NOT_FOUND", "Unknown LAM plugin.", 404);
  }
  if (plugin.availability !== "available") {
    return jsonError(
      "PLUGIN_PLANNED",
      `${plugin.name} is planned for a future release and cannot be executed.`,
      400,
    );
  }

  // Authoritative server-side Plus entitlement gate — impossible to spoof from client.
  const plusFeature = pluginPlusRequirement(plugin.id);
  if (plusFeature) {
    const plusAccess = await requireEntitlement(plusFeature);
    if (!plusAccess.ok) return plusAccess.response;
  }

  if (input.jeeMode) {
    const jeeAccess = await requireEntitlement("jee_focused_mode");
    if (!jeeAccess.ok) return jeeAccess.response;
  }

  const dedupeKey = `${sessionUser.id}:${input.executionId}`;
  if (activeExecutions.has(dedupeKey)) {
    return jsonError(
      "DUPLICATE_EXECUTION",
      "This plugin execution is already in progress.",
      409,
    );
  }

  let reservationKey: string | undefined;
  const usageFeature =
    plugin.id === "slideshow-maker"
      ? "slideshow"
      : plugin.id === "notes-to-quiz"
        ? "quiz"
        : null;

  if (usageFeature) {
    try {
      const access = await resolveUserEntitlements(sessionUser.id);
      const key = `${sessionUser.id}:${input.executionId}:${usageFeature}`;
      const reserved = await reserveGeneration({
        userId: sessionUser.id,
        feature: usageFeature,
        idempotencyKey: key,
        access,
      });
      if (reserved.replayed) {
        return jsonError(
          "GENERATION_REPLAY",
          "This generation has already completed or is in progress.",
          409,
        );
      }
      reservationKey = key;
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return jsonError("QUOTA_REACHED", "Your daily generation limit has been reached. Upgrade to Scholar Plus for higher limits.", 429);
      }
      if (error instanceof ReservationConflictError) {
        return jsonError("GENERATION_REPLAY", "Duplicate generation request rejected.", 409);
      }
      return jsonError("QUOTA_UNAVAILABLE", "Scholar could not verify your generation allowance.", 503);
    }
  }

  const savedProvider = await getUserAISettings(sessionUser.id).catch(() => null);
  const customAI = savedProvider?.scopes.includes("ai-tutor") || savedProvider?.scopes.includes("lam")
    ? savedProvider
    : null;

  const encoder = new TextEncoder();
  const disconnected = new AbortController();
  const signal = AbortSignal.any([request.signal, disconnected.signal, AbortSignal.timeout(110_000)]);
  activeExecutions.add(dedupeKey);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        activeExecutions.delete(dedupeKey);
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch { /* already closed */ }
      };
      const send = (event: object) => {
        if (closed || disconnected.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch { /* stream closed */ }
      };

      try {
        await executePluginServer({
          input,
          userId: sessionUser.id,
          customAI,
          signal,
          emit: (event) => send(event),
        });
        if (reservationKey) {
          await commitGeneration(reservationKey, sessionUser.id);
        }
      } catch (error) {
        if (reservationKey) {
          await releaseGeneration(reservationKey, sessionUser.id).catch(() => undefined);
        }
        if (!disconnected.signal.aborted) {
          const detail = publicAIError(error);
          send({
            type: "error",
            code: detail.code,
            status: detail.status,
            message: detail.message,
          });
        }
      } finally {
        close();
      }
    },
    cancel() {
      disconnected.abort();
      activeExecutions.delete(dedupeKey);
      if (reservationKey) {
        void releaseGeneration(reservationKey, sessionUser.id).catch(() => undefined);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
