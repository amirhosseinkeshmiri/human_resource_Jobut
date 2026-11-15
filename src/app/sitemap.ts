import type { MetadataRoute } from "next";
import { getPublicOrigin } from "@/brand/identity";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getPublicOrigin();
  return ["/", "/jobs", "/terms", "/privacy"].map((path) => ({
    url: `${origin}${path}`,
    changeFrequency: path === "/jobs" ? "daily" : "weekly",
    priority: path === "/" ? 1 : path === "/jobs" ? 0.9 : 0.4,
  }));
}
