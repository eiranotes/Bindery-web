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
    "문구 작가의 사업자·세금, 제작·발주, 행사 운영, 가격·원가 실무를 날짜와 함께 정리한 노트.",
};

function formatEditorialDate(value: string): string {
  return value.split("-").join(".");
}

export default async function NotesPage() {
  const sortedNotes = notes.toSorted((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
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
          신고, 인쇄, 원가, 현장 운영 기준을 업데이트 날짜와 함께 확인합니다.
        </p>
      </header>

      <section className="content-ledger" aria-labelledby="notes-list-title">
        <div className="section-heading">
          <h2 id="notes-list-title">노트 목록</h2>
          <p className="utility-text">{sortedNotes.length}권</p>
        </div>

        <ol className="note-list">
          {sortedNotes.map((note, index) => (
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
          실무 노트는 확인 과정을 돕는 참고 자료입니다. 법률·세무 판단이나
          업체별 발주 조건은 연결된 기관과 담당자에게 최신 기준을 다시
          확인하세요.
        </p>
      </aside>
    </div>
  );
}
