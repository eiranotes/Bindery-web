import { expect, test } from "@playwright/test";

test("unauthorized moderation and audit screens expose no queue data", async ({ page }) => {
  for (const [path, heading] of [
    ["/admin/community/reports", "신고 대기열을 볼 권한이 없습니다."],
    ["/admin/community/audit", "감사 이력을 볼 권한이 없습니다."],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("reporter@example.com")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  }
});

test("moderation boundaries fit mobile and desktop", async ({ page }) => {
  for (const viewport of [{ width: 360, height: 800 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (const path of ["/admin/community/reports", "/admin/community/audit"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} at ${viewport.width}px`).toBeLessThanOrEqual(1);
    }
  }
});
