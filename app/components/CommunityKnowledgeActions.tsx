"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type KnowledgeComment = { id: string; authorName: string | null };
type EventOption = { id: string; label: string };

export function CommunityKnowledgeActions({
  postId,
  comments,
  acceptedCommentId,
  canManage,
  isOperator,
  events,
}: {
  postId: string;
  comments: KnowledgeComment[];
  acceptedCommentId: string | null;
  canManage: boolean;
  isOperator: boolean;
  events: EventOption[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function mutate(payload: Record<string, unknown>) {
    setSubmitting(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/community/posts/${postId}/knowledge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "지식 상태를 변경하지 못했습니다.");
        return;
      }
      setFeedback("변경을 저장했습니다.");
      router.refresh();
    } catch {
      setFeedback("연결 문제로 변경하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function linkEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate({ action: "link-event", eventId: form.get("eventId") });
  }

  async function promote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate({
      action: "promote-note",
      slug: form.get("slug"),
      summary: form.get("summary"),
    });
  }

  if (!canManage && !isOperator) return null;

  return (
    <section className="community-live-actions" aria-labelledby="knowledge-actions-title">
      <div className="section-line-heading">
        <h2 id="knowledge-actions-title">정보 상태 관리</h2>
        <span>PROVENANCE</span>
      </div>
      {canManage && comments.length > 0 ? (
        <div className="page-actions">
          {comments.map((comment) => (
            <button
              className="button"
              disabled={submitting || acceptedCommentId === comment.id}
              key={comment.id}
              onClick={() => mutate({ action: "accept-answer", commentId: comment.id })}
              type="button"
            >
              {acceptedCommentId === comment.id
                ? "채택된 답변"
                : `${comment.authorName ?? "회원"} 답변 채택`}
            </button>
          ))}
        </div>
      ) : null}
      {canManage || isOperator ? (
        <form className="admin-inline-form" onSubmit={linkEvent}>
          <label>
            관련 행사
            <select name="eventId" required defaultValue="">
              <option value="" disabled>행사 선택</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.label}</option>)}
            </select>
          </label>
          <button className="button" disabled={submitting} type="submit">행사 연결</button>
        </form>
      ) : null}
      {isOperator ? (
        <details className="community-danger-zone">
          <summary>해결된 글을 운영 노트로 승격</summary>
          <form className="admin-inline-form" onSubmit={promote}>
            <label>노트 주소<input name="slug" pattern="[a-z0-9][a-z0-9-]{2,79}" required /></label>
            <label>운영자 요약<textarea name="summary" minLength={10} maxLength={240} rows={4} required /></label>
            <button className="button button--primary" disabled={submitting} type="submit">출처와 원문을 보존해 승격</button>
          </form>
        </details>
      ) : null}
      <p className="community-composer__feedback" aria-live="polite">{feedback}</p>
    </section>
  );
}
