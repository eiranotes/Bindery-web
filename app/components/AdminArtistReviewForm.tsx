"use client";

import { type FormEvent, useState } from "react";

export function AdminArtistReviewForm({ applicationId }: { applicationId: string }) {
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setFeedback("");

    try {
      const response = await fetch(
        `/api/admin/community/verifications/${encodeURIComponent(applicationId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nextStatus: form.get("nextStatus"),
            reason: form.get("reason"),
          }),
        },
      );
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "검수 결과를 저장하지 못했습니다.");
        return;
      }
      setFeedback("검수 결과를 저장했습니다.");
      window.location.reload();
    } catch {
      setFeedback("연결 문제로 검수 결과를 저장하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-inline-form" onSubmit={submit}>
      <label>
        처리 상태
        <select name="nextStatus" defaultValue="verified">
          <option value="verified">검수 완료</option>
          <option value="rejected">거절</option>
          <option value="suspended">일시 정지</option>
          <option value="revoked">회수</option>
        </select>
      </label>
      <label>
        처리 사유
        <textarea name="reason" maxLength={2000} rows={3} required />
      </label>
      <button className="button button--primary" disabled={submitting} type="submit">
        {submitting ? "저장 중" : "검수 저장"}
      </button>
      <p aria-live="polite">{feedback}</p>
    </form>
  );
}
