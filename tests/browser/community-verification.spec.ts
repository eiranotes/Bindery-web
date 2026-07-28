import { expect, test } from "@playwright/test";

test("unconfigured verification stays honest and sends no application", async ({
  page,
}) => {
  const response = await page.goto("/community/verify");
  expect(response?.status()).toBe(200);

  await expect(page.getByText("백엔드 미연결", { exact: true })).toBeVisible();
  await expect(
    page.getByText("이 화면에서는 파일, 사업자번호, 계정 정보를 받지 않습니다"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "확인 절차" })).toBeVisible();
  await expect(page.locator('script[data-bindery-turnstile="true"]')).toHaveCount(0);

  const result = await page.evaluate(async () => {
    const apiResponse = await fetch("/api/community/verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "browser-test-request",
      },
      body: JSON.stringify({
        activityName: "테스트 작가",
        proofUrl: "https://example.com/artist",
        primaryField: "문구",
        botToken: "not-a-real-token",
      }),
    });
    return { status: apiResponse.status, body: await apiResponse.json() };
  });

  expect(result).toEqual({
    status: 503,
    body: { ok: false, code: "not-configured" },
  });
});

test("unauthorized admin screens reveal no application or invitation data", async ({
  page,
}) => {
  for (const [path, heading] of [
    ["/admin/community/verifications", "검수 대기열을 볼 권한이 없습니다."],
    ["/admin/community/invitations", "초대를 발급할 권한이 없습니다."],
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("artist@example.com")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  }
});

test("invitation routes fail closed without backend configuration", async ({
  page,
}) => {
  const response = await page.goto("/community/invite/not-a-real-token");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "현재 초대를 확인할 수 없습니다." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "작가 초대 수락" })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});

test("verification and admin boundaries keep usable mobile and desktop width", async ({
  page,
}) => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/community/verify",
      "/admin/community/verifications",
      "/admin/community/invitations",
      "/community/invite/not-a-real-token",
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} at ${viewport.width}px`).toBeLessThanOrEqual(1);
    }
  }
});
