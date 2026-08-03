import type { Metadata } from "next";

import { newsItems } from "../lib/data";

export const metadata: Metadata = {
  title: "업계 소식 | Bindery",
  description:
    "행사 주최 측과 전시장, 창작자 지원 기관의 원문으로 이어지는 짧은 업데이트 타임라인.",
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
        <p className="eyebrow">NEWS · 원문 색인</p>
        <h1>업계 소식</h1>
        <p className="page-lede">
          참가 조건과 현장 운영에 영향을 주는 공지를 원문과 함께 정리합니다.
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

      <aside className="trust-notice" aria-label="뉴스 출처 안내">
        <p className="utility-text">SOURCE FIRST</p>
        <p>
          Bindery는 소식의 핵심 확인 지점만 정리합니다. 신청, 비용, 일정에
          관한 최종 판단은 연결된 공식 원문에서 확인하세요.
        </p>
      </aside>
    </div>
  );
}
