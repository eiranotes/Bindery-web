"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function AdminModerationForm({ reportId, isAdmin }: { reportId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/admin/community/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "운영 조치를 적용하지 못했습니다.");
        return;
      }
      setFeedback("사유와 함께 운영 이력을 추가했습니다.");
      router.refresh();
    } catch {
      setFeedback("연결 문제로 운영 조치를 적용하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-inline-form" onSubmit={submit}>
      <label>
        조치
        <select name="action" required defaultValue="triage">
          <option value="triage">검토 시작</option>
          <option value="dismiss">신고 기각</option>
          <option value="hide">글 숨김</option>
          <option value="lock">글 잠금</option>
          <option value="restore">글 복구</option>
          {isAdmin ? <option value="suspend_account">작성자 계정 정지</option> : null}
          {isAdmin ? <option value="resolve_appeal">이의제기 인용·복구</option> : null}
        </select>
      </label>
      <label>
        처리 사유
        <textarea name="reason" rows={4} maxLength={2000} required />
      </label>
      <button className="button button--primary" disabled={submitting} type="submit">
        {submitting ? "처리 중" : "조치 기록"}
      </button>
      <p aria-live="polite">{feedback}</p>
    </form>
  );
}
