// Local E2E test bridge invoked ONLY when Playwright tests real browser rendering
// against live `.env.local` AI/OCR providers in an environment without local Postgres.
import { mock } from "bun:test";
mock.module("server-only", () => ({}));

const { executePluginServer, PLUGIN_EXECUTE_REQUEST_SCHEMA } = await import("../src/lib/lam/plugin-server");
const { publicAIError } = await import("../src/lib/ai/errors");

const PORT = Number(process.env.LAM_E2E_BRIDGE_PORT || 3099);

const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 120,
  async fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, groqConfigured: Boolean(process.env.GROQ_API_KEY) });
    }
    if (req.method !== "POST" || url.pathname !== "/execute") {
      return new Response("Not Found", { status: 404 });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return Response.json({ ok: false, error: { code: "BAD_JSON", message: "Invalid JSON" } }, { status: 400 });
    }

    const parsed = PLUGIN_EXECUTE_REQUEST_SCHEMA.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "INVALID_PLUGIN_REQUEST",
            message: "Invalid plugin request payload",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const encoder = new TextEncoder();
    const ac = new AbortController();
    req.signal.addEventListener("abort", () => ac.abort(), { once: true });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch { /* ignore */ }
        };
        const send = (event: object) => {
          if (closed || ac.signal.aborted) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          for (let attempt = 0; attempt < 4; attempt += 1) {
            try {
              await executePluginServer({
                input,
                userId: "e2e-test-user",
                customAI: null,
                signal: AbortSignal.any([ac.signal, AbortSignal.timeout(210_000)]),
                emit: send,
              });
              break;
            } catch (err) {
              const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
              const retryAfter =
                err && typeof err === "object" && "retryAfterSeconds" in err
                  ? Number(err.retryAfterSeconds)
                  : 10;
              if ((code === "GROQ_RATE_LIMITED" || code === "PROVIDER_FAILURE") && attempt < 3 && !ac.signal.aborted) {
                send({
                  type: "status",
                  status: "preparing",
                  progressStage: `Provider cooldown (${retryAfter + 2}s), retrying automatically...`,
                });
                await new Promise((r) =>
                  setTimeout(r, Math.min(20_000, Math.max(4_000, (retryAfter + 2) * 1000))),
                );
                continue;
              }
              throw err;
            }
          }
        } catch (err) {
          if (!ac.signal.aborted) {
            const pub = publicAIError(err);
            send({ type: "error", code: pub.code, status: pub.status, message: pub.message });
          }
        } finally {
          close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  },
});

console.log(`LAM E2E bridge listening on http://127.0.0.1:${server.port}`);
