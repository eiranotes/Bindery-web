import type { Metadata } from "next";
import Link from "next/link";
import { DDay } from "../components/DDay";
import { PageIntro } from "../components/PageIntro";
import { StatusStamp } from "../components/StatusStamp";
import { events } from "../lib/data.ts";
import {
  daysUntilDeadline,
  deriveEventStatus,
  eventPath,
  filterEvents,
  formatDate,
} from "../lib/events.ts";
import type { EventFilters } from "../lib/types.ts";

export const metadata: Metadata = {
  title: "행사",
  description: "독립 창작자를 위한 행사 신청 마감과 참가 조건을 비교합니다.",
};

type EventsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function valueOf(
  value: string | string[] | undefined,
  fallback: string,
): string {
  return typeof value === "string" ? value : fallback;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const query = await searchParams;
  const filters: EventFilters = {
    region: valueOf(query.region, "전체"),
    genre: valueOf(query.genre, "전체"),
    scale: valueOf(query.scale, "전체"),
    business: valueOf(query.business, "전체"),
    sort: valueOf(query.sort, "deadline") === "date" ? "date" : "deadline",
  };
  const now = new Date();
  const filtered = filterEvents(events, filters, now);

  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="INDEX 01 / EVENTS"
        title="행사"
        description="마감·참가비·조건과 회차 변화를 비교합니다."
      >
        <div className="intro-actions">
          <Link className="button button--primary" href="/events/compare">
            행사 비교하기
          </Link>
          <Link className="button" href="/events/archive">
            회차 아카이브
          </Link>
          <Link className="button" href="/events/calendar">
            달력으로 보기
          </Link>
        </div>
      </PageIntro>

      <section className="filter-sheet" aria-labelledby="filter-title">
        <div className="section-line-heading">
          <h2 id="filter-title">조건 좁히기</h2>
          <span>{filtered.length} RESULTS</span>
        </div>
        <form action="/events" method="get">
          <label>
            지역
            <select name="region" defaultValue={filters.region}>
              {["전체", "서울", "부산", "대구"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            장르
            <select name="genre" defaultValue={filters.genre}>
              {["전체", "문구", "일러스트", "서브컬처", "복합"].map(
                (option) => (
                  <option key={option}>{option}</option>
                ),
              )}
            </select>
          </label>
          <label>
            규모
            <select name="scale" defaultValue={filters.scale}>
              {["전체", "소형", "중형", "대형"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            사업자
            <select name="business" defaultValue={filters.business}>
              <option value="전체">전체</option>
              <option value="true">필요</option>
              <option value="false">불필요</option>
            </select>
          </label>
          <label>
            정렬
            <select name="sort" defaultValue={filters.sort}>
              <option value="deadline">마감 가까운 순</option>
              <option value="date">개최일 순</option>
            </select>
          </label>
          <div className="filter-actions">
            <button className="button button--primary" type="submit">
              적용하기
            </button>
            <Link className="text-action" href="/events">
              필터 초기화
            </Link>
          </div>
        </form>
      </section>

      <section className="event-ledger" aria-labelledby="event-list-title">
        <div className="section-line-heading">
          <h2 id="event-list-title">행사 목록</h2>
          <span>OFFICIAL SOURCE FIRST</span>
        </div>
        {filtered.length ? (
          <ol>
            {filtered.map((event, index) => {
              const status = deriveEventStatus(event, now);
              return (
                <li key={event.id}>
                  <span className="event-ledger__number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="event-ledger__title">
                    <StatusStamp status={status} />
                    <Link href={eventPath(event)}>{event.name}</Link>
                    <span>
                      {event.region} · {event.venue}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>접수 마감</dt>
                      <dd>
                        {formatDate(event.applicationDeadline, {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt>참가비</dt>
                      <dd>₩{event.boothFee.toLocaleString("ko-KR")}</dd>
                    </div>
                    <div>
                      <dt>선정</dt>
                      <dd>{event.selection}</dd>
                    </div>
                  </dl>
                  <DDay
                    days={daysUntilDeadline(event, now)}
                    label={`${event.shortName} 신청`}
                  />
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="empty-state">
            <p>이 조건에 맞는 행사가 없습니다.</p>
            <Link className="text-action" href="/events">
              모든 행사 다시 보기
            </Link>
          </div>
        )}
      </section>

      <aside className="source-notice">
        <strong>정보 경계</strong>
        <p>
          예시 데이터입니다. 신청 전 공식 원문과 확인 날짜를 확인하세요.
        </p>
      </aside>
    </div>
  );
}
