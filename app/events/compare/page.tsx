import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "../../components/PageIntro";
import { events } from "../../lib/data.ts";
import {
  eventPath,
  formatCurrency,
  formatDate,
  formatDateRange,
} from "../../lib/events.ts";
import type { EventEdition } from "../../lib/types.ts";
import styles from "../event-tools.module.css";

export const metadata: Metadata = {
  title: "행사 비교",
  description:
    "독립 창작자 행사의 신청 마감, 참가비, 부스 조건과 현장 준비 정보를 최대 3개까지 비교합니다.",
};

type EventComparePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function valueOf(value: string | string[] | undefined, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function requestedEventIds(
  query: Record<string, string | string[] | undefined>,
): [string, string, string] {
  const defaults = events.slice(0, 3).map((event) => event.id);
  const requested = [
    valueOf(query.event1, defaults[0] ?? ""),
    valueOf(query.event2, defaults[1] ?? ""),
    valueOf(query.event3, defaults[2] ?? ""),
  ] as const;

  return requested.map((id, index) => {
    if (index > 0 && id === "") return "";
    if (events.some((event) => event.id === id)) return id;
    return defaults[index] ?? (index === 0 ? defaults[0] ?? "" : "");
  }) as [string, string, string];
}

function selectedEvents(requestedIds: readonly string[]): EventEdition[] {
  const selected: EventEdition[] = [];

  for (const id of requestedIds) {
    const event = events.find((candidate) => candidate.id === id);
    if (event && !selected.some((candidate) => candidate.id === event.id)) {
      selected.push(event);
    }
  }

  return selected.length ? selected : events.slice(0, 3);
}

function earliestDeadline(eventsToCompare: EventEdition[]) {
  return [...eventsToCompare].sort(
    (left, right) =>
      new Date(left.applicationDeadline).getTime() -
      new Date(right.applicationDeadline).getTime(),
  )[0];
}

function lowestFee(eventsToCompare: EventEdition[]) {
  return [...eventsToCompare].sort(
    (left, right) => left.boothFee - right.boothFee,
  )[0];
}

export default async function EventComparePage({
  searchParams,
}: EventComparePageProps) {
  const query = await searchParams;
  const requestedIds = requestedEventIds(query);
  const selected = selectedEvents(requestedIds);
  const deadlineLeader = earliestDeadline(selected);
  const feeLeader = lowestFee(selected);
  const noBusinessRequired = selected.filter(
    (event) => !event.businessRequired,
  );

  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="EVENTS / COMPARE"
        title="행사 비교"
        description="마감·비용·참가 조건을 같은 기준으로 비교합니다."
      >
        <div className="intro-actions">
          <Link className="button" href="/events/archive">
            회차 아카이브 보기
          </Link>
          <Link className="button" href="/events">
            행사 목록 보기
          </Link>
        </div>
      </PageIntro>

      <section className="filter-sheet" aria-labelledby="compare-picker-title">
        <div className="section-line-heading">
          <h2 id="compare-picker-title">비교할 행사 선택</h2>
          <span>UP TO 3 EVENTS</span>
        </div>
        <form
          action="/events/compare"
          className={styles.picker}
          method="get"
        >
          {["첫 번째 행사", "두 번째 행사", "세 번째 행사"].map(
            (label, index) => (
              <label key={label}>
                {label}
                <select
                  name={`event${index + 1}`}
                  defaultValue={requestedIds[index]}
                >
                  {index > 0 ? <option value="">선택 안 함</option> : null}
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.shortName} · {event.region}
                    </option>
                  ))}
                </select>
              </label>
            ),
          )}
          <div className="filter-actions">
            <button className="button button--primary" type="submit">
              비교 적용
            </button>
            <Link className="text-action" href="/events/compare">
              기본 비교로 돌아가기
            </Link>
          </div>
        </form>
      </section>

      <aside className="source-notice source-notice--strong">
        <strong>예시 데이터</strong>
        <p>
          비교값은 제품 검증용 예시입니다. 신청, 결제와 환불을 결정하기 전
          각 행사의 공식 원문과 확인 날짜를 다시 확인하세요.
        </p>
      </aside>

      <section className={styles.summary} aria-labelledby="comparison-summary-title">
        <div className="section-line-heading">
          <h2 id="comparison-summary-title">비교 요약</h2>
          <span>DECISION SIGNALS</span>
        </div>
        <dl className={styles.summaryList}>
          <div>
            <dt>가장 이른 마감</dt>
            <dd>
              {deadlineLeader.shortName}
              <small>
                {formatDate(deadlineLeader.applicationDeadline, {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </dd>
          </div>
          <div>
            <dt>낮은 참가비</dt>
            <dd>
              {feeLeader.shortName}
              <small>{formatCurrency(feeLeader.boothFee)}</small>
            </dd>
          </div>
          <div>
            <dt>사업자 없이 신청</dt>
            <dd>
              {noBusinessRequired.length
                ? noBusinessRequired.map((event) => event.shortName).join(" · ")
                : "해당 없음"}
              <small>선택한 회차의 현재 입력값 기준</small>
            </dd>
          </div>
        </dl>
        <p className={styles.summaryNote}>
          이 요약은 값의 차이만 보여 주며 행사 품질이나 적합도를 평가하지
          않습니다.
        </p>
      </section>

      <section className="history-section" aria-labelledby="comparison-title">
        <div className="section-line-heading">
          <h2 id="comparison-title">조건 비교표</h2>
          <span>{selected.length} EVENTS</span>
        </div>
        <p className={styles.scrollHint} data-ui="event-scroll-hint">
          모바일에서는 비교표를 좌우로 밀어 모든 행사 열을 확인하세요.
        </p>
        <div
          aria-label="선택한 행사 조건 비교표"
          className={`table-scroll ${styles.scrollRegion}`}
          data-ui="event-data-scroll"
          role="region"
          tabIndex={0}
        >
          <table className={styles.comparisonTable}>
            <caption className="sr-only">
              선택한 행사의 마감, 비용, 참가 조건과 공식 정보 확인일 비교
            </caption>
            <thead>
              <tr>
                <th scope="col">비교 항목</th>
                {selected.map((event) => (
                  <th scope="col" key={event.id}>
                    <Link href={eventPath(event)}>{event.shortName}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">신청 마감</th>
                {selected.map((event) => (
                  <td key={event.id}>
                    {formatDate(event.applicationDeadline, {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">개최 일정</th>
                {selected.map((event) => (
                  <td key={event.id}>{formatDateRange(event)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">지역·장소</th>
                {selected.map((event) => (
                  <td key={event.id}>
                    {event.region} · {event.venue}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">참가비</th>
                {selected.map((event) => (
                  <td key={event.id}>{formatCurrency(event.boothFee)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">부스</th>
                {selected.map((event) => (
                  <td key={event.id}>
                    {event.boothSize} · {event.boothCount.toLocaleString("ko-KR")}개
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">선정 방식</th>
                {selected.map((event) => (
                  <td key={event.id}>{event.selection}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">사업자</th>
                {selected.map((event) => (
                  <td key={event.id}>
                    {event.businessRequired ? "필요" : "필수 아님"}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">제출 자료</th>
                {selected.map((event) => (
                  <td key={event.id}>{event.application.documents.join(" · ")}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">전기</th>
                {selected.map((event) => (
                  <td key={event.id}>
                    {event.onsite.electricity ?? "정보 없음"}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">제공 집기</th>
                {selected.map((event) => (
                  <td key={event.id}>{event.onsite.fixtures ?? "정보 없음"}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">정보 확인</th>
                {selected.map((event) => (
                  <td key={event.id}>
                    <a href={event.sourceUrl} target="_blank" rel="noreferrer">
                      {event.verifiedAt} · 공식 원문 ↗
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
