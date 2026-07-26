import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "../components/PageIntro";
import { communityRecords, events } from "../lib/data";
import { eventPath } from "../lib/events";
import type { CommunityRecordKind } from "../lib/types";

export const metadata: Metadata = {
  title: "행사 커뮤니티",
  description:
    "행사별 준비 질문, 현장 팁, 후기 집계를 운영자 검수 기록으로 확인합니다.",
};

type CommunityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const recordKinds: CommunityRecordKind[] = [
  "준비 질문",
  "현장 팁",
  "후기 집계",
];

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function singleValue(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00+09:00`));
}

export default async function CommunityPage({
  searchParams,
}: CommunityPageProps) {
  const query = await searchParams;
  const requestedEvent = singleValue(query.event);
  const requestedKind = singleValue(query.kind);
  const selectedEvent = events.find((event) => event.id === requestedEvent);
  const selectedKind = recordKinds.find((kind) => kind === requestedKind);
  const filteredRecords = communityRecords.filter((record) => {
    if (selectedEvent && record.eventId !== selectedEvent.id) {
      return false;
    }

    return !selectedKind || record.kind === selectedKind;
  });

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="INDEX 05 / COMMUNITY"
        title="행사 커뮤니티"
        description="행사 단위로 반복되는 준비 질문과 현장 팁을 검수해 쌓습니다. 흘러가는 대화보다 다음 참가자가 다시 찾을 수 있는 기록을 우선합니다."
      />

      <aside
        className="boundary-note community-boundary"
        aria-labelledby="community-boundary"
      >
        <p className="stamp">운영 원칙</p>
        <div>
          <h2 id="community-boundary">자유게시판이 아닙니다.</h2>
          <p>
            직접 게시·DM·거래 기능 없이 운영자가 질문과 현장 기록을 검수해
            정리합니다. 개인 간 연락, 결제, 중개, 검증되지 않은 원문 후기는
            제공하지 않습니다.
          </p>
        </div>
      </aside>

      <section
        className="filter-sheet community-filter"
        aria-labelledby="community-filter-title"
      >
        <div className="section-line-heading">
          <h2 id="community-filter-title">기록 좁히기</h2>
          <span>{filteredRecords.length} RECORDS</span>
        </div>
        <form action="/community" method="get">
          <label>
            행사
            <select
              name="event"
              defaultValue={selectedEvent?.id ?? "전체"}
            >
              <option value="전체">전체 행사</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            기록 종류
            <select name="kind" defaultValue={selectedKind ?? "전체"}>
              <option value="전체">전체 종류</option>
              {recordKinds.map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </label>
          <div className="filter-actions">
            <button className="button button--primary" type="submit">
              적용하기
            </button>
            <Link className="text-action" href="/community">
              필터 초기화
            </Link>
          </div>
        </form>
      </section>

      <section className="community-ledger" aria-labelledby="community-record-title">
        <div className="section-line-heading">
          <h2 id="community-record-title">
            {selectedEvent?.name ?? "전체 행사"} · {selectedKind ?? "전체 기록"}
          </h2>
          <span>EVENT CONTEXT FIRST</span>
        </div>

        {filteredRecords.length ? (
          <ol>
            {filteredRecords.map((record, index) => {
              const event = events.find((item) => item.id === record.eventId);

              if (!event) {
                return null;
              }

              return (
                <li key={record.id}>
                  <span className="community-record__number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <article className="community-record">
                    <header>
                      <div className="community-record__meta">
                        <span className="status-stamp">{record.kind}</span>
                        <span>{record.moderation}</span>
                        <time dateTime={record.updatedAt}>
                          {formatDate(record.updatedAt)}
                        </time>
                      </div>
                      <h3>{record.title}</h3>
                      <p>{record.summary}</p>
                    </header>
                    <div className="community-record__answer">
                      <strong>정리된 답변</strong>
                      <p>{record.answer}</p>
                    </div>
                    <footer>
                      <Link href={eventPath(event)}>{event.name} 정보 보기</Link>
                      <ul aria-label="기록 태그">
                        {record.tags.map((tag) => (
                          <li key={tag}>#{tag}</li>
                        ))}
                      </ul>
                    </footer>
                  </article>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="empty-state">
            <p>이 조건에 맞는 검수 기록이 없습니다.</p>
            <Link className="text-action" href="/community">
              모든 기록 다시 보기
            </Link>
          </div>
        )}
      </section>

      <aside className="source-notice">
        <strong>기록 경계</strong>
        <p>
          현재 항목은 제품 구조를 검증하기 위한 예시 기록입니다. 신청 조건과
          현장 동선은 바뀔 수 있으므로 연결된 행사 정보의 공식 원문과 확인
          날짜를 함께 보세요.
        </p>
      </aside>
    </div>
  );
}
