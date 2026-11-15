/** Temporary product notices and under-development locks. Keep feature implementations and saved data intact. */
export const SECTION_SHUTDOWNS = {
  nigtube: {
    kind: "paused",
    title: "LAMTube",
    medium: "videos",
    tone: "coral",
    sidebarBadge: "Paused",
    alternative: { title: "Explore E-Books", viewId: "ebook" },
  },
  music: {
    kind: "paused",
    title: "Study Music",
    medium: "music",
    tone: "violet",
    sidebarBadge: "Paused",
    alternative: { title: "Open Focus Timer", viewId: "focus" },
  },
  "exam-prep": {
    kind: "development",
    title: "Scholar Exam Ready",
    medium: "exam preparation workspace",
    tone: "gold",
    sidebarBadge: "Locked",
    alternative: { title: "Open Question Practice", viewId: "question-practice" },
  },
} as const;

export type ShutdownSection = keyof typeof SECTION_SHUTDOWNS;

export function getSectionShutdown(viewId: string) {
  const section =
    viewId === "lamtube"
      ? "nigtube"
      : viewId === "exam-ready"
        ? "exam-prep"
        : viewId;
  return Object.hasOwn(SECTION_SHUTDOWNS, section)
    ? SECTION_SHUTDOWNS[section as ShutdownSection]
    : null;
}
