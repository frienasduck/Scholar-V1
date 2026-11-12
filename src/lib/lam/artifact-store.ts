"use client";

import type { LamMessage, LamPluginExecution } from "@/lib/lam/types";

export interface LamAiChatSessionRecord {
  id: string;
  title: string;
  updatedAt: string;
  messages: LamMessage[];
}

export interface LamPluginExecutionHistoryItem {
  executionId: string;
  pluginId: string;
  pluginName: string;
  status: LamPluginExecution["status"];
  outputType: LamPluginExecution["outputType"];
  prompt: string;
  messageId: string;
  sessionId: string;
  updatedAt: string;
  error?: string;
}

export interface StoredArtifactEntry {
  id: string;
  sessionId: string;
  messageId: string;
  pluginId: string;
  pluginName: string;
  outputType: LamPluginExecution["outputType"];
  title: string;
  createdAt: string;
  execution: LamPluginExecution;
}

const SESSION_KEY_PREFIX = "scholar-lam-ai-v2-";
const IDB_NAME = "scholar-lam-binary-v1";
const IDB_STORE = "media";
const MAX_SESSIONS = 25;
const MAX_MESSAGES_PER_SESSION = 100;

function sessionStorageKey(profileId: string): string {
  return `${SESSION_KEY_PREFIX}${profileId}`;
}

function openArtifactDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveArtifactMedia(artifactId: string, dataUrl: string): Promise<void> {
  if (!artifactId || !dataUrl) return;
  const db = await openArtifactDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(dataUrl, artifactId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function loadArtifactMedia(artifactId: string): Promise<string | null> {
  if (!artifactId) return null;
  const db = await openArtifactDB();
  if (!db) return null;
  return new Promise<string | null>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(artifactId);
      req.onsuccess = () => {
        const val = typeof req.result === "string" ? req.result : null;
        db.close();
        resolve(val);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/**
 * Strip huge base64 binary blobs before saving into localStorage, keeping artifactId
 * pointers so IndexedDB restores the full image cleanly across refreshes.
 */
function dehydrateExecutionForStorage(exec?: LamPluginExecution): LamPluginExecution | undefined {
  if (!exec) return undefined;
  const clone: LamPluginExecution = { ...exec };
  if (clone.imageData?.url && clone.imageData.url.startsWith("data:") && clone.imageData.artifactId) {
    clone.imageData = {
      ...clone.imageData,
      url: clone.imageData.url.length > 40_000 ? "" : clone.imageData.url,
    };
  }
  return clone;
}

export function loadLocalLamSessions(profileId: string): {
  activeSessionId: string;
  sessions: LamAiChatSessionRecord[];
} {
  if (typeof window === "undefined") {
    return { activeSessionId: "", sessions: [] };
  }
  try {
    const raw = window.localStorage.getItem(sessionStorageKey(profileId));
    if (!raw) return { activeSessionId: "", sessions: [] };
    const parsed = JSON.parse(raw) as {
      activeSessionId?: string;
      sessions?: LamAiChatSessionRecord[];
    };
    const sessions = Array.isArray(parsed?.sessions)
      ? parsed.sessions.filter((s) => s && typeof s.id === "string" && Array.isArray(s.messages)).slice(0, MAX_SESSIONS)
      : [];
    const activeSessionId =
      typeof parsed?.activeSessionId === "string" && sessions.some((s) => s.id === parsed.activeSessionId)
        ? parsed.activeSessionId
        : sessions[0]?.id ?? "";
    return { activeSessionId, sessions };
  } catch {
    return { activeSessionId: "", sessions: [] };
  }
}

export function saveLocalLamSessions(
  profileId: string,
  activeSessionId: string,
  sessions: LamAiChatSessionRecord[],
  saveEnabled = true,
): void {
  if (typeof window === "undefined") return;
  if (!saveEnabled) {
    try {
      window.localStorage.removeItem(sessionStorageKey(profileId));
    } catch { /* ignore */ }
    return;
  }
  const compactSessions: LamAiChatSessionRecord[] = sessions.slice(0, MAX_SESSIONS).map((sess) => ({
    id: sess.id,
    title: sess.title.slice(0, 90),
    updatedAt: sess.updatedAt,
    messages: sess.messages.slice(-MAX_MESSAGES_PER_SESSION).map((msg) => ({
      ...msg,
      pluginExecution: dehydrateExecutionForStorage(msg.pluginExecution),
    })),
  }));
  try {
    window.localStorage.setItem(
      sessionStorageKey(profileId),
      JSON.stringify({ activeSessionId, sessions: compactSessions }),
    );
    window.dispatchEvent(new CustomEvent("scholar:lam-ai-artifacts-changed", { detail: { profileId } }));
  } catch {
    // Fallback if quota tight: store only the most recent 5 sessions
    try {
      window.localStorage.setItem(
        sessionStorageKey(profileId),
        JSON.stringify({
          activeSessionId,
          sessions: compactSessions.slice(0, 5),
        }),
      );
    } catch { /* ignore quota failures cleanly */ }
  }
}

/**
 * Hydrates heavy media blobs (such as AISIG images) from IndexedDB back onto messages
 * after a full page reload.
 */
export async function hydrateSessionArtifacts(messages: LamMessage[]): Promise<LamMessage[]> {
  const updated = await Promise.all(
    messages.map(async (msg) => {
      const exec = msg.pluginExecution;
      if (!exec) return msg;
      if (exec.imageData?.artifactId && !exec.imageData.url) {
        const media = await loadArtifactMedia(exec.imageData.artifactId);
        if (media) {
          return {
            ...msg,
            pluginExecution: {
              ...exec,
              imageData: { ...exec.imageData, url: media },
            },
          };
        }
      }
      return msg;
    }),
  );
  return updated;
}

export function extractArtifactsAndHistory(sessions: LamAiChatSessionRecord[]): {
  artifacts: StoredArtifactEntry[];
  history: LamPluginExecutionHistoryItem[];
} {
  const artifacts: StoredArtifactEntry[] = [];
  const history: LamPluginExecutionHistoryItem[] = [];

  for (const session of sessions) {
    for (const msg of session.messages) {
      const exec = msg.pluginExecution;
      if (!exec) continue;
      history.push({
        executionId: exec.executionId ?? msg.id,
        pluginId: exec.pluginId,
        pluginName: exec.pluginName,
        status: exec.status,
        outputType: exec.outputType,
        prompt: exec.rawPrompt || msg.content.slice(0, 120),
        messageId: msg.id,
        sessionId: session.id,
        updatedAt: exec.completedAt || exec.startedAt || msg.createdAt,
        error: exec.error,
      });

      if (exec.status === "completed" || exec.status === "ready") {
        const title =
          exec.pdfData?.title ||
          exec.slideshowData?.title ||
          exec.explainerData?.concept ||
          exec.flowchartData?.title ||
          exec.plannerData?.planTitle ||
          exec.ncertData?.title ||
          exec.pyqData?.question?.slice(0, 72) ||
          exec.imageData?.prompt?.slice(0, 72) ||
          exec.analyticsData?.title ||
          exec.rawPrompt?.slice(0, 72) ||
          exec.pluginName;

        artifacts.push({
          id: exec.executionId ?? msg.id,
          sessionId: session.id,
          messageId: msg.id,
          pluginId: exec.pluginId,
          pluginName: exec.pluginName,
          outputType: exec.outputType,
          title,
          createdAt: exec.completedAt || msg.createdAt,
          execution: exec,
        });
      }
    }
  }

  return {
    artifacts: artifacts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    history: history.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
}
