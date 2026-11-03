import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { VelocitySidebar } from "../src/components/liquid-glass/velocity-motion";
import { WORDMARK_FILL_DURATION } from "../src/lib/animation/launch-wordmark";
import { VELOCITY_CONTROL_SELECTOR } from "../src/lib/animation/velocity-policy";

test("expanded sidebar and compact rail preserve the same semantic navigation container", () => {
  for (const expanded of [true, false]) {
    const html = renderToStaticMarkup(<VelocitySidebar expanded={expanded} reduced={false}><nav aria-label="Study sections">Notes</nav></VelocitySidebar>);
    expect(html).toContain("<aside");
    expect(html).toContain(`width:${expanded ? 256 : 76}px`);
    expect(html).toContain('class="scholar-desktop-sidebar sg-navigation-shell');
    expect(html).toContain('aria-label="Study sections"');
  }
});

test("sidebar remains optical Tier 2, compact lens uses original shared renderer", () => {
  const css = readFileSync("src/components/liquid-glass/liquid-velocity.css", "utf8");
  const shell = readFileSync("src/components/app-shell.tsx", "utf8");
  expect(css).toContain(".scholar-desktop-sidebar.sg-navigation-shell");
  expect(css).toContain('data-sidebar-expanded="false"');
  expect(shell).toContain("<VelocitySidebar expanded={sidebarOpen}");
  expect(shell).not.toContain("sg-velocity-lens-scene");
  expect(shell).not.toContain("liquid-crystal");
  expect(WORDMARK_FILL_DURATION).toBe(5000);
});

test("tactile migration is explicit and leaves assessment/Framer ownership alone", () => {
  expect(VELOCITY_CONTROL_SELECTOR).not.toContain(".scholar-main-scroll button");
  expect(VELOCITY_CONTROL_SELECTOR).not.toContain(".er-options");
  expect(VELOCITY_CONTROL_SELECTOR).not.toContain(".er-choice");
  expect(VELOCITY_CONTROL_SELECTOR).toContain(".eb-reader-tools > button");
  const practice = readFileSync("src/components/views/practice.tsx", "utf8");
  expect(practice).toContain('data-velocity-control="practice"');
  expect(practice).toMatch(/<button key=\{i\} onClick=\{\(\) => handleMCQSelect\(i\)\}/);
  const motion = readFileSync("src/components/liquid-glass/velocity-motion.tsx", "utf8");
  expect(motion).toContain('event.key === " " || event.key === "Enter"');
  expect(motion).toContain('document.removeEventListener("keydown", keydown)');
  expect(motion).toContain("spring({ bounce: 0.08");
});
