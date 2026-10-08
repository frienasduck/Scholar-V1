import { expect, test } from "bun:test";
import { SESSION_CHANGED_EVENT, SESSION_CHANGED_KEY, subscribeSessionChanges } from "../src/lib/auth/session-events";
import { isWorkspaceKey } from "../src/lib/account-workspace";

function tab(storageFails = false) {
  const target = new EventTarget(); const writes: [string, string][] = [];
  Object.assign(target, { localStorage: { setItem: (key: string, value: string) => { if (storageFails) throw new Error("storage unavailable"); writes.push([key, value]); } } });
  return { target: target as unknown as Window, writes };
}
function storage(target: Window, key: string, newValue: string | null) {
  const event = new Event("storage"); Object.assign(event, { key, newValue }); target.dispatchEvent(event);
}
test("same-tab auth changes invalidate locally and publish only a random nonce", () => {
  const { target, writes } = tab(); let changes = 0;
  const unsubscribe = subscribeSessionChanges(() => changes++, target);
  target.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  expect(changes).toBe(1); expect(writes).toHaveLength(1); expect(writes[0][0]).toBe(SESSION_CHANGED_KEY);
  expect(writes[0][1]).toMatch(/^[a-f0-9-]{36}$/); expect(isWorkspaceKey(SESSION_CHANGED_KEY)).toBe(false);
  unsubscribe(); target.dispatchEvent(new Event(SESSION_CHANGED_EVENT)); expect(changes).toBe(1);
});
test("remote sign-out invalidates without rebroadcast loops or trusting payload identity", () => {
  const { target, writes } = tab(); let changes = 0;
  const unsubscribe = subscribeSessionChanges(() => changes++, target);
  storage(target, SESSION_CHANGED_KEY, "untrusted marker"); expect(changes).toBe(1); expect(writes).toHaveLength(0);
  storage(target, "another-site-key", "anything"); storage(target, SESSION_CHANGED_KEY, null); expect(changes).toBe(1);
  unsubscribe(); storage(target, SESSION_CHANGED_KEY, "next"); expect(changes).toBe(1);
});
test("unavailable storage never prevents this tab from revoking old access", () => {
  const { target } = tab(true); let changes = 0;
  const unsubscribe = subscribeSessionChanges(() => changes++, target);
  target.dispatchEvent(new Event(SESSION_CHANGED_EVENT)); expect(changes).toBe(1); unsubscribe();
});
