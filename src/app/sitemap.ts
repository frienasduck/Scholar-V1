import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only public information pages. Never list student work or account routes.
  return ["", "/help", "/privacy", "/terms", "/updates"].map(path => ({ url: `https://scholar-v1.vercel.app${path}`, changeFrequency: "monthly", priority: path ? 0.5 : 1 }));
}
