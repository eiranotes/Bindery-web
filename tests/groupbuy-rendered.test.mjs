import assert from "node:assert/strict";
import test from "node:test";

import { render } from "./worker-harness.mjs";

test("renders a read-only Groupbuy status board with explicit trust boundaries", async () => {
  const response = await render("/groupbuy");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  const text = html.replaceAll("<!-- -->", "");

  assert.match(text, /공동구매 현황/);
  assert.match(text, /결제와 정산에 관여하지 않습니다/);
  assert.match(text, /진행 상태/);
  assert.match(text, /주최 이력/);
  assert.match(text, /참여 전 확인/);
  assert.match(text, /완료\s*4회/);
  assert.match(text, /무산\s*0회/);
  assert.match(text, /모집중/);
  assert.match(text, /외부 안내 채널/);

  assert.doesNotMatch(
    html,
    /결제하기|주문하기|구매하기|체크아웃|checkout|공구\s*등록|등록하기|글쓰기|모집글\s*작성/i,
  );
  assert.doesNotMatch(html, /<form\b/i);
});
