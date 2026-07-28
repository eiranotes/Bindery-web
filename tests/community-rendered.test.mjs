import assert from "node:assert/strict";
import test from "node:test";

import { render } from "./worker-harness.mjs";

test("community hub exposes two distinct free boards and an honest boundary", async () => {
  const response = await render("/community");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /문구작가 커뮤니티/);
  assert.match(html, /작가 인증 게시판/);
  assert.match(html, /모두의 게시판/);
  assert.match(html, /href="\/community\/artists"/);
  assert.match(html, /href="\/community\/general"/);
  assert.match(html, /공개된 글은 실제 회원 게시물이 아닙니다/);
  assert.match(html, /data-ad-placement="community-hub"/);
});

test("artist board fails closed without exposing post content", async () => {
  const response = await render("/community/artists");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /작가 인증을 확인한 뒤 열립니다/);
  assert.match(html, /인증 백엔드 미연결로 잠금/);
  assert.match(html, /href="\/community\/verify"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /소량 스티커 발주 전에/);
  assert.doesNotMatch(html, /포장 작업대에 늘 올려두는/);
});

test("general board filters and safely falls back from unknown query values", async () => {
  const productionResponse = await render(
    "/community/general?category=production&order=latest",
  );
  assert.equal(productionResponse.status, 200);
  const productionHtml = await productionResponse.text();
  assert.match(productionHtml, /소량 스티커 발주 전에 교정본/);
  assert.doesNotMatch(productionHtml, /포장 작업대에 늘 올려두는/);

  const fallbackResponse = await render(
    "/community/general?category=unknown&order=unknown",
  );
  assert.equal(fallbackResponse.status, 200);
  const fallbackHtml = await fallbackResponse.text();
  assert.match(fallbackHtml, /전체 정보/);
  assert.match(fallbackHtml, /첫 부스 전에 카드 결제 준비/);
  assert.match(fallbackHtml, /포장 작업대에 늘 올려두는/);
  assert.match(fallbackHtml, /예시 작성자/);
  assert.match(fallbackHtml, /예시 답변/);
  assert.match(fallbackHtml, /data-ad-placement="community-general-feed"/);
});

test("general post detail links to real write, report, and related screens", async () => {
  const response = await render(
    "/community/general/first-booth-card-reader-checklist",
  );
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /첫 부스 전에 카드 결제 준비/);
  assert.match(html, /답변과 댓글/);
  assert.match(html, /예시 작성자/);
  assert.match(html, /예시 도움/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /href="\/community\/write\?board=general"/);
  assert.match(
    html,
    /href="\/community\/report\?post=first-booth-card-reader-checklist"/,
  );
  assert.match(html, /href="\/notes\/first-booth-checklist"/);
});

test("write, verification, rules, and report destinations explain their live boundary", async () => {
  const destinations = [
    ["/auth/sign-in", /아직 로그인을 받을 수 없습니다/],
    ["/community/write?board=general", /이 브라우저에만 임시저장/],
    ["/community/write?board=artists", /작성 잠금/],
    ["/community/verify", /이 화면에서는 파일, 사업자번호, 계정 정보를 받지 않습니다/],
    ["/community/rules", /현재는 운영 기준만 공개합니다/],
    ["/community/report", /현재 신고를 전송하거나 저장하지 않습니다/],
  ];

  for (const [path, pattern] of destinations) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, pattern, path);
    if (path !== "/community/rules") {
      assert.match(html, /name="robots" content="noindex, nofollow"/, path);
    }
  }
});
