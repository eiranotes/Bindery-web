import type { Metadata } from "next";
import Link from "next/link";

import { CommunityBoardNav } from "../../components/CommunityBoardNav";
import { CommunityComposer } from "../../components/CommunityComposer";
import { PageIntro } from "../../components/PageIntro";

export const metadata: Metadata = {
  title: "커뮤니티 글 작성",
  description:
    "모두의 게시판 글을 이 기기에 임시저장하는 게시글 작성 화면입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

type CommunityWritePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommunityWritePage({
  searchParams,
}: CommunityWritePageProps) {
  const query = await searchParams;
  const selectedBoard = query.board === "artists" ? "artists" : "general";

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="COMMUNITY / WRITE"
        title={selectedBoard === "artists" ? "작가 게시판 글 작성" : "모두의 게시판 글 작성"}
        description="정보 분류와 출처 맥락을 먼저 적는 글쓰기 화면입니다. 현재 버전은 공개 게시 대신 기기 임시저장만 제공합니다."
      />

      <CommunityBoardNav current={selectedBoard} />

      {selectedBoard === "artists" ? (
        <section className="community-lock" aria-labelledby="artist-write-lock">
          <p className="status-stamp">작성 잠금</p>
          <div>
            <h2 id="artist-write-lock">작가 인증 세션이 있어야 작성할 수 있습니다.</h2>
            <p>
              브라우저 값이나 URL만으로 인증을 흉내 내지 않습니다. 서버 인증이
              연결되기 전에는 작가 게시판 작성 폼도 열지 않습니다.
            </p>
            <div className="intro-actions">
              <Link className="button button--primary" href="/community/verify">
                작가 인증 기준 확인
              </Link>
              <Link className="button" href="/community/write?board=general">
                모두의 게시판 글 작성
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section
          className="community-write-sheet"
          aria-labelledby="community-write-title"
        >
          <div className="section-line-heading">
            <h2 id="community-write-title">글 내용</h2>
            <span>DEVICE-LOCAL DRAFT</span>
          </div>
          <CommunityComposer />
        </section>
      )}
    </div>
  );
}
