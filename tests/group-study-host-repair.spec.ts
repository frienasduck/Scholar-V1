import { test, expect, type Page } from "@playwright/test";
import type { RoomSnapshot } from "../src/lib/group-study/types";

// Browser contracts use synthetic API responses; server authorization is tested
// separately in group-study-host-repair.test.ts and developer-access.test.ts.
test.use({
  baseURL: process.env.SCHOLAR_TEST_URL || "http://127.0.0.1:3105",
  launchOptions: {
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 390, height: 844 },
});
test.setTimeout(90_000);
const roomId = "room-host-repair";
const code = "SCH-ABCDEFGH";

function snapshot(host = true, pending = false): RoomSnapshot {
  const me = {
    id: host ? "host-member" : "participant-member",
    role: host ? ("host" as const) : ("participant" as const),
    status: pending ? ("pending" as const) : ("approved" as const),
    displayName: host ? "Scholar Host" : "Study Partner",
    handRaised: false,
    chatMuted: false,
  };
  return {
    room: {
      id: roomId,
      name: "Physics Revision",
      subject: "Physics",
      topic: "Energy",
      status: "waiting",
      locked: false,
      requireApproval: true,
      aiEnabled: true,
      chatEnabled: true,
      pdfEnabled: true,
      participantUploads: false,
      notesEditable: true,
      maxParticipants: 20,
      ...(host ? { code } : {}),
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
      startedAt: null,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
    me,
    participants: [
      { ...me, online: true, lastSeenAt: new Date().toISOString() },
    ],
    messages: [],
    resources: [],
    quiz: null,
    poll: null,
    focus: null,
    notes: "",
    revision: 1,
  };
}

async function setup(page: Page, host = true, pending = false) {
  let state = snapshot(host, pending);
  const actions: string[] = [];
  await page.route("**/api/group-study/rooms**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/events")) {
      return route.fulfill({ json: { ok: true } });
    }
    if (path.endsWith("/messages")) {
      return route.fulfill({
        json: { messages: state.messages, hasMore: false },
      });
    }
    if (path.endsWith("/actions")) {
      const input = route.request().postDataJSON();
      actions.push(input.action);
      if (input.action === "end") {
        state = {
          ...state,
          room: { ...state.room, status: "ended" },
          revision: state.revision + 1,
        };
        return route.fulfill({ json: { ok: true } });
      }
      if (input.action === "lock")
        state = {
          ...state,
          room: { ...state.room, locked: input.locked },
          revision: state.revision + 1,
        };
      return route.fulfill({ json: { ok: true, snapshot: state } });
    }
    if (path.endsWith("/join")) {
      const input = route.request().postDataJSON();
      if (input.code.replace(/[^a-z0-9]/gi, "").toUpperCase() !== "SCHABCDEFGH")
        return route.fulfill({
          status: 404,
          json: {
            error: "ROOM_NOT_FOUND",
            message: "That study room couldn't be found or is unavailable.",
          },
        });
      return route.fulfill({
        status: 201,
        json: { ok: true, roomId, role: "participant", status: "pending" },
      });
    }
    if (path === "/api/group-study/rooms") {
      if (route.request().method() === "POST")
        return route.fulfill({
          status: 201,
          json: {
            ok: true,
            roomId,
            name: state.room.name,
            code: "SCHABCDEFGH",
          },
        });
      return route.fulfill({
        json: {
          canHost: host,
          roomId: host ? roomId : undefined,
          recentRooms: [],
        },
      });
    }
    if (path === `/api/group-study/rooms/${roomId}`) {
      if (state.room.status === "ended")
        return route.fulfill({
          status: 410,
          json: { error: "ROOM_ENDED", message: "This study room has ended." },
        });
      return route.fulfill({ json: state });
    }
    return route.fulfill({
      status: 404,
      json: { error: "Study room not found." },
    });
  });
  return {
    actions,
    approve: () => {
      state = {
        ...state,
        me: { ...state.me, status: "approved" },
        participants: state.participants.map((p) => ({
          ...p,
          status: "approved",
        })),
        revision: state.revision + 1,
      };
    },
  };
}

test("developer landing → create → real code → clipboard → room → refresh → host controls", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const fixture = await setup(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() =>
    localStorage.setItem("scholar.group-study.room", "old-room"),
  );
  await page.goto("/group-study");
  await expect(
    page.getByRole("heading", { name: "Learn together. Think together." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in as host" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create Study Room", exact: true })
    .click();
  await page.getByLabel("Room name", { exact: true }).fill("Physics Revision");
  await page
    .getByRole("button", { name: "Create Study Room", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Room created" }),
  ).toBeVisible();
  await expect(
    page.getByLabel(`Room code ${code}`, { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/group-study$/);
  await page.getByRole("button", { name: "Copy Code", exact: true }).click();
  await expect(page.getByText("Room code copied to clipboard.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await page.screenshot({
    path: "test-artifacts/group-study-room-created.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Enter Study Room" }).click();
  await expect(
    page.getByRole("heading", { name: "Physics Revision", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("banner").getByLabel(`Study code ${code}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("banner").getByLabel("Participant count"),
  ).toHaveText("1 studying");
  await page.reload();
  await expect(
    page.getByRole("banner").getByLabel(`Study code ${code}`, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Room menu", exact: true }).click();
  await page.getByRole("tab", { name: "Host controls" }).click();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Locked", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "End Group Study", exact: true })
    .click();
  await page
    .getByRole("button", { name: "End for everyone", exact: true })
    .click();
  await expect(
    page.getByText("The host ended this study session for everyone."),
  ).toBeVisible();
  expect(fixture.actions).toEqual(["lock", "end"]);
  expect(errors).toEqual([]);
});

test("accountless participant sees same landing, polished invalid code, pending then approval", async ({
  page,
}) => {
  const fixture = await setup(page, false, true);
  await page.goto("/group-study");
  await expect(
    page.getByRole("heading", { name: "Learn together. Think together." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Study Room", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Your name", { exact: true }).fill("Study Partner");
  await page.getByLabel("Study code", { exact: true }).fill("SCHZZZZZZZZ");
  await page
    .getByRole("button", { name: "Join Study Room", exact: true })
    .click();
  await expect(page.getByText("Check the code and try again.")).toBeVisible();
  await page.getByLabel("Study code", { exact: true }).fill(code);
  await page
    .getByRole("button", { name: "Join Study Room", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Waiting for/ }),
  ).toBeVisible();
  fixture.approve();
  await expect(
    page.getByRole("heading", { name: "Physics Revision", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("tab", { name: "Host controls" })).toHaveCount(0);
});

test("existing room code and glass landing fit mobile and desktop", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/group-study");
  await expect(
    page.getByRole("button", { name: "Create Study Room", exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("heading", { name: "Learn together. Think together." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.goto(`/group-study?room=${roomId}`);
  await expect(
    page.getByRole("banner").getByLabel(`Study code ${code}`, { exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page
        .getByRole("banner")
        .getByLabel(`Study code ${code}`, { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
});
