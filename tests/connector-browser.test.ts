import { expect, test } from "bun:test";
import { requiresExternalDriveBrowser } from "../src/lib/connections/browser";
test("Android embedded authorization requires a full-browser handoff", () => {
  expect(requiresExternalDriveBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UP1A; wv) Chrome/126.0 Mobile Safari/537.36")).toBe(true);
});
test("ordinary laptop and mobile Chrome are not misclassified as WebViews", () => {
  expect(requiresExternalDriveBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36")).toBe(false);
  expect(requiresExternalDriveBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/126.0 Mobile Safari/537.36")).toBe(false);
});
