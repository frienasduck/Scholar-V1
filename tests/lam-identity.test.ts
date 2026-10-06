import { describe, expect, test, afterEach } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DEFAULT_LAM_IDENTITY, LAM_AVATARS, LAM_STATES, getLamAvatar, normalizeLamIdentity, resolveLamState } from "../src/lib/lam/identity";
import { LAM_PEEK_COOLDOWN, LAM_REACTION_COOLDOWN, canLamPeek, canLamReact, getLamPresence, releaseLamPresence, setLamEnvironment, setLamPresence, subscribeLamPresence } from "../src/lib/lam/presence";
import { publicV2Flags, isFlagEnabled } from "../src/lib/v2/flags";
import { switchWorkspace } from "../src/lib/account-workspace";

class IdentityStorage implements Storage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

describe("Approved LAM identity registry", () => {
  test("all 22 reference forms have stable unique IDs, crops and supported placements", () => {
    expect(LAM_AVATARS).toHaveLength(22);
    expect(new Set(LAM_AVATARS.map(a => a.id)).size).toBe(22);
    for (const a of LAM_AVATARS) {
      expect(existsSync(`public${a.asset}`)).toBe(true);
      expect(a.thumbnail).toBe(a.asset);
      expect(a.placements).toContain("header"); expect(a.placements).toContain("lamtube");
      const [x,y,w,h] = a.crop;
      expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
      expect(x+w).toBeLessThanOrEqual(a.sourceWidth); expect(y+h).toBeLessThanOrEqual(a.sourceHeight);
      expect(a.supportedStates).toEqual(LAM_STATES); expect(getLamAvatar(a.fallback).id).toBe(a.fallback);
    }
  });
  test("source sheets stay byte-identical to the supplied references", () => {
    const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
    const pairs = [["concepts", "895a89c5-3d31-4c60-b269-729c4f89e30a"], ["mascots", "727a05a2-be73-4593-8ac0-db60c7a0359f"]];
    // CI has the checked-in sources, not the user's temporary attachment directory.
    for (const [sheet,id] of pairs) {
      const attachment = `C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-${id}.png`;
      if (existsSync(attachment)) expect(hash(`public/lam/identity/${sheet}.png`)).toBe(hash(attachment));
    }
  });
  test("corrupt / old preferences cannot choose remote art or remove defaults", () => {
    expect(normalizeLamIdentity(null)).toEqual(DEFAULT_LAM_IDENTITY);
    expect(normalizeLamIdentity({ avatarId: "https://invalid.example/avatar", animations: "yes" })).toEqual(DEFAULT_LAM_IDENTITY);
    expect(normalizeLamIdentity({ avatarId: "nova", peeks: false, intensity: "expressive" })).toMatchObject({ avatarId: "nova", peeks: false, intensity: "expressive" });
    expect(getLamAvatar("missing").id).toBe(DEFAULT_LAM_IDENTITY.avatarId);
  });
  test("appearance has no provider, intelligence or personality fields", () => {
    expect(Object.keys(normalizeLamIdentity({ liveTutorPersonality: "exam", provider: "new" }))).toEqual(Object.keys(DEFAULT_LAM_IDENTITY));
  });
  test("LAM appearance stays with its account workspace and restores on return", () => {
    const storage = new IdentityStorage();
    const main = "neha-scholar-v5";
    const saved = (email: string, avatarId: string) => JSON.stringify({ schema: 5, state: { user: { email }, settings: { lamIdentity: normalizeLamIdentity({ avatarId }) } } });
    storage.setItem(main, saved("a@example.test", "nexus"));
    switchWorkspace(storage, "b@example.test", saved("b@example.test", "aurora"));
    expect(JSON.parse(storage.getItem(main)!).state.settings.lamIdentity.avatarId).toBe("aurora");
    storage.setItem(main, saved("b@example.test", "lore"));
    switchWorkspace(storage, "a@example.test", saved("a@example.test", "aurora"));
    expect(JSON.parse(storage.getItem(main)!).state.settings.lamIdentity.avatarId).toBe("nexus");
    switchWorkspace(storage, "b@example.test", saved("b@example.test", "aurora"));
    expect(JSON.parse(storage.getItem(main)!).state.settings.lamIdentity.avatarId).toBe("lore");
  });
  test("maps actual response, speech, tools and error state safely", () => {
    expect(resolveLamState("speaking")).toBe("responding"); expect(resolveLamState("working")).toBe("reading");
    expect(resolveLamState("typing")).toBe("listening"); expect(resolveLamState("completed")).toBe("happy");
    expect(resolveLamState("unrecognized")).toBe("idle");
  });
});

describe("Coordinated presence and interruption safety", () => {
  afterEach(() => { releaseLamPresence("panel"); releaseLamPresence("video"); setLamEnvironment({ hidden: false, reduced: false, enabled: true }); });
  test("active requests outrank idle placements and clean up on unmount", () => {
    setLamPresence("video", "lamtube_watching"); setLamPresence("panel", "thinking", true, true);
    expect(getLamPresence()).toMatchObject({ state: "thinking", busy: true, blocked: true });
    releaseLamPresence("panel"); expect(getLamPresence()).toMatchObject({ state: "lamtube_watching", busy: false, blocked: false });
  });
  test("identical updates do not emit needless renders; unsubscribe is safe", () => {
    let count = 0; const stop = subscribeLamPresence(() => count++);
    setLamPresence("panel", "thinking", true); const once = count;
    setLamPresence("panel", "thinking", true); expect(count).toBe(once);
    stop(); releaseLamPresence("panel"); expect(count).toBe(once);
  });
  test("reduced motion and hidden-tab signals propagate", () => {
    setLamEnvironment({ hidden: true, reduced: true }); expect(getLamPresence()).toMatchObject({ hidden: true, reduced: true });
  });
  const safe = { enabled: true, hidden: false, reduced: false, busy: false, blocked: false, typing: false, dialog: false, fullscreen: false, width: 1440, height: 900, page: "home", quietFor: 20_000, sincePeek: LAM_PEEK_COOLDOWN };
  test("peeks require rare cooldown and a calm large browsing viewport", () => {
    expect(canLamPeek(safe)).toBe(true);
    expect(canLamPeek({ ...safe, page: "dashboard" })).toBe(true);
    expect(canLamPeek({ ...safe, sincePeek: LAM_PEEK_COOLDOWN - 1 })).toBe(false);
    expect(canLamPeek({ ...safe, quietFor: 19_999 })).toBe(false);
    expect(canLamPeek({ ...safe, width: 390 })).toBe(false);
    expect(canLamPeek({ ...safe, height: 500 })).toBe(false);
  });
  test("all important activities and preferences suppress peeks", () => {
    for (const key of ["hidden", "reduced", "busy", "blocked", "typing", "dialog", "fullscreen"] as const) expect(canLamPeek({ ...safe, [key]: true })).toBe(false);
    expect(canLamPeek({ ...safe, enabled: false })).toBe(false);
    for (const page of ["ebook", "exam-prep", "quiz", "practice", "live-tutor", "nigtube"]) expect(canLamPeek({ ...safe, page })).toBe(false);
  });
  test("LAMTube rejects click spam and cannot restart an active sequence", () => {
    expect(canLamReact(20_000, 0, false)).toBe(true);
    expect(canLamReact(LAM_REACTION_COOLDOWN - 1, 0, false)).toBe(false);
    expect(canLamReact(20_000, 0, true)).toBe(false);
  });
  test("rollout switch is presentation-only and can be disabled", () => {
    expect(publicV2Flags().v2_lam_identity).toBe(true);
    expect(isFlagEnabled("v2_lam_identity", { overrides: { v2_lam_identity: false } })).toBe(false);
  });
});
