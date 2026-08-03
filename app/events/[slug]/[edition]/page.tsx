import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookmarkButton } from "../../../components/BookmarkButton";
import { DDay } from "../../../components/DDay";
import { StatusStamp } from "../../../components/StatusStamp";
import { events } from "../../../lib/data.ts";
import {
  deriveEventStatus,
  formatCurrency,
  formatDate,
  formatDateRange,
  getEventByPath,
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

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    startDate: event.startDate,
    endDate: event.endDate,
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: event.venue,
      address: event.address,
    },
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
            {event.region} {event.venue} · {formatDateRange(event)}
          </p>
        </div>
        <div className="detail-dday">
          <DDay days={milestone.days} label={`${event.shortName} ${milestone.label}`} />
          <span className="detail-dday__label">{milestone.label}까지</span>
        </div>
      </header>

      <aside className="origin-bar">
        <strong>공식 정보 원본</strong>
        <a href={event.sourceUrl} target="_blank" rel="noreferrer">
          {event.sourceLabel} 확인 ↗
        </a>
        <span>
          {event.verifiedAt} 확인 · 공식 출처 {event.sourceCount ?? 1}건을 연결했습니다.
          신청 전 반드시 회차 원문을 확인하세요.
        </span>
      </aside>

      <div className="detail-body-grid">
        <div className="event-detail-main">
          <div className="detail-columns">
        <section className="lined-section" aria-labelledby="application-title">
          <div className="section-line-heading">
            <h2 id="application-title">신청 준비</h2>
            <span>BEFORE APPLY</span>
          </div>
          <dl className="definition-list">
            <div>
              <dt>필요 자료</dt>
              <dd>
                <ul>
                  {event.application.documents.map((document) => (
                    <li key={document}>{document}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt>재판매 기준</dt>
              <dd><InfoValue value={event.application.resalePolicy} /></dd>
            </div>
            <div>
              <dt>환불 기준</dt>
              <dd><InfoValue value={event.application.refundPolicy} /></dd>
            </div>
            <div>
              <dt>메모</dt>
              <dd><InfoValue value={event.application.note} /></dd>
            </div>
          </dl>
        </section>

        <section className="lined-section" aria-labelledby="onsite-title">
          <div className="section-line-heading">
            <h2 id="onsite-title">현장 준비</h2>
            <span>ON SITE</span>
          </div>
          <dl className="definition-list">
            <div>
              <dt>반입</dt>
              <dd><InfoValue value={event.onsite.loadIn} /></dd>
            </div>
            <div>
              <dt>철수</dt>
              <dd><InfoValue value={event.onsite.loadOut} /></dd>
            </div>
            <div>
              <dt>전기</dt>
              <dd><InfoValue value={event.onsite.electricity} /></dd>
            </div>
            <div>
              <dt>벽면 사용</dt>
              <dd><InfoValue value={event.onsite.wallUse} /></dd>
            </div>
            <div>
              <dt>주차</dt>
              <dd><InfoValue value={event.onsite.parking} /></dd>
            </div>
            <div>
              <dt>물류 동선</dt>
              <dd><InfoValue value={event.onsite.logistics} /></dd>
            </div>
            <div>
              <dt>제공 집기</dt>
              <dd><InfoValue value={event.onsite.fixtures} /></dd>
            </div>
          </dl>
        </section>
          </div>

          <section className="history-section" aria-labelledby="history-title">
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
                  <th scope="row">{history.edition}</th>
                  <td>{history.dates}</td>
                  <td>{history.venue}</td>
                  <td>
                    {formatCurrency(history.boothFee)}
                    {history.previousBoothFee &&
                      history.boothFee > history.previousBoothFee && (
                        <small className="fee-change">
                          +{formatCurrency(history.boothFee - history.previousBoothFee)}
                        </small>
                      )}
                  </td>
                  <td><InfoValue value={history.booths === null ? null : history.booths.toLocaleString("ko-KR")} /></td>
                  <td>{history.selection}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          </section>

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
                })}
              </dd>
            </div>
            <div>
              <dt>부스비</dt>
              <dd>{formatCurrency(event.boothFee)}</dd>
            </div>
            <div>
              <dt>부스 크기</dt>
              <dd>{event.boothSize}</dd>
            </div>
            <div>
              <dt>사업자</dt>
              <dd>{event.businessRequired === null ? "확인 중" : event.businessRequired ? "필요" : "필수 아님"}</dd>
            </div>
            <div>
              <dt>선정 방식</dt>
              <dd>{event.selection}</dd>
            </div>
          </dl>
          <BookmarkButton eventId={event.id} className="button button--primary" />
          <a className="button" href="/events/calendar.ics">
            캘린더에 추가
          </a>
          <small>
            이 버튼은 먼저 이 기기의 브라우저에 저장합니다. 로그인한 뒤
            My Binder에서 직접 실행하면 계정 Binder와 중복 없이 합칠 수 있습니다.
          </small>
        </aside>
      </div>
    </article>
  );
}
