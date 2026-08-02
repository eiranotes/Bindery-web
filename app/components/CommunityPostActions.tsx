"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import {
  addCommunityPostBookmark,
  BOOKMARKS_CHANGED_EVENT,
  readBookmarkRecord,
  removeCommunityPostBookmark,
  writeBookmarkRecord,
} from "../lib/bookmarks";

export function CommunityPostActions({
  postId,
  postTitle,
  postBody = "",
  source = null,
  boardId,
  signedIn,
  canParticipate = signedIn,
  canCorrect = false,
  isOperator = false,
  canDelete,
  initiallyBookmarked,
}: {
  postId: string;
  postTitle: string;
  postBody?: string;
  source?: { label: string; url: string; checkedAt: string } | null;
  boardId: "general" | "artists";
  signedIn: boolean;
  canParticipate?: boolean;
  canCorrect?: boolean;
  isOperator?: boolean;
  canDelete: boolean;
  initiallyBookmarked: boolean;
}) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [includeSource, setIncludeSource] = useState(false);

  useEffect(() => {
    if (signedIn) return;
    const syncFromDevice = () =>
      setBookmarked(
        readBookmarkRecord(window.localStorage).communityPosts.some(
          (post) => post.id === postId,
        ),
      );
    const initialSync = window.setTimeout(syncFromDevice, 0);
    window.addEventListener(BOOKMARKS_CHANGED_EVENT, syncFromDevice);
    window.addEventListener("storage", syncFromDevice);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener(BOOKMARKS_CHANGED_EVENT, syncFromDevice);
      window.removeEventListener("storage", syncFromDevice);
    };
  }, [postId, signedIn]);

  function toggleLocalBookmark() {
    const current = readBookmarkRecord(window.localStorage);
    const locallyBookmarked = current.communityPosts.some((post) => post.id === postId);
    const next = locallyBookmarked
      ? removeCommunityPostBookmark(current, postId)
      : addCommunityPostBookmark(current, { id: postId, title: postTitle, boardId });
    if (!writeBookmarkRecord(window.localStorage, next)) {
      setFeedback("이 브라우저에서는 기기 Binder를 변경할 수 없습니다.");
      return;
    }
    setBookmarked(!locallyBookmarked);
    window.dispatchEvent(new Event(BOOKMARKS_CHANGED_EVENT));
    setFeedback(locallyBookmarked ? "이 기기의 Binder에서 제거했습니다." : "이 기기의 Binder에 저장했습니다.");
  }

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

  async function correctPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitting(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/community/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          body: formData.get("body"),
          reason: formData.get("reason"),
          source:
            isOperator && includeSource
              ? {
                  label: formData.get("sourceLabel"),
                  url: formData.get("sourceUrl"),
                  checkedAt: formData.get("sourceCheckedAt"),
                }
              : null,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "글을 수정하지 못했습니다.");
        return;
      }
      setFeedback("이전 내용을 수정 이력에 남기고 저장했습니다.");
      router.refresh();
    } catch {
      setFeedback("연결 문제로 글을 수정하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="community-reply-boundary">
        <p>공개 글은 이 기기의 Binder에 저장할 수 있습니다. 댓글과 신고는 로그인한 활성 회원만 이용할 수 있습니다.</p>
        <button className="button" onClick={toggleLocalBookmark} type="button">
          {bookmarked ? "이 기기 Binder에서 제거" : "이 기기 Binder에 저장"}
        </button>
        <Link
          className="button button--primary"
          href={`/auth/sign-in?next=/community/${boardId}/${encodeURIComponent(postId)}`}
        >
          로그인
        </Link>
        <p className="community-composer__feedback" aria-live="polite">{feedback}</p>
      </div>
    );
  }

  if (!canParticipate && !canCorrect && !canDelete) {
    return (
      <div className="community-reply-boundary">
        <p>
          현재 계정 상태에서는 댓글·신고·계정 Binder 변경을 사용할 수
          없습니다. 계정 상태가 복구된 뒤 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  return (
    <section className="community-live-actions" aria-labelledby="live-actions-title">
      <div className="section-line-heading">
        <h2 id="live-actions-title">참여하기</h2>
        <span>MEMBERS</span>
      </div>
      {canParticipate ? (
        <>
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
        </>
      ) : (
        <p className="community-composer__boundary">
          운영 열람 상태에서는 댓글·신고·계정 Binder 변경 없이 정정과 공개
          중단 도구만 표시합니다.
        </p>
      )}
      {canCorrect ? (
        <details className="community-correction-zone">
          <summary>글 수정·정정</summary>
          <form className="community-composer" onSubmit={correctPost}>
            <p className="community-composer__boundary">
              저장하면 바꾸기 전 제목과 본문, 수정 사유가 이력에 남습니다.
              {isOperator
                ? " 출처 재확인은 기존 행을 덮어쓰지 않고 새 확인 기록으로 추가됩니다."
                : " 출처 재확인 기록은 운영자가 추가합니다."}
            </p>
            <label>
              제목
              <input
                name="title"
                defaultValue={postTitle}
                minLength={4}
                maxLength={120}
                required
              />
            </label>
            <label>
              본문
              <textarea
                name="body"
                defaultValue={postBody}
                minLength={10}
                maxLength={20_000}
                rows={10}
                required
              />
            </label>
            <label>
              수정 사유
              <textarea name="reason" minLength={5} maxLength={500} rows={3} required />
              <small>무엇을 왜 바꿨는지 다른 독자가 이해할 수 있게 적어 주세요.</small>
            </label>
            {isOperator ? (
              <>
                <label className="community-consent">
                  <input
                    type="checkbox"
                    checked={includeSource}
                    onChange={(event) => setIncludeSource(event.target.checked)}
                  />
                  출처 재확인 기록 추가
                </label>
                {includeSource ? (
                  <div className="community-correction-source">
                    <label>
                      출처 이름
                      <input
                        name="sourceLabel"
                        defaultValue={source?.label ?? ""}
                        maxLength={120}
                        required
                      />
                    </label>
                    <label>
                      공개 원문 URL
                      <input
                        name="sourceUrl"
                        type="url"
                        pattern="https://.*"
                        title="HTTPS로 시작하는 공개 원문 URL을 입력해 주세요."
                        defaultValue={source?.url ?? ""}
                        inputMode="url"
                        required
                      />
                      <small>HTTPS로 공개된 원문만 재확인 기록에 남길 수 있습니다.</small>
                    </label>
                    <label>
                      확인 날짜
                      <input
                        name="sourceCheckedAt"
                        type="date"
                        defaultValue={source?.checkedAt ?? ""}
                        required
                      />
                    </label>
                  </div>
                ) : null}
              </>
            ) : null}
            <button className="button button--primary" disabled={submitting} type="submit">
              수정 이력 남기고 저장
            </button>
          </form>
        </details>
      ) : null}
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
