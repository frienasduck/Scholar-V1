import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { LAM_COMPACT_MEDIA_QUERY } from "../src/lib/lam/render-quality";
test("LAM's layout/render quality switch matches the actual desktop header dock", () => {
  expect(LAM_COMPACT_MEDIA_QUERY).toBe("(max-width: 1023px)");
  const widget = readFileSync("src/components/lam-widget.tsx", "utf8");
  expect(widget.match(/matchMedia\(LAM_COMPACT_MEDIA_QUERY\)/g)).toHaveLength(2);
  expect(widget).toContain('matchMedia("(min-width: 1024px)")');
  const css = readFileSync("src/app/globals.css", "utf8");
  expect(css).toMatch(/@media \(max-width: 1023px\) \{\s+html\[data-lam-docked\]/);
});
