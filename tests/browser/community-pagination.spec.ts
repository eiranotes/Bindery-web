import { expect, test } from "@playwright/test";

test("changing a public search keeps filters and starts a fresh cursor chain", async ({
  page,
}) => {
  await page.goto(
    "/community/general?q=%EA%B5%90%EC%A0%95&category=production&resolution=resolved&freshness=fresh&cursor=obsolete",
  );

  await page.getByLabel("검색어").fill("제작 안내");
  await page.getByRole("button", { name: "검색 적용" }).click();

  await expect(page).toHaveURL(/q=%EC%A0%9C%EC%9E%91\+%EC%95%88%EB%82%B4/);
  await expect(page).toHaveURL(/category=production/);
  await expect(page).toHaveURL(/resolution=resolved/);
  await expect(page).toHaveURL(/freshness=fresh/);
  await expect(page).not.toHaveURL(/cursor=/);
});

test("the pagination destination stays within the mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(
    "/community/general?q=%EA%B5%90%EC%A0%95&category=production&resolution=all&freshness=all",
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
