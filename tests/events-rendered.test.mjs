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
  assert.equal((html.match(/class="list-number"/g) ?? []).length, 5);
  assert.match(html, /href="\/community"/);
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
    "/events/compare?event1=illustar-2026-winter&event2=mungu-box-2026-8&event3=illustar-2026-winter",
  );
  const html = await response.text();
  const text = html.replaceAll("<!-- -->", "");

  assert.equal(response.status, 200);
  assert.match(text, /행사 비교/);
  assert.match(text, /2 EVENTS/);
  assert.match(text, /일러스타페어 겨울/);
  assert.match(text, /문구인더박스 8회/);
  assert.match(text, /예시 데이터/);
  assert.match(text, /비교 요약/);
  assert.match(text, /가장 이른 마감/);
  assert.match(text, /낮은 참가비/);
  assert.match(text, /사업자 없이 신청/);
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
  assert.match(text, /일러스타페어 겨울/);
  assert.match(text, /2025 여름/);
  assert.match(text, /₩120,000/);
  assert.match(text, /현재 회차/);
  assert.match(text, /최신 회차 보기/);
  assert.match(text, /모바일에서는 각 회차 표를 좌우로 밀어/);
  assert.match(html, /href="#archive-illustar-fair"/);
  assert.match(html, /data-ui="event-data-scroll"/);
});

test("event detail keeps official-source, missing-data, history, and review gates", async () => {
  const response = await render("/events/illustration-korea/2026-incheon");
  const html = await response.text();
  const text = html.replaceAll("<!-- -->", "");

  assert.equal(response.status, 200);
  assert.match(text, /공식 정보 원본/);
  assert.match(text, /정보 없음/);
  assert.match(text, /지난 회차 비교/);
  assert.match(text, /공식 출처 5건/);
  assert.match(text, /LOCAL ONLY/);
  assert.doesNotMatch(text, /현재 응답|비용 대비 만족|reviewAggregate/);
  assert.match(text, /내 바인더에 넣기/);
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
