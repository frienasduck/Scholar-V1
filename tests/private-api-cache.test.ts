import { expect, test } from "bun:test";
import config from "../next.config";
test("all API payloads are explicitly private and non-cacheable across accounts", async () => {
  const rules = await config.headers!();
  const rule = rules.find(item => item.source === "/api/:path*");
  expect(rule?.headers).toContainEqual({ key: "Cache-Control", value: "private, no-store" });
});
