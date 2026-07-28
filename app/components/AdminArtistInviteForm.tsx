"use client";

import { type FormEvent, useState } from "react";

export function AdminArtistInviteForm() {
  const [feedback, setFeedback] = useState("");
  const [acceptUrl, setAcceptUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setFeedback("");
    setAcceptUrl("");

    try {
      const response = await fetch("/api/admin/community/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        acceptPath?: string;
      };
      if (!response.ok || !result.ok || !result.acceptPath) {
        setFeedback(result.message ?? "초대를 발급하지 못했습니다.");
        return;
      }

      setFeedback("7일 동안 유효한 일회용 초대를 발급했습니다.");
      setAcceptUrl(`${window.location.origin}${result.acceptPath}`);
      event.currentTarget.reset();
    } catch {
      setFeedback("연결 문제로 초대를 발급하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="community-composer" onSubmit={submit}>
      <label>
        초대 이메일
        <input name="email" type="email" autoComplete="off" required />
      </label>
      <label>
        공개 활동명
        <input name="activityName" maxLength={80} required />
      </label>
      <label>
        확인한 공개 활동 URL
        <input name="proofUrl" type="url" required />
      </label>
      <label>
        주요 활동 분야
        <input name="primaryField" maxLength={80} required />
      </label>
      <label>
        초대·검수 사유
        <textarea name="reason" maxLength={500} rows={4} required />
      </label>
      <button className="button button--primary" disabled={submitting} type="submit">
        {submitting ? "발급 중" : "일회용 초대 발급"}
      </button>
      <p className="community-composer__feedback" aria-live="polite">
        {feedback}
      </p>
      {acceptUrl ? (
        <label>
          이번에만 표시되는 수락 주소
          <input readOnly value={acceptUrl} />
          <small>주소 자체가 일회용 비밀값이므로 지정한 사람에게만 전달하세요.</small>
        </label>
      ) : null}
    </form>
  );
}
