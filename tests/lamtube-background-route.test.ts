import { beforeEach, expect, mock, test } from "bun:test";
import { previewVideo } from "../src/lib/lamtube/preview";
import type { VideoState } from "../src/lib/lamtube/model";
mock.module("server-only", () => ({}));
const callbacks: (() => Promise<void>)[] = [];
let queued: boolean[] = [], started = 0, allowed = true;
let state: VideoState;
mock.module("next/server", () => ({ after: (fn: () => Promise<void>) => callbacks.push(fn) }));
mock.module("../src/lib/lamtube/http", () => ({
  authorize: async () => { if (!allowed) throw new Error("Denied"); return { id: "owner" }; },
  reply: (data: unknown, status = 200) => Response.json(data, { status }),
  fail: () => Response.json({ message: "Denied" }, { status: 403 }),
}));
mock.module("../src/lib/lamtube/store", () => ({ readVideo: async () => state, publicVideo: (v: VideoState) => ({ ...v, quotaKey: null }), deleteVideo: async () => {} }));
mock.module("../src/lib/lamtube/jobs", () => ({
  queueVideo: async (_user: string, _id: string, retry: boolean) => { queued.push(retry); return state; },
  runVideoBatch: async () => { started++; },
}));
mock.module("../src/lib/lamtube/actions", () => ({
  actionSchema: { parse: (body: unknown) => body }, act: async () => state, isInsightResult: () => false,
}));
const { POST } = await import("../src/app/api/lamtube/[id]/route");
const request = (action: string) => new Request("http://localhost/api/lamtube/v", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
const context = () => ({ params: Promise.resolve({ id: "v" }) });
beforeEach(() => { callbacks.length = 0; queued = []; started = 0; allowed = true; state = { ...previewVideo(), id: "v", status: "generating" }; });
test("202 returns the saved job before provider work, and schedules a server continuation", async () => {
  const res = await POST(request("start"), context());
  expect(res.status).toBe(202); expect((await res.json()).video.status).toBe("generating");
  expect(started).toBe(0); expect(callbacks).toHaveLength(1); expect(queued).toEqual([false]);
  await callbacks[0](); expect(started).toBe(1);
});
test("explicit retry is distinguished from a passive resume heartbeat", async () => {
  await POST(request("retry"), context()); expect(queued).toEqual([true]);
});
test("ready and cancelled jobs do not schedule more background work", async () => {
  for (const status of ["ready", "cancelled"] as const) { state.status = status; await POST(request("start"), context()); }
  expect(callbacks).toHaveLength(0); expect(started).toBe(0);
});
test("authorization failure cannot enqueue a video", async () => {
  allowed = false; const res = await POST(request("start"), context());
  expect(res.status).toBe(403); expect(queued).toHaveLength(0); expect(callbacks).toHaveLength(0);
});
