import assert from "node:assert/strict";
import test from "node:test";

import { render } from "./worker-harness.mjs";

test("home metadata contains product identity and no starter markers", async () => {
  const response = await render("/");
  const html = await response.text();

  assert.match(
    html,
    /<title>만드는 사람의 다음 일정을, 한 장에 — BINDERY<\/title>/,
  );
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(
    html,
    /codex-preview|Your site is taking shape|SkeletonPreview/,
  );
});

test("sitemap and robots expose public routes", async () => {
  const sitemap = await render("/sitemap.xml");
  const sitemapText = await sitemap.text();
  assert.equal(sitemap.status, 200);
  assert.match(
    sitemapText,
    /http:\/\/localhost:3000\/events\/illustar-fair\/2026-winter/,
  );
  assert.match(
    sitemapText,
    /http:\/\/localhost:3000\/notes\/simple-tax-start/,
  );
  assert.match(
    sitemapText,
    /http:\/\/localhost:3000\/community\/general/,
  );
  assert.doesNotMatch(
    sitemapText,
    /http:\/\/localhost:3000\/community\/artists/,
  );
  assert.doesNotMatch(
    sitemapText,
    /http:\/\/localhost:3000\/community\/general\/first-booth-card-reader-checklist/,
  );
  assert.doesNotMatch(
    sitemapText,
    /http:\/\/localhost:3000\/community\/(?:write|verify|report)/,
  );
  assert.doesNotMatch(sitemapText, /bindery\.example/);

  const robots = await render("/robots.txt");
  const robotsText = await robots.text();
  assert.equal(robots.status, 200);
  assert.match(robotsText, /Allow: \//);
  assert.match(
    robotsText,
    /Sitemap: http:\/\/localhost:3000\/sitemap\.xml/,
  );
});

test("RSS returns source-linked news items", async () => {
  const response = await render("/rss.xml");
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/rss\+xml/,
  );
  assert.match(body, /<rss version="2.0">/);
  assert.match(
    body,
    /서울일러스트레이션페어 참가자 프로필 공개 방식 확인/,
  );
  assert.match(body, /https:\/\/seoulillustrationfair\.co\.kr\//);
});
