import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCommunityCategory, getCommunityPost } from "../../../lib/community";

type CommunityPostPageProps = {
  params: Promise<{ slug: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00+09:00`));
}

export async function generateMetadata({
  params,
}: CommunityPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getCommunityPost(slug);

  if (!post) {
    return { title: "게시글을 찾을 수 없음" };
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
  const post = getCommunityPost(slug);

  if (!post) {
    notFound();
  }

  const category = getCommunityCategory(post.categoryId);

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
              예시 작성자 · {post.author} · {post.authorLabel}
            </dd>
          </div>
          <div>
            <dt>예시 답변</dt>
            <dd>{post.commentCount}</dd>
          </div>
          <div>
            <dt>예시 도움</dt>
            <dd>{post.usefulCount}</dd>
          </div>
        </dl>
      </header>

      <div className="community-post-body">
        {post.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {post.source ? (
        <aside className="source-notice">
          <strong>참고 원문</strong>
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
          <span>BACKEND REQUIRED</span>
        </div>
        <p>
          표시된 답변 수는 화면 검증용 예시입니다. 실제 답변 작성과 신고는
          계정·서버·운영 도구가 연결된 뒤 제공합니다.
        </p>
      </section>

      <div className="page-actions">
        <Link className="button button--primary" href="/community/general">
          모두의 게시판으로
        </Link>
        <Link className="button" href="/community/write?board=general">
          새 글 작성 화면
        </Link>
        <Link className="text-action" href={`/community/report?post=${post.slug}`}>
          이 글의 신고 기준
        </Link>
      </div>
    </article>
  );
}
