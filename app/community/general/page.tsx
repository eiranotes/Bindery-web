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
  type CommunityPost,
} from "../../lib/community";
import { getCommunitySourceFreshness } from "../../lib/server/community/knowledge.ts";
import {
  communitySearchPageHref,
  communitySearchPostToView,
  createSupabaseCommunitySearchRepository,
  searchCommunityPosts,
  type CommunitySearchFreshness,
  type CommunitySearchResolution,
} from "../../lib/server/community/search.ts";
import { getSupabasePublicConfig } from "../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

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

function selectedResolution(value: string | null): CommunitySearchResolution {
  return value === "resolved" || value === "unresolved" ? value : "all";
}

function selectedFreshness(value: string | null): CommunitySearchFreshness {
  return value === "fresh" || value === "stale" || value === "missing"
    ? value
    : "all";
}

export default async function GeneralCommunityPage({
  searchParams,
}: GeneralCommunityPageProps) {
  const query = await searchParams;
  const requestedCategory = singleValue(query.category);
  const selectedCategory = getCommunityCategory(requestedCategory);
  const searchQuery = (singleValue(query.q) ?? "").trim().slice(0, 200);
  const resolution = selectedResolution(singleValue(query.resolution));
  const freshness = selectedFreshness(singleValue(query.freshness));
  const cursor = singleValue(query.cursor);
  const config = getSupabasePublicConfig();
  const liveMode = config.status === "configured";
  const order = liveMode
    ? "latest"
    : singleValue(query.order) === "latest"
      ? "latest"
      : "helpful";
  let loadError = false;
  let posts: CommunityPost[];
  let nextCursor: string | null = null;

  if (liveMode) {
    try {
      const client = await createSupabaseServerClient(config);
      const result = await searchCommunityPosts(
        {
          actor: {
            authenticated: false,
            accountStatus: "anonymous",
            role: "none",
            artistStatus: "none",
          },
          input: {
            query: searchQuery,
            board: "general",
            categoryId: selectedCategory?.id,
            resolution,
            freshness,
            cursor,
            limit: 24,
          },
          now: new Date(),
        },
        { repository: createSupabaseCommunitySearchRepository(client!) },
      );
      posts = result.posts.map(communitySearchPostToView);
      nextCursor = result.nextCursor;
    } catch {
      posts = [];
      loadError = true;
    }
  } else {
    const normalizedSearch = searchQuery.toLocaleLowerCase("ko-KR");
    const now = new Date();
    posts = filterCommunityPosts({ categoryId: selectedCategory?.id, order }).filter(
      (post) => {
        const matchesText =
          !normalizedSearch ||
          [post.title, post.excerpt, ...post.body, ...post.tags]
            .join(" ")
            .toLocaleLowerCase("ko-KR")
            .includes(normalizedSearch);
        const matchesResolution =
          resolution === "all" ||
          (resolution === "resolved" && post.status === "해결") ||
          (resolution === "unresolved" && post.status !== "해결");
        const postFreshness = getCommunitySourceFreshness({
          checkedAt: post.source?.checkedAt ?? null,
          validForDays: post.source ? 90 : 0,
          now,
        });
        return (
          matchesText &&
          matchesResolution &&
          (freshness === "all" || freshness === postFreshness)
        );
      },
    );
  }
  const leadingPosts = posts.slice(0, 3);
  const trailingPosts = posts.slice(3);

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="COMMUNITY / OPEN BOARD"
        title="모두의 게시판"
        description="누구나 읽을 수 있는 공개 게시판입니다."
      >
        <div className="intro-actions">
          <Link
            className="button button--primary"
            href="/community/write?board=general"
          >
            글 작성
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
          <h2 id="general-community-filter">검색·필터</h2>
          <span>{posts.length} POSTS</span>
        </div>
        <form action="/community/general" method="get">
          <label>
            검색어
            <input
              type="search"
              name="q"
              maxLength={200}
              defaultValue={searchQuery}
              placeholder="제목과 본문 검색"
            />
          </label>
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
            해결 상태
            <select name="resolution" defaultValue={resolution}>
              <option value="all">전체 상태</option>
              <option value="resolved">해결됨</option>
              <option value="unresolved">미해결</option>
            </select>
          </label>
          <label>
            출처 신선도
            <select name="freshness" defaultValue={freshness}>
              <option value="all">전체 신선도</option>
              <option value="fresh">확인 유효</option>
              <option value="stale">재확인 필요</option>
              <option value="missing">출처 없음</option>
            </select>
          </label>
          <label>
            정렬
            <select name="order" defaultValue={order}>
              {!liveMode ? <option value="helpful">도움 많은 순</option> : null}
              <option value="latest">최근 수정 순</option>
            </select>
          </label>
          <div className="filter-actions">
            <button className="button button--primary" type="submit">
              검색 적용
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
          <span>{liveMode ? "LIVE POSTS" : "EXAMPLE CONTENT"}</span>
        </div>
        {loadError ? (
          <div className="empty-state">
            <p>게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
          </div>
        ) : posts.length ? (
          <>
            <CommunityPostList
              posts={leadingPosts}
              mode={liveMode ? "live" : "example"}
            />
            {trailingPosts.length ? (
              <>
                <AdSlot placement="community-general-feed" />
                <CommunityPostList
                  posts={trailingPosts}
                  startIndex={leadingPosts.length}
                  mode={liveMode ? "live" : "example"}
                />
              </>
            ) : null}
            {nextCursor ? (
              <div className="page-actions">
                <Link
                  className="button button--primary"
                  href={communitySearchPageHref(
                    "/community/general",
                    {
                      q: searchQuery,
                      category: selectedCategory?.id,
                      resolution,
                      freshness,
                      order,
                    },
                    nextCursor,
                  )}
                >
                  다음 글 보기
                </Link>
                <span className="utility-text">현재 검색·필터를 유지합니다.</span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-state">
            <p>검색 조건에 맞는 글이 없습니다.</p>
            <Link className="text-action" href="/community/general">
              모든 글 다시 보기
            </Link>
          </div>
        )}
      </section>

      <aside className="source-notice">
        <strong>{liveMode ? "공개 커뮤니티" : "예시 데이터"}</strong>
        {liveMode ? (
          <p>
            회원이 작성한 공개 글입니다. 사실 정보는 출처와 확인 날짜를
            확인하세요.
          </p>
        ) : (
          <p>
            현재 글과 작성자는 예시입니다. 작성 내용은 이 기기에만
            임시저장됩니다.
          </p>
        )}
      </aside>
    </div>
  );
}
