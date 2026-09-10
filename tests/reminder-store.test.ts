import { afterEach, describe, expect, test } from "bun:test";
import { useReminderStore, REMINDERS_CHANGED_EVENT, initReminderStoreSync, remindersStorageKey } from "../src/lib/reminders/store";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage); else Reflect.deleteProperty(globalThis, "localStorage");
  useReminderStore.setState({ byProfile: {} });
});
function browser() {
  const events = new EventTarget();
  const values = new Map<string, string>();
  let writes = 0;
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { writes++; values.set(key, value); } };
  Object.defineProperty(globalThis, "window", { configurable: true, value: events });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return { events, storage, writes: () => writes };
}
describe("reminder event ordering", () => {
  test("synchronous scheduler reads do not recursively hydrate a missing profile", () => {
    const { events } = browser();
    let calls = 0;
    events.addEventListener(REMINDERS_CHANGED_EVENT, () => {
      expect(++calls).toBeLessThan(3);
      expect(useReminderStore.getState().ensureProfile(11).version).toBe(2);
    });
    useReminderStore.getState().hydrate(11);
    expect(calls).toBe(1);
  });
  test("changed listeners see the newly persisted reminder state", () => {
    const { events } = browser();
    useReminderStore.getState().hydrate(11);
    const next = structuredClone(useReminderStore.getState().ensureProfile(11));
    next.settings.quietHours.enabled = true;
    events.addEventListener(REMINDERS_CHANGED_EVENT, () => expect(useReminderStore.getState().ensureProfile(11).settings.quietHours.enabled).toBe(true));
    useReminderStore.getState().persist(11, next);
  });
  test("cross-tab synchronization reads without writing back", () => {
    const { events, storage, writes } = browser();
    useReminderStore.getState().hydrate(11);
    const key = remindersStorageKey(11);
    const next = structuredClone(useReminderStore.getState().ensureProfile(11));
    next.settings.quietHours.enabled = true;
    storage.setItem(key, JSON.stringify(next));
    const before = writes();
    const cleanup = initReminderStoreSync();
    const event = Object.assign(new Event("storage"), { key });
    events.dispatchEvent(event);
    expect(writes()).toBe(before);
    expect(useReminderStore.getState().ensureProfile(11).settings.quietHours.enabled).toBe(true);
    cleanup();
  });
});
