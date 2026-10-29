import { expect, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LivingHomepage } from "../src/components/landing/living-homepage";
import { ChapterShowcase, FocusShowcase, PracticeShowcase, ScholarExperience } from "../src/components/landing/core-sections";
import { ExamReadyShowcase, LamShowcase } from "../src/components/landing/intelligence-sections";
import { GroupShowcase, MaterialsShowcase, PlannerShowcase, ReadingShowcase } from "../src/components/landing/knowledge-sections";
import { checkPractice, practiceExamples } from "../src/components/landing/demo-data";
import { isScholarRoute } from "../src/lib/routes";
import { useStore } from "../src/lib/store";
import { AuthScreen } from "../src/components/auth-screen";

const noop = () => undefined;
const renderHomepage = () => renderToStaticMarkup(<LivingHomepage onSignup={noop} onGuest={noop} />);
const sectionIds = ["experience", "meet-lam", "exam-ready", "materials", "chapters", "practice", "planner", "group-study", "reading", "focus-modes"];

test("the cinematic journey includes ten individually named section landmarks", () => {
  const html = renderHomepage();
  for (const id of sectionIds) {
    expect(html.match(new RegExp(`id="${id}"`, "g"))).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<section[^>]*id="${id}"[^>]*aria-labelledby="${id}-title"`));
    expect(html).toMatch(new RegExp(`<h2[^>]*id="${id}-title"`));
  }
});

test("feature links lead to existing Scholar routes or real page anchors", () => {
  const html = renderHomepage();
  const hrefs = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1]);
  expect(hrefs.length).toBeGreaterThanOrEqual(10);
  for (const href of hrefs) {
    expect(href.startsWith("/") || href.startsWith("#")).toBe(true);
    if (href.startsWith("#")) {
      expect(href.length).toBeGreaterThan(1);
      expect(html).toContain(`id="${href.slice(1)}"`);
      continue;
    }
    const path = new URL(href, "https://scholar.example").pathname;
    expect(["/", "/login", "/privacy", "/terms", "/help", "/updates"].includes(path) || isScholarRoute(path.slice(1).split("/"))).toBe(true);
  }
  for (const destination of ["/notes", "/analytics", "/exam-prep", "/chapter-command", "/practice", "/planner", "/group-study", "/ebook", "/focus"]) {
    expect(hrefs).toContain(destination);
  }
});

test("rendering the public previews cannot call a provider, enter Guest Mode, or alter student records", () => {
  const blockedFetch: typeof fetch = Object.assign(() => { throw new Error("A public preview attempted a network request"); }, { preconnect: globalThis.fetch.preconnect });
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(blockedFetch);
  const before = useStore.getState();
  let accountActions = 0;
  try {
    renderToStaticMarkup(<LivingHomepage onSignup={() => { accountActions++; }} onGuest={() => { accountActions++; }} />);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(accountActions).toBe(0);
    expect(useStore.getState()).toBe(before);
  } finally {
    fetchSpy.mockRestore();
  }
});

test("dedicated account entry keeps the real form without requiring the marketing journey", () => {
  const router = { back: noop, forward: noop, refresh: noop, push: noop, replace: noop, prefetch: noop, bfcacheId: "account-fixture" };
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthScreen accountOnly /></AppRouterContext.Provider>);
  expect(html).toContain('id="scholar-auth-form"');
  expect(html).toContain("Welcome back");
  for (const id of ["scholar-email", "scholar-password"]) {
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain(`for="${id}"`);
  }
  expect(html).toContain("Continue as Guest");
  expect(html).toContain("Continue with Google");
  expect(html).toContain("Forgot password?");
  expect(html).not.toContain('aria-label="Welcome to Scholar"');
  expect(html).not.toContain('data-testid="cinematic-homepage"');
});

test("learning and productivity demonstrations identify their sample content and scope", () => {
  for (const element of [<ScholarExperience key="experience" />, <LamShowcase key="lam" />, <ExamReadyShowcase key="exam" />, <ChapterShowcase key="chapters" />, <PracticeShowcase key="practice" />, <MaterialsShowcase key="materials" />, <GroupShowcase key="group" />, <PlannerShowcase key="planner" />, <ReadingShowcase key="reading" />, <FocusShowcase key="focus" />]) {
    expect(renderToStaticMarkup(element)).toMatch(/sample|illustrative|preview/i);
  }
  expect(renderToStaticMarkup(<ScholarExperience />)).toContain("no live AI requests");
  expect(renderToStaticMarkup(<PracticeShowcase />)).toContain("not saved or graded by AI");
  expect(renderToStaticMarkup(<PlannerShowcase />)).toContain("no tasks added to your planner");
  expect(renderToStaticMarkup(<GroupShowcase />)).toContain("no live room connection");
  expect(renderToStaticMarkup(<ReadingShowcase />)).toContain("no private documents");
});

test("the ambient motion control reflects a paused preference without invoking its action", () => {
  let changes = 0;
  const html = renderToStaticMarkup(<LivingHomepage onSignup={noop} onGuest={noop} paused onMotionToggle={() => { changes++; }} />);
  expect(html).toContain('data-motion="paused"');
  expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?Resume ambient motion<\/button>/);
  expect(changes).toBe(0);
});

test("Study Music remains honestly paused while the timer is usable and themes are silent", () => {
  const html = renderToStaticMarkup(<FocusShowcase />);
  expect(html).toContain("Study Music is temporarily unavailable");
  expect(html).toContain("copyright concerns");
  expect(html).toContain('href="/music"');
  expect(html).toContain('href="/focus"');
  expect(html).toContain("Start timer");
  expect(html).toContain("25:00");
  expect(html).toContain("visual themes are silent");
  expect(html).not.toMatch(/<(?:iframe|audio|video)\b/);
});

test("public previews preserve account restrictions and authentic approved LAM artwork", () => {
  const html = renderHomepage();
  expect(html).toContain("signed-in Plus account");
  const images = [...html.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map((match) => new URL(match[1], "https://scholar.example"));
  expect(images.some((url) => (url.searchParams.get("url") || url.pathname).startsWith("/lam/identity/avatars/"))).toBe(true);
  expect(html).not.toMatch(/<(?:iframe|audio|video)\b/);
  expect(html).not.toMatch(/guaranteed (?:marks|scores)|official (?:CBSE|NCERT) partner|2\.8x|43% fewer/i);
});

test("the first practice example correctly uses change in velocity over elapsed time", () => {
  const question = practiceExamples[0];
  const acceleration = (16 - 4) / 3;
  expect(question.options[question.correct]).toBe(`${acceleration} m/s²`);
  expect(checkPractice(0, question.correct)).toEqual({ correct: true, text: question.explanation });
  for (let option = 0; option < question.options.length; option++) {
    if (option !== question.correct) expect(checkPractice(0, option)).toEqual({ correct: false, text: question.misconception });
  }
});

test("the second practice example correctly uses constant speed times elapsed time", () => {
  const question = practiceExamples[1];
  expect(question.options[question.correct]).toBe(`${12 * 5} m`);
  expect(checkPractice(1, question.correct)).toEqual({ correct: true, text: question.explanation });
  expect(checkPractice(1, 0)).toEqual({ correct: false, text: question.misconception });
  expect(checkPractice(-1, 0)).toBeNull();
  expect(checkPractice(practiceExamples.length, 0)).toBeNull();
  expect(checkPractice(0, -1)).toBeNull();
  expect(checkPractice(0, practiceExamples[0].options.length)).toBeNull();
});
