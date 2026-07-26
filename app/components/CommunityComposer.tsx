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

export function CommunityComposer() {
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const [clearRequested, setClearRequested] = useState(false);

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClearRequested(false);
    const form = event.currentTarget;
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
        <strong>공개 게시 기능은 아직 연결되지 않았습니다.</strong>
        <p>
          아래 내용은 이 브라우저에만 임시저장됩니다. 계정, 서버, 운영 검수
          체계가 연결되기 전에는 다른 사람에게 보이지 않습니다. 암호화되거나
          자동 삭제되지 않으므로 공용 기기·공유 브라우저 프로필에서는 다른
          사용자나 확장 프로그램이 읽을 수 있습니다. 작업 후 직접 지워 주세요.
        </p>
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
        <small>사실 정보와 자유 대화를 구분해 다음 사람이 찾기 쉽게 합니다.</small>
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
        <small>행사·업체·제도 정보라면 원문 주소와 확인 날짜를 함께 남깁니다.</small>
      </label>

      <div className="community-composer__actions">
        <button className="button button--primary" type="submit">
          이 기기에 임시저장
        </button>
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
