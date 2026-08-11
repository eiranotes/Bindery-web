import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookmarkButton } from "../../../components/BookmarkButton";
import { DDay } from "../../../components/DDay";
import { StatusStamp } from "../../../components/StatusStamp";
import { events } from "../../../lib/data.ts";
import {
  deriveEventStatus,
  eventDataLabel,
  formatCurrency,
  formatDate,
  formatDateRange,
  getEventByPath,
  isEventDataStale,
  nextEventMilestone,
} from "../../../lib/events.ts";

type EventDetailProps = {
  params: Promise<{ slug: string; edition: string }>;
};

export function generateStaticParams() {
  return events.map((event) => ({
    slug: event.slug,
    edition: event.edition,
  }));
}

export async function generateMetadata({
  params,
}: EventDetailProps): Promise<Metadata> {
  const { slug, edition } = await params;
  const event = getEventByPath(slug, edition);
  return event
    ? {
        title: event.name,
        description: `${event.name}의 신청 마감, 참가비, 지난 회차와 현장 준비 정보.`,
      }
    : { title: "행사 정보 없음" };
}

function InfoValue({ value }: { value: string | null }) {
  return value ? (
    <>{value}</>
  ) : (
    <span className="unknown-value">정보 없음</span>
  );
}

export default async function EventDetailPage({ params }: EventDetailProps) {
  const { slug, edition } = await params;
  const event = getEventByPath(slug, edition);
  if (!event) notFound();
  const status = deriveEventStatus(event);
  const milestone = nextEventMilestone(event);
  const now = new Date();
  const applicationKnownCount = [
    event.application.documents.length > 0,
    event.application.resalePolicy,
    event.application.refundPolicy,
    event.application.note,
  ].filter(Boolean).length;
  const onsiteKnownCount = Object.values(event.onsite).filter(Boolean).length;
  const schemaEventStatus =
    status === "ended"
      ? "https://schema.org/EventCompleted"
      : status === "ongoing"
        ? "https://schema.org/EventInProgress"
        : "https://schema.org/EventScheduled";

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    startDate: event.startDate,
    endDate: event.endDate,
    eventStatus: schemaEventStatus,
    ...(event.venue
      ? {
          location: {
            "@type": "Place",
            name: event.venue,
            address: {
              "@type": "PostalAddress",
              ...(event.address ? { streetAddress: event.address } : {}),
              ...(event.city ? { addressLocality: event.city } : {}),
              addressCountry: event.countryCode,
            },
          },
        }
      : {}),
    organizer: {
      "@type": "Organization",
      name: event.organizer,
      url: event.sourceUrl,
    },
  };

  return (
    <article className="page-shell event-detail">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <nav className="breadcrumbs" aria-label="현재 위치">
        <Link href="/events">행사</Link>
        <span aria-hidden="true">/</span>
        <span>{event.shortName}</span>
      </nav>
      <header className="detail-title-block">
        <div>
          <StatusStamp status={status} />
          <h1>{event.name}</h1>
          <p>
            {event.region} {event.venue ?? "장소 확인 중"} · {formatDateRange(event)}
          </p>
        </div>
        <div className="detail-dday">
          {milestone.days === null ? (
            <strong className="detail-dday__past">종료</strong>
          ) : (
            <DDay days={milestone.days} label={`${event.shortName} ${milestone.label}`} />
          )}
          <span className="detail-dday__label">
            {milestone.state === "past" ? milestone.label : `${milestone.label}까지`}
          </span>
        </div>
      </header>

      <aside className="origin-bar">
        <strong>
          {eventDataLabel(event, now)}
        </strong>
        <a href={event.sourceUrl} target="_blank" rel="noreferrer">
          {event.sourceLabel} 확인 ↗
        </a>
        <span>
          {event.sourceCheckedAt?.slice(0, 10) ?? event.verifiedAt} 확인 · {event.countryName} · 원문 언어 {event.sourceLanguage} ·
          공식 출처 {event.sourceCount ?? 1}건을 연결했습니다.
          {isEventDataStale(event, now) ? " 재검수 기한이 지나 현재 원문 확인이 필요합니다." : ""}
          {event.reviewNeeded ? " 세부 필드는 검수 중입니다." : ""} 신청 전 반드시
          회차 원문을 확인하세요.
        </span>
      </aside>

      <div className="detail-body-grid">
        <div className="event-detail-main">
          <div className="detail-columns">
        <section className={`lined-section${applicationKnownCount ? "" : " lined-section--empty"}`} aria-labelledby="application-title">
          <div className="section-line-heading">
            <h2 id="application-title">신청 준비</h2>
            <span>BEFORE APPLY</span>
          </div>
          {applicationKnownCount ? <dl className="definition-list">
            {event.application.documents.length ? <div>
              <dt>필요 자료</dt>
              <dd>
                <ul>
                  {event.application.documents.map((document) => (
                    <li key={document}>{document}</li>
                  ))}
                </ul>
              </dd>
            </div> : null}
            {event.application.resalePolicy ? <div>
              <dt>재판매 기준</dt>
              <dd><InfoValue value={event.application.resalePolicy} /></dd>
            </div> : null}
            {event.application.refundPolicy ? <div>
              <dt>환불 기준</dt>
              <dd><InfoValue value={event.application.refundPolicy} /></dd>
            </div> : null}
            {event.application.note ? <div>
              <dt>메모</dt>
              <dd><InfoValue value={event.application.note} /></dd>
            </div> : null}
          </dl> : <p className="unknown-section-copy">공식 원문에서 확인·검수된 신청 준비 세부정보가 아직 없습니다.</p>}
        </section>

        <section className={`lined-section${onsiteKnownCount ? "" : " lined-section--empty"}`} aria-labelledby="onsite-title">
          <div className="section-line-heading">
            <h2 id="onsite-title">현장 준비</h2>
            <span>ON SITE</span>
          </div>
          {onsiteKnownCount ? <dl className="definition-list">
            {event.onsite.loadIn ? <div>
              <dt>반입</dt>
              <dd><InfoValue value={event.onsite.loadIn} /></dd>
            </div> : null}
            {event.onsite.loadOut ? <div>
              <dt>철수</dt>
              <dd><InfoValue value={event.onsite.loadOut} /></dd>
            </div> : null}
            {event.onsite.electricity ? <div>
              <dt>전기</dt>
              <dd><InfoValue value={event.onsite.electricity} /></dd>
            </div> : null}
            {event.onsite.wallUse ? <div>
              <dt>벽면 사용</dt>
              <dd><InfoValue value={event.onsite.wallUse} /></dd>
            </div> : null}
            {event.onsite.parking ? <div>
              <dt>주차</dt>
              <dd><InfoValue value={event.onsite.parking} /></dd>
            </div> : null}
            {event.onsite.logistics ? <div>
              <dt>물류 동선</dt>
              <dd><InfoValue value={event.onsite.logistics} /></dd>
            </div> : null}
            {event.onsite.fixtures ? <div>
              <dt>제공 집기</dt>
              <dd><InfoValue value={event.onsite.fixtures} /></dd>
            </div> : null}
          </dl> : <p className="unknown-section-copy">공식 원문에서 확인·검수된 현장 준비 세부정보가 아직 없습니다.</p>}
        </section>
          </div>

          {event.history.length >= 2 ? <section className="history-section" aria-labelledby="history-title">
        <div className="section-line-heading">
          <h2 id="history-title">지난 회차 비교</h2>
          <span>{event.history.length} EDITIONS</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">회차</th>
                <th scope="col">일정</th>
                <th scope="col">장소</th>
                <th scope="col">참가비</th>
                <th scope="col">부스</th>
                <th scope="col">선정</th>
              </tr>
            </thead>
            <tbody>
              {event.history.map((history) => (
                <tr key={history.edition}>
                  <th scope="row">
                    {history.path ? <Link href={history.path}>{history.edition}</Link> : history.edition}
                  </th>
                  <td>{history.dates}</td>
                  <td><InfoValue value={history.venue} /></td>
                  <td>
                    {formatCurrency(
                      history.boothFee,
                      history.boothFeeCurrency ?? event.boothFeeCurrency ?? "KRW",
                    )}
                    {history.previousBoothFee &&
                      history.boothFee !== null &&
                      history.boothFee > history.previousBoothFee && (
                        <small className="fee-change">
                          +{formatCurrency(
                            history.boothFee - history.previousBoothFee,
                            history.boothFeeCurrency ?? event.boothFeeCurrency ?? "KRW",
                          )}
                        </small>
                      )}
                  </td>
                  <td><InfoValue value={history.booths === null ? null : history.booths.toLocaleString("ko-KR")} /></td>
                  <td><InfoValue value={history.selection} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          </section> : null}

          <section className="review-boundary" aria-labelledby="review-title">
        <div className="section-line-heading">
          <h2 id="review-title">참가 후기 참고 경계</h2>
          <span>LOCAL ONLY</span>
        </div>
        <p>
          참가자·판매자 후기는 운영 참고용 로컬 저장소에만 보관하며 이 화면에는
          원문, 작성자, 건수, 평가를 게시하지 않습니다.
        </p>
          </section>
        </div>

        <aside className="detail-side" aria-labelledby="detail-side-title">
          <h2 id="detail-side-title">한눈에</h2>
          <dl>
            <div>
              <dt>{milestone.label}</dt>
              <dd>
                {formatDate(milestone.date, {
                  month: "2-digit",
                  day: "2-digit",
                }, event.timeZone)}
              </dd>
            </div>
            <div>
              <dt>데이터 상태</dt>
              <dd>{eventDataLabel(event, now)}</dd>
            </div>
            <div>
              <dt>부스비</dt>
              <dd>{formatCurrency(event.boothFee, event.boothFeeCurrency ?? "KRW")}</dd>
            </div>
            <div>
              <dt>부스 크기</dt>
              <dd><InfoValue value={event.boothSize} /></dd>
            </div>
            <div>
              <dt>부스 수</dt>
              <dd>{event.boothCount === null ? "정보 없음" : event.boothCount.toLocaleString("ko-KR")}</dd>
            </div>
            <div>
              <dt>사업자</dt>
              <dd>{event.businessRequired === null ? "확인 중" : event.businessRequired ? "필요" : "필수 아님"}</dd>
            </div>
            <div>
              <dt>선정 방식</dt>
              <dd><InfoValue value={event.selection} /></dd>
            </div>
          </dl>
          {(event.boothOptions ?? []).length ? (
            <section className="detail-booth-options" aria-labelledby="booth-options-title">
              <h3 id="booth-options-title">부스 옵션</h3>
              <ul>
                {(event.boothOptions ?? []).map((option) => (
                  <li key={option.id}>
                    <strong>{option.label}</strong>
                    <span>{option.size ?? "규격 확인 필요"}</span>
                    <span>
                      {formatCurrency(option.feeAmount, option.currency ?? "KRW")}
                      {option.vatIncluded === null
                        ? " · VAT 확인 필요"
                        : option.vatIncluded
                          ? " · VAT 포함"
                          : " · VAT 별도"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <BookmarkButton eventId={event.id} className="button button--primary" />
          {event.applicationDeadline ? (
            <a className="button" href={`/events/calendar.ics?event=${encodeURIComponent(event.id)}&kind=deadline`}>
              신청 마감 ICS
            </a>
          ) : null}
          <a className="button" href={`/events/calendar.ics?event=${encodeURIComponent(event.id)}&kind=event`}>
            개최 일정 ICS
          </a>
          <small>
            <Link href="/events/calendar">전체 행사 달력 보기</Link> · 저장한 행사는
            My Binder에서 비교와 일정 작업으로 이어갈 수 있습니다.
          </small>
        </aside>
      </div>
    </article>
  );
}
