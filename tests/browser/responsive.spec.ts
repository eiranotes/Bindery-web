import { expect, test } from "@playwright/test";

const viewports = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
];

test("home preserves its information contract without page overflow", async ({
  page,
}) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const metrics = await page.evaluate(() => ({
      pageOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      deadlineRows: document.querySelectorAll(".deadline-list > li").length,
      indexLinks: document.querySelectorAll(".home-index > a").length,
      today: document.querySelector(".mockup-hero__copy .eyebrow")?.textContent,
    }));

    expect(metrics.pageOverflow, `${viewport.width}px page overflow`).toBe(0);
    expect(metrics.deadlineRows).toBe(3);
    expect(metrics.indexLinks).toBe(4);
    expect(metrics.today).toContain("오늘 ·");
  }
});

test("360px primary controls meet the touch target floor", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const controls = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        ".button, summary, .home-index a, .home-binder-link a",
      ),
    ].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        label: element.textContent?.trim() ?? element.tagName,
        height: Math.round(rect.height),
        width: Math.round(rect.width),
      };
    }),
  );

  expect(controls.length).toBeGreaterThan(0);
  expect(
    controls.filter(
      (control) => control.height < 44 || control.width < 44,
    ),
  ).toEqual([]);
});

test("wide event and calendar data scroll inside their own sheets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/events/illustar-fair/2026-winter");

  const detail = await page.evaluate(() => {
    const tableSheet = document.querySelector(".table-scroll");
    return {
      pageOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      sheetClientWidth: tableSheet?.clientWidth ?? 0,
      sheetScrollWidth: tableSheet?.scrollWidth ?? 0,
    };
  });

  expect(detail.pageOverflow).toBe(0);
  expect(detail.sheetScrollWidth).toBeGreaterThan(detail.sheetClientWidth);

  await page.goto("/events/calendar");
  const calendar = await page.evaluate(() => {
    const calendarSheet = document.querySelector(".calendar-sheet");
    return {
      pageOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      sheetClientWidth: calendarSheet?.clientWidth ?? 0,
      sheetScrollWidth: calendarSheet?.scrollWidth ?? 0,
    };
  });

  expect(calendar.pageOverflow).toBe(0);
  expect(calendar.sheetScrollWidth).toBeGreaterThan(calendar.sheetClientWidth);
});
