// Profile-scoped browser storage. Class 9 and Class 11 never share module data.

export type ProfileId = "class9" | "class11";

export function getProfileId(scholarClass: 9 | 11): ProfileId {
  return scholarClass === 11 ? "class11" : "class9";
}

export function getProfileKey(profile: ProfileId, moduleKey: string): string {
  return `scholar:${profile}:${moduleKey}`;
}

export function profileKey(scholarClass: 9 | 11, moduleKey: string): string {
  return getProfileKey(getProfileId(scholarClass), moduleKey);
}

export const SHARED_KEYS = new Set([
  "scholar-sidebar-open",
  "fc-video-bg",
  "quiz-video-bg",
  "py-code",
]);

export function storageKey(scholarClass: 9 | 11, moduleKey: string): string {
  return SHARED_KEYS.has(moduleKey) ? moduleKey : profileKey(scholarClass, moduleKey);
}

export function profileGetItem(scholarClass: 9 | 11, moduleKey: string): string | null {
  try {
    return localStorage.getItem(storageKey(scholarClass, moduleKey));
  } catch {
    return null;
  }
}

export function profileSetItem(scholarClass: 9 | 11, moduleKey: string, value: string): void {
  try {
    localStorage.setItem(storageKey(scholarClass, moduleKey), value);
  } catch {
    // Storage may be unavailable or full. UI state remains usable in memory.
  }
}

export function profileRemoveItem(scholarClass: 9 | 11, moduleKey: string): void {
  try {
    localStorage.removeItem(storageKey(scholarClass, moduleKey));
  } catch {
    // Storage is optional.
  }
}

export function profileGetJSON<T>(scholarClass: 9 | 11, moduleKey: string, fallback: T): T {
  try {
    const raw = profileGetItem(scholarClass, moduleKey);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function profileSetJSON(scholarClass: 9 | 11, moduleKey: string, value: unknown): void {
  profileSetItem(scholarClass, moduleKey, JSON.stringify(value));
}

const MIGRATION_VERSION_KEY = "scholar-storage-migration-version";
const CURRENT_MIGRATION = 2;

/**
 * v1 copied each legacy value into both profiles. v2 removes only copies that
 * are provably identical to each other and to the legacy value. The unscoped
 * value remains as an inactive backup and is never loaded by either profile.
 */
export function migrateLegacyStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const version = Number.parseInt(localStorage.getItem(MIGRATION_VERSION_KEY) || "0", 10);
    if (version >= CURRENT_MIGRATION) return;

    const legacyKeys = [
      "aisig-history",
      "dv-studied",
      "fc-custom-cards",
      "fc-c11-review-state",
      "fc-c11-bookmarks",
      "pp-mistakes",
      "pr-completed",
      "smart-reminders",
      "quiz-custom-questions",
      "quiz-mistakes",
      "pdf-edited-questions",
      "pdf-review-status",
      "mu-playlists",
    ];

    for (const key of legacyKeys) {
      const legacy = localStorage.getItem(key);
      const class9Key = getProfileKey("class9", key);
      const class11Key = getProfileKey("class11", key);
      const class9 = localStorage.getItem(class9Key);
      const class11 = localStorage.getItem(class11Key);
      if (legacy !== null && class9 === legacy && class11 === legacy) {
        localStorage.removeItem(class9Key);
        localStorage.removeItem(class11Key);
      }
    }

    localStorage.setItem(MIGRATION_VERSION_KEY, String(CURRENT_MIGRATION));
  } catch {
    // A migration failure must never prevent the app from loading.
  }
}
