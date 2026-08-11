import type { MetadataRoute } from "next";
import { getSiteUrl } from "./lib/site.ts";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/groupbuy", "/me", "/auth", "/admin", "/api"],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
