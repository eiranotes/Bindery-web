"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminArtistInviteRevokeForm({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reason = String(form.get("reason") ?? "");
    if (
      !window.confirm(
        "이 초대 링크를 취소할까요? 취소한 링크는 다시 살릴 수 없으며 필요하면 새 초대를 발급해야 합니다.",
      )
    ) {
      return;
    }

    setSubmitting(true);
    setFeedback("");
    try {
      const response = await fetch(
        `/api/admin/community/invitations/${encodeURIComponent(inviteId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "초대를 취소하지 못했습니다.");
        return;
      }

      setFeedback("초대를 취소했습니다. 필요하면 새 초대를 발급하세요.");
      router.refresh();
    } catch {
      setFeedback("연결 문제로 초대를 취소하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-inline-form" onSubmit={submit}>
      <label>
        취소 사유
        <textarea name="reason" maxLength={500} rows={2} required />
      </label>
      <button className="button" disabled={submitting} type="submit">
        {submitting ? "취소 처리 중" : "미사용 초대 취소"}
      </button>
      <p aria-live="polite">{feedback}</p>
    </form>
  );
}
