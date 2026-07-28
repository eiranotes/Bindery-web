"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function CommunityPostActions({
  postId,
  boardId,
  signedIn,
  canDelete,
  initiallyBookmarked,
}: {
  postId: string;
  boardId: "general" | "artists";
  signedIn: boolean;
  canDelete: boolean;
  initiallyBookmarked: boolean;
}) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitting(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: formData.get("body") }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "댓글을 저장하지 못했습니다.");
        return;
      }
      form.reset();
      setFeedback("댓글을 저장했습니다.");
      router.refresh();
    } catch {
      setFeedback("연결 문제로 댓글을 저장하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleBookmark() {
    setSubmitting(true);
    setFeedback("");
    try {
      const next = !bookmarked;
      const response = await fetch(`/api/community/posts/${postId}/bookmark`, {
        method: next ? "PUT" : "DELETE",
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "저장 상태를 바꾸지 못했습니다.");
        return;
      }
      setBookmarked(next);
      setFeedback(next ? "내 Binder에 저장했습니다." : "내 Binder에서 제거했습니다.");
    } catch {
      setFeedback("연결 문제로 저장 상태를 바꾸지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!window.confirm("이 글을 공개 목록에서 내릴까요? 운영 이력은 보존됩니다.")) {
      return;
    }
    setSubmitting(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/community/posts/${postId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: formData.get("reason") }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "글을 내리지 못했습니다.");
        return;
      }
      router.push(`/community/${boardId}`);
      router.refresh();
    } catch {
      setFeedback("연결 문제로 글을 내리지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="community-reply-boundary">
        <p>댓글, 저장, 신고는 로그인한 활성 회원만 이용할 수 있습니다.</p>
        <Link
          className="button button--primary"
          href={`/auth/sign-in?next=/community/${boardId}/${encodeURIComponent(postId)}`}
        >
          로그인
        </Link>
      </div>
    );
  }

  return (
    <section className="community-live-actions" aria-labelledby="live-actions-title">
      <div className="section-line-heading">
        <h2 id="live-actions-title">참여하기</h2>
        <span>MEMBERS</span>
      </div>
      <form className="community-composer" onSubmit={submitComment}>
        <label>
          댓글
          <textarea name="body" rows={5} maxLength={5000} required />
          <small>개인정보와 주문·거래 정보는 남기지 마세요.</small>
        </label>
        <button className="button button--primary" disabled={submitting} type="submit">
          댓글 저장
        </button>
      </form>
      <div className="page-actions">
        <button className="button" disabled={submitting} onClick={toggleBookmark} type="button">
          {bookmarked ? "내 Binder에서 제거" : "내 Binder에 저장"}
        </button>
        <Link className="button" href={`/community/report?post=${encodeURIComponent(postId)}`}>
          이 글 신고
        </Link>
      </div>
      {canDelete ? (
        <details className="community-danger-zone">
          <summary>내 글 공개 중단</summary>
          <form className="admin-inline-form" onSubmit={deletePost}>
            <label>
              삭제 사유
              <textarea name="reason" rows={3} maxLength={500} required />
            </label>
            <button className="button" disabled={submitting} type="submit">
              확인 후 글 내리기
            </button>
          </form>
        </details>
      ) : null}
      <p className="community-composer__feedback" aria-live="polite">
        {feedback}
      </p>
    </section>
  );
}
