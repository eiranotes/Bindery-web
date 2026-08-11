import assert from "node:assert/strict";
import test from "node:test";

import { render } from "./worker-harness.mjs";

test("notes index renders substantive dated entries", async () => {
  const response = await render("/notes");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /실무 노트/);
  assert.match(html, /문구작가 개인사업자의 부가세·종소세 한눈에 보기/);
  assert.match(html, /해외 주문을 보내기 전/);
  assert.match(html, /공식 출처 (?:<!-- -->)?6(?:<!-- -->)?건/);
  assert.match(html, /공식 출처 (?:<!-- -->)?13(?:<!-- -->)?건/);
  assert.match(html, /2026\.08\.07/);
  assert.match(html, /부스비를 회수하려면 몇 개를 팔아야 하나/);
  assert.match(html, /업데이트가 필요한 노트/);
  assert.match(html, /href="\/notes\/booth-break-even"/);
  assert.match(html, /href="\/notes\/overseas-shipping-customs"/);
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
  assert.match(legalHtml, /2026\.08\.07/);
  assert.match(legalHtml, /법률·세무·통관 자문이 아닙니다/);
  assert.match(legalHtml, /연 1억 400만원 미만/);
  assert.match(legalHtml, /종합소득세는 부가세 과세유형과 별개입니다/);
  assert.match(legalHtml, /국세청/);
  assert.match(legalHtml, /국가법령정보센터/);
});

test("overseas customs guide keeps transport, export, and destination rules separate", async () => {
  const response = await render("/notes/overseas-shipping-customs");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /우편 접수 ≠ 수출신고/);
  assert.match(html, /FOB 200만 · 500만원/);
  assert.match(html, /FOB 500만원 이하/);
  assert.match(html, /우편 신고생략 후보/);
  assert.match(html, /소포수령증/);
  assert.match(html, /CN23/);
  assert.match(html, /판매물품을 Gift 또는 Sample로 허위 표시하지 않습니다/);
  assert.match(html, /미국 저가 우편물 무관세 취급 중단/);
  assert.match(html, /EU 저가 전자상거래 임시 관세 안내/);
  assert.match(html, /일본 1만엔 이하 면세와 예외/);
  assert.match(html, /관세청 고객지원센터/);
  assert.match(html, /우정사업본부/);
});

test("news timeline summarizes and links each named source", async () => {
  const response = await render("/news");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /행사 변경 기록/);
  assert.match(html, /2026\.07\.24/);
  assert.match(html, /서울일러스트레이션페어 참가자 프로필 공개 방식 확인/);
  assert.match(html, /href="https:\/\/seoulillustrationfair\.co\.kr\/"/);
  assert.match(
    html,
    /서울일러스트레이션페어(?:<!-- -->)? 원문 확인/,
  );
  assert.match(html, /공식 공지만 원문과 함께 정리합니다/);
  assert.match(html, /최종 판단은 연결된 공식 원문에서 확인/);
});
