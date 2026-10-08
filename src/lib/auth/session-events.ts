/** Invalidation only: no account IDs, entitlement data, cookies or tokens. */
export const SESSION_CHANGED_EVENT = "scholar:session-changed";
export const SESSION_CHANGED_KEY = "scholar-session-invalidation-v1";

export function notifySessionChanged() {
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function subscribeSessionChanges(onChange: () => void, target: Window = window) {
  const local = () => {
    // Existing sign-out/developer-change events also reach every open tab.
    // Storage restrictions must never prevent this tab from invalidating.
    try { target.localStorage.setItem(SESSION_CHANGED_KEY, crypto.randomUUID()); } catch { /* focus revalidation remains available */ }
    onChange();
  };
  const remote = (event: StorageEvent) => {
    if (event.key === SESSION_CHANGED_KEY && event.newValue !== null) onChange();
  };
  target.addEventListener(SESSION_CHANGED_EVENT, local);
  target.addEventListener("storage", remote);
  return () => {
    target.removeEventListener(SESSION_CHANGED_EVENT, local);
    target.removeEventListener("storage", remote);
  };
}
