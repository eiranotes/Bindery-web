import type { Metadata } from "next";
import Link from "next/link";

import { BinderClient } from "../components/BinderClient";

export const metadata: Metadata = {
  title: "My Binder",
  description:
    "관심 있는 행사 페이지를 계정 없이 이 기기에 모아 두는 개인 바인더입니다.",
};

export default function MyBinderPage() {
  return (
    <div className="page-shell binder-page">
      <header className="page-intro binder-intro">
        <p className="eyebrow">MY BINDER / DEVICE 01</p>
        <h1>My Binder</h1>
        <p className="page-lede">
          다음에 다시 볼 행사만 조용히 꽂아 두는 개인 페이지입니다.
        </p>
      </header>

      <aside className="trust-notice binder-privacy" aria-label="저장 방식 안내">
        <p className="utility-text">DEVICE LOCAL</p>
        <p>
          저장한 행사는 계정 없이 이 기기의 브라우저에만 남습니다. 브라우저
          데이터를 지우거나 다른 기기를 사용하면 이 목록은 이어지지 않습니다.
        </p>
      </aside>

      <BinderClient />

      <noscript>
        <section className="binder-empty">
          <div>
            <h2>바인더를 펼치려면 JavaScript가 필요합니다.</h2>
            <p>
              기기 안에 저장된 행사를 읽고 바로 빼는 기능에만 JavaScript를
              사용합니다.
            </p>
            <Link href="/events">행사 찾아보기</Link>
          </div>
        </section>
      </noscript>
    </div>
  );
}
