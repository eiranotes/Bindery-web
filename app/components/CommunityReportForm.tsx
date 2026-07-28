"use client";

import { type FormEvent, useState } from "react";

export function CommunityReportForm({ postId }: { postId: string }) {
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitting(true);
    setFeedback("");
    try {
      const response = await fetch("/api/community/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          reasonCode: formData.get("reasonCode"),
          details: formData.get("details"),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        code?: string;
        message?: string;
      };
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "신고를 접수하지 못했습니다.");
        return;
      }
      setFeedback(
        result.code === "existing"
          ? "같은 사유의 처리 중인 신고가 이미 있습니다."
          : "신고를 접수했습니다. 운영 처리 이력에 따라 검토합니다.",
      );
      form.reset();
    } catch {
      setFeedback("연결 문제로 신고를 접수하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="community-composer" onSubmit={submit}>
      <label>
        신고 사유
        <select name="reasonCode" defaultValue="personal_information" required>
          <option value="personal_information">개인정보 노출</option>
          <option value="harassment">괴롭힘·혐오</option>
          <option value="misinformation">허위·기만 정보</option>
          <option value="spam">반복 광고·스팸</option>
          <option value="fraud">사기·거래 유도</option>
          <option value="other">저작권·기타</option>
        </select>
      </label>
      <label>
        확인할 내용 <span>(선택)</span>
        <textarea name="details" rows={5} maxLength={2000} />
        <small>민감한 개인정보를 다시 복사하지 말고 위치와 상황만 적어 주세요.</small>
      </label>
      <button className="button button--primary" disabled={submitting} type="submit">
        {submitting ? "접수 중" : "신고 접수"}
      </button>
      <p className="community-composer__feedback" aria-live="polite">
        {feedback}
      </p>
    </form>
  );
}
