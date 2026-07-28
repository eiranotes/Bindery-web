"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

import { PageIntro } from "../../components/PageIntro";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser.ts";
import { getSupabasePublicConfig } from "../../lib/supabase/config.ts";
import { safeCommunityReturnPath } from "../../lib/supabase/redirect.ts";

type RequestState = "idle" | "sending" | "sent" | "error";

export default function CommunitySignInPage() {
  const config = useMemo(() => getSupabasePublicConfig(), []);
  const [email, setEmail] = useState("");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [feedback, setFeedback] = useState("");

  async function requestSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (config.status !== "configured") return;

    setRequestState("sending");
    setFeedback("");
    const client = createSupabaseBrowserClient(config);
    const returnPath = safeCommunityReturnPath(
      new URLSearchParams(window.location.search).get("next"),
    );
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", returnPath);
    const { error } = await client!.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      setRequestState("error");
      setFeedback("로그인 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setRequestState("sent");
    setFeedback("입력한 주소로 로그인 링크를 보냈습니다.");
  }

  return (
    <div className="page-shell community-page">
      <meta name="robots" content="noindex, nofollow" />
      <PageIntro
        eyebrow="COMMUNITY / SIGN IN"
        title="커뮤니티 로그인"
        description="모두의 게시판 작성과 작가 신청에 사용할 이메일 로그인입니다. 게시판 권한은 로그인 뒤에도 서버에서 다시 확인합니다."
      />

      {config.status === "unconfigured" ? (
        <section className="community-lock" aria-labelledby="sign-in-unavailable">
          <p className="status-stamp">백엔드 준비 중</p>
          <div>
            <h2 id="sign-in-unavailable">아직 로그인을 받을 수 없습니다.</h2>
            <p>
              현재 배포에는 Supabase 공개 설정이 연결되지 않았습니다. 기존 공개
              정보는 계속 읽을 수 있지만 회원 작성과 작가 인증은 열지 않습니다.
            </p>
            <div className="intro-actions">
              <Link className="button button--primary" href="/community/general">
                모두의 게시판 보기
              </Link>
              <Link className="button" href="/community">
                커뮤니티 홈
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="community-write-sheet" aria-labelledby="sign-in-form-title">
          <div className="section-line-heading">
            <h2 id="sign-in-form-title">이메일로 로그인</h2>
            <span>MAGIC LINK</span>
          </div>
          <form className="community-composer" onSubmit={requestSignIn}>
            <label>
              이메일 주소
              <input
                autoComplete="email"
                inputMode="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
              <small>로그인 링크를 받을 수 있는 주소를 입력하세요.</small>
            </label>
            <div className="community-composer__actions">
              <button
                className="button button--primary"
                disabled={requestState === "sending" || requestState === "sent"}
                type="submit"
              >
                {requestState === "sending" ? "보내는 중" : "로그인 링크 받기"}
              </button>
              <Link className="button" href="/community/general">
                읽기만 계속하기
              </Link>
            </div>
            <p className="community-composer__feedback" aria-live="polite">
              {feedback}
            </p>
          </form>
        </section>
      )}
    </div>
  );
}
