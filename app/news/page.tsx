import type { Metadata } from "next";

import { newsItems } from "../lib/data";

export const metadata: Metadata = {
  title: "행사 변경 기록 | Bindery",
  description:
    "행사 참가 조건과 운영에 영향을 주는 공식 원문 변경 기록.",
};

function formatEditorialDate(value: string): string {
  return value.split("-").join(".");
}

export default function NewsPage() {
  const sortedNews = newsItems.toSorted((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt),
  );
  const latestDate = sortedNews.at(0)?.publishedAt;

  return (
    <div className="page-shell content-page">
      <header className="page-intro">
        <p className="eyebrow">SOURCE UPDATE · 변경 기록</p>
        <h1>행사 변경 기록</h1>
        <p className="page-lede">
          저장하거나 검토 중인 행사 판단에 영향을 주는 공식 공지만 원문과
          함께 정리합니다.
        </p>
        {latestDate ? (
          <p className="utility-text">
            마지막 정리{" "}
            <time dateTime={latestDate}>
              {formatEditorialDate(latestDate)}
            </time>
          </p>
        ) : null}
      </header>

      <section className="news-ledger" aria-labelledby="news-list-title">
        <div className="section-heading">
          <h2 id="news-list-title">최근 업데이트</h2>
          <p className="utility-text">{sortedNews.length}건</p>
        </div>

        <ol className="news-timeline">
          {sortedNews.map((item) => (
            <li key={item.id}>
              <article className="news-entry">
                <div className="news-date">
                  <time dateTime={item.publishedAt}>
                    {formatEditorialDate(item.publishedAt)}
                  </time>
                </div>
                <div className="news-copy">
                  <p className="eyebrow">{item.category}</p>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                </div>
                <a
                  className="text-action"
                  href={item.sourceUrl}
                  rel="noreferrer"
                >
                  {item.source} 원문 확인
                </a>
              </article>
            </li>
          ))}
        </ol>
      </section>

      <aside className="trust-notice" aria-label="변경 기록 출처 안내">
        <p className="utility-text">SOURCE FIRST</p>
        <p>
          독립 업계 뉴스가 아니라 행사 조건의 공식 변경 확인 지점을
          기록합니다. 신청, 비용, 일정에 관한 최종 판단은 연결된 공식
          원문에서 확인하세요.
        </p>
      </aside>
    </div>
  );
}
