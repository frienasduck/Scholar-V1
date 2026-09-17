import { expect, test } from "bun:test";
import {
  singleFlight,
  pollDelay,
} from "../src/components/group-study/room-sync";
test("room refreshes deduplicate and queue exactly one forced post-mutation read", async () => {
  const resolvers: Array<(value: number) => void> = [];
  const calls: boolean[] = [];
  const read = singleFlight((force: boolean) => {
    calls.push(force);
    return new Promise<number>((resolve) => resolvers.push(resolve));
  });
  const first = read(),
    duplicate = read(),
    forced = read(true),
    forcedAgain = read(true);
  expect(first).toBe(duplicate);
  expect(forced).toBe(forcedAgain);
  expect(calls).toEqual([false]);
  resolvers[0](1);
  expect(await first).toBe(1);
  await Promise.resolve();
  expect(calls).toEqual([false, true]);
  resolvers[1](2);
  expect(await forced).toBe(2);
});
test("foreground, background and failed requests have bounded adaptive intervals", () => {
  expect(pollDelay(false, 0)).toBe(3000);
  expect(pollDelay(true, 0)).toBe(30000);
  expect(pollDelay(false, 1)).toBe(6000);
  expect(pollDelay(false, 99)).toBeLessThanOrEqual(30000);
});
