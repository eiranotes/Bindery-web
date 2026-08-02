import { expect, test } from "@playwright/test";

test("artist list and detail stay content-free without a verified server state", async ({
  page,
}) => {
  await page.goto("/community/artists");
  await expect(
    page.getByRole("heading", { name: "작가 인증을 확인한 뒤 열립니다." }),
  ).toBeVisible();
  await expect(page.getByText(/PROTECTED POSTS/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "첫 글 작성하기" })).toHaveCount(0);

  await page.goto("/community/artists/not-a-real-post");
  await expect(
    page.getByRole("heading", { name: "작가 게시판 접근 상태를 확인해 주세요." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /제작|행사|원가/ })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});

test("artist write form stays absent when server artist access is unavailable", async ({
  page,
}) => {
  await page.goto("/community/write?board=artists");
  await expect(
    page.getByRole("heading", { name: "백엔드 연결 후 작가 인증 상태를 확인합니다." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "작가 인증 기준 확인" })).toHaveAttribute(
    "href",
    "/community/verify",
  );
  await expect(page.getByRole("button", { name: "게시하기" })).toHaveCount(0);
  await expect(page.getByLabel("제목")).toHaveCount(0);
});

test("artist boundaries fit mobile and desktop without exposing content", async ({ page }) => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/community/artists",
      "/community/artists/not-a-real-post",
      "/community/write?board=artists",
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} at ${viewport.width}px`).toBeLessThanOrEqual(1);
    }
  }
});
