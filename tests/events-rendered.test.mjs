import assert from "node:assert/strict";
import test from "node:test";

import { render } from "./worker-harness.mjs";

test("home follows the checked-in HTML mockup language at reduced density", async () => {
  const response = await render("/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /신청 마감을 놓치면/);
  assert.match(html, /1년을 기다립니다/);
  assert.match(html, /오늘 · <time dateTime="\d{4}-\d{2}-\d{2}">/);
  assert.match(html, /신청 마감 임박/);
  assert.match(html, /class="colorbar"/);
  assert.equal((html.match(/class="d-day"/g) ?? []).length, 3);
  assert.equal((html.match(/class="list-number"/g) ?? []).length, 5);
  assert.match(html, /href="\/community"/);
  assert.doesNotMatch(html, /calendar-grid|groupbuy-progress|news-timeline/);
});

test("event filters survive in the URL and narrow the server-rendered list", async () => {
  const response = await render("/events?region=부산");
  const html = await response.text();
  const text = html.replaceAll("<!-- -->", "");

  assert.equal(response.status, 200);
  assert.match(text, /문구인더박스 8회/);
  assert.match(text, /1 RESULTS/);
  assert.doesNotMatch(text, /서울일러스트레이션페어 V\.20/);
});

test("event detail keeps official-source, missing-data, history, and review gates", async () => {
  const response = await render("/events/illustar-fair/2026-winter");
  const html = await response.text();
  const text = html.replaceAll("<!-- -->", "");

  assert.equal(response.status, 200);
  assert.match(text, /공식 정보 원본/);
  assert.match(text, /정보 없음/);
  assert.match(text, /지난 회차 비교/);
  assert.match(text, /현재 응답\s*3건/);
  assert.doesNotMatch(text, /비용 대비 만족/);
  assert.match(text, /내 바인더에 넣기/);
});

test("calendar route and ICS feed expose both event and deadline semantics", async () => {
  const calendar = await render("/events/calendar?month=2026-08");
  const calendarHtml = await calendar.text();
  assert.equal(calendar.status, 200);
  assert.match(calendarHtml, /신청 마감/);
  assert.match(calendarHtml, /행사 시작/);

  const ics = await render("/events/calendar.ics");
  const icsText = await ics.text();
  assert.equal(ics.status, 200);
  assert.match(ics.headers.get("content-type") ?? "", /^text\/calendar/);
  assert.match(icsText, /BEGIN:VCALENDAR/);
  assert.match(icsText, /일러스타페어 2026 겨울/);
  assert.match(icsText, /신청 마감/);
});
