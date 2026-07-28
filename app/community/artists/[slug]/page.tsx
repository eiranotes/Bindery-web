import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommunityPostActions } from "../../../components/CommunityPostActions";
import { getCommunityCategory } from "../../../lib/community.ts";
import {
  createSupabaseCommunityRepository,
  durableCommunityPostToView,
} from "../../../lib/server/community/posts.ts";
import { getCurrentCommunityMember } from "../../../lib/server/community/session.ts";
import { getSupabasePublicConfig } from "../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "작가 게시판 글",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export default async function ArtistPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = getSupabasePublicConfig();
  const session = await getCurrentCommunityMember({ config });
  const hasArtistAccess = session.access.capabilities.includes("artist:read");

  if (!hasArtistAccess || config.status !== "configured") {
    return (
      <div className="page-shell community-page">
        <section className="community-lock" aria-labelledby="artist-post-lock">
          <p className="status-stamp">보호된 글</p>
          <div>
            <h1 id="artist-post-lock">작가 게시판 접근 상태를 확인해 주세요.</h1>
            <p>권한이 확인되지 않아 제목, 본문, 작성자와 댓글을 응답에 포함하지 않았습니다.</p>
            <div className="intro-actions">
              <Link
                className="button button--primary"
                href={session.state === "signed_out" ? "/auth/sign-in" : "/community/verify"}
              >
                {session.state === "signed_out" ? "로그인" : "작가 상태 확인"}
              </Link>
              <Link className="button" href="/community/general">모두의 게시판</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const client = await createSupabaseServerClient(config);
  const repository = createSupabaseCommunityRepository(client!);
  const durablePost = await repository.getPost(slug);
  if (!durablePost || durablePost.boardId !== "artists") {
    notFound();
  }
  const post = durableCommunityPostToView(durablePost);
  const comments = await repository.listComments(durablePost.id);
  const bookmarked = session.member
    ? await repository.isBookmarked(session.member.id, durablePost.id)
    : false;
  const category = getCommunityCategory(post.categoryId);

  return (
    <article className="page-shell community-post-page">
      <nav className="breadcrumbs" aria-label="현재 위치">
        <Link href="/community">커뮤니티</Link>
        <span aria-hidden="true">/</span>
        <Link href="/community/artists">작가 인증 게시판</Link>
      </nav>

      <header className="community-post-header">
        <div className="community-post-row__meta">
          <span className="status-stamp">{category?.label}</span>
          <span>{post.status}</span>
          <time dateTime={post.updatedAt}>수정 {formatDate(post.updatedAt)}</time>
        </div>
        <h1>{post.title}</h1>
        <p>{post.excerpt}</p>
        <dl>
          <div><dt>작성자</dt><dd>{post.author}</dd></div>
          <div><dt>댓글</dt><dd>{comments.length}</dd></div>
          <div>
            <dt>접근 상태</dt>
            <dd>
              {session.access.artistAccess === "provisional"
                ? "임시 승인 · 검수 대기"
                : "작가 접근 확인"}
            </dd>
          </div>
        </dl>
      </header>

      <div className="community-post-body">
        {post.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>

      {post.source ? (
        <aside className="source-notice">
          <strong>참고 원문</strong>
          <p>
            <a href={post.source.url} target="_blank" rel="ugc nofollow noreferrer">
              {post.source.label}
            </a>
            <span> · {formatDate(`${post.source.checkedAt}T12:00:00+09:00`)} 확인</span>
          </p>
        </aside>
      ) : null}

      <section className="community-reply-boundary" aria-labelledby="artist-replies-title">
        <div className="section-line-heading">
          <h2 id="artist-replies-title">답변과 댓글</h2>
          <span>{comments.length} ITEMS</span>
        </div>
        {comments.length > 0 ? (
          <ol className="community-comment-list">
            {comments.map((comment) => (
              <li key={comment.id}>
                <div>
                  <strong>{comment.authorName ?? "작가 회원"}</strong>
                  <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
                </div>
                <p>{comment.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p>아직 댓글이 없습니다.</p>
        )}
      </section>

      <CommunityPostActions
        postId={post.slug}
        boardId="artists"
        signedIn={session.member !== null}
        canDelete={
          session.member?.id === durablePost.authorId ||
          session.member?.actor.role === "moderator" ||
          session.member?.actor.role === "admin"
        }
        initiallyBookmarked={bookmarked}
      />

      <div className="page-actions">
        <Link className="button button--primary" href="/community/artists">
          작가 게시판으로
        </Link>
        <Link className="button" href="/community/write?board=artists">
          새 글 작성
        </Link>
      </div>
    </article>
  );
}
