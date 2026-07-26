import type { Metadata } from "next";
import Link from "next/link";

import { AdSlot } from "../components/AdSlot";
import { CommunityBoardNav } from "../components/CommunityBoardNav";
import { CommunityPostList } from "../components/CommunityPostList";
import { PageIntro } from "../components/PageIntro";
import { communityBoards, communityPosts } from "../lib/community";

export const metadata: Metadata = {
  title: "문구작가 커뮤니티",
  description:
    "작가 인증 게시판과 모두의 게시판을 분리한 정보 우선 문구작가 자유게시판입니다.",
};

export default function CommunityPage() {
  const latestPosts = [...communityPosts]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 3);

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="INDEX 05 / COMMUNITY"
        title="문구작가 커뮤니티"
        description="자유롭게 묻고 답하되, 다음 사람이 다시 찾을 수 있는 정보가 먼저 보이게 정리합니다. 작가 인증 여부에 따라 두 게시판의 읽기·쓰기 경계를 분리합니다."
      />

      <CommunityBoardNav />

      <section
        className="community-board-index"
        aria-labelledby="community-board-index-title"
      >
        <div className="section-line-heading">
          <h2 id="community-board-index-title">게시판 선택</h2>
          <span>2 BOARDS</span>
        </div>
        <div className="community-board-index__rows">
          {communityBoards.map((board, index) => (
            <article key={board.id}>
              <span className="community-board-index__number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="community-board-index__audience">
                  {board.audienceLabel}
                </p>
                <h3>{board.title}</h3>
                <p>{board.description}</p>
                <small>{board.purpose}</small>
              </div>
              <Link className="button" href={board.path}>
                {board.shortTitle} 열기
              </Link>
            </article>
          ))}
        </div>
      </section>

      <AdSlot placement="community-hub" />

      <section
        className="community-principles"
        aria-labelledby="community-principles-title"
      >
        <div className="section-line-heading">
          <h2 id="community-principles-title">정보가 먼저 보이는 방식</h2>
          <span>INFORMATION FIRST</span>
        </div>
        <ol>
          <li>
            <strong>실무 분류</strong>
            <span>행사, 제작, 원가, 사업, 저작권, 배송을 먼저 찾습니다.</span>
          </li>
          <li>
            <strong>상태 표시</strong>
            <span>답변 대기, 해결, 최신 확인 필요를 글마다 구분합니다.</span>
          </li>
          <li>
            <strong>출처 맥락</strong>
            <span>사실 정보는 원문과 확인 날짜를 함께 남기는 방향입니다.</span>
          </li>
        </ol>
      </section>

      <section
        className="community-post-ledger"
        aria-labelledby="community-latest-title"
      >
        <div className="section-line-heading">
          <h2 id="community-latest-title">모두의 게시판 최근 정보</h2>
          <Link href="/community/general">전체 글 보기</Link>
        </div>
        <CommunityPostList posts={latestPosts} />
      </section>

      <aside className="boundary-note community-boundary">
        <p className="stamp">현재 범위</p>
        <div>
          <h2>화면 구조와 예시 글을 검증하는 단계입니다.</h2>
          <p>
            공개된 글은 실제 회원 게시물이 아닙니다. 작가 인증, 공개 게시,
            신고 접수는 서버 계정과 운영 체계가 연결된 뒤 제공하며, 이
            버전에서는 인증된 것처럼 보이는 우회 기능을 만들지 않습니다.
          </p>
          <div className="inline-actions">
            <Link className="text-action" href="/community/rules">
              운영·신고 기준 보기
            </Link>
            <Link className="text-action" href="/community/verify">
              작가 인증 기준 보기
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
