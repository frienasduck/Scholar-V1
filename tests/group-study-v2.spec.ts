import { expect, test, type Page } from "@playwright/test";
import type { RoomSnapshot } from "../src/lib/group-study/types";

// UI contracts run against the real Next.js app with a shared synthetic room.
// They never claim to validate production database/provider availability.
test.use({
  baseURL: process.env.SCHOLAR_TEST_URL || "http://127.0.0.1:3105",
  launchOptions: {
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 1440, height: 1000 },
});
test.setTimeout(180_000);
const roomId = "room-v2-contract",
  code = "SCH-ABCDEFGH";
type Message = RoomSnapshot["messages"][number];
function initial(): RoomSnapshot {
  const host = {
    id: "host-v2",
    displayName: "Scholar Host",
    role: "host" as const,
    status: "approved" as const,
    handRaised: false,
    chatMuted: false,
    joinedAt: new Date().toISOString(),
  };
  return {
    room: {
      id: roomId,
      code,
      name: "Physics Revision",
      subject: "Physics",
      topic: "Work, Energy & Power",
      status: "waiting",
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
      startedAt: null,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
    me: host,
    participants: [
      { ...host, online: true, lastSeenAt: new Date().toISOString() },
    ],
    messages: [],
    resources: [],
    focus: null,
    quiz: null,
    poll: null,
    notes: "",
    notesRevision: 0,
    revision: 1,
    version: "1",
    activity: [],
  };
}
function twoPagePdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
    "",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  for (const [index, text] of [
    [3, "Work = force x displacement"],
    [5, "Energy is measured in joules"],
  ] as const) {
    const stream = `BT /F1 14 Tf 20 330 Td (${text}) Tj ET`;
    objects[index] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }
  let source = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(source));
    source += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(source);
  source +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(source);
}
async function fixture(host: Page, participant: Page) {
  let state = initial();
  const requests: Array<{
    at: number;
    role: string;
    path: string;
    method: string;
    unchanged?: boolean;
  }> = [];
  let fail = false;
  const snapshot = (isHost: boolean): RoomSnapshot => {
    const me = state.participants.find(
      (p) => p.role === (isHost ? "host" : "participant"),
    )!;
    const room = { ...state.room };
    if (!isHost) delete room.code;
    return {
      ...state,
      room:
        me.status === "pending"
          ? { ...room, name: "", subject: "", topic: "", code: undefined }
          : room,
      me,
      participants:
        me.status === "pending"
          ? []
          : state.participants.filter((p) => isHost || p.status === "approved"),
      messages: me.status === "pending" ? [] : state.messages,
      quiz: state.quiz
        ? { ...state.quiz, myAnswers: isHost ? {} : state.quiz.myAnswers }
        : null,
      version: String(state.revision),
    };
  };
  const addMessage = (
    kind: Message["kind"],
    body: string,
    isHost: boolean,
    id = `m-${state.messages.length}`,
  ) => {
    const me = state.participants.find(
      (p) => p.role === (isHost ? "host" : "participant"),
    )!;
    state.messages.push({
      id,
      kind,
      body,
      author: kind === "ai" ? "Group LAM" : me.displayName,
      authorId: kind === "ai" ? undefined : me.id,
      authorRole: me.role,
      createdAt: new Date().toISOString(),
    });
  };
  async function install(page: Page, isHost: boolean) {
    await page.route("**/api/group-study/rooms**", async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        path = url.pathname;
      const entry = {
        at: Date.now(),
        role: isHost ? "host" : "participant",
        path,
        method: request.method(),
        unchanged: false,
      };
      requests.push(entry);
      if (fail) return route.abort("internetdisconnected");
      if (path === "/api/group-study/rooms")
        return route.fulfill({
          status: request.method() === "POST" ? 201 : 200,
          json:
            request.method() === "POST"
              ? { ok: true, roomId, code: "SCHABCDEFGH", name: state.room.name }
              : { canHost: isHost, recentRooms: [] },
        });
      if (path.endsWith("/join")) {
        if (state.room.locked)
          return route.fulfill({
            status: 404,
            json: { code: "ROOM_LOCKED", message: "Room is locked." },
          });
        state.participants.push({
          id: "student-v2",
          displayName: "Study Partner",
          role: "participant",
          status: "pending",
          handRaised: false,
          chatMuted: false,
          joinedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          online: true,
        });
        state.revision++;
        return route.fulfill({
          status: 201,
          json: { ok: true, roomId, status: "pending" },
        });
      }
      if (path.endsWith("/events"))
        return route.fulfill({ json: { ok: true } });
      if (path.endsWith("/messages"))
        return route.fulfill({
          json: {
            messages:
              state.participants.find(
                (p) => p.role === (isHost ? "host" : "participant"),
              )?.status === "pending"
                ? []
                : state.messages,
            hasMore: false,
          },
        });
      if (state.room.status === "ended")
        return route.fulfill({
          status: 410,
          json: { code: "ROOM_ENDED", message: "This study room has ended." },
        });
      const me = state.participants.find(
        (p) => p.role === (isHost ? "host" : "participant"),
      );
      if (me?.status === "removed")
        return route.fulfill({
          status: 403,
          json: {
            code: "PARTICIPANT_REMOVED",
            message: "You were removed from this study room.",
          },
        });
      if (path.endsWith("/actions")) {
        const input = request.postDataJSON();
        if (input.action === "start") state.room.status = "active";
        if (
          ["approve", "deny", "remove", "clear-hand", "mute"].includes(
            input.action,
          )
        ) {
          const p = state.participants.find(
            (p) => p.id === input.participantId,
          )!;
          if (input.action === "clear-hand") p.handRaised = false;
          else if (input.action === "mute") p.chatMuted = input.muted;
          else
            p.status =
              input.action === "approve"
                ? "approved"
                : input.action === "deny"
                  ? "denied"
                  : "removed";
        }
        if (input.action === "hand") me!.handRaised = input.raised;
        if (input.action === "chat") {
          await new Promise((resolve) => setTimeout(resolve, 450));
          addMessage("chat", input.body, isHost, input.clientMessageId);
        }
        if (input.action === "announce") {
          state.room.announcement = input.body;
          addMessage("announcement", input.body, true);
        }
        if (input.action === "focus") {
          if (input.operation === "start")
            state.focus = {
              status: "running",
              durationSeconds: input.durationSeconds,
              remainingSeconds: input.durationSeconds,
              endsAt: new Date(
                Date.now() + input.durationSeconds * 1000,
              ).toISOString(),
            };
          else if (input.operation === "pause")
            state.focus = {
              ...state.focus!,
              status: "paused",
              remainingSeconds: Math.ceil(
                (Date.parse(state.focus!.endsAt!) - Date.now()) / 1000,
              ),
              endsAt: null,
            };
          else if (input.operation === "resume")
            state.focus = {
              ...state.focus!,
              status: "running",
              endsAt: new Date(
                Date.now() + state.focus!.remainingSeconds * 1000,
              ).toISOString(),
            };
          else
            state.focus = {
              ...state.focus!,
              status: "completed",
              remainingSeconds: 0,
              endsAt: null,
            };
        }
        if (input.action === "notes") {
          if (input.notesRevision !== state.notesRevision)
            return route.fulfill({
              status: 409,
              json: {
                code: "NOTES_CONFLICT",
                message: "Someone updated the notes.",
              },
            });
          state.notes = input.text;
          state.notesRevision!++;
        }
        if (input.action === "quiz")
          state.quiz = {
            id: "quiz-v2",
            title: input.title,
            questions: input.questions.map((q: object, i: number) => ({
              ...q,
              id: `q-${i}`,
            })),
            revealed: false,
            responseCount: 0,
            myAnswers: {},
          };
        if (input.action === "answer") {
          state.quiz!.myAnswers[input.questionId] = input.answer;
          state.quiz!.responseCount = 1;
        }
        if (input.action === "reveal") {
          state.quiz!.revealed = true;
          state.quiz!.correctPercent = 100;
          state.quiz!.distribution = Object.fromEntries(
            state.quiz!.questions.map((q) => [
              q.id,
              q.options.map((_, i) =>
                state.quiz!.myAnswers[q.id] === i ? 1 : 0,
              ),
            ]),
          );
        }
        if (input.action === "poll")
          state.poll = {
            id: "poll-v2",
            question: input.question,
            options: input.options,
            counts: input.options.map(() => 0),
            myVote: null,
          };
        if (input.action === "vote") {
          state.poll!.counts[input.option] = 1;
          state.poll!.myVote = input.option;
        }
        if (input.action === "resource") {
          if (input.remove)
            state.resources = state.resources.filter(
              (r) => r.id !== input.resourceId,
            );
          state.room.activeResourceId = input.remove ? null : input.resourceId;
          state.room.page = 1;
        }
        if (input.action === "page") state.room.page = input.page;
        if (input.action === "lock") state.room.locked = input.locked;
        if (input.action === "settings")
          Object.assign(state.room, input.settings);
        if (input.action === "end") {
          state.room.status = "ended";
          return route.fulfill({ json: { ok: true } });
        }
        state.revision++;
        return route.fulfill({
          json: { ok: true, snapshot: snapshot(isHost) },
        });
      }
      if (path.endsWith("/ai") || path.endsWith("/analysis")) {
        addMessage(
          "ai",
          "## Work and energy\nThe work-energy theorem states that $W = \\Delta K$.\n\n[Page 1] Work is force times displacement.",
          isHost,
        );
        state.revision++;
        return route.fulfill({ json: { ok: true } });
      }
      if (path.endsWith("/resources") && request.method() === "POST") {
        state.resources.push({
          id: "resource-v2",
          name: "Energy.pdf",
          mimeType: "application/pdf",
          pageCount: 2,
          sizeBytes: twoPagePdf().length,
          uploadedBy: "Scholar Host",
          createdAt: new Date().toISOString(),
        });
        state.revision++;
        return route.fulfill({ status: 201, json: { ok: true } });
      }
      if (path.endsWith("/resources/resource-v2"))
        return route.fulfill({
          contentType: "application/pdf",
          body: twoPagePdf(),
        });
      if (path === `/api/group-study/rooms/${roomId}`) {
        entry.unchanged =
          url.searchParams.get("version") === String(state.revision);
        return route.fulfill({
          json: entry.unchanged
            ? { unchanged: true, version: String(state.revision) }
            : snapshot(isHost),
        });
      }
      return route.fulfill({
        status: 404,
        json: { code: "ROOM_NOT_FOUND", message: "Not found" },
      });
    });
  }
  await install(host, true);
  await install(participant, false);
  return {
    requests,
    state: () => state,
    fail: (value: boolean) => {
      fail = value;
    },
    remoteNotes: (value: string) => {
      state.notes = value;
      state.notesRevision!++;
      state.revision++;
    },
  };
}
async function nav(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true });
  if (!(await tab.isVisible()))
    await page.getByRole("button", { name: "Room menu", exact: true }).click();
  await tab.click();
  // Wait for the glass drawer's closing transition; its fading tabs must not
  // be mistaken for the next navigation target or included in screenshots.
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function capture(page: Page, name: string) {
  await page.screenshot({
    path: `test-artifacts/group-study-v2-${name}.png`,
    fullPage: true,
  });
}

test("V2 three-minute single-flight polling soak and offline recovery", async ({
  page: host,
  browser,
}) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const participant = await context.newPage();
  const f = await fixture(host, participant);
  await host.goto(`/group-study?room=${roomId}`);
  await participant.goto("/group-study");
  await participant
    .getByLabel("Your name", { exact: true })
    .fill("Study Partner");
  await participant.getByLabel("Study code", { exact: true }).fill(code);
  await participant
    .getByRole("button", { name: "Join Study Room", exact: true })
    .click();
  await host.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(
    participant.getByRole("heading", { name: "Physics Revision", exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  const started = Date.now();
  await host.waitForTimeout(180_000);
  const reads = f.requests.filter(
    (r) => r.at >= started && r.path === `/api/group-study/rooms/${roomId}`,
  );
  expect(reads.length).toBeGreaterThan(50);
  expect(reads.length).toBeLessThan(135);
  expect(reads.filter((r) => r.unchanged).length).toBeGreaterThan(
    reads.length * 0.8,
  );
  expect(
    f.requests.filter((r) => r.path.endsWith("/events") && r.method === "GET"),
  ).toHaveLength(0);
  for (const p of [host, participant]) {
    await expect(
      p.getByText(/Reconnecting|Connection lost|Connecting…/),
    ).toHaveCount(0);
    await expect(
      p.getByRole("heading", { name: "Physics Revision", exact: true }),
    ).toBeVisible();
  }
  f.fail(true);
  await expect(
    host.getByText("Connection lost — retrying.", { exact: true }),
  ).toBeVisible({ timeout: 50_000 });
  await context.setOffline(true);
  await expect(
    participant.getByText("Offline — updates resume when you reconnect.", {
      exact: true,
    }),
  ).toBeVisible();
  f.fail(false);
  await context.setOffline(false);
  await expect(
    participant.getByText("Offline — updates resume when you reconnect.", {
      exact: true,
    }),
  ).toHaveCount(0, { timeout: 10_000 });
  await expect(
    host.getByText("Connection lost — retrying.", { exact: true }),
  ).toHaveCount(0, { timeout: 35_000 });
  await host.reload();
  await expect(
    host.getByRole("heading", { name: "Physics Revision", exact: true }),
  ).toBeVisible();
  await context.close();
});

test("V2 two-context collaboration, study tools, preserved drafts and responsive layouts", async ({
  page: host,
  browser,
}) => {
  const participantContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const participant = await participantContext.newPage(),
    errors: string[] = [];
  host.on("pageerror", (e) => errors.push(e.message));
  participant.on("pageerror", (e) => errors.push(e.message));
  const f = await fixture(host, participant);
  await host.goto("/group-study");
  await capture(host, "desktop-landing");
  await host
    .getByRole("button", { name: "Create Study Room", exact: true })
    .click();
  await host.getByLabel("Room name", { exact: true }).fill("Physics Revision");
  await host
    .getByRole("button", { name: "Create Study Room", exact: true })
    .click();
  await expect(
    host.getByRole("region", { name: "Room created" }),
  ).toBeVisible();
  await host.getByRole("button", { name: "Enter Study Room" }).click();
  await expect(
    host.getByRole("heading", { name: "Physics Revision", exact: true }),
  ).toBeVisible();
  await capture(host, "desktop-host");
  await participant.goto("/group-study");
  await participant
    .getByLabel("Your name", { exact: true })
    .fill("Study Partner");
  await participant.getByLabel("Study code", { exact: true }).fill(code);
  await participant
    .getByRole("button", { name: "Join Study Room", exact: true })
    .click();
  await expect(
    participant.getByRole("heading", { name: "Waiting for the host" }),
  ).toBeVisible();
  await expect(
    host.getByRole("button", { name: "Approve", exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  await host.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(
    participant.getByRole("heading", { name: "Physics Revision", exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  await capture(participant, "desktop-participant");
  await host
    .getByRole("button", { name: "Start study session", exact: true })
    .click();
  await nav(host, "Chat");
  await nav(participant, "Chat");
  await participant
    .getByLabel("Message", { exact: true })
    .fill("What is the SI unit of work?");
  await participant.getByLabel("Message", { exact: true }).press("Enter");
  await expect(
    participant.getByText("Sending…", { exact: true }),
  ).toBeVisible();
  await expect(
    host.getByText("What is the SI unit of work?", { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  await host.getByLabel("Message", { exact: true }).fill("Joule.");
  await host.getByLabel("Message", { exact: true }).press("Shift+Enter");
  await host.getByLabel("Message", { exact: true }).press("Enter");
  await expect(participant.getByText("Joule.", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await capture(host, "chat");
  await nav(host, "Host controls");
  await host
    .getByLabel("Announcement", { exact: true })
    .fill("Quiz starts in two minutes.");
  await host.getByRole("button", { name: "Post announcement" }).click();
  await nav(participant, "Participants");
  await participant
    .getByRole("button", { name: "Raise hand", exact: true })
    .last()
    .click();
  await nav(host, "Participants");
  await expect(host.getByRole("button", { name: "Clear hand" })).toBeVisible({
    timeout: 10_000,
  });
  await capture(host, "participants");
  await host.getByRole("button", { name: "Clear hand" }).click();
  await nav(host, "Focus");
  await host.getByRole("button", { name: "10 min", exact: true }).click();
  await nav(participant, "Focus");
  await expect(participant.getByRole("timer")).not.toHaveText("00:00", {
    timeout: 10_000,
  });
  await capture(host, "focus");
  await host.getByRole("button", { name: "Pause timer" }).click();
  await expect(participant.getByText("Paused", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await host.getByRole("button", { name: "Resume timer" }).click();
  await nav(host, "Quiz");
  await host.getByRole("button", { name: "Create quiz", exact: true }).click();
  await host.getByLabel("Quiz title", { exact: true }).fill("Energy check");
  await host
    .getByLabel("Question", { exact: true })
    .fill("Which is the SI unit of work?");
  await host.getByLabel("Option A", { exact: true }).fill("Joule");
  await host.getByLabel("Option B", { exact: true }).fill("Watt");
  await host
    .getByLabel("Explanation (optional)")
    .fill("Work is energy transferred, measured in joules.");
  await host.getByRole("button", { name: "Start quiz", exact: true }).click();
  await nav(participant, "Quiz");
  await participant
    .getByRole("button", { name: "A Joule", exact: true })
    .click();
  await expect(
    host
      .getByRole("tabpanel", { name: "Quiz", exact: true })
      .getByText(/1 completed/),
  ).toBeVisible({ timeout: 10_000 });
  await host.getByRole("button", { name: "End & reveal answers" }).click();
  await expect(
    participant.getByText("100% correct · room aggregate"),
  ).toBeVisible({ timeout: 10_000 });
  await capture(host, "quiz");
  await host
    .getByLabel("Poll question", { exact: true })
    .fill("Did you understand this?");
  await host.getByRole("button", { name: "Ask quick poll" }).click();
  await participant
    .getByRole("button", { name: "1 Yes 0 votes", exact: true })
    .click();
  await expect(
    host.getByRole("button", { name: "1 Yes 1 votes", exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  await nav(host, "Materials");
  await host.locator('input[type="file"]').setInputFiles({
    name: "Energy.pdf",
    mimeType: "application/pdf",
    buffer: twoPagePdf(),
  });
  await expect(
    host.getByRole("heading", { name: "Energy.pdf", exact: true }),
  ).toBeVisible();
  await host.getByRole("button", { name: "Open", exact: true }).click();
  await expect(host.locator('canvas[data-rendered-page="1"]')).toBeVisible({
    timeout: 20_000,
  });
  await host.getByRole("button", { name: "Next page" }).click();
  await expect(host.locator('canvas[data-rendered-page="2"]')).toBeVisible();
  await host.getByRole("button", { name: "Share this page" }).click();
  await nav(participant, "Materials");
  await expect(participant.getByLabel("Document page")).toHaveValue("2", {
    timeout: 10_000,
  });
  await participant.getByRole("button", { name: "Previous page" }).click();
  await expect(
    participant.getByRole("button", { name: "Follow Host: Off" }),
  ).toBeVisible();
  await host.getByRole("button", { name: "Share this page" }).click();
  await expect(participant.getByLabel("Document page")).toHaveValue("1");
  await capture(host, "materials");
  await host.getByRole("button", { name: "Ask LAM about page 2" }).click();
  await host
    .getByLabel("Ask Group LAM", { exact: true })
    .fill("Explain the work-energy theorem.");
  await host.getByRole("button", { name: "Ask LAM", exact: true }).click();
  await expect(host.locator(".gs-ai-output .scholar-ai-content")).toContainText(
    "Work and energy",
  );
  await capture(host, "lam");
  await nav(host, "Notes");
  await host
    .getByLabel("Shared study notes")
    .fill("Work is measured in joules.");
  await expect(
    host.getByRole("status").filter({ hasText: /^Saved$/ }),
  ).toBeVisible();
  await nav(participant, "Notes");
  await expect(participant.getByLabel("Shared study notes")).toHaveValue(
    "Work is measured in joules.",
    { timeout: 10_000 },
  );
  await host
    .getByLabel("Shared study notes")
    .fill("My draft must survive another writer.");
  f.remoteNotes("Remote version to merge.");
  await expect(
    host.getByText("Someone else updated the notes.", { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(host.getByLabel("Shared study notes")).toHaveValue(
    "My draft must survive another writer.",
  );
  await host.getByRole("button", { name: "Save my merged draft" }).click();
  await expect(
    host.getByRole("status").filter({ hasText: /^Saved$/ }),
  ).toBeVisible();
  await capture(host, "notes");
  for (const width of [390, 430, 768, 1440]) {
    await host.setViewportSize({ width, height: 900 });
    await nav(host, "Overview");
    expect(
      await host.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await nav(host, "Chat");
    await expect(host.getByLabel("Message", { exact: true })).toBeVisible();
    expect(
      await host.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    if (width === 390) await capture(host, "mobile-room");
  }
  await nav(host, "Host controls");
  await host.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    host.getByRole("button", { name: "Locked", exact: true }),
  ).toBeVisible();
  await host.reload();
  await expect(
    host.getByRole("heading", { name: "Physics Revision", exact: true }),
  ).toBeVisible();
  await nav(host, "Participants");
  await host.getByRole("button", { name: "Remove", exact: true }).click();
  await host.getByRole("button", { name: "Confirm removal" }).click();
  await expect(
    participant.getByText("You were removed from this study room.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 10_000 });
  await nav(host, "Host controls");
  await host.getByRole("button", { name: "End Group Study" }).click();
  await host.getByRole("button", { name: "End for everyone" }).click();
  await expect(
    host.getByText("The host ended this study session for everyone."),
  ).toBeVisible();
  expect(
    f.requests.filter((r) => r.path.endsWith("/events") && r.method === "GET"),
  ).toHaveLength(0);
  expect(f.requests.some((r) => r.unchanged)).toBe(true);
  expect(errors).toEqual([]);
  await participantContext.close();
});
