import { expect, test } from "@playwright/test";

test("general search keeps text, category, resolution, and freshness in the URL", async ({
  page,
}) => {
  await page.goto("/community/general");

  await page.getByLabel("검색어").fill("카드 결제");
  await page.getByLabel("분류").selectOption("event");
  await page.getByLabel("해결 상태").selectOption("unresolved");
  await page.getByLabel("출처 신선도").selectOption("missing");
  await page.getByRole("button", { name: "검색 적용" }).click();

  await expect(page).toHaveURL(/q=%EC%B9%B4%EB%93%9C\+%EA%B2%B0%EC%A0%9C/);
  await expect(page).toHaveURL(/category=event/);
  await expect(page).toHaveURL(/resolution=unresolved/);
  await expect(page).toHaveURL(/freshness=missing/);
  await expect(
    page.getByText("첫 부스 전에 카드 결제 준비를 어디까지 해야 할까요"),
  ).toBeVisible();
  await expect(page.getByText("소량 스티커 발주 전에 교정본에서 확인할 순서")).toHaveCount(0);
});

test("artist search controls and query data remain absent from a locked board", async ({
  page,
}) => {
  await page.goto("/community/artists?q=%EB%B9%84%EB%B0%80+%EA%B5%90%EC%A0%95");

  await expect(
    page.getByRole("heading", { name: "작가 인증을 확인한 뒤 열립니다." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "보호 글 검색·필터" })).toHaveCount(0);
  await expect(page.locator('input[name="q"]')).toHaveCount(0);
  await expect(page.getByText("비밀 교정", { exact: true })).toHaveCount(0);
});

test("community search surfaces keep mobile and desktop width", async ({ page }) => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/community/general?q=%EA%B5%90%EC%A0%95&category=production&resolution=resolved&freshness=all",
      "/community/artists?q=%EA%B5%90%EC%A0%95",
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} at ${viewport.width}px`).toBeLessThanOrEqual(1);
    }
  }
});
