/** Temporary product notices. Keep feature implementations and saved data intact. */
export const SECTION_SHUTDOWNS = {
  nigtube: {
    title: "LAMTube",
    medium: "videos",
    tone: "coral",
    alternative: { title: "Explore E-Books", viewId: "ebook" },
  },
  music: {
    title: "Study Music",
    medium: "music",
    tone: "violet",
    alternative: { title: "Open Focus Timer", viewId: "focus" },
  },
} as const;

export type ShutdownSection = keyof typeof SECTION_SHUTDOWNS;

export function getSectionShutdown(viewId: string) {
  const section = viewId === "lamtube" ? "nigtube" : viewId;
  return Object.hasOwn(SECTION_SHUTDOWNS, section)
    ? SECTION_SHUTDOWNS[section as ShutdownSection]
    : null;
}
