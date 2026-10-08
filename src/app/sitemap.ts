import type { MetadataRoute } from "next";
import { SCHOLAR_PRODUCTION_ORIGIN } from "@/lib/site-origin";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only public information pages. Never list student work or account routes.
  return ["", "/help", "/privacy", "/terms", "/updates"].map(path => ({ url: `${SCHOLAR_PRODUCTION_ORIGIN}${path}`, changeFrequency: "monthly", priority: path ? 0.5 : 1 }));
}
