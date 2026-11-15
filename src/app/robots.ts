import type { MetadataRoute } from "next";
import { getPublicOrigin } from "@/brand/identity";

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/jobs"],
      disallow: ["/admin", "/candidate", "/employer", "/api"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
