"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function CommunityAppealForm({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setFeedback("");
    try {
      const response = await fetch(
        `/api/community/reports/${encodeURIComponent(reportId)}/appeal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: data.get("reason") }),
        },
      );
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "이의제기를 제출하지 못했습니다.");
        return;
      }
      setFeedback("이의제기를 제출했습니다. 관리자 검토 결과는 알림에서 확인할 수 있습니다.");
      form.reset();
      router.refresh();
    } catch {
      setFeedback("연결 문제로 이의제기를 제출하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="community-composer" onSubmit={submit}>
      <label>
        이의제기 사유
        <textarea name="reason" rows={7} minLength={10} maxLength={2000} required />
        <small>운영 판단에서 다시 확인할 사실과 근거를 10자 이상 적어 주세요.</small>
      </label>
      <button className="button button--primary" disabled={submitting} type="submit">
        {submitting ? "제출 중" : "이의제기 제출"}
      </button>
      <p className="community-composer__feedback" aria-live="polite">{feedback}</p>
    </form>
  );
}
