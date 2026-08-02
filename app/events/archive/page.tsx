import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "../../components/PageIntro";
import { events } from "../../lib/data.ts";
import { eventPath, formatCurrency } from "../../lib/events.ts";
import type { EventEdition, EventHistory } from "../../lib/types.ts";

export const metadata: Metadata = {
  title: "행사 회차 아카이브",
  description:
    "독립 창작자 행사의 일정, 장소, 참가비, 부스 수와 선정 방식 변화를 회차별로 비교합니다.",
};

type ArchivedEdition = EventHistory & {
  path: string | null;
  current: boolean;
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

function buildEventArchives(source: EventEdition[]): EventArchive[] {
  const grouped = new Map<string, EventEdition[]>();

  for (const event of source) {
    const editions = grouped.get(event.slug) ?? [];
    editions.push(event);
    grouped.set(event.slug, editions);
  }

  return Array.from(grouped.entries())
    .map(([slug, sourceEditions]) => {
      const ordered = sourceEditions.toSorted(
        (left, right) =>
          new Date(right.startDate).getTime() -
          new Date(left.startDate).getTime(),
      );
      const latest = ordered[0];
      const historyByEdition = new Map<string, ArchivedEdition>();

      for (const event of ordered) {
        event.history.forEach((history, index) => {
          const current = index === 0;
          const existing = historyByEdition.get(history.edition);

          if (!existing || (current && !existing.current)) {
            historyByEdition.set(history.edition, {
              ...history,
              path: current ? eventPath(event) : null,
              current,
            });
          }
        });
      }

      return {
        slug,
        name: latest.shortName,
        organizer: latest.organizer,
        region: latest.region,
        verifiedAt: latest.verifiedAt,
        latestPath: eventPath(latest),
        editions: Array.from(historyByEdition.values()),
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

      <section aria-labelledby="archive-list-title">
        <div className="section-line-heading">
          <h2 id="archive-list-title">행사별 누적 기록</h2>
          <span>
            {archives.length} SERIES · {editionCount} EDITIONS
          </span>
        </div>

        {archives.map((archive) => (
          <section
            className="history-section"
            key={archive.slug}
            aria-labelledby={`archive-${archive.slug}`}
          >
            <div className="section-line-heading">
              <h2 id={`archive-${archive.slug}`}>{archive.name}</h2>
              <Link href={archive.latestPath}>최신 회차 보기</Link>
            </div>
            <p>
              {archive.organizer} · {archive.region} · {archive.verifiedAt} 확인
            </p>
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
                  {archive.editions.map((edition) => (
                    <tr key={edition.edition}>
                      <th scope="row">
                        {edition.path ? (
                          <Link href={edition.path}>{edition.edition}</Link>
                        ) : (
                          edition.edition
                        )}
                      </th>
                      <td>{edition.dates}</td>
                      <td>{edition.venue}</td>
                      <td>{formatCurrency(edition.boothFee)}</td>
                      <td>{edition.booths.toLocaleString("ko-KR")}</td>
                      <td>{edition.selection}</td>
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
