import type { Metadata } from "next";
import Link from "next/link";
import { DDay } from "../components/DDay";
import { PageIntro } from "../components/PageIntro";
import { StatusStamp } from "../components/StatusStamp";
import { events, genres, regions, scales } from "../lib/data.ts";
import {
  deriveEventStatus,
  eventDataLabel,
  eventPath,
  filterEvents,
  formatCurrency,
  formatDate,
  isDecisionReady,
  isEventDataStale,
  nextEventMilestone,
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

function enumValue<T extends string>(
  value: string | string[] | undefined,
  values: readonly T[],
  fallback: T,
): T {
  const candidate = valueOf(value, fallback);
  return values.includes(candidate as T) ? (candidate as T) : fallback;
}

function boothFeeRange(event: (typeof events)[number]) {
  const priced = (event.boothOptions ?? []).filter(
    (option) => option.feeAmount !== null && option.currency,
  );
  if (!priced.length) return "정보 없음";
  const currencies = new Set(priced.map((option) => option.currency));
  if (currencies.size !== 1) return "통화별 옵션 확인";
  const amounts = priced.map((option) => option.feeAmount as number);
  const minimum = Math.min(...amounts);
  const maximum = Math.max(...amounts);
  const currency = priced[0].currency ?? "KRW";
  return minimum === maximum
    ? formatCurrency(minimum, currency)
    : `${formatCurrency(minimum, currency)}–${formatCurrency(maximum, currency)}`;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const query = await searchParams;
  const filters: EventFilters = {
    region: valueOf(query.region, "전체"),
    genre: valueOf(query.genre, "전체"),
    scale: valueOf(query.scale, "전체"),
    business: valueOf(query.business, "전체"),
    stage: enumValue(query.stage, ["apply", "upcoming", "archived", "all"], "apply"),
    data: enumValue(query.data, ["all", "decision_ready", "source_reachable"], "all"),
    sort: valueOf(query.sort, "deadline") === "date" ? "date" : "deadline",
  };
  const now = new Date();
  const filtered = filterEvents(events, filters, now);
  const decisionReadyCount = events.filter((event) => isDecisionReady(event, now)).length;
  const staleCount = events.filter((event) => isEventDataStale(event, now)).length;

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
            현재 단계
            <select name="stage" defaultValue={filters.stage}>
              <option value="apply">지원 가능·예정</option>
              <option value="upcoming">개최 예정·진행</option>
              <option value="archived">종료 회차</option>
              <option value="all">전체</option>
            </select>
          </label>
          <label>
            정보 상태
            <select name="data" defaultValue={filters.data}>
              <option value="all">전체</option>
              <option value="decision_ready">참가 판단 가능</option>
              <option value="source_reachable">공식 일정 확인</option>
            </select>
          </label>
          <label>
            지역
            <select name="region" defaultValue={filters.region}>
              {regions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            장르
            <select name="genre" defaultValue={filters.genre}>
              {genres.map(
                (option) => (
                  <option key={option}>{option}</option>
                ),
              )}
            </select>
          </label>
          <label>
            규모
            <select name="scale" defaultValue={filters.scale}>
              {scales.map((option) => (
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
              <option value="null">확인 중</option>
            </select>
          </label>
          <label>
            정렬
            <select name="sort" defaultValue={filters.sort}>
              <option value="deadline">다음 일정 가까운 순</option>
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

      <section className="event-coverage" aria-label="행사 데이터 상태">
        <p><strong>{decisionReadyCount}</strong><span>참가 판단 가능</span></p>
        <p><strong>{events.length - staleCount}</strong><span>재검수 기한 내</span></p>
        <p><strong>{staleCount}</strong><span>재확인 필요</span></p>
        <p><strong>{events.length}</strong><span>공식 일정 인덱스</span></p>
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
              const milestone = nextEventMilestone(event, now);
              return (
                <li key={event.id}>
                  <span className="event-ledger__number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="event-ledger__title">
                    <StatusStamp status={status} />
                    <Link href={eventPath(event)}>{event.name}</Link>
                    <span>
                      {event.region} · {event.venue ?? "장소 확인 중"}
                      {" · "}{eventDataLabel(event, now)}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>{milestone.label}</dt>
                      <dd>
                        {formatDate(milestone.date, {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        }, event.timeZone)}
                      </dd>
                    </div>
                    <div>
                      <dt>부스비 범위</dt>
                      <dd>{boothFeeRange(event)}</dd>
                    </div>
                    <div>
                      <dt>사업자</dt>
                      <dd>{event.businessRequired === null ? "정보 없음" : event.businessRequired ? "필요" : "필수 아님"}</dd>
                    </div>
                    <div>
                      <dt>선정</dt>
                      <dd>{event.selection ?? "정보 없음"}</dd>
                    </div>
                  </dl>
                  {milestone.days === null ? (
                    <span className="event-ended-label">종료</span>
                  ) : (
                    <DDay
                      days={milestone.days}
                      label={`${event.shortName} ${milestone.label}`}
                    />
                  )}
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
          공식 원문과 연결된 정규화 데이터입니다. 세부 검수 중인 회차는
          확인되지 않은 값을 정보 없음으로 표시하므로 신청 전 원문을 다시
          확인하세요.
        </p>
      </aside>
    </div>
  );
}
