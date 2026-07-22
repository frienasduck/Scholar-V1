"use client";

import { DEFAULT_LAM_PREFERENCES, type LamConversation, type LamPreferences, type LamProfileState } from "./types";

const keyFor = (profileId: string) => `scholar-lam-v1-${profileId}`;
const id = () => crypto.randomUUID();

export function createLamConversation(profileId: string): LamConversation {
  const now = new Date().toISOString();
  return { id: id(), profileId, title: "New conversation", mode: "general", messages: [], createdAt: now, updatedAt: now };
}

export function loadLamState(profileId: string): LamProfileState {
  const freshConversation = createLamConversation(profileId);
  const fallback: LamProfileState = {
    version: 1, profileId, activeConversationId: freshConversation.id,
    conversations: [freshConversation], preferences: { ...DEFAULT_LAM_PREFERENCES }, memories: [], actionHistory: [],
  };
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(profileId)) || "null") as Partial<LamProfileState> | null;
    if (!parsed || parsed.version !== 1 || parsed.profileId !== profileId) return fallback;
    const conversations = Array.isArray(parsed.conversations)
      ? parsed.conversations.filter((item) => item?.profileId === profileId && Array.isArray(item.messages)).slice(0, 50)
      : [];
    if (!conversations.length) conversations.push(freshConversation);
    return {
      ...fallback,
      ...parsed,
      profileId,
      conversations,
      activeConversationId: conversations.some((item) => item.id === parsed.activeConversationId) ? parsed.activeConversationId! : conversations[0].id,
      preferences: { ...DEFAULT_LAM_PREFERENCES, ...(parsed.preferences ?? {}) },
      memories: Array.isArray(parsed.memories) ? parsed.memories.slice(0, 100) : [],
      actionHistory: Array.isArray(parsed.actionHistory) ? parsed.actionHistory.slice(0, 100) : [],
    };
  } catch { return fallback; }
}

export function saveLamState(state: LamProfileState) {
  if (typeof window === "undefined") return;
  const persisted = state.preferences.saveConversations === false
    ? { ...state, activeConversationId: "session-only", conversations: [{ ...createLamConversation(state.profileId), id: "session-only" }] }
    : state;
  localStorage.setItem(keyFor(state.profileId), JSON.stringify(persisted));
  queueMicrotask(() => window.dispatchEvent(new CustomEvent("scholar:lam-state", { detail: { profileId: state.profileId } })));
}

export function renameLamConversation(profileId: string, conversationId: string, title: string) {
  const state = loadLamState(profileId);
  saveLamState({ ...state, conversations: state.conversations.map((item) => item.id === conversationId ? { ...item, title: title.trim().slice(0, 80) || item.title, updatedAt: new Date().toISOString() } : item) });
}

export function deleteLamConversation(profileId: string, conversationId: string) {
  const state = loadLamState(profileId);
  const remaining = state.conversations.filter((item) => item.id !== conversationId);
  const conversations = remaining.length ? remaining : [createLamConversation(profileId)];
  saveLamState({ ...state, conversations, activeConversationId: state.activeConversationId === conversationId ? conversations[0].id : state.activeConversationId });
}

export function updateLamPreferences(profileId: string, patch: Partial<LamPreferences>) {
  const state = loadLamState(profileId);
  saveLamState({ ...state, preferences: { ...state.preferences, ...patch } });
}

export function clearLamProfile(profileId: string) {
  localStorage.removeItem(keyFor(profileId));
  window.dispatchEvent(new CustomEvent("scholar:lam-state", { detail: { profileId } }));
}
