import { beforeEach, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
import { z } from "zod";

mock.module("server-only", () => ({}));

let currentUser: { id: string } | null = { id: "user-test-1" };
let currentPlan: "FREE" | "PLUS" = "FREE";
let executionMode: "succeed" | "fail" | "slow" = "succeed";
let releaseGate: (() => void) | null = null;

const commitMock = mock(async () => {});
const releaseMock = mock(async () => {});
const executeServerMock = mock(async ({ input, emit }: {
  input: { executionId: string; pluginId: string; prompt: string };
  emit: (event: Record<string, unknown>) => void;
}) => {
  if (executionMode === "slow") {
    await new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
  }
  if (executionMode === "fail") {
    throw new Error("Simulated provider failure");
  }
  emit({
    type: "status",
    status: "running",
    progressStage: "Running test execution...",
    currentStep: 2,
    totalSteps: 3,
  });
  emit({
    type: "result",
    content: `Completed **${input.pluginId}**`,
    execution: {
      executionId: input.executionId,
      pluginId: input.pluginId,
      pluginName: input.pluginId,
      status: "completed",
      outputType: "generic",
    },
  });
});

class MockRateLimitError extends Error {
  retryAfterSeconds = 60;
}
class MockQuotaExceededError extends Error {}
class MockReservationConflictError extends Error {}

mock.module("@/lib/resources/http", () => ({
  mutationOrigin: (request: Request) => request.headers.get("origin") === "http://localhost:3000",
}));
mock.module("@/lib/auth/session", () => ({
  getSessionUser: async () => currentUser,
}));
mock.module("@/lib/security/rate-limit", () => ({
  RateLimitError: MockRateLimitError,
  enforceRateLimit: async () => {},
}));
mock.module("@/lib/subscriptions/entitlements", () => ({
  resolveUserEntitlements: async () => ({
    plan: currentPlan,
    features: currentPlan === "PLUS"
      ? new Set(["aisig", "homework_scanner", "slideshow_generation_plus", "jee_focused_mode"])
      : new Set(),
  }),
  requireEntitlement: async (feature: string) => {
    if (currentPlan === "PLUS") return { ok: true };
    return {
      ok: false,
      response: Response.json(
        { ok: false, error: { code: "PLUS_REQUIRED", message: `${feature} requires Scholar Plus.` } },
        { status: 403 },
      ),
    };
  },
}));
mock.module("@/lib/v2/usage/ledger", () => ({
  QuotaExceededError: MockQuotaExceededError,
  ReservationConflictError: MockReservationConflictError,
  reserveGeneration: async () => ({ replayed: false }),
  commitGeneration: commitMock,
  releaseGeneration: releaseMock,
}));
mock.module("@/lib/ai/user-provider", () => ({
  getUserAISettings: async () => null,
}));
mock.module("@/lib/lam/plugin-server", () => {
  return {
    PLUGIN_EXECUTE_REQUEST_SCHEMA: z.object({
      executionId: z.string().min(4).max(120),
      pluginId: z.string().min(2).max(80),
      prompt: z.string().max(12_000).default(""),
      scholarClass: z.union([z.literal(9), z.literal(11)]).default(11),
      jeeMode: z.boolean().default(false),
    }),
    executePluginServer: executeServerMock,
  };
});

const { POST } = await import("../src/app/api/lam/plugins/execute/route");

beforeEach(() => {
  currentUser = { id: "user-test-1" };
  currentPlan = "FREE";
  executionMode = "succeed";
  releaseGate = null;
  executeServerMock.mockClear();
  commitMock.mockClear();
  releaseMock.mockClear();
});

function makeReq(body: Record<string, unknown>, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/lam/plugins/execute", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("rejects cross-origin plugin execution with 403 ORIGIN_REJECTED", async () => {
  const res = await POST(
    makeReq({ executionId: "exec-origin-1", pluginId: "concept-explainer", prompt: "Gravitation" }, "https://evil.example"),
  );
  expect(res.status).toBe(403);
  const data = await res.json();
  expect(data.error.code).toBe("ORIGIN_REJECTED");
  expect(executeServerMock).not.toHaveBeenCalled();
});

test("rejects unauthenticated callers with 401 AUTH_REQUIRED", async () => {
  currentUser = null;
  const res = await POST(
    makeReq({ executionId: "exec-auth-1", pluginId: "concept-explainer", prompt: "Gravitation" }),
  );
  expect(res.status).toBe(401);
  const data = await res.json();
  expect(data.error.code).toBe("AUTH_REQUIRED");
  expect(executeServerMock).not.toHaveBeenCalled();
});

test("rejects unknown plugin IDs with 404 and planned plugins with 400", async () => {
  const missingRes = await POST(
    makeReq({ executionId: "exec-404-1", pluginId: "non-existent-plugin", prompt: "test" }),
  );
  expect(missingRes.status).toBe(404);

  for (const plannedId of ["weekly-review", "citation-helper"]) {
    const plannedRes = await POST(
      makeReq({ executionId: `exec-planned-${plannedId}`, pluginId: plannedId, prompt: "test" }),
    );
    expect(plannedRes.status).toBe(400);
    const data = await plannedRes.json();
    expect(data.error.code).toBe("PLUGIN_PLANNED");
  }
  expect(executeServerMock).not.toHaveBeenCalled();
});

test("blocks Free users on all Plus-gated plugins (aisig, homework-scanner, slideshow-maker) server-side", async () => {
  currentPlan = "FREE";
  for (const plusPluginId of ["aisig", "homework-scanner", "slideshow-maker"]) {
    const res = await POST(
      makeReq({ executionId: `exec-plus-${plusPluginId}`, pluginId: plusPluginId, prompt: "Newton laws" }),
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("PLUS_REQUIRED");
  }
  expect(executeServerMock).not.toHaveBeenCalled();
});

test("blocks Free users when jeeMode=true is requested directly", async () => {
  currentPlan = "FREE";
  const res = await POST(
    makeReq({ executionId: "exec-jee-free", pluginId: "concept-explainer", prompt: "Electrostatics", jeeMode: true }),
  );
  expect(res.status).toBe(403);
  const data = await res.json();
  expect(data.error.code).toBe("PLUS_REQUIRED");
  expect(executeServerMock).not.toHaveBeenCalled();
});

test("allows Plus user and streams SSE status + result and commits quota for quota-tracked plugins", async () => {
  currentPlan = "PLUS";
  const res = await POST(
    makeReq({ executionId: "exec-ok-slideshow", pluginId: "slideshow-maker", prompt: "Thermodynamics Laws", jeeMode: true }),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  const text = await res.text();
  expect(text).toContain('"type":"status"');
  expect(text).toContain('"type":"result"');
  expect(executeServerMock).toHaveBeenCalledTimes(1);
  expect(commitMock).toHaveBeenCalledTimes(1);
  expect(releaseMock).not.toHaveBeenCalled();
});

test("releases reserved quota and emits SSE error if plugin execution fails mid-stream", async () => {
  executionMode = "fail";
  const res = await POST(
    makeReq({ executionId: "exec-fail-quiz", pluginId: "notes-to-quiz", prompt: "Cell biology" }),
  );
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(text).toContain('"type":"error"');
  expect(releaseMock).toHaveBeenCalledTimes(1);
  expect(commitMock).not.toHaveBeenCalled();
});

test("rejects duplicate concurrent executionId with 409 DUPLICATE_EXECUTION", async () => {
  executionMode = "slow";
  const req1 = POST(makeReq({ executionId: "exec-dup-1", pluginId: "concept-explainer", prompt: "Momentum" }));
  await new Promise((r) => setTimeout(r, 20));
  const req2 = await POST(makeReq({ executionId: "exec-dup-1", pluginId: "concept-explainer", prompt: "Momentum" }));
  expect(req2.status).toBe(409);
  const dupData = await req2.json();
  expect(dupData.error.code).toBe("DUPLICATE_EXECUTION");
  releaseGate?.();
  const res1 = await req1;
  await res1.text();
});
