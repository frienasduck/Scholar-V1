import { beforeEach, expect, mock, test } from "bun:test";
import { previewVideo } from "../src/lib/lamtube/preview";

mock.module("server-only", () => ({}));
let leased = false;
let failSave = false;
let saved = previewVideo();
const events: string[] = [];
mock.module("../src/lib/lamtube/store", () => ({
  claimVideo: async () => { leased = true; events.push("claim"); return "token"; },
  readVideo: async () => structuredClone(saved),
  saveVideo: async (_user: string, next: typeof saved) => {
    // Model a database write that yields before checking the lease.
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(leased).toBe(true);
    events.push("save");
    if (failSave) throw new Error("Write failed");
    saved = next;
    return next;
  },
  releaseLease: async () => { events.push("release"); leased = false; },
  insertVideo: async () => saved,
  cancelVideo: async () => saved,
}));
mock.module("../src/lib/lamtube/generate", () => ({ processVideo: async () => saved, teachingPolicy: () => "" }));
mock.module("../src/lib/lamtube/settings", () => ({ validateSettings: async () => saved.settings }));
mock.module("../src/lib/ai/structured", () => ({ completeJSON: async () => ({}) }));
mock.module("../src/lib/personalization/server", () => ({ checkGrade: async () => {}, ProfileError: class extends Error {} }));
const { act } = await import("../src/lib/lamtube/actions");

beforeEach(() => { leased = false; failSave = false; saved = previewVideo(); events.length = 0; });
test("watch edits retain their lease until the saved write commits", async () => {
  const result = await act("owner", saved.id, { action: "edit", watch: { notes: "F = ma", position: 12 } });
  expect(result).toHaveProperty("watch.notes", "F = ma");
  expect(events).toEqual(["claim", "save", "release"]);
  expect(leased).toBe(false);
});
test("failed writes still release the lease after the write rejects", async () => {
  failSave = true;
  await expect(act("owner", saved.id, { action: "edit", title: "Renamed lesson" })).rejects.toThrow("Write failed");
  expect(events).toEqual(["claim", "save", "release"]);
  expect(leased).toBe(false);
});
