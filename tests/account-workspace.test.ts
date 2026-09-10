import { describe, expect, test } from "bun:test";
import { recoverWorkspaceSwitch, switchWorkspace, isWorkspaceKey } from "../src/lib/account-workspace";

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  failKey = "";
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (key === this.failKey) throw new Error("QuotaExceededError"); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
const state = (email: string, note: string) => JSON.stringify({ schema: 5, state: { user: { email }, notes: [{ title: note }] } });

describe("recoverable local account workspaces", () => {
  test("account B cannot inherit account A notes, LAM, files or module history", () => {
    const storage = new MemoryStorage();
    storage.setItem("neha-scholar-v5", state("a@example.test", "Private A"));
    storage.setItem("scholar-lam-v1-class-11", "A conversation");
    storage.setItem("scholar:class11:aisig-history", "A image history");
    storage.setItem("ws-notes", "A workspace note");
    storage.setItem("other-app-setting", "keep");
    expect(switchWorkspace(storage, "b@example.test", state("b@example.test", ""))).toBe(true);
    expect(storage.getItem("neha-scholar-v5")).not.toContain("Private A");
    expect(storage.getItem("scholar-lam-v1-class-11")).toBeNull();
    expect(storage.getItem("ws-notes")).toBeNull();
    expect(storage.getItem("other-app-setting")).toBe("keep");
    switchWorkspace(storage, "a@example.test", state("a@example.test", ""));
    expect(storage.getItem("neha-scholar-v5")).toContain("Private A");
    expect(storage.getItem("scholar-lam-v1-class-11")).toBe("A conversation");
    expect(storage.getItem("scholar:class11:aisig-history")).toBe("A image history");
  });
  test("failed backup never changes active records", () => {
    const storage = new MemoryStorage();
    const original = state("a@example.test", "Keep this");
    storage.setItem("neha-scholar-v5", original);
    storage.failKey = "scholar-account-vault-v1:a%40example.test";
    expect(() => switchWorkspace(storage, "b@example.test", state("b@example.test", ""))).toThrow();
    expect(storage.getItem("neha-scholar-v5")).toBe(original);
  });
  test("same account retains existing records without duplicating storage", () => {
    const storage = new MemoryStorage();
    storage.setItem("neha-scholar-v5", state("a@example.test", "Keep"));
    expect(switchWorkspace(storage, " A@example.test ", state("a@example.test", ""))).toBe(false);
    expect(storage.getItem("neha-scholar-v5")).toContain("Keep");
  });
  test("an interrupted switch restores its durable backup", () => {
    const storage = new MemoryStorage();
    const backupKey = "scholar-account-vault-v1:a";
    storage.setItem(backupKey, JSON.stringify({ "neha-scholar-v5": state("a@example.test", "Safe") }));
    storage.setItem("scholar-workspace-switch-v1", JSON.stringify({ backupKey, previousOwner: "a@example.test" }));
    storage.setItem("neha-scholar-v5", "partial switch");
    recoverWorkspaceSwitch(storage);
    expect(storage.getItem("neha-scholar-v5")).toContain("Safe");
    expect(storage.getItem("scholar-workspace-switch-v1")).toBeNull();
  });
  test("vaults and unrelated sites never become active workspace entries", () => {
    expect(isWorkspaceKey("scholar-account-vault-v1:a")).toBe(false);
    expect(isWorkspaceKey("unrelated-data")).toBe(false);
  });
});
