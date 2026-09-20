import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { RoomSnapshot } from "../src/lib/group-study/types";
import type { GroupFeatureId } from "../src/lib/group-study/features";

test.use({
  baseURL: process.env.SCHOLAR_TEST_URL || "http://127.0.0.1:3105",
  launchOptions: {
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 1440, height: 960 },
});
test.setTimeout(120_000);

const roomId = "room-group-study-3";
const members: RoomSnapshot["participants"] = [
  {
    id: "host-3",
    displayName: "Scholar Host",
    role: "host",
    status: "approved",
    handRaised: false,
    chatMuted: false,
    followHost: true,
    currentFeature: "overview",
    voiceJoined: false,
    cameraActive: false,
    voiceAllowed: true,
    cameraAllowed: true,
    online: true,
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "learner-a",
    displayName: "Learner A",
    role: "participant",
    status: "approved",
    handRaised: false,
    chatMuted: false,
    followHost: true,
    currentFeature: "overview",
    voiceJoined: false,
    cameraActive: false,
    voiceAllowed: true,
    cameraAllowed: true,
    online: true,
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "learner-b",
    displayName: "Learner B",
    role: "participant",
    status: "approved",
    handRaised: false,
    chatMuted: false,
    followHost: true,
    currentFeature: "overview",
    voiceJoined: false,
    cameraActive: false,
    voiceAllowed: true,
    cameraAllowed: true,
    online: true,
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  },
];

function makeState(): RoomSnapshot {
  return {
    room: {
      id: roomId,
      code: "SCH-MULTI300",
      name: "Multiplayer Physics",
      subject: "Physics",
      topic: "Motion",
      status: "active",
      locked: false,
      requireApproval: true,
      aiEnabled: true,
      chatEnabled: true,
      pdfEnabled: true,
      participantUploads: false,
      notesEditable: true,
      maxParticipants: 15,
      activeResourceId: null,
      page: 1,
      followHost: true,
      navigationMode: "follow",
      activeFeature: "overview",
      activeContext: {},
      featurePolicy: {
        overview: "group",
        materials: "group",
        lam: "group",
        chat: "group",
        quiz: "group",
        notes: "group",
        focus: "group",
        participants: "group",
      },
      sessionPath: [],
      navigationRevision: 0,
      voiceEnabled: true,
      cameraEnabled: true,
      reactionsEnabled: true,
      announcement: "",
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
    me: members[0],
    participants: structuredClone(members),
    messages: [],
    resources: [],
    quiz: null,
    poll: null,
    focus: null,
    notes: "",
    notesRevision: 0,
    revision: 1,
    version: "1",
    activity: [],
    reactions: [],
  };
}

async function installRoom(page: Page, memberId: string, state: RoomSnapshot) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__scholarMediaCalls", {
      value: { count: 0 },
      configurable: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          (
            window as unknown as { __scholarMediaCalls: { count: number } }
          ).__scholarMediaCalls.count += 1;
          return new MediaStream();
        },
      },
    });
  });
  await page.route("**/api/group-study/rooms/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const member = state.participants.find((item) => item.id === memberId)!;
    const snapshot = (): RoomSnapshot => ({
      ...state,
      room: {
        ...state.room,
        ...(member.role === "host" ? {} : { code: undefined }),
      },
      me: { ...member },
      participants: state.participants.map((item) => ({ ...item })),
      version: String(state.revision),
    });
    if (path.endsWith("/messages"))
      return route.fulfill({
        json: { messages: state.messages, hasMore: false },
      });
    if (path.endsWith("/events")) return route.fulfill({ json: { ok: true } });
    if (path.endsWith("/media-config"))
      return route.fulfill({
        json: {
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          limits: { media: 6, video: 4 },
        },
      });
    if (path.endsWith("/signals")) {
      if (request.method() === "POST")
        return route.fulfill({ status: 201, json: { ok: true } });
      return route.fulfill({
        json: { signals: [], serverTime: new Date().toISOString() },
      });
    }
    if (path.endsWith("/actions")) {
      const input = request.postDataJSON();
      if (input.action === "navigate") {
        member.currentFeature = input.feature;
        if (
          member.role === "host" &&
          (input.takeGroup || state.room.navigationMode === "follow")
        ) {
          state.room.activeFeature = input.feature;
          state.room.activeContext = input.context ?? {};
          state.room.navigationRevision += 1;
        }
      }
      if (input.action === "follow-host") member.followHost = input.following;
      if (input.action === "navigation-mode") {
        state.room.navigationMode = input.mode;
        state.room.followHost = input.mode === "follow";
      }
      if (input.action === "feature-policy") {
        state.room.featurePolicy[input.feature as GroupFeatureId] =
          input.access;
        if (
          state.room.activeFeature === input.feature &&
          input.access !== "group"
        ) {
          state.room.activeFeature = "overview";
          state.room.navigationRevision += 1;
        }
      }
      if (input.action === "session-path") state.room.sessionPath = input.steps;
      if (input.action === "media-state") {
        member.voiceJoined = input.voiceJoined;
        member.cameraActive = input.cameraActive;
      }
      state.revision += 1;
      return route.fulfill({ json: { ok: true, snapshot: snapshot() } });
    }
    if (path === `/api/group-study/rooms/${roomId}`) {
      if (url.searchParams.get("version") === String(state.revision))
        return route.fulfill({
          json: { unchanged: true, version: String(state.revision) },
        });
      return route.fulfill({ json: snapshot() });
    }
    return route.fulfill({ status: 404, json: { message: "Not found" } });
  });
}

async function openTab(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true });
  if (!(await tab.isVisible()))
    await page.getByRole("button", { name: "Room menu", exact: true }).click();
  await tab.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("3.0 host and two participants honor follow, guided take-group, and feature policy", async ({
  page: host,
  browser,
}) => {
  const state = makeState();
  const contextA: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const contextB: BrowserContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const learnerA = await contextA.newPage();
  const learnerB = await contextB.newPage();
  const errors: string[] = [];
  for (const page of [host, learnerA, learnerB])
    page.on("pageerror", (error) => errors.push(error.message));
  await installRoom(host, "host-3", state);
  await installRoom(learnerA, "learner-a", state);
  await installRoom(learnerB, "learner-b", state);
  await Promise.all(
    [host, learnerA, learnerB].map((page) =>
      page.goto(`/group-study/${roomId}/overview`),
    ),
  );
  await expect(
    host.getByRole("heading", { name: "Multiplayer Physics", exact: true }),
  ).toBeVisible();
  await learnerB
    .getByRole("button", { name: "Following host ✓", exact: true })
    .click();
  await expect(
    learnerB.getByRole("button", { name: "Explore independently" }),
  ).toBeVisible();

  await openTab(host, "Materials");
  await expect(learnerA).toHaveURL(/\/materials$/, { timeout: 10_000 });
  await expect(learnerB).toHaveURL(/\/overview$/);
  await expect(learnerB.getByText(/Host moved to Materials/)).toBeVisible();

  await openTab(host, "Host controls");
  await host.getByLabel("Quiz access").selectOption("off");
  await expect(learnerA.getByRole("tab", { name: "Quiz" })).toHaveCount(0, {
    timeout: 10_000,
  });
  await learnerA.goto(`/group-study/${roomId}/quiz`);
  await expect(learnerA).toHaveURL(/\/materials$/, { timeout: 10_000 });
  await expect(
    learnerA.getByText("The host has closed this section."),
  ).toBeVisible();

  await host.getByRole("radio", { name: /Guided Freedom/ }).click();
  await openTab(host, "Group LAM");
  await expect(learnerA).toHaveURL(/\/materials$/);
  await host.getByRole("button", { name: "Take group here" }).click();
  await expect(learnerA).toHaveURL(/\/lam$/, { timeout: 10_000 });
  await expect(learnerB.getByText(/Host moved to Group LAM/)).toBeVisible({
    timeout: 10_000,
  });

  expect(
    await learnerB.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await contextA.close();
  await contextB.close();
});

test("3.0 media permission is requested only after the explicit join action", async ({
  page,
}) => {
  const state = makeState();
  await installRoom(page, "host-3", state);
  await page.goto(`/group-study/${roomId}/overview`);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __scholarMediaCalls: { count: number } })
          .__scholarMediaCalls.count,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "Join voice" }).click();
  await expect(page.getByRole("button", { name: "Leave voice" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __scholarMediaCalls: { count: number } })
          .__scholarMediaCalls.count,
    ),
  ).toBe(1);
});
