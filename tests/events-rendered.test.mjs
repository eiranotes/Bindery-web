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
  assert.match(html, /다가오는 신청·행사 일정/);
  assert.match(html, /행사 비교하기/);
  assert.match(html, /회차 아카이브 보기/);
  assert.match(html, /class="colorbar"/);
  assert.equal((html.match(/class="d-day"/g) ?? []).length, 3);
  assert.equal((html.match(/class="list-number"/g) ?? []).length, 4);
  assert.match(html, /href="\/community"/);
  assert.doesNotMatch(html, /href="\/groupbuy"/);
  assert.doesNotMatch(html, /calendar-grid|groupbuy-progress|news-timeline/);
});

test("event filters survive in the URL and narrow the server-rendered list", async () => {
  const response = await render("/events?region=인천");
  const html = await response.text();
  const text = html.replaceAll("<!-- -->", "");

  assert.equal(response.status, 200);
  assert.match(text, /2026 인천 일러스트코리아/);
  assert.match(text, /1 RESULTS/);
  assert.doesNotMatch(text, /2026 수원 일러스트코리아/);
});

test("event comparison normalizes duplicates, allows empty slots, and keeps decision context", async () => {
  const response = await render(
    "/events/compare?event1=illustration-korea-2026-incheon&event2=illustration-korea-2026-suwon&event3=illustration-korea-2026-incheon",
  );
  const html = await response.text();
  const text = html.replaceAll("<!-- -->", "");

  assert.equal(response.status, 200);
  assert.match(text, /행사 비교/);
  assert.match(text, /2 EVENTS/);
  assert.match(text, /인천 일러스트코리아/);
  assert.match(text, /수원 일러스트코리아/);
  assert.match(text, /공식 정보 비교/);
  assert.match(text, /비교 요약/);
  assert.match(text, /가장 이른 신청 일정/);
  assert.match(text, /낮은 참가비/);
  assert.match(text, /사업자 없이 신청/);
  assert.match(text, /확인된 회차 없음/);
  assert.match(text, /정보 없음/);
  assert.match(text, /공식 원문/);
  assert.match(text, /제출 자료/);
  assert.match(text, /선택 안 함/);
  assert.match(text, /모바일에서는 비교표를 좌우로 밀어/);
  assert.match(html, /data-ui="event-data-scroll"/);
  assert.match(html, /tabindex="0"/i);
});

test("event archive groups edition history and exposes scalable wayfinding", async () => {
  const response = await render("/events/archive");
  const html = await response.text();
  const text = html.replaceAll("<!-- -->", "");

  assert.equal(response.status, 200);
  assert.match(text, /행사 회차 아카이브/);
  assert.match(text, /행사 바로가기/);
  assert.match(text, /행사별 누적 기록/);
  assert.match(text, /수원 일러스트코리아/);
  assert.match(text, /2026 인천 일러스트코리아/);
  assert.match(text, /₩550,000/);
  assert.match(text, /정보 없음/);
  assert.match(text, /현재 회차/);
  assert.match(text, /최신 회차 보기/);
  assert.match(text, /모바일에서는 각 회차 표를 좌우로 밀어/);
  assert.match(html, /href="#archive-illustration-korea"/);
  assert.match(html, /data-ui="event-data-scroll"/);
});

test("event detail keeps official-source, missing-data, history, and review gates", async () => {
  const response = await render("/events/illustration-korea/2026-incheon");
  const html = await response.text();
  const text = html.replaceAll("<!-- -->", "");

  assert.equal(response.status, 200);
  assert.match(text, /편집 검수된 공식 정보/);
  assert.match(text, /정보 없음/);
  assert.match(text, /지난 회차 비교/);
  assert.match(text, /공식 출처 5건/);
  assert.match(text, /LOCAL ONLY/);
  assert.doesNotMatch(text, /현재 응답|비용 대비 만족|reviewAggregate/);
  assert.match(text, /내 바인더에 넣기/);
});

test("source-checked event details disclose pending review and preserve unknowns", async () => {
  const response = await render("/events/agf-korea/2026");
  const html = await response.text();
  const text = html.replaceAll("<!-- -->", "");

  assert.equal(response.status, 200);
  assert.match(text, /Anime × Game Festival 2026/);
  assert.match(text, /공식 원문 연결 정보/);
  assert.match(text, /세부 필드는 검수 중입니다/);
  assert.match(text, /정보 없음/);
  assert.doesNotMatch(text, />undefined<|NaN/);
});

test("international stationery details expose country provenance and native currency", async () => {
  const response = await render("/events/paperworld-china/2026");
  const html = await response.text();
  const text = html.replaceAll("<!-- -->", "");

  assert.equal(response.status, 200);
  assert.match(text, /페이퍼월드 차이나 2026/);
  assert.match(text, /중국·상하이/);
  assert.match(text, /원문 언어 zh-Hans/);
  assert.match(text, /CN¥990|CNY\s*990/);
  assert.match(text, /공식 원문 연결 정보/);
  assert.match(html, /"addressCountry":"CN"/);
  assert.doesNotMatch(text, />undefined<|NaN/);
});

test("Design Festa detail preserves official scale, closed lottery, and JPY fees", async () => {
  const response = await render("/events/design-festa/2026-64");
  const html = await response.text();
  const text = html.replaceAll("<!-- -->", "");

  assert.equal(response.status, 200);
  assert.match(text, /디자인 페스타 vol\.64/);
  assert.match(text, /일본·도쿄/);
  assert.match(text, /6,500/);
  assert.match(text, /추첨/);
  assert.match(text, /JP¥17,000|JPY\s*17,000/);
  assert.match(html, /"addressCountry":"JP"/);
  assert.doesNotMatch(text, />undefined<|NaN/);
});

test("comparison does not rank unlike booth-fee currencies", async () => {
  const response = await render(
    "/events/compare?event1=paperworld-china-2026&event2=illustration-korea-2026-incheon",
  );
  const text = (await response.text()).replaceAll("<!-- -->", "");

  assert.equal(response.status, 200);
  assert.match(text, /통화가 달라 직접 비교하지 않음/);
  assert.match(text, /CN¥990|CNY\s*990/);
  assert.match(text, /₩550,000/);
});

test("calendar route and ICS feed expose both event and deadline semantics", async () => {
  const calendar = await render("/events/calendar?month=2026-08");
  const calendarHtml = await calendar.text();
  assert.equal(calendar.status, 200);
  assert.match(calendarHtml, /인천 일러스트코리아 조기 신청 할인 마감/);

  const ics = await render("/events/calendar.ics");
  const icsText = await ics.text();
  assert.equal(ics.status, 200);
  assert.match(ics.headers.get("content-type") ?? "", /^text\/calendar/);
  assert.match(icsText, /BEGIN:VCALENDAR/);
  assert.match(icsText, /2026 인천 일러스트코리아/);
  assert.match(icsText, /조기 신청 할인 마감/);
  assert.match(icsText, /DTSTART;VALUE=DATE:20260830/);
});
