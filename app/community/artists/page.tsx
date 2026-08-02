import type { Metadata } from "next";
import Link from "next/link";

import { CommunityBoardNav } from "../../components/CommunityBoardNav";
import { CommunityPostList } from "../../components/CommunityPostList";
import { PageIntro } from "../../components/PageIntro";
import {
  COMMUNITY_CATEGORY_CATALOG,
  getCommunityCategory,
} from "../../lib/community.ts";
import {
  communitySearchPageHref,
  communitySearchPostToView,
  createSupabaseCommunitySearchRepository,
  searchCommunityPosts,
  type CommunitySearchFreshness,
  type CommunitySearchResolution,
} from "../../lib/server/community/search.ts";
import { getCurrentCommunityMember } from "../../lib/server/community/session.ts";
import { getSupabasePublicConfig } from "../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "작가 인증 게시판",
  description:
    "작가 인증을 마친 사람만 읽고 쓸 수 있도록 설계된 문구작가 전용 자유게시판입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

type ArtistCommunityPageProps = {
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

export default async function ArtistCommunityPage({
  searchParams,
}: ArtistCommunityPageProps) {
  const query = await searchParams;
  const searchQuery = (singleValue(query.q) ?? "").trim().slice(0, 200);
  const category = getCommunityCategory(singleValue(query.category));
  const resolution = selectedResolution(singleValue(query.resolution));
  const freshness = selectedFreshness(singleValue(query.freshness));
  const cursor = singleValue(query.cursor);
  const config = getSupabasePublicConfig();
  const session = await getCurrentCommunityMember({ config });
  const hasArtistAccess = session.access.capabilities.includes("artist:read");
  const canWriteArtist = session.access.capabilities.includes("artist:write");
  let posts = [] as ReturnType<typeof communitySearchPostToView>[];
  let loadError = false;
  let nextCursor: string | null = null;

  if (hasArtistAccess && config.status === "configured") {
    try {
      const client = await createSupabaseServerClient(config);
      const result = await searchCommunityPosts(
        {
          actor: session.member!.actor,
          input: {
            query: searchQuery,
            board: "artists",
            categoryId: category?.id,
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
      loadError = true;
    }
  }
  const lockState =
    session.state === "unconfigured"
      ? {
          stamp: "인증 확인 필요",
          title: "작가 인증을 확인한 뒤 열립니다.",
          description:
            "현재 사이트에는 서버 계정과 작가 인증 시스템이 연결돼 있지 않습니다. 그래서 게시글 제목, 본문, 작성자 정보까지 모두 노출하지 않는 상태로 닫아 두었습니다.",
          status: "인증 백엔드 미연결로 잠금",
          primaryHref: "/community/verify",
          primaryLabel: "작가 인증 기준 확인",
        }
      : session.state === "signed_out"
        ? {
            stamp: "로그인 필요",
            title: "로그인한 뒤 작가 상태를 확인합니다.",
            description:
              "브라우저에 표시된 값이 아니라 서버가 확인한 계정과 작가 상태로 접근을 결정합니다.",
            status: "로그인 전 잠금",
            primaryHref: "/auth/sign-in",
            primaryLabel: "커뮤니티 로그인",
          }
        : session.state === "error"
          ? {
              stamp: "확인 지연",
              title: "작가 권한을 확인하지 못했습니다.",
              description:
                "보호된 글은 노출하지 않았습니다. 잠시 후 다시 확인하거나 모두의 게시판을 이용해 주세요.",
              status: "권한 확인 실패로 잠금",
              primaryHref: "/community/artists",
              primaryLabel: "다시 확인",
            }
          : {
              stamp: "작가 상태 필요",
              title: "작가 신청 또는 검수 완료 상태가 필요합니다.",
              description:
                "현재 계정은 로그인됐지만 작가 게시판 접근 상태가 아닙니다. 최소 정보 신청 기준과 임시 승인 절차를 확인해 주세요.",
              status: "작가 상태 미충족으로 잠금",
              primaryHref: "/community/verify",
              primaryLabel: "작가 신청 기준 확인",
            };

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="COMMUNITY / VERIFIED ARTISTS"
        title="작가 인증 게시판"
        description="인증 작가만 읽고 쓰는 실무 게시판입니다."
      />

      <CommunityBoardNav current="artists" />

      {hasArtistAccess ? (
        <>
          <section className="community-lock" aria-labelledby="artist-access-ready">
            <p className="status-stamp">
              {session.access.artistAccess === "provisional"
                ? "임시 승인 · 검수 대기"
                : "접근 확인됨"}
            </p>
            <div>
              <h2 id="artist-access-ready">
                {session.member?.displayName}님의 작가 게시판 접근을 확인했습니다.
              </h2>
              <p>
                보호 글은 서버 세션과 데이터베이스 정책을 모두 통과한 경우에만
                내려옵니다. 작가 인증은 글 내용의 사실성이나 거래 안전을 보증하지 않습니다.
              </p>
              {session.access.artistAccess === "provisional" ? (
                <p>
                  임시 승인 상태에서는 최근 24시간 기준 글 1개, 댓글 5개까지
                  작성할 수 있으며 운영 검수 후 제한이 해제됩니다.
                </p>
              ) : null}
              <div className="intro-actions">
                {canWriteArtist ? (
                  <Link className="button button--primary" href="/community/write?board=artists">
                    작가 글 작성
                  </Link>
                ) : null}
                <Link className="button" href="/community/general">
                  모두의 게시판 보기
                </Link>
              </div>
            </div>
          </section>

          <section
            className="filter-sheet community-filter"
            aria-labelledby="artist-community-filter"
          >
            <div className="section-line-heading">
              <h2 id="artist-community-filter">보호 글 검색·필터</h2>
              <span>{posts.length} POSTS</span>
            </div>
            <form action="/community/artists" method="get">
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
                <select name="category" defaultValue={category?.id ?? "all"}>
                  <option value="all">전체 분류</option>
                  {COMMUNITY_CATEGORY_CATALOG.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
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
              <div className="filter-actions">
                <button className="button button--primary" type="submit">
                  검색 적용
                </button>
                <Link className="text-action" href="/community/artists">
                  필터 초기화
                </Link>
              </div>
            </form>
          </section>

          <section className="community-post-ledger" aria-labelledby="artist-post-list-title">
            <div className="section-line-heading">
              <h2 id="artist-post-list-title">작가 실무 글</h2>
              <span>{posts.length} PROTECTED POSTS</span>
            </div>
            {loadError ? (
              <div className="empty-state">
                <p>보호 게시글을 불러오지 못했습니다. 내용은 노출하지 않았습니다.</p>
              </div>
            ) : posts.length > 0 ? (
              <>
                <CommunityPostList posts={posts} mode="live" />
                {nextCursor ? (
                  <div className="page-actions">
                    <Link
                      className="button button--primary"
                      href={communitySearchPageHref(
                        "/community/artists",
                        {
                          q: searchQuery,
                          category: category?.id,
                          resolution,
                          freshness,
                        },
                        nextCursor,
                      )}
                    >
                      다음 보호 글 보기
                    </Link>
                    <span className="utility-text">현재 검색·필터를 유지합니다.</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="empty-state">
                <p>검색 조건에 맞는 작가 게시판 글이 없습니다.</p>
                <Link className="text-action" href="/community/write?board=artists">
                  첫 글 작성하기
                </Link>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="community-lock" aria-labelledby="artist-lock-title">
          <p className="status-stamp">{lockState.stamp}</p>
          <div>
            <h2 id="artist-lock-title">{lockState.title}</h2>
            <p>{lockState.description}</p>
            <div className="intro-actions">
              <Link className="button button--primary" href={lockState.primaryHref}>
                {lockState.primaryLabel}
              </Link>
              <Link className="button" href="/community/general">
                모두의 게시판 보기
              </Link>
            </div>
          </div>
        </section>
      )}

      <section
        className="access-ledger"
        aria-labelledby="artist-access-title"
      >
        <div className="section-line-heading">
          <h2 id="artist-access-title">게시판 접근 기준</h2>
          <span>FAIL CLOSED</span>
        </div>
        <dl>
          <div>
            <dt>읽기</dt>
            <dd>작가 인증 세션이 있을 때만</dd>
          </div>
          <div>
            <dt>쓰기</dt>
            <dd>작가 인증 세션이 있을 때만</dd>
          </div>
          <div>
            <dt>현재 상태</dt>
            <dd>{hasArtistAccess ? "서버 권한 확인 완료" : lockState.status}</dd>
          </div>
        </dl>
      </section>

      <aside className="boundary-note">
        <p className="stamp">배지의 뜻</p>
        <div>
          <h2>인증은 내용 검증이 아닙니다.</h2>
          <p>활동 자격만 확인하며, 글의 사실성을 보증하지 않습니다.</p>
        </div>
      </aside>
    </div>
  );
}
