import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const outputRoot = join(process.cwd(), "artifacts", "site-screenshots");

const viewports = [
  { name: "mobile", width: 360, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

const routes = [
  { name: "home", path: "/" },
  { name: "events", path: "/events" },
  { name: "events-compare", path: "/events/compare" },
  { name: "events-archive", path: "/events/archive" },
  { name: "events-calendar", path: "/events/calendar?month=2026-08" },
  {
    name: "event-detail",
    path: "/events/illustar-fair/2026-winter",
  },
  { name: "notes", path: "/notes" },
  { name: "community", path: "/community" },
  { name: "community-general", path: "/community/general" },
  { name: "binder", path: "/me" },
] as const;

for (const viewport of viewports) {
  test.describe(`${viewport.name} screenshots`, () => {
    test.use({ viewport });

    for (const route of routes) {
      test(`${route.name}`, async ({ page }) => {
        const response = await page.goto(route.path, {
          waitUntil: "networkidle",
        });

        expect(response?.ok(), `${route.path} should load`).toBeTruthy();
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("main")).toBeVisible();

        const directory = join(outputRoot, viewport.name);
        await mkdir(directory, { recursive: true });
        await page.screenshot({
          path: join(directory, `${route.name}.png`),
          fullPage: true,
        });
      });
    }
  });
}
