import { beforeEach, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));

const host = {
  id: "host-owner",
  email: "owner@example.test",
  name: "Test Host",
  sessionVersion: 1,
};
let user: typeof host | null = host;
let allowed = true;
const cookies = new Map<string, string>();
mock.module("../src/lib/auth/session", () => ({
  getSessionUser: async () => user,
}));
mock.module("../src/lib/auth/beta", () => ({
  isBetaAllowed: async (value: typeof host | null) => Boolean(value && allowed),
}));
mock.module("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) =>
      cookies.has(key) ? { value: cookies.get(key)! } : undefined,
    set: (key: string, value: string) => cookies.set(key, value),
  }),
}));

const makeRoom = () => ({
  id: "room-repair-123",
  code: "SCHABCDEFGH",
  hostUserId: host.id,
  name: "Physics Revision",
  subject: "Physics",
  topic: "Work",
  status: "waiting",
  locked: false,
  requireApproval: true,
  aiEnabled: true,
  chatEnabled: true,
  pdfEnabled: true,
  participantUploads: false,
  notesEditable: false,
  maxParticipants: 15,
  activeResourceId: null,
  page: 1,
  followHost: true,
  navigationMode: "follow",
  activeFeature: "overview",
  activeContext: {},
  featurePolicy: {},
  sessionPath: [],
  navigationRevision: 0,
  voiceEnabled: true,
  cameraEnabled: true,
  reactionsEnabled: true,
  announcement: "",
  notes: "",
  revision: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  startedAt: null,
  endedAt: null,
  lastActivityAt: new Date(),
  expiresAt: new Date(Date.now() + 3_600_000),
});
let room = makeRoom();
type Member = {
  id: string;
  roomId: string;
  role: string;
  status: string;
  displayName: string;
  tokenHash: string | null;
  expiresAt: Date;
  approvedAt: Date | null;
  joinedAt: Date;
  lastSeenAt: Date;
  handRaised: boolean;
  chatMuted: boolean;
  followHost: boolean;
  currentFeature: string;
  voiceJoined: boolean;
  cameraActive: boolean;
  voiceAllowed: boolean;
  cameraAllowed: boolean;
  removedAt: Date | null;
};
let members: Member[] = [];
type Where = {
  id?: string;
  code?: string;
  roomId?: string;
  role?: string;
  tokenHash?: string;
  status?: string | { in: string[] };
  voiceJoined?: boolean;
  cameraActive?: boolean;
};
const matches = (member: Member, where: Where) =>
  (!where.id || member.id === where.id) &&
  (!where.roomId || member.roomId === where.roomId) &&
  (!where.role || member.role === where.role) &&
  (!where.tokenHash || member.tokenHash === where.tokenHash) &&
  (where.voiceJoined === undefined ||
    member.voiceJoined === where.voiceJoined) &&
  (where.cameraActive === undefined ||
    member.cameraActive === where.cameraActive) &&
  (!where.status ||
    (typeof where.status === "string"
      ? member.status === where.status
      : where.status.in.includes(member.status)));
const createMember = (data: Partial<Member>) => {
  const member: Member = {
    id: `member-${members.length}`,
    roomId: room.id,
    role: "participant",
    status: "pending",
    displayName: "Student",
    tokenHash: null,
    expiresAt: room.expiresAt,
    approvedAt: null,
    joinedAt: new Date(),
    lastSeenAt: new Date(),
    handRaised: false,
    chatMuted: false,
    followHost: true,
    currentFeature: "overview",
    voiceJoined: false,
    cameraActive: false,
    voiceAllowed: true,
    cameraAllowed: true,
    removedAt: null,
    ...data,
  };
  members.push(member);
  return member;
};
let nestedHost = false;
let versionSelected = false;
let readLocks = 0;
let snapshotReads = 0;
let eventWrites = 0;
let rateCount = 0;
let transactionIsolation: string | undefined;
const activities = new Map<string, { kind: string; state: object }>();
const messages = new Map<
  string,
  {
    id: string;
    roomId: string;
    participantId: string;
    kind: string;
    body: string;
    createdAt: Date;
    participant: { displayName: string; role: string };
  }
>();
const signals: Array<{
  roomId: string;
  senderId: string;
  targetId: string;
  kind: string;
  payload: object;
  expiresAt: Date;
}> = [];
const tx = {
  $queryRaw: async (sql: TemplateStringsArray) => {
    if (sql.join("").includes('FROM "GroupStudyResource"')) return [];
    readLocks++;
    return [room];
  },
  user: {
    findUnique: async (args: { select?: { sessionVersion?: boolean } }) => {
      versionSelected = args.select?.sessionVersion === true;
      return host;
    },
  },
  securityAttempt: { create: async () => ({}), count: async () => rateCount },
  groupStudyRoom: {
    create: async ({
      data,
    }: {
      data: { code: string; participants?: { create: Partial<Member> } };
    }) => {
      room.code = data.code;
      nestedHost = Boolean(data.participants);
      if (data.participants) createMember(data.participants.create);
      return room;
    },
    findUnique: async ({ where }: { where: Where }) =>
      (where.id && where.id !== room.id) ||
      (where.code && where.code !== room.code)
        ? null
        : room,
    update: async ({
      data,
    }: {
      data: Partial<typeof room> & {
        revision?: unknown;
        navigationRevision?: unknown;
      };
    }) => {
      const { revision, navigationRevision, ...rest } = data;
      Object.assign(room, rest);
      if (revision) room.revision++;
      if (navigationRevision) room.navigationRevision++;
      return room;
    },
  },
  groupStudyParticipant: {
    findFirst: async ({ where }: { where: Where }) =>
      members.find((member) => matches(member, where)) ?? null,
    findMany: async ({ where }: { where: Where }) =>
      members.filter((member) => matches(member, where)),
    count: async ({ where }: { where: Where }) =>
      members.filter((member) => matches(member, where)).length,
    create: async ({ data }: { data: Partial<Member> }) => createMember(data),
    update: async ({
      where,
      data,
    }: {
      where: Where;
      data: Partial<Member>;
    }) => {
      const member = members.find((value) => matches(value, where))!;
      Object.assign(member, data);
      return member;
    },
    updateMany: async () => ({ count: 0 }),
  },
  groupStudyMessage: {
    findMany: async () => {
      snapshotReads++;
      return [...messages.values()].reverse();
    },
    findUnique: async ({ where }: { where: { id: string } }) =>
      messages.get(where.id) ?? null,
    create: async ({
      data,
    }: {
      data: {
        id?: string;
        roomId: string;
        participantId: string;
        kind: string;
        body: string;
      };
    }) => {
      const member = members.find((m) => m.id === data.participantId)!;
      const value = {
        ...data,
        id: data.id ?? `message-${messages.size}`,
        createdAt: new Date(),
        participant: { displayName: member.displayName, role: member.role },
      };
      messages.set(value.id, value);
      return value;
    },
  },
  groupStudyResource: {
    findMany: async () => [],
    deleteMany: async () => ({ count: 0 }),
  },
  groupStudyActivity: {
    findMany: async () => [...activities.values()],
    findUnique: async ({
      where,
    }: {
      where: { roomId_kind: { kind: string } };
    }) => activities.get(where.roomId_kind.kind) ?? null,
    upsert: async ({ create }: { create: { kind: string; state: object } }) => {
      activities.set(create.kind, create);
      return create;
    },
  },
  groupStudyEvent: {
    create: async () => {
      eventWrites++;
      return {};
    },
    findMany: async () => [],
  },
  groupStudySignal: {
    create: async ({ data }: { data: (typeof signals)[number] }) => {
      signals.push(data);
      return data;
    },
    deleteMany: async () => ({ count: 0 }),
    findMany: async () => [],
  },
};
mock.module("../src/lib/db", () => ({
  db: {
    ...tx,
    $transaction: async (
      operation: ((client: typeof tx) => Promise<unknown>) | Promise<unknown>[],
      options?: { isolationLevel?: string },
    ) => {
      transactionIsolation = options?.isolationLevel;
      return Array.isArray(operation) ? Promise.all(operation) : operation(tx);
    },
  },
}));
const { POST: createRoom } =
  await import("../src/app/api/group-study/rooms/route");
const { POST: joinRoom } =
  await import("../src/app/api/group-study/rooms/join/route");
const { POST: roomAction } =
  await import("../src/app/api/group-study/rooms/[roomId]/actions/route");
const {
  getRoomPrincipal,
  getRoomSnapshot,
  performRoomAction,
  revalidateRoomPrincipal,
  sanitizeQuiz,
  resolveFocus,
} = await import("../src/lib/group-study/server");
const { GET: readRoom } =
  await import("../src/app/api/group-study/rooms/[roomId]/route");
const { POST: sendSignal } =
  await import("../src/app/api/group-study/rooms/[roomId]/signals/route");
const request = (path: string, body: object) =>
  new Request(`https://scholar.example/api/group-study/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://scholar.example",
    },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  room = makeRoom();
  members = [];
  user = host;
  allowed = true;
  cookies.clear();
  nestedHost = false;
  versionSelected = false;
  readLocks = snapshotReads = eventWrites = rateCount = 0;
  activities.clear();
  messages.clear();
  signals.length = 0;
});

test("V2 joining keeps the atomic room lock without a stale serializable snapshot", async () => {
  user = null;
  const response = await joinRoom(
    request("rooms/join", {
      displayName: "Concurrent join test",
      code: room.code,
    }),
  );
  expect(response.status).toBe(201);
  expect(transactionIsolation).toBe("ReadCommitted");
  expect(readLocks).toBe(1);
  expect(members[0].role).toBe("participant");
  expect(members[0].status).toBe("pending");
});

test("creation returns the real code and atomically creates an approved host; refresh preserves it", async () => {
  const result = await createRoom(
    request("rooms", { name: "Physics Revision" }),
  );
  expect(result.status).toBe(201);
  expect(await result.json()).toMatchObject({
    ok: true,
    roomId: room.id,
    code: room.code,
  });
  expect(nestedHost).toBe(true);
  expect(members[0]).toMatchObject({
    role: "host",
    status: "approved",
    tokenHash: null,
  });
  expect((await getRoomSnapshot(room.id)).room.code).toBe(
    `SCH-${room.code.slice(3)}`,
  );
  expect((await getRoomSnapshot(room.id)).me.role).toBe("host");
});
test("existing orphaned room is repaired only for its authenticated authorized owner", async () => {
  expect((await getRoomPrincipal(room.id)).role).toBe("host");
  await getRoomPrincipal(room.id);
  expect(members).toHaveLength(1);
  members = [];
  user = { ...host, id: "another-account" };
  await expect(getRoomPrincipal(room.id)).rejects.toThrow("invite code");
  expect(members).toHaveLength(0);
});
test("unauthenticated and blocked accounts cannot create rooms", async () => {
  user = null;
  expect((await createRoom(request("rooms", { name: "Room" }))).status).toBe(
    403,
  );
  user = host;
  allowed = false;
  expect((await createRoom(request("rooms", { name: "Room" }))).status).toBe(
    403,
  );
  expect(members).toHaveLength(0);
});
test("accountless join waits for approval, receives no code, and cannot escalate or cross rooms", async () => {
  await getRoomPrincipal(room.id);
  user = null;
  const result = await joinRoom(
    request("rooms/join", { displayName: "Student", code: "sch-abcdefgh" }),
  );
  expect(result.status).toBe(201);
  expect(await result.json()).toMatchObject({
    role: "participant",
    status: "pending",
  });
  const pending = await getRoomSnapshot(room.id);
  expect(pending.room.code).toBeUndefined();
  expect(pending.room.name).toBe("");
  const principal = await getRoomPrincipal(room.id, { allowPending: true });
  user = host;
  await performRoomAction(room.id, await getRoomPrincipal(room.id), {
    action: "approve",
    participantId: principal.id,
  });
  user = null;
  expect((await getRoomSnapshot(room.id)).me.status).toBe("approved");
  const approved = await getRoomPrincipal(room.id);
  await expect(
    performRoomAction(room.id, approved, { action: "end" }),
  ).rejects.toThrow("Only the host");
  await expect(
    revalidateRoomPrincipal(
      tx as unknown as Parameters<typeof revalidateRoomPrincipal>[0],
      { ...room, id: "another-room" },
      approved,
    ),
  ).rejects.toThrow("not valid here");
  user = host;
  await performRoomAction(room.id, await getRoomPrincipal(room.id), {
    action: "remove",
    participantId: approved.id,
  });
  user = null;
  await expect(getRoomPrincipal(room.id)).rejects.toThrow("removed");
});
test("pending participant can leave successfully without reading a revoked snapshot", async () => {
  user = null;
  await joinRoom(
    request("rooms/join", { displayName: "Student", code: room.code }),
  );
  const left = await roomAction(
    request(`rooms/${room.id}/actions`, { action: "leave" }),
    { params: Promise.resolve({ roomId: room.id }) },
  );
  expect(left.status).toBe(200);
  expect(await left.json()).toEqual({ ok: true });
  expect(members[0].status).toBe("left");
});
test("locked/full rooms reject new joins and invalid code yields a controlled response", async () => {
  user = null;
  room.locked = true;
  expect(
    (
      await joinRoom(
        request("rooms/join", { displayName: "Student", code: room.code }),
      )
    ).status,
  ).toBe(404);
  expect(members).toHaveLength(0);
  room.locked = false;
  room.maxParticipants = 1;
  createMember({ status: "approved" });
  expect(
    (
      await joinRoom(
        request("rooms/join", { displayName: "Student", code: room.code }),
      )
    ).status,
  ).toBe(409);
  const wrong = await joinRoom(
    request("rooms/join", { displayName: "Student", code: "SCHZZZZZZZZ" }),
  );
  expect(wrong.status).toBe(404);
  expect((await wrong.json()).message).toContain("couldn't be found");
});
test("host actions retain version binding and ending a room returns success, not a revoked snapshot error", async () => {
  const principal = await getRoomPrincipal(room.id);
  await performRoomAction(room.id, principal, { action: "lock", locked: true });
  expect(room.locked).toBe(true);
  expect(versionSelected).toBe(true);
  await performRoomAction(room.id, principal, {
    action: "lock",
    locked: false,
  });
  expect(room.locked).toBe(false);
  await performRoomAction(room.id, principal, {
    action: "announce",
    body: "Study page 4",
  });
  expect(room.announcement).toBe("Study page 4");
  const ended = await roomAction(
    request(`rooms/${room.id}/actions`, { action: "end" }),
    { params: Promise.resolve({ roomId: room.id }) },
  );
  expect(ended.status).toBe(200);
  expect(await ended.json()).toEqual({ ok: true });
  expect(room.status).toBe("ended");
});

test("V2 conditional reads are authorized, lock-free, and skip full snapshot queries", async () => {
  await getRoomPrincipal(room.id);
  readLocks = 0;
  const initial = await getRoomSnapshot(room.id);
  expect(readLocks).toBe(0);
  expect(snapshotReads).toBe(0);
  const url = `https://scholar.example/api/group-study/rooms/${room.id}?version=${encodeURIComponent(initial.version!)}`;
  const params = { params: Promise.resolve({ roomId: room.id }) };
  const unchanged = await readRoom(new Request(url), params);
  expect(await unchanged.json()).toEqual({
    unchanged: true,
    version: initial.version,
  });
  expect(snapshotReads).toBe(0);
  expect(readLocks).toBe(0);
  user = null;
  expect((await readRoom(new Request(url), params)).status).toBe(401);
});

test("V2 presence acknowledgment does not increment revision or create events", async () => {
  const principal = await getRoomPrincipal(room.id);
  members[0].lastSeenAt = new Date(Date.now() - 31_000);
  const result = await roomAction(
    request(`rooms/${room.id}/actions`, { action: "heartbeat" }),
    { params: Promise.resolve({ roomId: room.id }) },
  );
  expect(await result.json()).toEqual({ ok: true });
  expect(room.revision).toBe(0);
  expect(eventWrites).toBe(0);
  expect(snapshotReads).toBe(0);
  expect(Date.now() - principal.member.lastSeenAt.getTime()).toBeLessThan(1000);
});

test("V2 notes use an independent revision and preserve stale drafts through conflicts", async () => {
  const principal = await getRoomPrincipal(room.id);
  await performRoomAction(room.id, principal, {
    action: "announce",
    body: "Unrelated change",
  });
  await performRoomAction(room.id, principal, {
    action: "notes",
    text: "First draft",
    revision: 0,
    notesRevision: 0,
  });
  expect(room.notes).toBe("First draft");
  expect((await getRoomSnapshot(room.id)).notesRevision).toBe(1);
  await expect(
    performRoomAction(room.id, principal, {
      action: "notes",
      text: "Stale overwrite",
      revision: room.revision,
      notesRevision: 0,
    }),
  ).rejects.toThrow("Someone updated");
  expect(room.notes).toBe("First draft");
});

test("V2 chat is idempotent, bounded, attributed to the authenticated sender and rate limited", async () => {
  const principal = await getRoomPrincipal(room.id);
  room.status = "active";
  const input = {
    action: "chat" as const,
    body: "Work has units of joules",
    clientMessageId: "491af25b-f6f9-40d7-8656-d15bdeff9330",
  };
  await performRoomAction(room.id, principal, input);
  const revision = room.revision;
  await performRoomAction(room.id, principal, input);
  expect(messages.size).toBe(1);
  expect(room.revision).toBe(revision);
  expect(eventWrites).toBe(0);
  expect([...messages.values()][0]).toMatchObject({
    participantId: principal.id,
    body: input.body,
  });
  rateCount = 20;
  await expect(
    performRoomAction(room.id, principal, {
      ...input,
      clientMessageId: "c6d8c9a2-b946-4449-8045-dbc7192e9f4c",
    }),
  ).rejects.toThrow("Please wait a moment");
});

test("Group Study 3.0 enforces feature policy on direct participant actions", async () => {
  const hostPrincipal = await getRoomPrincipal(room.id);
  const student = createMember({
    status: "approved",
    tokenHash: "participant-token-hash",
  });
  const studentPrincipal = {
    room,
    member: student,
    role: "participant" as const,
    displayName: student.displayName,
    id: student.id,
  } as unknown as Awaited<ReturnType<typeof getRoomPrincipal>>;
  await performRoomAction(room.id, hostPrincipal, {
    action: "feature-policy",
    feature: "quiz",
    access: "off",
  });
  await expect(
    performRoomAction(room.id, studentPrincipal, {
      action: "answer",
      quizId: "quiz-1",
      questionId: "question-1",
      answer: 0,
    }),
  ).rejects.toThrow("host has closed");
  await expect(
    performRoomAction(room.id, studentPrincipal, {
      action: "navigate",
      feature: "quiz",
    }),
  ).rejects.toThrow("host has closed");
  await expect(
    performRoomAction(room.id, studentPrincipal, {
      action: "feature-policy",
      feature: "chat",
      access: "off",
    }),
  ).rejects.toThrow("Only the host");
});

test("Group Study 3.0 guided navigation moves the room only on an explicit take-group action", async () => {
  const principal = await getRoomPrincipal(room.id);
  await performRoomAction(room.id, principal, {
    action: "navigation-mode",
    mode: "guided",
  });
  await performRoomAction(room.id, principal, {
    action: "navigate",
    feature: "materials",
  });
  expect(room.activeFeature).toBe("overview");
  await performRoomAction(room.id, principal, {
    action: "navigate",
    feature: "materials",
    takeGroup: true,
    context: { resourceId: "resource-1", page: 3 },
  });
  expect(room.activeFeature).toBe("materials");
  expect(room.activeContext).toEqual({ resourceId: "resource-1", page: 3 });
  expect(room.navigationRevision).toBe(1);
});

test("Group Study 3.0 applies hard room media limits server-side", async () => {
  const principal = await getRoomPrincipal(room.id);
  for (let index = 0; index < 6; index++)
    createMember({ status: "approved", voiceJoined: true });
  await expect(
    performRoomAction(room.id, principal, {
      action: "media-state",
      voiceJoined: true,
      cameraActive: false,
    }),
  ).rejects.toThrow("voice room is full");
  members[members.length - 1].voiceJoined = false;
  await performRoomAction(room.id, principal, {
    action: "media-state",
    voiceJoined: true,
    cameraActive: false,
  });
  expect(members.find((member) => member.role === "host")?.voiceJoined).toBe(
    true,
  );
});

test("Group Study 3.0 signaling is room-scoped and requires both peers to join voice", async () => {
  const principal = await getRoomPrincipal(room.id);
  principal.member.voiceJoined = true;
  const target = createMember({ status: "approved", voiceJoined: true });
  const params = { params: Promise.resolve({ roomId: room.id }) };
  const valid = await sendSignal(
    request(`rooms/${room.id}/signals`, {
      targetId: target.id,
      kind: "offer",
      payload: { type: "offer", sdp: "v=0" },
    }),
    params,
  );
  expect(valid.status).toBe(201);
  expect(signals).toHaveLength(1);
  const outsider = createMember({
    roomId: "another-room",
    status: "approved",
    voiceJoined: true,
  });
  const crossRoom = await sendSignal(
    request(`rooms/${room.id}/signals`, {
      targetId: outsider.id,
      kind: "offer",
      payload: { type: "offer", sdp: "v=0" },
    }),
    params,
  );
  expect(crossRoom.status).toBe(404);
  target.voiceJoined = false;
  const inactivePeer = await sendSignal(
    request(`rooms/${room.id}/signals`, {
      targetId: target.id,
      kind: "ice",
      payload: { candidate: "candidate" },
    }),
    params,
  );
  expect(inactivePeer.status).toBe(404);
});

test("V2 quizzes redact solutions before reveal and publish no individual answers afterward", () => {
  const quiz = {
    id: "quiz",
    title: "Units",
    revealed: false,
    questions: [
      {
        id: "q",
        question: "Unit of work?",
        options: ["Joule", "Watt"],
        correctAnswer: 0,
        explanation: "Work is measured in joules.",
      },
    ],
    answers: { a: { q: 0 }, b: { q: 1 } },
  };
  const initial = sanitizeQuiz(quiz, "a", []);
  expect(initial.questions[0].correctAnswer).toBeUndefined();
  expect(initial.distribution).toBeUndefined();
  expect(initial.myAnswers).toEqual({ q: 0 });
  const revealed = sanitizeQuiz({ ...quiz, revealed: true }, "a", []);
  expect(revealed.distribution).toEqual({ q: [1, 1] });
  expect(revealed.correctPercent).toBe(50);
  expect(revealed.results).toBeUndefined();
});

test("V2 focus countdown is derived from end time without writes", () => {
  expect(
    resolveFocus(
      {
        status: "running",
        durationSeconds: 600,
        remainingSeconds: 600,
        endsAt: new Date(100_000).toISOString(),
      },
      85_000,
    ).remainingSeconds,
  ).toBe(15);
  expect(
    resolveFocus(
      {
        status: "paused",
        durationSeconds: 600,
        remainingSeconds: 200,
        endsAt: null,
      },
      999_999,
    ).remainingSeconds,
  ).toBe(200);
});
