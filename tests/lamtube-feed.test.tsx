import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { previewVideo } from "../src/lib/lamtube/preview";
import { selectFeedVideos } from "../src/lib/lamtube/feed";
import { reconcileVideos, videoScope } from "../src/lib/lamtube/library";
import { GenerationProgress } from "../src/components/lamtube/generation-progress";
import { AIVideoFeedCard } from "../src/components/lamtube/feed-card";
const demo = previewVideo();
const video = (id: string, createdAt: number) => ({ ...structuredClone(demo), id, createdAt });
test("newest generated lesson is first, edits do not move older lessons above it", () => {
  const old = { ...video("old", 1), updatedAt: 999 }, fresh = video("fresh", 2);
  expect(selectFeedVideos([old, fresh], 11, "All", "", "home").map(v => v.id)).toEqual(["fresh", "old"]);
});
test("private feed honors grade, subject, text and saved/history filters", () => {
  const v = video("v", 1);
  expect(selectFeedVideos([v], 9, "All", "", "home")).toHaveLength(0);
  expect(selectFeedVideos([v], 11, "Chemistry", "", "home")).toHaveLength(0);
  expect(selectFeedVideos([v], 11, "Physics", "absent chapter", "home")).toHaveLength(0);
  expect(selectFeedVideos([v], 11, "Physics", "laws", "home")).toHaveLength(1);
  v.watch.favorite = false; v.watch.lastWatched = null;
  expect(selectFeedVideos([v], 11, "All", "", "saved")).toHaveLength(0);
  expect(selectFeedVideos([v], 11, "All", "", "history")).toHaveLength(0);
  v.watch.favorite = true; v.watch.lastWatched = 1;
  expect(selectFeedVideos([v], 11, "All", "", "saved")).toHaveLength(1);
  expect(selectFeedVideos([v], 11, "All", "", "history")).toHaveLength(1);
});
test("generating jobs appear in feed; untouched drafts and cancelled jobs do not", () => {
  const v = video("v", 1);
  for (const status of ["draft", "cancelled"] as const) expect(selectFeedVideos([{ ...v, status }], 11, "All", "", "home")).toHaveLength(0);
  expect(selectFeedVideos([{ ...v, status: "generating" }], 11, "All", "", "home")).toHaveLength(1);
});
test("out-of-order polling cannot rewind a queued job; deleted lessons disappear", () => {
  const v = video("v", 1), fresh = { ...v, revision: 3, status: "generating" as const };
  expect(reconcileVideos([{ ...v, revision: 1 }], [fresh])[0]).toEqual(fresh);
  expect(reconcileVideos([], [fresh])).toEqual([]);
});
test("account and guest library scopes are separate", () => {
  expect(videoScope(false, "owner", "user")).toBe("guest");
  expect(videoScope(true, "", "guest")).not.toBe("guest");
  expect(videoScope(true, "owner", "user")).not.toBe(videoScope(true, "other", "user"));
});
test("generation view exposes saved progress, clear steps and background navigation", () => {
  const v = { ...video("v", 1), status: "generating" as const, stage: "narration" as const };
  const html = renderToStaticMarkup(<GenerationProgress video={v} busy={false} onRun={()=>{}} onCancel={()=>{}} onBackground={()=>{}} onEdit={()=>{}} />);
  expect(html).toContain("Continue in background"); expect(html).toContain("Saved lesson progress");
  expect(html).toContain("Record narration"); expect(html).toContain("Cancel generation");
  expect(html).toContain("resume when you return"); expect(html).not.toContain("Retry saved generation");
});
test("feed cards are keyboard buttons with real status, not fabricated thumbnails", () => {
  const v = { ...video("v", 1), status: "generating" as const };
  const html = renderToStaticMarkup(<AIVideoFeedCard video={v} onOpen={()=>{}} />);
  expect(html).toContain("<button"); expect(html).toContain("View progress for");
  expect(html).toContain("Working in the background"); expect(html).not.toContain("<iframe");
});
