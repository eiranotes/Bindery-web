import { expect, test } from "@playwright/test";

test("unconfigured general board keeps examples and local draft fallback honest", async ({
  page,
}) => {
  await page.goto("/community/general");
  await expect(page.getByText("EXAMPLE CONTENT", { exact: true })).toBeVisible();
  await expect(page.getByText("예시 데이터", { exact: true })).toBeVisible();

  await page.goto("/community/write?board=general");
  await expect(
    page.getByText("공개 게시 기능은 아직 연결되지 않았습니다.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "이 기기에 임시저장" })).toBeVisible();
  await expect(page.getByRole("button", { name: "게시하기" })).toHaveCount(0);
});

test("unconfigured durable mutations fail closed without storing input", async ({
  page,
}) => {
  await page.goto("/community/write?board=general");
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/community/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boardId: "general",
        categoryId: "production",
        kind: "question",
        title: "브라우저 테스트 게시글",
        body: "이 내용은 백엔드 미연결 상태에서 저장되면 안 됩니다.",
      }),
    });
    return { status: response.status, body: await response.json() };
  });
  expect(result).toEqual({
    status: 503,
    body: { ok: false, code: "not-configured" },
  });
});

test("unconfigured reporting shows criteria but no intake form", async ({ page }) => {
  await page.goto("/community/report?post=first-booth-card-reader-checklist");
  await expect(
    page.getByRole("heading", { name: "현재 신고를 전송하거나 저장하지 않습니다." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "신고 접수" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "신고 사유" })).toBeVisible();
});

test("general board, detail, write, and report stay within mobile and desktop width", async ({
  page,
}) => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/community/general",
      "/community/general/first-booth-card-reader-checklist",
      "/community/write?board=general",
      "/community/report?post=first-booth-card-reader-checklist",
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} at ${viewport.width}px`).toBeLessThanOrEqual(1);
    }
  }
});
