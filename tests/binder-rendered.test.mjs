import assert from "node:assert/strict";
import test from "node:test";

import { render } from "./worker-harness.mjs";

test("My Binder explains local storage and includes a useful no-script path", async () => {
  const response = await render("/me");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /My Binder/);
  assert.match(html, /이 기기/);
  assert.match(html, /계정 없이/);
  assert.match(html, /행사 찾아보기/);
  assert.match(html, /JavaScript/);
});
