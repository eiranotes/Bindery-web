import type { MetadataRoute } from "next";
import { getSiteUrl } from "./lib/site.ts";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
