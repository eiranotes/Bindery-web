import Link from "next/link";

import {
  getCommunityCategory,
  getCommunityPostPath,
  type CommunityPost,
} from "../lib/community";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00+09:00`));
}

type CommunityPostListProps = {
  posts: CommunityPost[];
  startIndex?: number;
};

export function CommunityPostList({
  posts,
  startIndex = 0,
}: CommunityPostListProps) {
  return (
    <ol className="community-post-list">
      {posts.map((post, index) => {
        const category = getCommunityCategory(post.categoryId);

        return (
          <li key={post.slug}>
            <span className="community-post__number">
              {String(startIndex + index + 1).padStart(2, "0")}
            </span>
            <article className="community-post-row">
              <div className="community-post-row__meta">
                {post.pinned ? <span className="status-stamp">중요 정보</span> : null}
                <span>{category?.label}</span>
                <span>{post.status}</span>
                <time dateTime={post.updatedAt}>
                  {formatDate(post.updatedAt)}
                </time>
              </div>
              <h3>
                <Link href={getCommunityPostPath(post)}>{post.title}</Link>
              </h3>
              <p>{post.excerpt}</p>
              <footer>
                <span>
                  예시 작성자 · {post.author} · {post.authorLabel}
                </span>
                <span>
                  예시 답변 {post.commentCount} · 예시 도움 {post.usefulCount}
                </span>
              </footer>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
