import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const communityRoutes = [
  "/community",
  "/community/artists",
  "/community/general",
  "/community/general/first-booth-card-reader-checklist",
  "/community/write?board=general",
  "/community/write?board=artists",
  "/community/verify",
  "/community/rules",
  "/community/report",
];

async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press("Tab");

    if (await target.evaluate((element) => element === document.activeElement)) {
      const outlineWidth = await target.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).outlineWidth),
      );
      expect(outlineWidth).toBeGreaterThanOrEqual(3);
      return;
    }
  }

  expect(
    await target.evaluate((element) => element === document.activeElement),
    "target should be reachable in the document keyboard order",
  ).toBe(true);
}

test("community routes and every visible internal destination resolve", async ({
  page,
  request,
}) => {
  const destinations = new Set<string>();

  for (const route of communityRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);

    const hrefs = await page.locator("a[href]").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")),
    );

    for (const href of hrefs) {
      if (href?.startsWith("/") && !href.startsWith("//")) {
        destinations.add(href);
      }
    }
  }

  expect(destinations.size).toBeGreaterThan(10);
  for (const destination of destinations) {
    const response = await request.get(destination);
    expect(
      response.status(),
      `${destination} should have a real destination`,
    ).toBeLessThan(400);
  }
});

test("artist board fails closed and exposes verification recovery", async ({
  page,
}) => {
  await page.goto("/community/artists");

  await expect(
    page.getByRole("heading", {
      name: "작가 인증을 확인한 뒤 열립니다.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "작가 인증 기준 확인" }),
  ).toHaveAttribute("href", "/community/verify");
  await expect(
    page.getByText("소량 스티커 발주 전에 교정본에서 확인할 순서"),
  ).toHaveCount(0);
});

test("community ad inventory stays labeled, reserved, and clear of controls", async ({
  page,
}) => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);

    for (const route of ["/", "/community", "/community/general"]) {
      await page.goto(route);
      const slots = page.locator(".ad-slot");
      const slotCount = await slots.count();
      expect(slotCount, `${route} at ${viewport.width}px`).toBeGreaterThan(0);

      const metrics = await slots.evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label: element.getAttribute("aria-label"),
            placement: element.getAttribute("data-ad-placement"),
            height: Math.round(rect.height),
            width: Math.round(rect.width),
          };
        }),
      );

      expect(new Set(metrics.map((metric) => metric.placement)).size).toBe(
        metrics.length,
      );
      for (const metric of metrics) {
        expect(metric.label).toBe("광고 영역");
        expect(metric.height).toBeGreaterThanOrEqual(128);
        expect(metric.width).toBeGreaterThan(0);
      }

      const overlaps = await page.evaluate(() => {
        const slots = [...document.querySelectorAll<HTMLElement>(".ad-slot")];
        const controls = [
          ...document.querySelectorAll<HTMLElement>(
            "a[href], button, input, select, textarea",
          ),
        ].filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden";
        });

        return slots.flatMap((slot) => {
          const slotRect = slot.getBoundingClientRect();

          return controls
            .filter((control) => {
              const controlRect = control.getBoundingClientRect();
              return !(
                controlRect.right <= slotRect.left ||
                controlRect.left >= slotRect.right ||
                controlRect.bottom <= slotRect.top ||
                controlRect.top >= slotRect.bottom
              );
            })
            .map((control) => control.textContent?.trim() ?? control.tagName);
        });
      });

      expect(overlaps, `${route} at ${viewport.width}px`).toEqual([]);
    }
  }
});

test("repeated navigation and community row actions meet 44px targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/community/general");

  const controls = await page
    .locator(
      ".desktop-nav > a, .site-footer nav a, .community-board-nav a, .community-post-row h3 a, .community-page .button",
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => getComputedStyle(element).display !== "none")
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label: element.textContent?.trim(),
            height: Math.round(rect.height),
            width: Math.round(rect.width),
          };
        }),
    );

  expect(controls.length).toBeGreaterThan(0);
  expect(
    controls.filter((control) => control.height < 44 || control.width < 44),
  ).toEqual([]);
});

test("representative community actions are keyboard reachable and visibly focused", async ({
  page,
}) => {
  await page.goto("/community/general");
  await tabTo(page, page.getByRole("link", { name: "작가 인증 게시판" }));
  await tabTo(
    page,
    page.getByRole("link", {
      name: "첫 부스 전에 카드 결제 준비를 어디까지 해야 할까요",
    }),
  );

  await page.goto("/community/write?board=general");
  await tabTo(page, page.getByRole("button", { name: "이 기기에 임시저장" }));
  await tabTo(page, page.getByRole("button", { name: "임시 글 지우기" }));
  await page.keyboard.press("Enter");

  const confirmation = page.getByRole("button", {
    name: "정말 임시 글 지우기",
  });
  await expect(confirmation).toBeFocused();
  const confirmationOutline = await confirmation.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).outlineWidth),
  );
  expect(confirmationOutline).toBeGreaterThanOrEqual(3);
});

test("unknown community posts use the Bindery recovery screen", async ({
  page,
}) => {
  const response = await page.goto("/community/general/not-a-real-post");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "이 기록을 찾을 수 없습니다." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "커뮤니티 보기" }),
  ).toHaveAttribute("href", "/community");
});
