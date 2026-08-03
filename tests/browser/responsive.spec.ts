import { expect, test } from "@playwright/test";

const viewports = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
];

const primaryRoutes = [
  "/",
  "/events",
  "/events/compare",
  "/events/archive",
  "/events/calendar",
  "/events/illustration-korea/2026-incheon",
  "/notes",
  "/notes/first-booth-checklist",
  "/groupbuy",
  "/news",
  "/community",
  "/community/artists",
  "/community/general",
  "/community/general/first-booth-card-reader-checklist",
  "/community/write?board=general",
  "/community/write?board=artists",
  "/community/verify",
  "/community/rules",
  "/community/report",
  "/me",
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
        ".button, summary, .home-index a, .home-support a, .home-binder-link a",
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

test("wide event, comparison, archive, and calendar data scroll inside their own sheets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });

  for (const route of [
    "/events/illustration-korea/2026-incheon",
    "/events/compare",
    "/events/archive",
  ]) {
    await page.goto(route);
    const metrics = await page.evaluate(() => {
      const tableSheet = document.querySelector(".table-scroll");
      return {
        pageOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        sheetClientWidth: tableSheet?.clientWidth ?? 0,
        sheetScrollWidth: tableSheet?.scrollWidth ?? 0,
      };
    });

    expect(metrics.pageOverflow, `${route} page overflow`).toBe(0);
    expect(
      metrics.sheetScrollWidth,
      `${route} local table scroll width`,
    ).toBeGreaterThan(metrics.sheetClientWidth);
  }

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

test("comparison and archive expose keyboard-scrollable tables with sticky row labels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });

  for (const route of ["/events/compare", "/events/archive"]) {
    await page.goto(route);

    const region = page.locator('[data-ui="event-data-scroll"]').first();
    await expect(region).toBeVisible();
    await expect(region).toHaveAttribute("tabindex", "0");
    await region.focus();
    await expect(region).toBeFocused();

    const metrics = await region.evaluate((element) => {
      const firstRowHeader = element.querySelector("tbody th");
      const hint = document.querySelector('[data-ui="event-scroll-hint"]');
      return {
        rowHeaderPosition: firstRowHeader
          ? getComputedStyle(firstRowHeader).position
          : null,
        hintDisplay: hint ? getComputedStyle(hint).display : null,
      };
    });

    expect(metrics.rowHeaderPosition, `${route} sticky row header`).toBe(
      "sticky",
    );
    expect(metrics.hintDisplay, `${route} mobile scroll hint`).not.toBe("none");
  }
});

test("primary routes keep text out of avoidably narrow columns", async ({
  page,
}) => {
  test.setTimeout(60_000);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const route of primaryRoutes) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );

      expect(overflow, `${route} at ${viewport.width}px`).toBe(0);
    }
  }

  for (const viewport of viewports.filter(({ width }) => width >= 768)) {
    await page.setViewportSize(viewport);
    await page.goto("/groupbuy");

    const titleLines = await page.evaluate(() =>
      [...document.querySelectorAll(".groupbuy-entry h3")].map((heading) => {
        const style = getComputedStyle(heading);
        const lineHeight = Number.parseFloat(style.lineHeight);
        const height = heading.getBoundingClientRect().height;
        return Number.isFinite(lineHeight) && lineHeight > 0
          ? Math.max(1, Math.round(height / lineHeight))
          : 1;
      }),
    );

    expect(
      titleLines.filter((lineCount) => lineCount > 2),
      `${viewport.width}px group-buy title wrapping`,
    ).toEqual([]);
  }

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  const tabletNavigation = await page.evaluate(() => ({
    desktop: getComputedStyle(
      document.querySelector(".desktop-nav") as HTMLElement,
    ).display,
    mobile: getComputedStyle(
      document.querySelector(".mobile-nav") as HTMLElement,
    ).display,
  }));
  expect(tabletNavigation.desktop).toBe("none");
  expect(tabletNavigation.mobile).not.toBe("none");

  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of ["/notes", "/groupbuy"]) {
    await page.goto(route);
    const noticeWidths = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".trust-notice > p:last-child, .boundary-note > div > p",
        ),
      ].map((paragraph) =>
        Math.round(paragraph.getBoundingClientRect().width),
      ),
    );

    expect(noticeWidths.length, `${route} notice coverage`).toBeGreaterThan(0);
    expect(
      noticeWidths.filter((width) => width < 300),
      `${route} notice text measure`,
    ).toEqual([]);
  }
});

test("shell language selection is synchronized, honest, and touch sized", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const selector = page
    .locator(".locale-control--desktop")
    .getByRole("combobox", { name: "언어" });
  await expect(selector).toHaveCount(1);
  await selector.focus();

  const desktopMetrics = await selector.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      height: Math.round(rect.height),
      width: Math.round(rect.width),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });

  expect(desktopMetrics.height).toBeGreaterThanOrEqual(44);
  expect(desktopMetrics.width).toBeGreaterThanOrEqual(44);
  expect(desktopMetrics.outlineStyle).not.toBe("none");
  expect(desktopMetrics.outlineWidth).toBeGreaterThanOrEqual(3);

  await selector.selectOption("en");
  await expect(page.getByRole("link", { name: "Events" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.locator("html")).toHaveAttribute(
    "data-shell-locale",
    "en",
  );
  await expect(
    page
      .getByRole("contentinfo")
      .getByText("Event content remains in Korean.", { exact: false }),
  ).toBeVisible();

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByText("Menu", { exact: true }).click();

  const mobileSelector = page
    .locator(".locale-control--mobile")
    .getByRole("combobox", { name: "Language" });
  await expect(mobileSelector).toBeVisible();
  const mobileHeight = await mobileSelector.evaluate((element) =>
    Math.round(element.getBoundingClientRect().height),
  );
  expect(mobileHeight).toBeGreaterThanOrEqual(44);
});
