import type { Metadata } from "next";
import Link from "next/link";

import { AdSlot } from "../../components/AdSlot";
import { CommunityBoardNav } from "../../components/CommunityBoardNav";
import { CommunityPostList } from "../../components/CommunityPostList";
import { PageIntro } from "../../components/PageIntro";
import {
  COMMUNITY_CATEGORY_CATALOG,
  filterCommunityPosts,
  getCommunityCategory,
} from "../../lib/community";

export const metadata: Metadata = {
  title: "모두의 게시판",
  description:
    "문구 작가, 예비 작가, 문구를 좋아하는 사람이 함께 정보를 묻고 답하는 자유게시판입니다.",
};

type GeneralCommunityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

export default async function GeneralCommunityPage({
  searchParams,
}: GeneralCommunityPageProps) {
  const query = await searchParams;
  const requestedCategory = singleValue(query.category);
  const selectedCategory = getCommunityCategory(requestedCategory);
  const order = singleValue(query.order) === "latest" ? "latest" : "helpful";
  const posts = filterCommunityPosts({
    categoryId: selectedCategory?.id,
    order,
  });
  const leadingPosts = posts.slice(0, 3);
  const trailingPosts = posts.slice(3);

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="COMMUNITY / OPEN BOARD"
        title="모두의 게시판"
        description="작가 인증 여부와 관계없이 읽을 수 있는 자유게시판입니다. 실무 정보와 해결된 질문을 먼저 찾고, 자유 대화는 별도 분류로 구분합니다."
      >
        <div className="intro-actions">
          <Link
            className="button button--primary"
            href="/community/write?board=general"
          >
            글 작성 화면 열기
          </Link>
          <Link className="button" href="/community/rules">
            운영·신고 기준
          </Link>
        </div>
      </PageIntro>

      <CommunityBoardNav current="general" />

      <section
        className="filter-sheet community-filter"
        aria-labelledby="general-community-filter"
      >
        <div className="section-line-heading">
          <h2 id="general-community-filter">정보 좁히기</h2>
          <span>{posts.length} POSTS</span>
        </div>
        <form action="/community/general" method="get">
          <label>
            분류
            <select
              name="category"
              defaultValue={selectedCategory?.id ?? "all"}
            >
              <option value="all">전체 분류</option>
              {COMMUNITY_CATEGORY_CATALOG.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            정렬
            <select name="order" defaultValue={order}>
              <option value="helpful">도움 많은 순</option>
              <option value="latest">최근 수정 순</option>
            </select>
          </label>
          <div className="filter-actions">
            <button className="button button--primary" type="submit">
              적용하기
            </button>
            <Link className="text-action" href="/community/general">
              필터 초기화
            </Link>
          </div>
        </form>
      </section>

      <section
        className="community-post-ledger"
        aria-labelledby="general-post-list-title"
      >
        <div className="section-line-heading">
          <h2 id="general-post-list-title">
            {selectedCategory?.label ?? "전체 정보"} ·{" "}
            {order === "helpful" ? "도움 많은 순" : "최근 수정 순"}
          </h2>
          <span>EXAMPLE CONTENT</span>
        </div>
        {posts.length ? (
          <>
            <CommunityPostList posts={leadingPosts} />
            {trailingPosts.length ? (
              <>
                <AdSlot placement="community-general-feed" />
                <CommunityPostList
                  posts={trailingPosts}
                  startIndex={leadingPosts.length}
                />
              </>
            ) : null}
          </>
        ) : (
          <div className="empty-state">
            <p>이 분류에는 아직 예시 글이 없습니다.</p>
            <Link className="text-action" href="/community/general">
              모든 글 다시 보기
            </Link>
          </div>
        )}
      </section>

      <aside className="source-notice">
        <strong>예시 데이터</strong>
        <p>
          현재 글과 작성자 이름은 게시판 구조를 검증하기 위한 예시입니다.
          공개 게시와 댓글은 아직 연결되지 않았으며, 작성 화면에서는 이
          기기에 임시저장만 할 수 있습니다.
        </p>
      </aside>
    </div>
  );
}
