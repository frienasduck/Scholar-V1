import type { VideoState } from "./model";
export function selectFeedVideos(videos: VideoState[], grade: number, subject: string, query: string, tab: string) {
  const q = query.trim().toLowerCase();
  return videos.filter((v) => v.settings.grade === grade &&
    (["ready", "generating", "failed"].includes(v.status) || !!v.repair) &&
    (subject === "All" || v.settings.subjectId === ({ Physics: "physics", Chemistry: "chemistry", Mathematics: "maths", Maths: "maths", Science: "science", English: "english", "Computer Science": "cs" } as Record<string, string>)[subject]) &&
    (!q || `${v.title} ${v.settings.chapters.map((c) => c.title).join(" ")}`.toLowerCase().includes(q)) &&
    (tab !== "saved" || v.watch.favorite) && (tab !== "history" || !!v.watch.lastWatched)
  ).sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
}
