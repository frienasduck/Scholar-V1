import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("production uses the supported Webpack path while retaining deployment preflight", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  expect(pkg.scripts.build).toBe("bun run deploy:preflight && next build --webpack");
});

test("the shared LAM placement rule is global rather than an impure CSS-module selector", () => {
  const moduleCss = readFileSync("src/components/lam/lam-identity.module.css", "utf8");
  const globalCss = readFileSync("src/app/globals.css", "utf8");
  expect(moduleCss).not.toContain(":global(.lam-living-presence)");
  expect(globalCss).toContain(".lam-living-presence { margin-bottom: 14px; }");
});

test("Exam Ready material validation remains internal to the route", () => {
  const route = readFileSync("src/app/api/exam-ready/materials/route.ts", "utf8");
  expect(route).toContain("const scopeSchema = z.object(");
  expect(route).not.toContain("export const scopeSchema");
  expect(route).toContain("scopeSchema.parse(");
});
