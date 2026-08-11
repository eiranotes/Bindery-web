import type { Metadata } from "next";
import Link from "next/link";

import { notes } from "../lib/data";
import {
  createSupabaseKnowledgeRepository,
  type PromotedCommunityNote,
} from "../lib/server/community/knowledge.ts";
import { getSupabasePublicConfig } from "../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "실무 노트 | Bindery",
  description:
    "문구 작가의 사업자·세금, 해외배송·통관, 제작·발주, 행사 운영, 가격·원가 실무를 공식 출처와 날짜로 정리한 노트.",
};

function formatEditorialDate(value: string): string {
  return value.split("-").join(".");
}

export default async function NotesPage() {
  const sortedNotes = notes.toSorted((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  const officialGuides = sortedNotes.filter(
    (note) => note.guideType === "official-guide",
  );
  const editorialNotes = sortedNotes.filter(
    (note) => note.guideType !== "official-guide",
  );
  const config = getSupabasePublicConfig();
  let promotedNotes: PromotedCommunityNote[] = [];
  let promotedLoadError = false;
  if (config.status === "configured") {
    try {
      const client = await createSupabaseServerClient(config);
      promotedNotes = await createSupabaseKnowledgeRepository(
        client!,
      ).listPromotedNotes();
    } catch {
      promotedLoadError = true;
    }
  }

  return (
    <div className="page-shell content-page">
      <header className="page-intro">
        <p className="eyebrow">NOTES · 실무 기록</p>
        <h1>필요할 때 다시 펴보는 실무 노트</h1>
        <p className="page-lede">
          신고, 세금, 해외 통관, 인쇄와 원가 기준을 공식 원문과 확인 날짜까지
          함께 살펴봅니다.
        </p>
      </header>

      <section
        className="creator-guide-ledger"
        aria-labelledby="official-guides-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">OFFICIAL SOURCE GUIDE</p>
            <h2 id="official-guides-title">지금 먼저 확인할 운영 안내</h2>
          </div>
          <p className="utility-text">{officialGuides.length}개 가이드</p>
        </div>

        <ol>
          {officialGuides.map((note, index) => (
            <li key={note.slug}>
              <article>
                <span className="guide-ledger__number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="guide-ledger__copy">
                  <div className="note-meta">
                    <span>{note.category}</span>
                    <span>공식 출처 {note.sources?.length ?? 0}건</span>
                    <span>
                      확인 {formatEditorialDate(note.sourceCheckedAt ?? note.updatedAt)}
                    </span>
                  </div>
                  <h3>
                    <Link href={`/notes/${note.slug}`}>{note.title}</Link>
                  </h3>
                  <p>{note.summary}</p>
                </div>
                <dl className="guide-ledger__facts">
                  {note.facts?.slice(0, 2).map((fact) => (
                    <div key={fact.label}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
                <Link
                  className="text-action"
                  href={`/notes/${note.slug}`}
                  aria-label={`${note.title} 읽기`}
                >
                  가이드 펼치기
                </Link>
              </article>
            </li>
          ))}
        </ol>
      </section>

      <section className="content-ledger" aria-labelledby="notes-list-title">
        <div className="section-heading">
          <h2 id="notes-list-title">제작·현장·원가 노트</h2>
          <p className="utility-text">{editorialNotes.length}권</p>
        </div>

        <ol className="note-list">
          {editorialNotes.map((note, index) => (
            <li className="note-list-item" key={note.slug}>
              <article>
                <div className="note-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="note-copy">
                  <div className="note-meta">
                    <span>{note.category}</span>
                    <span>
                      업데이트{" "}
                      <time dateTime={note.updatedAt}>
                        {formatEditorialDate(note.updatedAt)}
                      </time>
                    </span>
                    <span>{note.readMinutes}분</span>
                  </div>
                  <h3>
                    <Link href={`/notes/${note.slug}`}>{note.title}</Link>
                  </h3>
                  <p>{note.summary}</p>
                  <ul className="tag-list" aria-label="주제">
                    {note.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                  {note.isStale ? (
                    <p className="inline-notice inline-notice--stale">
                      업데이트가 필요한 노트 · 마지막 확인{" "}
                      <time dateTime={note.updatedAt}>
                        {formatEditorialDate(note.updatedAt)}
                      </time>
                    </p>
                  ) : null}
                </div>
                <Link
                  className="text-action"
                  href={`/notes/${note.slug}`}
                  aria-label={`${note.title} 읽기`}
                >
                  노트 펼치기
                </Link>
              </article>
            </li>
          ))}
        </ol>
      </section>

      {config.status === "configured" ? (
        <section className="content-ledger" aria-labelledby="promoted-notes-title">
          <div className="section-heading">
            <h2 id="promoted-notes-title">커뮤니티에서 정리한 노트</h2>
            <p className="utility-text">{promotedNotes.length}권</p>
          </div>
          {promotedLoadError ? (
            <p className="inline-notice">승격된 노트를 불러오지 못했습니다.</p>
          ) : promotedNotes.length === 0 ? (
            <p className="inline-notice">아직 커뮤니티에서 승격된 노트가 없습니다.</p>
          ) : (
            <ol className="note-list">
              {promotedNotes.map((note, index) => (
                <li className="note-list-item" key={note.id}>
                  <article>
                    <div className="note-index" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="note-copy">
                      <div className="note-meta">
                        <span>커뮤니티 승격</span>
                        <span>원문 확인 {formatEditorialDate(note.sourceCheckedAt)}</span>
                      </div>
                      <h3><Link href={`/notes/${note.slug}`}>{note.title}</Link></h3>
                      <p>{note.summary}</p>
                      <p className="utility-text">원 작성자 {note.sourceAuthorName}</p>
                    </div>
                    <Link className="text-action" href={`/notes/${note.slug}`}>노트 펼치기</Link>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      <aside className="trust-notice" aria-label="노트 이용 안내">
        <p className="utility-text">READING NOTE</p>
        <p>
          공식 출처 가이드도 개인의 세액이나 통관 결과를 대신 확정하지
          않습니다. 적용 조건과 확인 날짜를 본 뒤 연결된 기관·세무서·세관에
          최신 기준을 다시 확인하세요.
        </p>
      </aside>
    </div>
  );
}
