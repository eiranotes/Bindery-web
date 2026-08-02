import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommunityPostActions } from "../../../components/CommunityPostActions";
import { CommunityKnowledgeActions } from "../../../components/CommunityKnowledgeActions";
import { events as eventCatalog } from "../../../lib/data.ts";
import { getCommunityCategory, getCommunityPost } from "../../../lib/community";
import {
  createSupabaseKnowledgeRepository,
  getCommunitySourceFreshness,
  type KnowledgePost,
} from "../../../lib/server/community/knowledge.ts";
import {
  createSupabaseCommunityRepository,
  durableCommunityPostToView,
  type DurableCommunityComment,
  type DurableCommunityRevision,
} from "../../../lib/server/community/posts.ts";
import { getCurrentCommunityMember } from "../../../lib/server/community/session.ts";
import { getSupabasePublicConfig } from "../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

type CommunityPostPageProps = {
  params: Promise<{ slug: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDate(value: string) {
  return dateFormatter.format(
    new Date(value.length === 10 ? `${value}T12:00:00+09:00` : value),
  );
}

export async function generateMetadata({
  params,
}: CommunityPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getCommunityPost(slug);

  if (!post) {
    return {
      title: "커뮤니티 게시글",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function CommunityPostPage({
  params,
}: CommunityPostPageProps) {
  const { slug } = await params;
  const config = getSupabasePublicConfig();
  const liveMode = config.status === "configured";
  const session = await getCurrentCommunityMember({ config });
  let post = liveMode ? undefined : getCommunityPost(slug);
  let comments: DurableCommunityComment[] = [];
  let revisions: DurableCommunityRevision[] = [];
  let bookmarked = false;
  let liveAuthorId: string | null = null;
  let knowledgePost: KnowledgePost | null = null;
  let loadError = false;

  if (liveMode) {
    try {
      const client = await createSupabaseServerClient(config);
      const repository = createSupabaseCommunityRepository(client!);
      const durablePost = await repository.getPost(slug);
      if (durablePost?.boardId === "general") {
        post = durableCommunityPostToView(durablePost);
        liveAuthorId = durablePost.authorId;
        knowledgePost = await createSupabaseKnowledgeRepository(client!).getPost(
          durablePost.id,
        );
        comments = await repository.listComments(durablePost.id);
        revisions = await repository.listRevisions(durablePost.id);
        bookmarked = session.member
          ? await repository.isBookmarked(session.member.id, durablePost.id)
          : false;
      }
    } catch {
      loadError = true;
    }
  }

  if (liveMode && loadError) {
    return (
      <div className="page-shell community-page">
        <nav className="breadcrumbs" aria-label="현재 위치">
          <Link href="/community">커뮤니티</Link>
          <span aria-hidden="true">/</span>
          <Link href="/community/general">모두의 게시판</Link>
        </nav>
        <section className="community-lock" aria-labelledby="post-service-error">
          <p className="status-stamp">서비스 오류</p>
          <div>
            <h1 id="post-service-error">게시글을 불러오지 못했습니다.</h1>
            <p>공개 글 저장소에 일시적으로 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
            <Link className="button button--primary" href={`/community/general/${encodeURIComponent(slug)}`}>
              다시 시도
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!post) {
    notFound();
  }

  const category = getCommunityCategory(post.categoryId);
  const linkedEvent = knowledgePost?.eventId
    ? eventCatalog.find((event) => event.id === knowledgePost?.eventId)
    : null;
  const sourceFreshness = knowledgePost?.source
    ? getCommunitySourceFreshness({
        checkedAt: knowledgePost.source.checkedAt,
        validForDays: knowledgePost.source.validForDays,
        now: new Date(),
      })
    : "missing";
  const isActiveAuthor =
    session.member?.actor.accountStatus === "active" &&
    session.member.id === liveAuthorId;
  const isActiveOperator = session.access.capabilities.includes(
    "moderation:content",
  );

  return (
    <article className="page-shell community-post-page">
      <nav className="breadcrumbs" aria-label="현재 위치">
        <Link href="/community">커뮤니티</Link>
        <span aria-hidden="true">/</span>
        <Link href="/community/general">모두의 게시판</Link>
      </nav>

      <header className="community-post-header">
        <div className="community-post-row__meta">
          <span className="status-stamp">{category?.label}</span>
          <span>{post.status}</span>
          <time dateTime={post.updatedAt}>
            수정 {formatDate(post.updatedAt)}
          </time>
        </div>
        <h1>{post.title}</h1>
        <p>{post.excerpt}</p>
        <dl>
          <div>
            <dt>작성자</dt>
            <dd>
              {liveMode ? post.author : `예시 작성자 · ${post.author} · ${post.authorLabel}`}
            </dd>
          </div>
          <div>
            <dt>{liveMode ? "댓글" : "예시 답변"}</dt>
            <dd>{liveMode ? comments.length : post.commentCount}</dd>
          </div>
          {!liveMode ? (
            <div>
              <dt>예시 도움</dt>
              <dd>{post.usefulCount}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      <div className="community-post-body">
        {post.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {post.source ? (
        <aside className="source-notice">
          <strong>
            참고 원문
            {liveMode
              ? sourceFreshness === "stale"
                ? " · 재확인 필요"
                : sourceFreshness === "fresh"
                  ? " · 확인 기간 내"
                  : ""
              : ""}
          </strong>
          <p>
            <a
              href={post.source.url}
              target="_blank"
              rel="ugc nofollow noreferrer"
            >
              {post.source.label}
            </a>
            <span> · {formatDate(post.source.checkedAt)} 확인</span>
          </p>
        </aside>
      ) : null}

      {liveMode && revisions.length > 0 ? (
        <section className="community-reply-boundary" aria-labelledby="revision-history-title">
          <div className="section-line-heading">
            <h2 id="revision-history-title">수정 이력</h2>
            <span>{revisions.length} REVISIONS</span>
          </div>
          <ol className="community-comment-list">
            {revisions.map((revision) => (
              <li key={revision.id}>
                <div>
                  <strong>{revision.editorName ?? "회원 또는 운영자"}</strong>
                  <time dateTime={revision.createdAt}>{formatDate(revision.createdAt)}</time>
                </div>
                <p>{revision.reason ?? "수정 사유가 기록되지 않았습니다."}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {linkedEvent ? (
        <aside className="trust-notice">
          <p className="utility-text">RELATED EVENT</p>
          <p>
            관련 행사: <Link href={`/events/${linkedEvent.slug}/${linkedEvent.edition}`}>{linkedEvent.name}</Link>
          </p>
        </aside>
      ) : null}

      {post.related ? (
        <aside className="trust-notice">
          <p className="utility-text">관련 정보</p>
          <p>
            게시글과 함께 확인할 운영자 자료가 있습니다.{" "}
            <Link href={post.related.path}>{post.related.label} 보기</Link>
          </p>
        </aside>
      ) : null}

      <section className="community-reply-boundary" aria-labelledby="reply-title">
        <div className="section-line-heading">
          <h2 id="reply-title">답변과 댓글</h2>
          <span>{liveMode ? `${comments.length} ITEMS` : "BACKEND REQUIRED"}</span>
        </div>
        {liveMode ? (
          comments.length > 0 ? (
            <ol className="community-comment-list">
              {comments.map((comment) => (
                <li key={comment.id}>
                  <div>
                    <strong>{comment.authorName ?? "회원"}</strong>
                    {knowledgePost?.acceptedCommentId === comment.id ? (
                      <span className="status-stamp">채택 답변</span>
                    ) : null}
                    <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
                  </div>
                  <p>{comment.body}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p>아직 댓글이 없습니다. 확인 가능한 경험이나 출처와 함께 답해 주세요.</p>
          )
        ) : (
          <p>
            표시된 답변 수는 화면 검증용 예시입니다. 실제 답변 작성과 신고는
            계정·서버·운영 도구가 연결된 뒤 제공합니다.
          </p>
        )}
      </section>

      {liveMode && knowledgePost ? (
        <CommunityKnowledgeActions
          postId={post.slug}
          comments={knowledgePost.kind === "question" ? comments : []}
          acceptedCommentId={knowledgePost.acceptedCommentId}
          canManage={
            session.member?.actor.accountStatus === "active" &&
            session.member.id === liveAuthorId
          }
          isOperator={session.access.capabilities.includes("moderation:content")}
          events={eventCatalog.map((event) => ({ id: event.id, label: event.name }))}
        />
      ) : null}

      {liveMode ? (
        <CommunityPostActions
          postId={post.slug}
          postTitle={post.title}
          postBody={post.body.join("\n\n")}
          source={post.source ?? null}
          boardId="general"
          signedIn={session.member !== null}
          canParticipate={session.access.capabilities.includes("general:comment")}
          canCorrect={
            isActiveAuthor || isActiveOperator
          }
          isOperator={isActiveOperator}
          canDelete={
            isActiveAuthor || isActiveOperator
          }
          initiallyBookmarked={bookmarked}
        />
      ) : null}

      <div className="page-actions">
        <Link className="button button--primary" href="/community/general">
          모두의 게시판으로
        </Link>
        <Link className="button" href="/community/write?board=general">
          새 글 작성 화면
        </Link>
        {!liveMode ? (
          <Link className="text-action" href={`/community/report?post=${post.slug}`}>
            이 글의 신고 기준
          </Link>
        ) : null}
      </div>
    </article>
  );
}
