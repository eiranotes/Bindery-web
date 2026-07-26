import assert from "node:assert/strict";
import test from "node:test";

import { render } from "./worker-harness.mjs";

test("notes index renders substantive dated entries", async () => {
  const response = await render("/notes");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /실무 노트/);
  assert.match(html, /간이과세자로 굿즈 판매를 시작할 때 확인할 것/);
  assert.match(html, /2026\.07\.14/);
  assert.match(html, /부스비를 회수하려면 몇 개를 팔아야 하나/);
  assert.match(html, /업데이트가 필요한 노트/);
  assert.match(html, /href="\/notes\/booth-break-even"/);
});

test("note detail exposes freshness and legal-information boundaries", async () => {
  const staleResponse = await render("/notes/booth-break-even");
  assert.equal(staleResponse.status, 200);

  const staleHtml = await staleResponse.text();
  assert.match(staleHtml, /마지막 업데이트/);
  assert.match(staleHtml, /2025\.02\.11/);
  assert.match(staleHtml, /현재 기준과 다를 수 있습니다/);
  assert.match(staleHtml, /행사 고정비를 모두 모은다/);
  assert.match(staleHtml, /확인 목록/);

  const legalResponse = await render("/notes/simple-tax-start");
  assert.equal(legalResponse.status, 200);

  const legalHtml = await legalResponse.text();
  assert.match(legalHtml, /마지막 업데이트/);
  assert.match(legalHtml, /2026\.07\.14/);
  assert.match(legalHtml, /법률·세무 자문이 아닙니다/);
  assert.match(legalHtml, /국세청 안내 또는 전문가에게 다시 확인/);
});

test("news timeline summarizes and links each named source", async () => {
  const response = await render("/news");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /업계 소식/);
  assert.match(html, /2026\.07\.24/);
  assert.match(html, /서울일러스트레이션페어 참가자 프로필 공개 방식 확인/);
  assert.match(html, /href="https:\/\/seoulillustrationfair\.co\.kr\/"/);
  assert.match(
    html,
    /서울일러스트레이션페어(?:<!-- -->)? 원문 확인/,
  );
  assert.match(html, /원문을 옮겨 싣지 않고/);
  assert.match(html, /최종 판단은 연결된 공식 원문에서 확인/);
});
