"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render(
        container: HTMLElement,
        options: {
          sitekey: string;
          callback(token: string): void;
          "expired-callback"(): void;
          "error-callback"(): void;
        },
      ): string;
      reset(widgetId: string): void;
      remove(widgetId: string): void;
    };
  }
}

let turnstileScript: Promise<void> | null = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScript) return turnstileScript;

  turnstileScript = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-bindery-turnstile="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.binderyTurnstile = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(), { once: true });
    document.head.appendChild(script);
  });

  return turnstileScript;
}

export function ArtistApplicationForm({ siteKey }: { siteKey: string }) {
  const widgetContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  const [botToken, setBotToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;

    loadTurnstile()
      .then(() => {
        if (!active || !widgetContainer.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(widgetContainer.current, {
          sitekey: siteKey,
          callback: setBotToken,
          "expired-callback": () => setBotToken(""),
          "error-callback": () => {
            setBotToken("");
            setFeedback("자동 제출 방지 확인을 불러오지 못했습니다.");
          },
        });
      })
      .catch(() => {
        if (active) setFeedback("자동 제출 방지 확인을 불러오지 못했습니다.");
      });

    return () => {
      active = false;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
    };
  }, [siteKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!botToken || submitting) {
      setFeedback("자동 제출 방지 확인을 먼저 완료해 주세요.");
      return;
    }

    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setFeedback("");

    try {
      const response = await fetch("/api/community/verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({
          activityName: form.get("activityName"),
          proofUrl: form.get("proofUrl"),
          primaryField: form.get("primaryField"),
          optionalPublicUrl: form.get("optionalPublicUrl"),
          applicantNote: form.get("applicantNote"),
          policyConsent: form.get("policyAccepted") === "on",
          botToken,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "신청을 저장하지 못했습니다.");
        if (widgetId.current) window.turnstile?.reset(widgetId.current);
        setBotToken("");
        return;
      }

      setSuccess(true);
      setFeedback("임시 승인 · 검수 대기 상태로 접수했습니다.");
    } catch {
      setFeedback("연결 문제로 신청을 저장하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="community-composer__boundary" role="status">
        <strong>임시 승인 · 검수 대기</strong>
        <p>
          신청과 작가 게시판 접근 상태를 함께 만들었습니다. 운영자는 7일 내
          검수를 목표로 하며, 이 상태가 게시글 내용의 사실성을 인증하지는
          않습니다.
        </p>
        <div className="intro-actions">
          <Link className="button button--primary" href="/community/artists">
            작가 게시판 확인
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="community-composer" onSubmit={submit}>
      <label>
        공개 활동명
        <input name="activityName" maxLength={80} required />
      </label>
      <label>
        공개 활동 증빙 URL
        <input name="proofUrl" type="url" inputMode="url" required />
        <small>공개 상점, 포트폴리오 또는 활동 채널 한 곳을 입력하세요.</small>
      </label>
      <label>
        주요 활동 분야
        <input name="primaryField" maxLength={80} required />
      </label>
      <label>
        추가 공개 URL <span>선택</span>
        <input name="optionalPublicUrl" type="url" inputMode="url" />
      </label>
      <label>
        운영자에게 전달할 설명 <span>선택 · 500자</span>
        <textarea name="applicantNote" maxLength={500} rows={5} />
      </label>
      <label className="community-consent">
        <input name="policyAccepted" type="checkbox" required />
        <span>
          현재 커뮤니티 운영 규칙과 개인정보 처리 경계를 확인했습니다.
        </span>
      </label>
      <div ref={widgetContainer} />
      <div className="community-composer__actions">
        <button
          className="button button--primary"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "접수하는 중" : "임시 승인으로 신청"}
        </button>
      </div>
      <p className="community-composer__feedback" aria-live="polite">
        {feedback}
      </p>
    </form>
  );
}
