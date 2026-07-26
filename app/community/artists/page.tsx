import type { Metadata } from "next";
import Link from "next/link";

import { CommunityBoardNav } from "../../components/CommunityBoardNav";
import { PageIntro } from "../../components/PageIntro";

export const metadata: Metadata = {
  title: "작가 인증 게시판",
  description:
    "작가 인증을 마친 사람만 읽고 쓸 수 있도록 설계된 문구작가 전용 자유게시판입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ArtistCommunityPage() {
  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="COMMUNITY / VERIFIED ARTISTS"
        title="작가 인증 게시판"
        description="행사 참가와 제작 실무처럼 공개하기 조심스러운 정보를 인증 작가끼리 나누는 자유게시판입니다."
      />

      <CommunityBoardNav current="artists" />

      <section className="community-lock" aria-labelledby="artist-lock-title">
        <p className="status-stamp">인증 확인 필요</p>
        <div>
          <h2 id="artist-lock-title">작가 인증을 확인한 뒤 열립니다.</h2>
          <p>
            현재 사이트에는 서버 계정과 작가 인증 시스템이 연결돼 있지
            않습니다. 그래서 게시글 제목, 본문, 작성자 정보까지 모두
            노출하지 않는 상태로 닫아 두었습니다.
          </p>
          <div className="intro-actions">
            <Link className="button button--primary" href="/community/verify">
              작가 인증 기준 확인
            </Link>
            <Link className="button" href="/community/general">
              모두의 게시판 보기
            </Link>
          </div>
        </div>
      </section>

      <section
        className="access-ledger"
        aria-labelledby="artist-access-title"
      >
        <div className="section-line-heading">
          <h2 id="artist-access-title">게시판 접근 기준</h2>
          <span>FAIL CLOSED</span>
        </div>
        <dl>
          <div>
            <dt>읽기</dt>
            <dd>작가 인증 세션이 있을 때만</dd>
          </div>
          <div>
            <dt>쓰기</dt>
            <dd>작가 인증 세션이 있을 때만</dd>
          </div>
          <div>
            <dt>현재 상태</dt>
            <dd>인증 백엔드 미연결로 잠금</dd>
          </div>
        </dl>
      </section>

      <aside className="boundary-note">
        <p className="stamp">배지의 뜻</p>
        <div>
          <h2>작가 인증은 정보 검증 배지가 아닙니다.</h2>
          <p>
            인증은 창작 활동 자격을 확인하는 신호입니다. 게시글의 사실성과
            거래 안전을 보증하지 않으며, 사실 정보는 원문과 확인 날짜를
            별도로 판단해야 합니다.
          </p>
        </div>
      </aside>
    </div>
  );
}
