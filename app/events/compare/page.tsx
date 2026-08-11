import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "../../components/PageIntro";
import { events } from "../../lib/data.ts";
import {
  deriveEventStatus,
  eventDataLabel,
  eventPath,
  eventTime,
  formatCurrency,
  formatDate,
  formatDateRange,
  isEventDataStale,
} from "../../lib/events.ts";
import type { BoothOption, EventEdition } from "../../lib/types.ts";
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
  const requested = [
    valueOf(query.event1, ""),
    valueOf(query.event2, ""),
    valueOf(query.event3, ""),
  ] as const;

  return requested.map((id) => {
    if (id === "") return "";
    if (events.some((event) => event.id === id)) return id;
    return "";
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

  return selected;
}

function earliestDeadline(eventsToCompare: EventEdition[], now: Date) {
  return eventsToCompare.filter((event) => {
    if (!event.applicationDeadline) return false;
    if (!['final', 'capacity'].includes(event.applicationDeadlineKind ?? 'final')) return false;
    const deadline = eventTime(event.applicationDeadline, true, event.timeZone);
    return deadline !== null && deadline >= now.getTime();
  }).sort(
    (left, right) =>
      (eventTime(left.applicationDeadline, true, left.timeZone) as number) -
      (eventTime(right.applicationDeadline, true, right.timeZone) as number),
  )[0];
}

function boothSignature(option: BoothOption) {
  return [
    option.label.trim().toLocaleLowerCase("ko-KR"),
    option.size?.trim().toLocaleLowerCase("ko-KR") ?? "",
    option.currency ?? "",
    String(option.vatIncluded),
  ].join("|");
}

function comparableBoothFees(eventsToCompare: EventEdition[]) {
  if (eventsToCompare.length < 2) return null;
  const optionMaps = eventsToCompare.map(
    (event) => new Map((event.boothOptions ?? []).map((option) => [boothSignature(option), option])),
  );
  const commonSignature = [...optionMaps[0].keys()].find((signature) =>
    optionMaps.every((options) => options.has(signature)),
  );
  if (!commonSignature) return null;
  const candidates = eventsToCompare.flatMap((event, index) => {
    const option = optionMaps[index].get(commonSignature);
    return option?.feeAmount === null || option?.feeAmount === undefined
      ? []
      : [{ event, option }];
  });
  if (candidates.length !== eventsToCompare.length) return null;
  const currencies = new Set(candidates.map(({ option }) => option.currency));
  if (currencies.size !== 1) return null;
  const sorted = candidates.toSorted(
    (left, right) =>
      (left.option.feeAmount as number) - (right.option.feeAmount as number),
  );
  const leader = sorted[0];
  const tiedLeaders = sorted.filter(
    ({ option }) => option.feeAmount === leader.option.feeAmount,
  );
  const eventLabel =
    tiedLeaders.length === eventsToCompare.length
      ? eventsToCompare.length === 2
        ? "두 행사 동일"
        : "세 행사 동일"
      : tiedLeaders.length > 1
        ? `${tiedLeaders.map(({ event }) => event.shortName).join(" · ")} 동률`
        : leader.event.shortName;
  return {
    ...leader,
    eventLabel,
    label: [leader.option.label, leader.option.size].filter(Boolean).join(" · "),
  }
}

function businessRequirement(value: boolean | null) {
  if (value === null) return "정보 없음";
  return value ? "필요" : "필수 아님";
}

function boothOptionText(option: BoothOption) {
  const fee = formatCurrency(option.feeAmount, option.currency ?? "KRW");
  const vat =
    option.vatIncluded === null
      ? "VAT 확인 필요"
      : option.vatIncluded
        ? "VAT 포함"
        : "VAT 별도";
  return [option.label, option.size, fee, vat].filter(Boolean).join(" · ");
}

export default async function EventComparePage({
  searchParams,
}: EventComparePageProps) {
  const query = await searchParams;
  const now = new Date();
  const requestedIds = requestedEventIds(query);
  const selected = selectedEvents(requestedIds);
  const deadlineLeader = earliestDeadline(selected, now);
  const comparableFee = comparableBoothFees(selected);
  const noBusinessRequired = selected.filter(
    (event) => event.businessRequired === false,
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
                  <option value="">{index === 0 ? "행사 선택" : "선택 안 함"}</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.shortName} · {event.region} · {deriveEventStatus(event, now) === "ended" ? "종료" : eventDataLabel(event, now)}
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
              선택 초기화
            </Link>
          </div>
        </form>
      </section>

      {selected.length < 2 ? (
        <section className="empty-state" aria-labelledby="comparison-empty-title">
          <h2 id="comparison-empty-title">비교할 행사를 2개 이상 선택하세요.</h2>
          <p>
            참가 판단에 필요한 필드와 공식 원문 확인일을 먼저 보여 주고,
            동일한 부스 구성이 있을 때만 비용을 직접 비교합니다.
          </p>
          <Link className="text-action" href="/events?stage=apply">
            지원 가능한 행사에서 고르기
          </Link>
        </section>
      ) : null}

      {selected.length >= 2 ? <aside className="source-notice source-notice--strong">
        <strong>공식 정보 비교</strong>
        <p>
          공식 원문에서 정규화한 현재 입력값입니다. 재검수 기한이 지났거나
          핵심 필드가 부족한 회차는 비교 불가 사유를 표시하며, 신청 전 원문과
          확인 날짜를 다시 확인하세요.
        </p>
      </aside> : null}

      {selected.length >= 2 ? <section className={styles.summary} aria-labelledby="comparison-summary-title">
        <div className="section-line-heading">
          <h2 id="comparison-summary-title">비교 요약</h2>
          <span>DECISION SIGNALS</span>
        </div>
        <dl className={styles.summaryList}>
          <div>
            <dt>가장 이른 신청 일정</dt>
            <dd>
              {deadlineLeader ? deadlineLeader.shortName : "확인된 신청 마감 없음"}
              {deadlineLeader ? (
                <small>
                  {deadlineLeader.applicationDeadlineLabel ?? "접수 마감"} ·{" "}
                  {formatDate(deadlineLeader.applicationDeadline, {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }, deadlineLeader.timeZone)}
                </small>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>동일 부스 옵션 최저비용</dt>
            <dd>
              {comparableFee
                ? comparableFee.eventLabel
                : "동일 구성이 없어 직접 비교하지 않음"}
              {comparableFee ? (
                <small>
                  {comparableFee.label} ·{" "}
                  {formatCurrency(
                    comparableFee.option.feeAmount,
                    comparableFee.option.currency ?? "KRW",
                  )}
                </small>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>사업자 없이 신청</dt>
            <dd>
              {noBusinessRequired.length
                ? noBusinessRequired.map((event) => event.shortName).join(" · ")
                : "확인된 회차 없음"}
              <small>정보 없음은 불필요로 간주하지 않음</small>
            </dd>
          </div>
        </dl>
        <p className={styles.summaryNote}>
          서로 다른 면적·포함 집기·VAT 조건은 낮은 가격으로 순위를 매기지
          않습니다. 이 요약은 행사 품질이나 적합도를 평가하지 않습니다.
        </p>
      </section> : null}

      {selected.length >= 2 ? <section className="history-section" aria-labelledby="comparison-title">
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
                <th scope="row">데이터 상태</th>
                {selected.map((event) => (
                  <td key={event.id}>
                    <strong>{eventDataLabel(event, now)}</strong>
                    <br />
                    핵심 필드 {event.decisionCoverage?.known ?? 0}/
                    {event.decisionCoverage?.total ?? 6}
                    {isEventDataStale(event, now) ? " · 재검수 기한 경과" : ""}
                  </td>
                ))}
              </tr>
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
                    }, event.timeZone)}
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
                    {event.region} · {event.venue ?? "장소 확인 중"}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">부스 옵션·참가비</th>
                {selected.map((event) => (
                  <td key={event.id}>
                    {(event.boothOptions ?? []).length ? (
                      <ul className={styles.optionList}>
                        {(event.boothOptions ?? []).map((option) => (
                          <li key={option.id}>{boothOptionText(option)}</li>
                        ))}
                      </ul>
                    ) : (
                      "비교 가능한 부스 옵션 없음"
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">부스</th>
                {selected.map((event) => (
                  <td key={event.id}>
                    {event.boothSize ?? "크기 정보 없음"} ·{" "}
                    {event.boothCount === null
                      ? "정보 없음"
                      : `${event.boothCount.toLocaleString("ko-KR")}개`}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">선정 방식</th>
                {selected.map((event) => (
                  <td key={event.id}>{event.selection ?? "정보 없음"}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">사업자</th>
                {selected.map((event) => (
                  <td key={event.id}>
                    {businessRequirement(event.businessRequired)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">제출 자료</th>
                {selected.map((event) => (
                  <td key={event.id}>
                    {event.application.documents.length
                      ? event.application.documents.join(" · ")
                      : "정보 없음"}
                  </td>
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
                      {event.sourceCheckedAt?.slice(0, 10) ?? event.verifiedAt} · 공식 원문 ↗
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section> : null}
    </div>
  );
}
