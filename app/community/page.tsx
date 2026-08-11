import type { Metadata } from "next";
import Link from "next/link";

import { CommunityBoardNav } from "../components/CommunityBoardNav";
import { CommunityPostList } from "../components/CommunityPostList";
import { PageIntro } from "../components/PageIntro";
import { communityBoards, communityPosts } from "../lib/community";
import {
  createSupabaseCommunityRepository,
  durableCommunityPostToView,
} from "../lib/server/community/posts.ts";
import { getSupabasePublicConfig } from "../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "문구작가 커뮤니티",
  description:
    "작가 인증 게시판과 모두의 게시판을 분리한 정보 우선 문구작가 자유게시판입니다.",
};

export default async function CommunityPage() {
  const config = getSupabasePublicConfig();
  const liveMode = config.status === "configured";
  let loadError = false;
  let latestPosts = liveMode
    ? []
    : [...communityPosts]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 3);

  if (liveMode) {
    try {
      const client = await createSupabaseServerClient(config);
      const durablePosts = await createSupabaseCommunityRepository(client!).listPosts({
        boardId: "general",
        limit: 3,
      });
      latestPosts = durablePosts.map(durableCommunityPostToView);
    } catch {
      loadError = true;
    }
  }

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="INDEX 05 / COMMUNITY"
        title="문구작가 커뮤니티"
        description="두 게시판의 공개 범위와 작성 자격을 나눕니다."
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

      <section
        className="community-post-ledger"
        aria-labelledby="community-latest-title"
      >
        <div className="section-line-heading">
          <h2 id="community-latest-title">모두의 게시판 최근 정보</h2>
          <Link href="/community/general">전체 글 보기</Link>
        </div>
        {loadError ? (
          <div className="empty-state" role="status">
            <p>최근 공개 글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
            <Link className="text-action" href="/community">
              다시 시도
            </Link>
          </div>
        ) : latestPosts.length > 0 ? (
          <CommunityPostList posts={latestPosts} mode={liveMode ? "live" : "example"} />
        ) : (
          <div className="empty-state">
            <p>아직 공개된 모두의 게시판 글이 없습니다.</p>
            <Link className="text-action" href="/community/write?board=general">
              첫 글 작성하기
            </Link>
          </div>
        )}
      </section>

      {!liveMode ? (
        <aside className="boundary-note community-boundary">
          <p className="stamp">현재 범위</p>
          <div>
            <h2>현재 글은 예시입니다.</h2>
            <p>공개 게시와 신고는 아직 연결되지 않았습니다.</p>
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
      ) : null}
    </div>
  );
}
