"use client";

import { useEffect, useRef, useState } from "react";

import {
  COMMUNITY_CATEGORY_CATALOG,
  type CommunityCategoryId,
} from "../lib/community";

export const COMMUNITY_DRAFT_KEY = "bindery.community-draft";
const COMMUNITY_DRAFT_VERSION = 1;

export type CommunityDraft = {
  version: typeof COMMUNITY_DRAFT_VERSION;
  categoryId: CommunityCategoryId;
  title: string;
  body: string;
  sourceUrl: string;
  savedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCommunityCategoryId(
  value: unknown,
): value is CommunityCategoryId {
  return COMMUNITY_CATEGORY_CATALOG.some(
    (category) => category.id === value,
  );
}

export function parseCommunityDraft(raw: string | null): CommunityDraft | null {
  if (!raw) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);

    if (
      !isRecord(value) ||
      value.version !== COMMUNITY_DRAFT_VERSION ||
      !isCommunityCategoryId(value.categoryId) ||
      typeof value.title !== "string" ||
      typeof value.body !== "string" ||
      typeof value.sourceUrl !== "string" ||
      typeof value.savedAt !== "string"
    ) {
      return null;
    }

    return {
      version: COMMUNITY_DRAFT_VERSION,
      categoryId: value.categoryId,
      title: value.title,
      body: value.body,
      sourceUrl: value.sourceUrl,
      savedAt: value.savedAt,
    };
  } catch {
    return null;
  }
}

function setFormValue(form: HTMLFormElement, name: string, value: string) {
  const field = form.elements.namedItem(name);

  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLSelectElement
  ) {
    field.value = value;
  }
}

export function CommunityComposer({
  liveBoard,
}: {
  liveBoard?: "general" | "artists";
} = {}) {
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const [clearRequested, setClearRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function setFeedback(message: string) {
    if (feedbackRef.current) {
      feedbackRef.current.textContent = message;
    }
  }

  useEffect(() => {
    const form = formRef.current;

    if (!form) {
      return;
    }

    try {
      const draft = parseCommunityDraft(
        window.localStorage.getItem(COMMUNITY_DRAFT_KEY),
      );

      if (!draft) {
        return;
      }

      setFormValue(form, "category", draft.categoryId);
      setFormValue(form, "title", draft.title);
      setFormValue(form, "body", draft.body);
      setFormValue(form, "sourceUrl", draft.sourceUrl);
      setFeedback("이 기기에 저장한 임시 글을 불러왔습니다.");
    } catch {
      setFeedback("브라우저 저장 공간을 사용할 수 없어 임시 글을 불러오지 못했습니다.");
    }
  }, []);

  function saveLocalDraft(form: HTMLFormElement) {
    const formData = new FormData(form);
    const category = formData.get("category");
    const title = formData.get("title");
    const body = formData.get("body");
    const sourceUrl = formData.get("sourceUrl");

    if (
      !isCommunityCategoryId(category) ||
      typeof title !== "string" ||
      typeof body !== "string" ||
      typeof sourceUrl !== "string"
    ) {
      setFeedback("임시 글의 입력값을 확인해 주세요.");
      return;
    }

    const draft: CommunityDraft = {
      version: COMMUNITY_DRAFT_VERSION,
      categoryId: category,
      title,
      body,
      sourceUrl,
      savedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(
        COMMUNITY_DRAFT_KEY,
        JSON.stringify(draft),
      );
      setFeedback(
        "이 기기에 임시저장했습니다. 공개 게시되거나 전송되지 않지만 자동 삭제되지 않으므로 공용·공유 브라우저에서는 작업 후 직접 지워 주세요.",
      );
    } catch {
      setFeedback("브라우저 저장 공간을 사용할 수 없어 임시저장하지 못했습니다.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClearRequested(false);
    const form = event.currentTarget;

    if (!liveBoard) {
      saveLocalDraft(form);
      return;
    }

    const formData = new FormData(form);
    setSubmitting(true);
    setFeedback("게시 권한과 입력값을 확인하고 있습니다.");
    try {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: liveBoard,
          categoryId: formData.get("category"),
          kind: formData.get("kind"),
          title: formData.get("title"),
          body: formData.get("body"),
          sourceLabel: formData.get("sourceLabel"),
          sourceUrl: formData.get("sourceUrl"),
          sourceCheckedAt: formData.get("sourceCheckedAt"),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        post?: { id?: string };
      };
      if (!response.ok || !result.ok || !result.post?.id) {
        setFeedback(result.message ?? "게시하지 못했습니다. 입력 내용을 유지했습니다.");
        return;
      }

      try {
        window.localStorage.removeItem(COMMUNITY_DRAFT_KEY);
      } catch {
        // Publishing succeeded; a blocked local cleanup must not misreport it.
      }
      setFeedback("게시했습니다. 게시글로 이동합니다.");
      const boardPath = liveBoard === "artists" ? "artists" : "general";
      window.location.assign(`/community/${boardPath}/${result.post.id}`);
    } catch {
      setFeedback("연결 문제로 게시하지 못했습니다. 입력 내용을 유지했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClear() {
    try {
      window.localStorage.removeItem(COMMUNITY_DRAFT_KEY);
      formRef.current?.reset();
      setClearRequested(false);
      setFeedback("이 기기에 저장한 임시 글을 지웠습니다.");
    } catch {
      setClearRequested(false);
      setFeedback("브라우저 저장 공간을 사용할 수 없어 임시 글을 지우지 못했습니다.");
    }
  }

  function handleClearRequest() {
    setClearRequested(true);
    setFeedback(
      "저장된 임시 글을 지우려면 ‘정말 임시 글 지우기’를 눌러 주세요.",
    );
  }

  function handleClearCancel() {
    setClearRequested(false);
    setFeedback("임시 글 삭제를 취소했습니다.");
  }

  return (
    <form
      className="community-composer"
      ref={formRef}
      onSubmit={handleSubmit}
      aria-describedby="community-composer-boundary"
    >
      <div className="community-composer__boundary" id="community-composer-boundary">
        <strong>
          {liveBoard
            ? "로그인 세션과 게시 권한을 서버에서 다시 확인합니다."
            : "공개 게시 기능은 아직 연결되지 않았습니다."}
        </strong>
        {liveBoard ? (
          <p>
            게시하면 다른 이용자가 읽을 수 있습니다. 개인 연락처, 주문 정보,
            계좌번호를 적지 말고 사실 정보에는 확인한 공개 출처를 남겨 주세요.
          </p>
        ) : (
          <p>
            이 브라우저에만 임시저장되며 암호화·자동 삭제되지 않습니다. 공유
            기기에서는 저장하지 말고, 작업 후 직접 지워 주세요.
          </p>
        )}
      </div>

      <label>
        글 분류
        <select name="category" defaultValue="event" required>
          {COMMUNITY_CATEGORY_CATALOG.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        글 성격
        <select name="kind" defaultValue="question" required>
          <option value="question">질문</option>
          <option value="experience">경험 공유</option>
          <option value="fact">사실·안내</option>
        </select>
      </label>

      <label>
        제목
        <input
          name="title"
          type="text"
          required
          minLength={4}
          maxLength={100}
          autoComplete="off"
        />
      </label>

      <label>
        본문
        <textarea
          name="body"
          required
          minLength={20}
          maxLength={3000}
          rows={10}
        />
        <small>개인 연락처, 계좌번호, 주문자 정보는 적지 마세요.</small>
      </label>

      <label>
        참고 원문 URL <span>(선택)</span>
        <input
          name="sourceUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://"
        />
        <small>사실 정보에는 원문과 확인 날짜를 남겨 주세요.</small>
      </label>

      <label>
        출처 이름 <span>(URL을 적은 경우)</span>
        <input
          name="sourceLabel"
          type="text"
          maxLength={120}
          defaultValue="참고 원문"
        />
      </label>

      <label>
        출처 확인 날짜 <span>(URL을 적은 경우)</span>
        <input
          name="sourceCheckedAt"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </label>

      <div className="community-composer__actions">
        <button
          className="button button--primary"
          disabled={submitting}
          type="submit"
        >
          {liveBoard
            ? submitting
              ? "게시 중"
              : "게시하기"
            : "이 기기에 임시저장"}
        </button>
        {liveBoard ? (
          <button
            className="button"
            disabled={submitting}
            type="button"
            onClick={() => formRef.current && saveLocalDraft(formRef.current)}
          >
            이 기기에 임시저장
          </button>
        ) : null}
        <button
          className="button"
          type="button"
          onClick={clearRequested ? handleClear : handleClearRequest}
        >
          {clearRequested ? "정말 임시 글 지우기" : "임시 글 지우기"}
        </button>
        {clearRequested ? (
          <>
            <button className="button" type="button" onClick={handleClearCancel}>
              삭제 취소
            </button>
          </>
        ) : null}
      </div>

      <p
        className="community-composer__feedback"
        ref={feedbackRef}
        role="status"
        aria-live="polite"
      />
    </form>
  );
}
