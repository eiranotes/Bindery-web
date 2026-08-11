import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "../../components/PageIntro";
import { events } from "../../lib/data.ts";
import { deriveEventStatus, eventPath, formatCurrency, formatDateRange } from "../../lib/events.ts";
import type { EventEdition } from "../../lib/types.ts";
import styles from "../event-tools.module.css";

export const metadata: Metadata = {
  title: "행사 회차 아카이브",
  description:
    "독립 창작자 행사의 일정, 장소, 참가비, 부스 수와 선정 방식 변화를 회차별로 비교합니다.",
};

type ArchivedEdition = {
  id: string;
  edition: string;
  dates: string;
  venue: string | null;
  boothFee: number | null;
  boothFeeCurrency: string | null;
  booths: number | null;
  selection: string | null;
  path: string;
  current: boolean;
  currentLabel: "현재 회차" | "최근 회차";
};

type EventArchive = {
  slug: string;
  name: string;
  organizer: string;
  region: string;
  verifiedAt: string;
  latestPath: string;
  editions: ArchivedEdition[];
};

function buildEventArchives(source: EventEdition[], now = new Date()): EventArchive[] {
  const grouped = new Map<string, EventEdition[]>();

  for (const event of source) {
    const key = event.masterId ?? event.slug;
    const editions = grouped.get(key) ?? [];
    editions.push(event);
    grouped.set(key, editions);
  }

  return Array.from(grouped.entries())
    .filter(([, sourceEditions]) => sourceEditions.length >= 2)
    .map(([masterId, sourceEditions]) => {
      const ordered = sourceEditions.toSorted(
        (left, right) =>
          new Date(right.startDate).getTime() -
          new Date(left.startDate).getTime(),
      );
      const active = ordered
        .filter((event) => deriveEventStatus(event, now) !== "ended")
        .toSorted(
          (left, right) =>
            new Date(left.startDate).getTime() - new Date(right.startDate).getTime(),
        );
      const current = active[0] ?? ordered[0];
      const currentLabel: ArchivedEdition["currentLabel"] = active.length
        ? "현재 회차"
        : "최근 회차";

      return {
        slug: masterId,
        name: current.shortName,
        organizer: current.organizer,
        region: current.region,
        verifiedAt: current.verifiedAt,
        latestPath: eventPath(current),
        editions: ordered.map((event) => ({
          id: event.id,
          edition: event.name,
          dates: formatDateRange(event),
          venue: event.venue,
          boothFee: event.boothFee,
          boothFeeCurrency: event.boothFeeCurrency,
          booths: event.boothCount,
          selection: event.selection,
          path: eventPath(event),
          current: event.id === current.id,
          currentLabel,
        })),
      };
    })
    .toSorted((left, right) => left.name.localeCompare(right.name, "ko-KR"));
}

export default function EventArchivePage() {
  const archives = buildEventArchives(events);
  const editionCount = archives.reduce(
    (total, archive) => total + archive.editions.length,
    0,
  );

  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="EVENTS / EDITION ARCHIVE"
        title="행사 회차 아카이브"
        description="행사별 일정·장소·참가비와 선정 방식의 변화를 누적합니다."
      >
        <div className="intro-actions">
          <Link className="button button--primary" href="/events/compare">
            행사 비교하기
          </Link>
          <Link className="button" href="/events">
            현재 행사 보기
          </Link>
        </div>
      </PageIntro>

      <aside className="source-notice">
        <strong>아카이브 기준</strong>
        <p>
          현재 데이터에 포함된 회차 이력을 행사별로 묶었습니다. 신청과 비용을
          결정하기 전에는 최신 회차 상세의 공식 원문과 확인 날짜를 다시
          확인하세요.
        </p>
      </aside>

      <nav className={styles.archiveIndex} aria-labelledby="archive-index-title">
        <div className="section-line-heading">
          <h2 id="archive-index-title">행사 바로가기</h2>
          <span>{archives.length} SERIES</span>
        </div>
        <ol>
          {archives.map((archive, index) => (
            <li key={archive.slug}>
              <a href={`#archive-${archive.slug}`}>
                <span className={styles.archiveNumber}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{archive.name}</strong>
                <span className={styles.archiveMeta}>
                  {archive.editions.length}회차 · {archive.verifiedAt} 확인
                </span>
                <span className={styles.archiveArrow} aria-hidden="true">
                  ↓
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section aria-labelledby="archive-list-title">
        <div className="section-line-heading">
          <h2 id="archive-list-title">행사별 누적 기록</h2>
          <span>
            {archives.length} SERIES · {editionCount} EDITIONS
          </span>
        </div>
        <p className={styles.scrollHint} data-ui="event-scroll-hint">
          모바일에서는 각 회차 표를 좌우로 밀어 장소·부스·선정 정보를
          확인하세요.
        </p>

        {archives.map((archive) => (
          <section
            className={`history-section ${styles.archiveSection}`}
            id={`archive-${archive.slug}`}
            key={archive.slug}
            aria-labelledby={`archive-title-${archive.slug}`}
          >
            <div className="section-line-heading">
              <h2 id={`archive-title-${archive.slug}`}>{archive.name}</h2>
              <Link href={archive.latestPath}>기준 회차 보기</Link>
            </div>
            <p>
              {archive.organizer} · {archive.region} · {archive.verifiedAt} 확인
            </p>
            <div
              aria-label={`${archive.name} 회차 비교표`}
              className={`table-scroll ${styles.scrollRegion}`}
              data-ui="event-data-scroll"
              role="region"
              tabIndex={0}
            >
              <table className={styles.archiveTable}>
                <caption className="sr-only">
                  {archive.name}의 회차별 일정, 장소, 참가비, 부스 수와 선정 방식
                </caption>
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
                  {archive.editions.map((edition) => (
                    <tr key={edition.edition}>
                      <th scope="row">
                        <Link href={edition.path}>{edition.edition}</Link>
                        {edition.current ? (
                          <span className={styles.currentEdition}>{edition.currentLabel}</span>
                        ) : null}
                      </th>
                      <td>{edition.dates}</td>
                      <td>{edition.venue ?? "정보 없음"}</td>
                      <td>
                        {formatCurrency(
                          edition.boothFee,
                          edition.boothFeeCurrency ?? "KRW",
                        )}
                      </td>
                      <td>
                        {edition.booths === null
                          ? "정보 없음"
                          : edition.booths.toLocaleString("ko-KR")}
                      </td>
                      <td>{edition.selection ?? "정보 없음"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </section>
    </div>
  );
}
