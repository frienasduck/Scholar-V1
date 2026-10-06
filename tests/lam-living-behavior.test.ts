import { afterEach, describe, expect, test } from "bun:test";
import { DEFAULT_LAM_IDENTITY, LAM_AVATARS, LAM_STATES, normalizeLamIdentity } from "../src/lib/lam/identity";
import { beginLamTubeReaction, cancelLamReaction, canLamPeek, configureLamBehavior, examLamUrgency, getLamPresence, getLamSession, lamInactivityState, lamOwnerState, lamStatePriority, lamTubeStoryAt, LAMTUBE_STORY, noteLamInteraction, reactLam, recordLamPeek, releaseLamPresence, resetLamBehaviorForTests, setLamContext, setLamEnvironment, setLamPresence, startLamSession, subscribeLamPresence, tickLamBehavior } from "../src/lib/lam/presence";

afterEach(resetLamBehaviorForTests);
const now = 1_000_000;
describe("All approved forms share a living vocabulary, not an identical idle loop", () => {
  test("all 22 forms have bounded, distinct motion profiles and the complete state vocabulary", () => {
    expect(LAM_AVATARS.length).toBe(22);
    expect(LAM_STATES.length).toBeGreaterThan(45);
    expect(new Set(LAM_AVATARS.map(a => a.motion.language)).size).toBe(10);
    for (const a of LAM_AVATARS) {
      expect(a.motion.float).toBeGreaterThanOrEqual(0); expect(a.motion.float).toBeLessThanOrEqual(4);
      expect(a.motion.tilt).toBeGreaterThan(0); expect(a.motion.tilt).toBeLessThanOrEqual(8);
      expect(a.motion.tempo).toBeGreaterThanOrEqual(6);
      expect(a.supportedStates).toEqual(LAM_STATES);
    }
  });
  test("old settings migrate safely; only allowlisted presentation options persist", () => {
    expect(normalizeLamIdentity({ avatarId: "lore", cursorAwareness: false, reducedMotion: true, presence: "quiet", provider: "x" })).toMatchObject({ avatarId: "lore", cursorAwareness: false, reducedMotion: true, presence: "quiet" });
    expect(normalizeLamIdentity({ presence: "extreme", reducedMotion: "no" }).presence).toBe("balanced");
    expect(normalizeLamIdentity({ reducedMotion: "no" }).reducedMotion).toBe(false);
    expect(normalizeLamIdentity({}).cursorAwareness).toBe(true);
  });
});
describe("Central activity priorities and finite feedback", () => {
  test("error > teaching > thinking > listening > ambient > idle", () => {
    const order = ["error","teaching","thinking","listening","lamtube_watching","idle"] as const;
    for (let i = 1; i < order.length; i++) expect(lamStatePriority(order[i-1])).toBeGreaterThan(lamStatePriority(order[i]));
    setLamPresence("video", "lamtube_watching", false, true, {}, now);
    setLamPresence("chat", "thinking", true, true, { target: "content" }, now);
    setLamPresence("input", "listening", false, true, { target: "input" }, now);
    expect(getLamPresence()).toMatchObject({ state: "thinking", busy: true, target: "content" });
    setLamPresence("chat", "error", false, true, {}, now);
    expect(getLamPresence().state).toBe("error");
  });
  test("persistent success/error flags settle once, never loop a celebration", () => {
    setLamPresence("answer", "happy", false, false, {}, now);
    expect(lamOwnerState("answer", "happy", now + 1000)).toBe("happy");
    tickLamBehavior(now + 2300);
    expect(lamOwnerState("answer", "happy", now + 2300)).toBe("attentive");
    setLamPresence("answer", "happy", false, false, {}, now + 2400);
    expect(getLamPresence().state).toBe("attentive");
  });
  test("owned feedback publishes its settled state even while teaching outranks it", () => {
    setLamPresence("teacher", "teaching", false, true, {}, now);
    setLamPresence("answer", "helpful", false, true, {}, now);
    const original = getLamPresence();
    expect(original.activities.answer).toBe("helpful");
    let updates = 0;
    const stop = subscribeLamPresence(() => updates++);
    tickLamBehavior(now + 2300);
    expect(getLamPresence().state).toBe("teaching");
    expect(getLamPresence().activities.answer).toBe("attentive");
    expect(getLamPresence().activities).not.toBe(original.activities);
    expect(updates).toBe(1);
    tickLamBehavior(now + 2500);
    expect(updates).toBe(1);
    stop();
    releaseLamPresence("answer");
    expect(getLamPresence().activities.answer).toBeUndefined();
  });
  test("micro/normal/major reactions all release to the actual activity", () => {
    for (const [level,duration] of [["micro",1400],["normal",1900],["major",2400]] as const) {
      resetLamBehaviorForTests(); setLamPresence("idle", "idle", false, false, {}, now);
      expect(reactLam("feedback", "success", level, now)).toBe(true);
      expect(getLamPresence().state).toBe("success");
      expect(reactLam("spam", "success", level, now + 100)).toBe(false);
      tickLamBehavior(now + duration); expect(getLamPresence().reaction).toBeNull();
    }
  });
  test("celebration preference, session mute, rollout and hidden tabs are respected", () => {
    configureLamBehavior({ ...DEFAULT_LAM_IDENTITY, celebrations: false });
    expect(reactLam("x", "success", "micro", now)).toBe(false);
    for (const patch of [{ hidden: true },{ enabled: false },{ sessionMuted: true }]) {
      resetLamBehaviorForTests(); setLamEnvironment(patch);
      expect(reactLam("x", "greeting", "micro", now)).toBe(false);
    }
  });
  test("identical activity updates and unchanged clock ticks do not notify subscribers", () => {
    let renders = 0; const stop = subscribeLamPresence(() => renders++);
    setLamPresence("work", "teaching", false, true, {}, now); const first = renders;
    setLamPresence("work", "teaching", false, true, {}, now+100); tickLamBehavior(now+200);
    expect(renders).toBe(first); stop(); releaseLamPresence("work");
  });
  test("urgent exam restraint changes on the shared clock, without a feature timer", () => {
    const deadline = now + 3 * 60 * 60_000;
    setLamPresence("exam", "exam_focus", false, true, { deadline }, now);
    expect(getLamPresence().urgency).toBe("focused");
    tickLamBehavior(now + 2 * 60 * 60_000); expect(getLamPresence().urgency).toBe("urgent");
    tickLamBehavior(deadline - 14 * 60_000); expect(getLamPresence().urgency).toBe("emergency");
    expect(examLamUrgency(2 * 24 * 60 * 60_000)).toBe("calm");
  });
});
describe("Natural inactivity and session continuity", () => {
  test("rest → sleepy → sleep thresholds", () => {
    expect(lamInactivityState(89_999)).toBe("idle"); expect(lamInactivityState(90_000)).toBe("rest");
    expect(lamInactivityState(240_000)).toBe("sleepy"); expect(lamInactivityState(480_000)).toBe("sleeping");
  });
  test("one greeting per session; navigation does not reset inactivity or peek count", () => {
    startLamSession(now); cancelLamReaction(); noteLamInteraction(now);
    recordLamPeek(now); setLamContext("dashboard"); setLamContext("resources");
    tickLamBehavior(now + 480_001); expect(getLamPresence().state).toBe("sleeping");
    expect(getLamSession()).toMatchObject({ greeted: true, peekCount: 1, lastActivity: now });
    noteLamInteraction(now + 480_100); expect(getLamPresence().state).toBe("wake");
    tickLamBehavior(now + 482_000); expect(getLamPresence().state).toBe("idle");
    startLamSession(now + 482_100); expect(getLamPresence().reaction).toBeNull();
  });
  test("busy and focused panels never fall asleep; idle reactions can be disabled", () => {
    noteLamInteraction(now); setLamPresence("chat", "thinking", true, true, {}, now);
    tickLamBehavior(now + 500_000); expect(getLamPresence().state).toBe("thinking");
    resetLamBehaviorForTests(); noteLamInteraction(now);
    configureLamBehavior({ ...DEFAULT_LAM_IDENTITY, idleReactions: false });
    tickLamBehavior(now + 500_000); expect(getLamPresence().state).toBe("idle");
  });
});
describe("LAMTube atomic story", () => {
  test("notice → look-back → eye-contact → shrug → What? → smooth return → watching", () => {
    setLamPresence("video", "lamtube_watching", false, true, { target: "screen" }, now);
    expect(beginLamTubeReaction("story", 0, now)).toBe(true);
    for (const step of LAMTUBE_STORY) {
      tickLamBehavior(now + step.at);
      expect(getLamPresence().reaction?.phase).toBe(step.phase);
      expect(getLamPresence().state).toBe(step.state);
    }
    tickLamBehavior(now + 3360);
    expect(getLamPresence()).toMatchObject({ state: "lamtube_watching", reaction: null });
  });
  test("no replay while active, no hidden/reduced playback; unmount cancels", () => {
    expect(beginLamTubeReaction("v", 0, now)).toBe(true);
    expect(beginLamTubeReaction("v", 0, now + 10)).toBe(false);
    setLamEnvironment({ reduced: true }); expect(getLamPresence().reaction).toBeNull();
    expect(beginLamTubeReaction("v",0,now)).toBe(false);
    resetLamBehaviorForTests(); beginLamTubeReaction("v",0,now);
    releaseLamPresence("v"); expect(getLamPresence().reaction).toBeNull();
  });
  test("new input, teaching or provider error interrupts the story", () => {
    for (const state of ["thinking","listening","teaching","error"] as const) {
      resetLamBehaviorForTests(); beginLamTubeReaction("v",0,now);
      setLamPresence("real",state,state === "thinking",true,{},now+300);
      expect(getLamPresence().reaction).toBeNull(); expect(getLamPresence().state).toBe(state);
      expect(beginLamTubeReaction("v",0,now+400)).toBe(false);
    }
  });
  test("rare alternates have bounded stories and return", () => {
    expect(lamTubeStoryAt(1000,1).phase).toBe("double-take");
    expect(lamTubeStoryAt(1000,2).phase).toBe("wave");
    expect(lamTubeStoryAt(1900,2).phase).toBe("return");
  });
});
describe("Rare peeks must yield to study and controls", () => {
  const safe = { enabled:true,hidden:false,reduced:false,busy:false,blocked:false,typing:false,dialog:false,fullscreen:false,width:1440,height:900,page:"home",quietFor:20000,sincePeek:300000 };
  test("balanced max 3, lively max 4, quiet max 0", () => {
    expect(canLamPeek({ ...safe,count:2,presence:"balanced" })).toBe(true);
    expect(canLamPeek({ ...safe,count:3,presence:"balanced" })).toBe(false);
    expect(canLamPeek({ ...safe,count:3,presence:"lively" })).toBe(true);
    expect(canLamPeek({ ...safe,count:4,presence:"lively" })).toBe(false);
    expect(canLamPeek({ ...safe,count:0,presence:"quiet" })).toBe(false);
  });
  test("all important pages, urgency, controls, phones and switches suppress peeks", () => {
    for (const page of ["ebook","exam-prep","chapter-command","practice","live-tutor","nigtube","music"]) expect(canLamPeek({ ...safe,page })).toBe(false);
    for (const urgency of ["focused","urgent","emergency"] as const) expect(canLamPeek({ ...safe,urgency })).toBe(false);
    for (const key of ["typing","dialog","fullscreen","busy","blocked","hidden","reduced"] as const) expect(canLamPeek({ ...safe,[key]:true })).toBe(false);
    expect(canLamPeek({ ...safe,width:390 })).toBe(false);
    expect(canLamPeek({ ...safe,enabled:false })).toBe(false);
  });
});
