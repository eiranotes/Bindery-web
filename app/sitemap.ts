import type { MetadataRoute } from "next";
import { events, notes } from "./lib/data.ts";
import { eventPath } from "./lib/events.ts";
import { getSiteUrl } from "./lib/site.ts";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await getSiteUrl();
  const paths = [
    "/",
    "/events",
    "/events/archive",
    "/events/compare",
    "/events/calendar",
    "/notes",
    "/news",
    "/community",
    "/community/general",
    "/community/rules",
    "/me",
    ...events.map(eventPath),
    ...notes.map((note) => `/notes/${note.slug}`),
  ];

  return paths.map((path) => ({
    url: new URL(path, base).toString(),
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority:
      path === "/"
        ? 1
        : path === "/events"
          ? 0.9
          : path === "/events/compare" || path === "/events/archive"
            ? 0.8
            : 0.7,
  }));
}
