import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

// The room action policy is pure and importable without the server bundle.
const { canPerformAction, normalizeRoomCode, HOST_ACTIONS, displayNameSchema, joinRoomSchema, createRoomSchema, quizQuestionSchema, groupActionSchema } = await import("../src/lib/group-study/policy");

describe("group study room policy", () => {
  test("participants can only perform non-host actions while approved", () => {
    for (const action of HOST_ACTIONS) {
      expect(canPerformAction("participant", "approved", action)).toBe(false);
    }
    expect(canPerformAction("participant", "approved", "chat")).toBe(true);
    expect(canPerformAction("participant", "approved", "hand")).toBe(true);
    expect(canPerformAction("participant", "approved", "answer")).toBe(true);
    expect(canPerformAction("participant", "approved", "vote")).toBe(true);
    expect(canPerformAction("participant", "approved", "heartbeat")).toBe(true);
    expect(canPerformAction("participant", "approved", "notes")).toBe(true);
  });

  test("pending, removed, denied and left identities can only heartbeat or leave", () => {
    for (const status of ["pending", "removed", "denied", "left"]) {
      expect(canPerformAction("participant", status, "chat")).toBe(false);
      expect(canPerformAction("participant", status, "approve")).toBe(false);
      expect(canPerformAction("participant", status, "heartbeat")).toBe(true);
      expect(canPerformAction("participant", status, "leave")).toBe(true);
    }
  });

  test("a participant can never perform host actions even with forged status or role", () => {
    expect(canPerformAction("host", "approved", "end")).toBe(true);
    // Forged role values fall back to participant treatment.
    expect(canPerformAction("moderator", "approved", "remove")).toBe(false);
    expect(canPerformAction("participant", "approved", "approve")).toBe(false);
    expect(canPerformAction("participant", "approved", "remove")).toBe(false);
    expect(canPerformAction("participant", "approved", "settings")).toBe(false);
    expect(canPerformAction("participant", "approved", "end")).toBe(false);
    expect(canPerformAction("participant", "approved", "reveal")).toBe(false);
  });

  test("room codes normalize case, spacing, separators, and confusing characters are excluded at generation", () => {
    expect(normalizeRoomCode(" sch-7k4p2q ")).toBe("SCH7K4P2Q");
    expect(normalizeRoomCode("SCH-7K4P2Q")).toBe("SCH7K4P2Q");
    expect(normalizeRoomCode("sCH7k4p2q")).toBe("SCH7K4P2Q");
  });

  test("display names reject control characters, HTML-length abuse and short names", () => {
    expect(displayNameSchema.safeParse("Johan").success).toBe(true);
    expect(displayNameSchema.safeParse("A").success).toBe(false);
    expect(displayNameSchema.safeParse("bad\nname").success).toBe(false);
    expect(displayNameSchema.safeParse("x".repeat(41)).success).toBe(false);
    expect(displayNameSchema.safeParse("  Trimmed  ").success).toBe(true);
  });

  test("join payload requires name and code, and nothing else passes validation", () => {
    expect(joinRoomSchema.safeParse({ displayName: "Johan", code: "SCH-7K4P2Q" }).success).toBe(true);
    expect(joinRoomSchema.safeParse({ displayName: "Johan" }).success).toBe(false);
    expect(joinRoomSchema.safeParse({ displayName: "Johan", code: "SCH-7K4P2Q", role: "host" }).success).toBe(false);
    expect(joinRoomSchema.safeParse({ displayName: "J", code: "SCH7K4P2Q" }).success).toBe(false);
  });

  test("create payload is host-shaped and strictly validated", () => {
    expect(createRoomSchema.safeParse({ name: "Physics Revision" }).success).toBe(true);
    expect(createRoomSchema.safeParse({ name: "Physics Revision", subject: "Physics", topic: "Work", maxParticipants: 15 }).success).toBe(true);
    expect(createRoomSchema.safeParse({ name: "Physics Revision", hostUserId: "forged" }).success).toBe(false);
    expect(createRoomSchema.safeParse({ name: "Physics Revision", maxParticipants: 500 }).success).toBe(false);
  });

  test("quiz question payloads cannot smuggle extra fields or invalid answers", () => {
    const valid = { question: "What is work?", options: ["A", "B", "C", "D"], correctAnswer: 1 };
    expect(quizQuestionSchema.safeParse(valid).success).toBe(true);
    expect(quizQuestionSchema.safeParse({ ...valid, correctAnswer: 9 }).success).toBe(false);
    expect(quizQuestionSchema.safeParse({ ...valid, extra: "x" }).success).toBe(false);
  });

  test("action union rejects unknown actions and forged fields", () => {
    expect(groupActionSchema.safeParse({ action: "approve", participantId: "p1" }).success).toBe(true);
    expect(groupActionSchema.safeParse({ action: "become-host" }).success).toBe(false);
    expect(groupActionSchema.safeParse({ action: "chat", body: "hi", role: "host" }).success).toBe(false);
    expect(groupActionSchema.safeParse({ action: "settings", settings: { hostUserId: "x" } }).success).toBe(false);
    expect(groupActionSchema.safeParse({ action: "page", page: 0 }).success).toBe(false);
  });
});
