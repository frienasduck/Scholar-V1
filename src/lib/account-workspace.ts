/** Recoverable account switching for the existing local-first storage keys.
 * This is not authorization/encryption: the server session remains authoritative.
 * Backups stay on this browser and are never sent anywhere.
 */
const OWNER = "scholar-workspace-owner-v1";
const JOURNAL = "scholar-workspace-switch-v1";
const VAULT = "scholar-account-vault-v1:";
const MAIN = "neha-scholar-v5";
type Snapshot = Record<string, string>;
type Journal = { previousOwner: string; backupKey: string };

export function isWorkspaceKey(key: string) {
  if (key === OWNER || key === JOURNAL || key.startsWith(VAULT)) return false;
  return /^(scholar[:-]|neha-scholar-|ws-|eb-reader-data$|pdf-studio-history$|pp-mistakes$|py-code$|smart-reminders$|fc-|quiz-|aisig-history$|dv-studied$|pr-completed$|pdf-edited-questions$|pdf-review-status$|mu-playlists$)/.test(key) && key !== "scholar-guest-session-v1";
}

function snapshot(storage: Storage): Snapshot {
  const result: Snapshot = {};
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key && isWorkspaceKey(key)) result[key] = storage.getItem(key)!;
  }
  return result;
}

function decode(raw: string | null): Snapshot {
  if (!raw) return {};
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The saved workspace backup could not be read.");
  const entries = Object.entries(value);
  if (entries.some(([key, item]) => !isWorkspaceKey(key) || typeof item !== "string")) throw new Error("The saved workspace backup is invalid.");
  return Object.fromEntries(entries) as Snapshot;
}

function restore(storage: Storage, values: Snapshot) {
  for (const key of Object.keys(snapshot(storage))) storage.removeItem(key);
  for (const [key, value] of Object.entries(values)) storage.setItem(key, value);
}

export function recoverWorkspaceSwitch(storage: Storage) {
  const raw = storage.getItem(JOURNAL);
  if (!raw) return;
  const journal = JSON.parse(raw) as Journal;
  if (!journal.backupKey?.startsWith(VAULT)) throw new Error("Workspace recovery is unavailable.");
  const backup = storage.getItem(journal.backupKey);
  if (!backup) throw new Error("Workspace recovery backup is missing.");
  restore(storage, decode(backup));
  storage.setItem(OWNER, journal.previousOwner);
  storage.removeItem(JOURNAL);
}

export function workspaceOwner(storage: Storage) { try { return storage.getItem(OWNER) ?? ""; } catch { return ""; } }

/** Returns true when a full reload is needed to discard old module state. */
export function switchWorkspace(storage: Storage, email: string, freshState: string) {
  recoverWorkspaceSwitch(storage);
  const owner = email.trim().toLowerCase();
  if (!owner) throw new Error("A verified account is required.");
  let previous = workspaceOwner(storage);
  if (!previous) {
    const parsed = JSON.parse(storage.getItem(MAIN) || "{}");
    previous = String(parsed.state?.user?.email || "unassigned").trim().toLowerCase();
  }
  if (owner === previous) { storage.setItem(OWNER, owner); return false; }
  const outgoing = snapshot(storage);
  const backupKey = VAULT + encodeURIComponent(previous);
  const incoming = decode(storage.getItem(VAULT + encodeURIComponent(owner)));
  incoming[MAIN] ||= freshState;
  // Complete the durable backup BEFORE touching any active records. If space
  // is insufficient, this throws and leaves the previous workspace intact.
  storage.setItem(backupKey, JSON.stringify(outgoing));
  storage.setItem(JOURNAL, JSON.stringify({ previousOwner: previous, backupKey }));
  try {
    restore(storage, incoming);
    storage.setItem(OWNER, owner);
    storage.removeItem(JOURNAL);
    storage.removeItem("scholar-guest-session-v1");
  } catch (error) {
    recoverWorkspaceSwitch(storage);
    throw error;
  }
  return true;
}
