"use client";

import Link from "next/link";
import { useState } from "react";

export function ArtistInviteAcceptForm({
  token,
  currentPolicyVersion,
}: {
  token: string;
  currentPolicyVersion: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [policyConsent, setPolicyConsent] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function accept() {
    setSubmitting(true);
    setFeedback("");
    try {
      const response = await fetch(
        `/api/community/invitations/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            policyConsent,
            policyVersion: currentPolicyVersion,
          }),
        },
      );
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "초대를 수락하지 못했습니다.");
        return;
      }
      setAccepted(true);
      setFeedback("작가 검수 완료 상태로 초대를 수락했습니다.");
    } catch {
      setFeedback("연결 문제로 초대를 수락하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (accepted) {
    return (
      <div className="community-composer__boundary" role="status">
        <strong>초대 수락 완료</strong>
        <p>{feedback}</p>
        <Link className="button button--primary" href="/community/artists">
          작가 게시판 확인
        </Link>
      </div>
    );
  }

  return (
    <div className="community-composer__boundary">
      <strong>초대받은 이메일 계정과 현재 로그인 계정이 같아야 합니다.</strong>
      <p>초대는 한 번만 사용할 수 있고 발급 후 7일이 지나면 만료됩니다.</p>
      <label className="community-consent">
        <input
          checked={policyConsent}
          onChange={(event) => setPolicyConsent(event.currentTarget.checked)}
          type="checkbox"
        />
        <span>
          현재 <Link href="/community/rules">커뮤니티 운영 규칙</Link>과 개인정보
          처리 경계를 확인하고 동의합니다. <small>{currentPolicyVersion}</small>
        </span>
      </label>
      <div className="intro-actions">
        <button
          className="button button--primary"
          disabled={submitting || !policyConsent}
          onClick={accept}
          type="button"
        >
          {submitting ? "확인 중" : "작가 초대 수락"}
        </button>
      </div>
      <p className="community-composer__feedback" aria-live="polite">
        {feedback}
      </p>
    </div>
  );
}
